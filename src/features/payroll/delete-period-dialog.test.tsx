import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeletePeriodDialog } from "./delete-period-dialog"
import { payrollDeletionService } from "./services/payroll-deletion-service"
import { PayrollStatus } from "./period-status"
import type { PayrollPeriod } from "./types"

vi.mock("./services/payroll-deletion-service", () => ({
  payrollDeletionService: { isConfigured: vi.fn(), deletePeriod: vi.fn() },
}))
const period: PayrollPeriod = {
  a365_payrollperiodid: "11111111-1111-1111-1111-111111111111",
  a365_name: "Oct 16–31, 2026", a365_periodstart: "2026-10-16",
  a365_periodend: "2026-10-31", a365_paydate: "2026-10-31",
  a365_payrollstatus: PayrollStatus.Processing, statecode: 0,
}
function setup(isAdmin = true, status = PayrollStatus.Processing as PayrollPeriod["a365_payrollstatus"]) {
  const onClose = vi.fn(), onDeleted = vi.fn()
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><DeletePeriodDialog period={{ ...period, a365_payrollstatus: status }} isAdmin={isAdmin} onClose={onClose} onDeleted={onDeleted} /></QueryClientProvider>)
  return { onClose, onDeleted }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(payrollDeletionService.isConfigured).mockReturnValue(true)
  vi.mocked(payrollDeletionService.deletePeriod).mockResolvedValue(undefined)
})
describe("Payroll deletion confirmation", () => {
  it("names the period and its entries; opening and Cancel make no write", async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    expect(screen.getByText(/Delete Oct 16–31, 2026/)).toHaveTextContent("all its payroll entries")
    expect(payrollDeletionService.deletePeriod).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(payrollDeletionService.deletePeriod).not.toHaveBeenCalled()
  })
  it("Escape closes without deletion", async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledOnce()
    expect(payrollDeletionService.deletePeriod).not.toHaveBeenCalled()
  })
  it("requires confirmation, blocks duplicate clicks and dismissal until confirmed success", async () => {
    const user = userEvent.setup()
    let finish!: () => void
    vi.mocked(payrollDeletionService.deletePeriod).mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
    const { onClose, onDeleted } = setup()
    await user.dblClick(screen.getByRole("button", { name: "Delete payroll" }))
    expect(payrollDeletionService.deletePeriod).toHaveBeenCalledOnce()
    expect(payrollDeletionService.deletePeriod).toHaveBeenCalledWith({ periodId: period.a365_payrollperiodid, periodName: period.a365_name, operationId: expect.any(String) })
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
  })
  it("retains the confirmation and operation identity after an uncertain failure", async () => {
    const user = userEvent.setup()
    vi.mocked(payrollDeletionService.deletePeriod).mockRejectedValueOnce(new Error("Retry the same operation."))
    const { onDeleted } = setup()
    await user.click(screen.getByRole("button", { name: "Delete payroll" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Retry the same operation.")
    expect(onDeleted).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Delete payroll" }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    const calls = vi.mocked(payrollDeletionService.deletePeriod).mock.calls
    expect(calls[0][0].operationId).toBe(calls[1][0].operationId)
  })
  it.each([PayrollStatus.Ready, PayrollStatus.Locked])("blocks finalized status %s", (status) => {
    setup(true, status)
    expect(screen.getByRole("button", { name: "Delete payroll" })).toBeDisabled()
  })
  it("blocks non-admins", () => {
    setup(false)
    expect(screen.getByRole("button", { name: "Delete payroll" })).toBeDisabled()
  })
  it("explains missing backend setup and prevents deletion", () => {
    vi.mocked(payrollDeletionService.isConfigured).mockReturnValue(false)
    setup()
    expect(screen.getByRole("alert")).toHaveTextContent("Dataverse server setup")
    expect(screen.getByRole("button", { name: "Delete payroll" })).toBeDisabled()
  })
})
