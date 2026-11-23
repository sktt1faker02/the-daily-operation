import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PayrollEntryTable } from "./payroll-entry-table"
import type { PayrollEntry } from "./types"

function entry(id: string, name: string, number?: string | null): PayrollEntry {
  return {
    a365_payrollentryid: id, a365_name: name, a365_employeename: name,
    a365_employeenumber: number, a365_isincluded: true, _a365_employee_value: id,
    a365_basicpay: 1000, a365_allowances: 0, a365_otherearnings: 0,
    a365_otherdeductions: 0, a365_unpaidleavedays: 0, a365_grosspay: 1000,
    a365_sss: 0, a365_philhealth: 0, a365_hdmf: 0, a365_unpaidleave: 0,
    a365_withholdingtax: 0, a365_totaldeductions: 0, a365_netpay: 1000,
    a365_calculatedon: null, a365_comment: null,
  }
}

const entries = [
  entry("a", "Alice", "EMP-10"),
  entry("b", "Zoe", "EMP-2"),
  entry("c", "Maria", "EMP-001"),
]
const rowNames = () => screen.getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell")[0].textContent)

describe("PayrollEntryTable employee order", () => {
  it.each([true, false])("sorts by hidden employee number with editable=%s and keeps actions on their rows", async editable => {
    const onEdit = vi.fn(), onViewPayslip = vi.fn()
    const originalOrder = [...entries]
    render(<PayrollEntryTable entries={entries} editable={editable} onEdit={onEdit} onViewPayslip={onViewPayslip} />)
    expect(rowNames()).toEqual(["Maria", "Zoe", "Alice"])
    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
      "Employee", "Basic Pay", "Allowances", "Gross", "Deductions", "Net Pay", "Actions",
    ])
    expect(screen.queryByText("EMP-001")).not.toBeInTheDocument()
    expect(entries).toEqual(originalOrder)
    await userEvent.setup().click(screen.getByRole("button", { name: editable ? "Edit Zoe" : "View payslip for Zoe" }))
    expect(editable ? onEdit : onViewPayslip).toHaveBeenCalledWith(entries[1])
  })

  it("keeps filtered and refreshed entries in employee-number order", () => {
    const props = { editable: false, onEdit: vi.fn() }
    const { rerender } = render(<PayrollEntryTable {...props} entries={entries} />)
    rerender(<PayrollEntryTable {...props} entries={entries.filter(row => row.a365_employeename !== "Maria")} />)
    expect(rowNames()).toEqual(["Zoe", "Alice"])
    rerender(<PayrollEntryTable {...props} entries={[...entries].reverse()} />)
    expect(rowNames()).toEqual(["Maria", "Zoe", "Alice"])
  })

  it("puts missing numbers last and resolves duplicate numbers consistently", () => {
    const rows = [entry("d", "Missing"), entry("c", "Blank", "  "), entry("b", "Second", "0001"), entry("a", "First", "0001"), entry("e", "Null", null)]
    render(<PayrollEntryTable entries={rows} editable={false} onEdit={vi.fn()} />)
    expect(rowNames()).toEqual(["First", "Second", "Blank", "Missing", "Null"])
  })
})
