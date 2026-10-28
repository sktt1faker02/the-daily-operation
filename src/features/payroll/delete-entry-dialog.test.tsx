import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeleteEntryDialog } from "./delete-entry-dialog"
import { PayrollEntryTable } from "./payroll-entry-table"
import { payrollDeletionService } from "./services/payroll-deletion-service"
import { PayrollStatus } from "./period-status"
import { payrollKeys } from "./hooks/use-payroll-periods"
import type { PayrollEntry, PayrollPeriod } from "./types"

vi.mock("./services/payroll-deletion-service", () => ({ payrollDeletionService: { isConfigured: vi.fn(), deleteEntry: vi.fn() } }))
const entry: PayrollEntry = {
  a365_payrollentryid: "entry", a365_name: "Synthetic entry", a365_employeename: "Synthetic Employee", _a365_employee_value: "employee", a365_isincluded: true,
  a365_basicpay: 1000, a365_allowances: 0, a365_otherearnings: 0, a365_otherdeductions: 0, a365_unpaidleavedays: 0, a365_grosspay: 1000,
  a365_sss: 0, a365_philhealth: 0, a365_hdmf: 0, a365_unpaidleave: 0, a365_withholdingtax: 0, a365_totaldeductions: 0, a365_netpay: 1000, a365_calculatedon: null, a365_comment: null,
}
const period: PayrollPeriod = { a365_payrollperiodid: "period", a365_name: "Synthetic cutoff", a365_periodstart: "2026-10-16", a365_periodend: "2026-10-31", a365_paydate: "2026-10-31", a365_payrollstatus: PayrollStatus.Processing }
function setup(status: PayrollPeriod["a365_payrollstatus"] = PayrollStatus.Processing) {
  const client = new QueryClient(), onClose = vi.fn(), onDeleted = vi.fn()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><DeleteEntryDialog entry={entry} period={{ ...period, a365_payrollstatus: status }} isAdmin onClose={onClose} onDeleted={onDeleted} /></QueryClientProvider>)
  return { onClose, onDeleted, invalidate }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(payrollDeletionService.isConfigured).mockReturnValue(true)
  vi.mocked(payrollDeletionService.deleteEntry).mockResolvedValue(undefined)
})
describe("Payroll entry removal", () => {
  it("names both employee and cutoff; Cancel makes no write", async () => {
    const user = userEvent.setup(), { onClose } = setup()
    expect(screen.getByText(/Delete the payroll entry for Synthetic Employee from Synthetic cutoff/)).toHaveTextContent("master record")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(payrollDeletionService.deleteEntry).not.toHaveBeenCalled()
  })
  it("confirms only the selected entry and refreshes payroll rows and totals", async () => {
    const user = userEvent.setup(), { onDeleted, invalidate } = setup()
    await user.click(screen.getByRole("button", { name: "Delete payroll entry" }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(payrollDeletionService.deleteEntry).toHaveBeenCalledWith({ periodId: "period", periodName: "Synthetic cutoff", entryId: "entry", employeeId: "employee", employeeName: "Synthetic Employee", operationId: expect.any(String) })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: payrollKeys.all })
  })
  it.each([PayrollStatus.Ready, PayrollStatus.Locked])("blocks finalized entries (%s)", (status) => {
    setup(status)
    expect(screen.getByRole("button", { name: "Delete payroll entry" })).toBeDisabled()
  })
  it("uses icon-only Edit and Delete with accessible hover labels", async () => {
    const user = userEvent.setup(), onEdit = vi.fn(), onDelete = vi.fn()
    render(<PayrollEntryTable entries={[entry]} editable onEdit={onEdit} onDelete={onDelete} />)
    const edit = screen.getByRole("button", { name: "Edit Synthetic Employee" })
    expect(edit).toHaveAttribute("title", "Edit")
    expect(edit.textContent).toBe("")
    await user.click(edit)
    expect(onEdit).toHaveBeenCalledWith(entry)
    const remove = screen.getByRole("button", { name: "Delete payroll entry for Synthetic Employee" })
    expect(remove).toHaveAttribute("title", "Delete payroll entry")
    await user.click(remove)
    expect(onDelete).toHaveBeenCalledWith(entry)
  })
  it("does not offer deletion for finalized payroll rows", () => {
    render(<PayrollEntryTable entries={[entry]} editable={false} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /Delete payroll entry/ })).not.toBeInTheDocument()
  })
})
