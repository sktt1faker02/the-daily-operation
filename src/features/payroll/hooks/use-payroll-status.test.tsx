import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { usePayrollStatusTransition } from "./use-payroll-status"
import { PayrollStatus } from "../period-status"
import { payrollPeriodService } from "../services/payroll-period-service"
import { sendPayslipReadyNotifications } from "../services/payslip-ready-notification-service"

vi.mock("../services/payroll-period-service", () => ({ payrollPeriodService: { transitionStatus: vi.fn() } }))
vi.mock("../services/payslip-ready-notification-service", () => ({ sendPayslipReadyNotifications: vi.fn() }))
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return renderHook(() => usePayrollStatusTransition("period"), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}
beforeEach(() => vi.resetAllMocks())

describe("Mark Ready email orchestration", () => {
  it("waits for a confirmed Ready transition before dispatching notifications", async () => {
    let confirm!: () => void
    vi.mocked(payrollPeriodService.transitionStatus).mockReturnValue(new Promise(resolve => { confirm = resolve }))
    const report = { periodId: "period", recipients: [], error: "Email lookup failed" }
    vi.mocked(sendPayslipReadyNotifications).mockResolvedValue(report)
    const { result } = setup()
    let done!: Promise<unknown>
    await act(async () => { done = result.current.mutateAsync({ to: PayrollStatus.Ready, userId: "admin" }) })
    await waitFor(() => expect(payrollPeriodService.transitionStatus).toHaveBeenCalledOnce())
    expect(sendPayslipReadyNotifications).not.toHaveBeenCalled()
    await act(async () => { confirm(); expect(await done).toEqual(report) })
    expect(sendPayslipReadyNotifications).toHaveBeenCalledExactlyOnceWith({ periodId: "period" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
  it("does not send if Mark Ready fails, and never automatically retries the action", async () => {
    vi.mocked(payrollPeriodService.transitionStatus).mockRejectedValue(new Error("Status update failed"))
    const { result } = setup()
    await act(async () => { await expect(result.current.mutateAsync({ to: PayrollStatus.Ready, userId: "admin" })).rejects.toThrow("Status update failed") })
    expect(payrollPeriodService.transitionStatus).toHaveBeenCalledOnce()
    expect(sendPayslipReadyNotifications).not.toHaveBeenCalled()
  })
  it.each([PayrollStatus.Locked, PayrollStatus.Processing])("does not send for transition %s", async to => {
    vi.mocked(payrollPeriodService.transitionStatus).mockResolvedValue(undefined)
    const { result } = setup()
    await act(async () => { expect(await result.current.mutateAsync({ to, userId: "admin" })).toBeNull() })
    expect(sendPayslipReadyNotifications).not.toHaveBeenCalled()
  })
})
