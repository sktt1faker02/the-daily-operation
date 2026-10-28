import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeleteEmployeeDialog } from "./delete-employee-dialog"
import { EmployeeTable } from "./employee-table"
import { employeeDeletionService } from "./employee-deletion-service"
import { employeeKeys } from "./use-employees"
import type { Employee } from "./types"

vi.mock("./employee-deletion-service", () => ({ employeeDeletionService: { isConfigured: vi.fn(), deleteEmployee: vi.fn() } }))
const employee: Employee = {
  a365_employeeid: "11111111-1111-1111-1111-111111111111", a365_employeenumber: "TEST-001", a365_name: "Synthetic Employee",
  a365_firstname: "Synthetic", a365_lastname: "Employee", a365_middlename: null, a365_workemail: null,
  _a365_department_value: null, _a365_position_value: null, a365_employmentstatus: null, a365_employmenttype: null,
  a365_datehired: null, a365_enddate: null, a365_basicmonthlysalary: null, a365_payrollfrequency: null,
  a365_sssnumber: null, a365_philhealthnumber: null, a365_hdmfnumber: null, a365_tin: null,
  a365_paymentmethod: null, a365_bankname: null, a365_bankaccountnumber: null, _a365_systemuser_value: null,
}
function setup(isAdmin = true) {
  const client = new QueryClient(), onClose = vi.fn(), onDeleted = vi.fn()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><DeleteEmployeeDialog employee={employee} isAdmin={isAdmin} onClose={onClose} onDeleted={onDeleted} /></QueryClientProvider>)
  return { onClose, onDeleted, invalidate }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(employeeDeletionService.isConfigured).mockReturnValue(true)
  vi.mocked(employeeDeletionService.deleteEmployee).mockResolvedValue(undefined)
})
describe("Employee deletion", () => {
  it("names the employee and warns about history; Cancel makes no write", async () => {
    const user = userEvent.setup(), { onClose } = setup()
    expect(screen.getByText(/Permanently delete Synthetic Employee/)).toHaveTextContent("TEST-001")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(employeeDeletionService.deleteEmployee).not.toHaveBeenCalled()
  })
  it("deletes only after confirmation and refreshes the employee caches", async () => {
    const user = userEvent.setup(), { onDeleted, invalidate } = setup()
    expect(employeeDeletionService.deleteEmployee).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Delete employee" }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(employeeDeletionService.deleteEmployee).toHaveBeenCalledWith({ employeeId: employee.a365_employeeid, employeeName: employee.a365_name, operationId: expect.any(String) })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: employeeKeys.all })
  })
  it("retains the dialog and presents the server history restriction", async () => {
    vi.mocked(employeeDeletionService.deleteEmployee).mockRejectedValue(new Error("Employee has payroll history. Set to Inactive instead."))
    const user = userEvent.setup(), { onDeleted } = setup()
    await user.click(screen.getByRole("button", { name: "Delete employee" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Inactive")
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeVisible()
  })
  it("blocks non-admin deletion", () => {
    setup(false)
    expect(screen.getByRole("button", { name: "Delete employee" })).toBeDisabled()
  })
  it("uses icon-only Edit and Delete with hover labels and row-specific callbacks", async () => {
    const user = userEvent.setup(), onEdit = vi.fn(), onDelete = vi.fn()
    render(<EmployeeTable employees={[employee]} onEdit={onEdit} onDelete={onDelete} departmentNames={new Map()} positionNames={new Map()} />)
    const edit = screen.getByRole("button", { name: "Edit Synthetic Employee" })
    expect(edit).toHaveAttribute("title", "Edit")
    expect(edit.textContent).toBe("")
    const remove = screen.getByRole("button", { name: "Delete Synthetic Employee" })
    expect(remove).toHaveAttribute("title", "Delete employee")
    await user.click(edit)
    expect(onEdit).toHaveBeenCalledWith(employee)
    await user.click(remove)
    expect(onDelete).toHaveBeenCalledWith(employee)
  })
})
