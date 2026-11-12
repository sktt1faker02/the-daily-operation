import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PayslipReadyNotifications } from "./payslip-ready-notifications"
import { sendPayslipReadyNotifications, type PayslipNotificationReport } from "./services/payslip-ready-notification-service"

vi.mock("./services/payslip-ready-notification-service", () => ({ sendPayslipReadyNotifications: vi.fn() }))
const initial: PayslipNotificationReport = { periodId: "period", readyOn: "2026-10-26T08:00:00Z", recipients: [
  { entryId: "a", employeeId: "employee-a", name: "Employee A", status: "accepted", detail: "Accepted by sender." },
  { entryId: "b", employeeId: "employee-b", name: "Employee B", status: "missing-email", detail: "Work Email needed." },
] }
const busy = vi.fn()
function setup(report = initial) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><PayslipReadyNotifications initial={report} onSendingChange={busy} /></QueryClientProvider>)
}
beforeEach(() => vi.resetAllMocks())

describe("Payslip notification report", () => {
  it("does not send when mounted and retries only remaining recipients", async () => {
    const user = userEvent.setup()
    vi.mocked(sendPayslipReadyNotifications).mockResolvedValue({ ...initial, recipients: [{ ...initial.recipients[1], status: "accepted", detail: "Accepted." }] })
    setup()
    expect(sendPayslipReadyNotifications).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Retry remaining notifications" }))
    await screen.findByText("2 accepted by the sending service.")
    expect(sendPayslipReadyNotifications).toHaveBeenCalledExactlyOnceWith({ periodId: "period", expectedReadyOn: initial.readyOn, entryIds: ["b"] })
    expect(screen.queryByRole("button", { name: "Retry remaining notifications" })).not.toBeInTheDocument()
    expect(busy.mock.calls).toEqual([[true], [false]])
  })
  it("requires confirmation before retrying uncertain sends and blocks duplicate clicks", async () => {
    const user = userEvent.setup()
    let finish!: (report: PayslipNotificationReport) => void
    vi.mocked(sendPayslipReadyNotifications).mockReturnValue(new Promise(resolve => { finish = resolve }))
    setup({ ...initial, recipients: [initial.recipients[0], { ...initial.recipients[1], status: "unknown" }] })
    const retry = screen.getByRole("button", { name: "Retry remaining notifications" })
    expect(retry).toBeDisabled()
    await user.click(screen.getByRole("checkbox"))
    await user.dblClick(retry)
    expect(sendPayslipReadyNotifications).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled()
    finish({ ...initial, recipients: [{ ...initial.recipients[1], status: "accepted" }] })
    await screen.findByText("2 accepted by the sending service.")
  })
  it("keeps the original release identity after a failed retry", async () => {
    const user = userEvent.setup()
    vi.mocked(sendPayslipReadyNotifications).mockResolvedValue({ periodId: "period", readyOn: "new-release", recipients: [], error: "Release changed" })
    setup()
    await user.click(screen.getByRole("button", { name: "Retry remaining notifications" }))
    await screen.findByRole("alert")
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry remaining notifications" })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: "Retry remaining notifications" }))
    expect(vi.mocked(sendPayslipReadyNotifications).mock.calls[1][0].expectedReadyOn).toBe(initial.readyOn)
    expect(screen.getByText("Employee A")).toBeInTheDocument()
  })
  it("shows a retryable lookup failure", () => {
    setup({ periodId: "period", recipients: [], error: "Unable to read recipients" })
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to read recipients")
    expect(screen.getByRole("button", { name: "Retry remaining notifications" })).toBeEnabled()
  })
  it("explains a verified empty included list without offering a resend", () => {
    setup({ periodId: "period", recipients: [] })
    expect(screen.getByText("No included employees to notify.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry remaining notifications" })).not.toBeInTheDocument()
    expect(sendPayslipReadyNotifications).not.toHaveBeenCalled()
  })
})
