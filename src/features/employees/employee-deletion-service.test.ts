import { afterEach, describe, expect, it, vi } from "vitest"
import { A365_DeleteEmployeeService } from "@/generated/services/A365_DeleteEmployeeService"
import { employeeDeletionService } from "./employee-deletion-service"

vi.mock("@/generated/services/A365_DeleteEmployeeService", () => ({ A365_DeleteEmployeeService: { a365_DeleteEmployee: vi.fn() } }))
const input = { employeeId: "11111111-1111-1111-1111-111111111111", employeeName: "Synthetic Employee", operationId: "22222222-2222-2222-2222-222222222222" }
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })
describe("Employee deletion transport", () => {
  it("uses its generated employee API and validates the committed identity", async () => {
    vi.spyOn(employeeDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeleteEmployeeService.a365_DeleteEmployee).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ ...input, deleted: true }) } })
    await employeeDeletionService.deleteEmployee(input)
    expect(A365_DeleteEmployeeService.a365_DeleteEmployee).toHaveBeenCalledExactlyOnceWith(JSON.stringify(input))
  })
  it("reports only the recognized server restriction for linked history", async () => {
    vi.spyOn(employeeDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeleteEmployeeService.a365_DeleteEmployee).mockRejectedValue(new Error("internal details PAYROLL_DELETE: This employee has payroll, leave or template records and cannot be deleted. Set the employee to Inactive instead to preserve history. more internal details"))
    await expect(employeeDeletionService.deleteEmployee(input)).rejects.toThrow(/^This employee has payroll, leave or template records and cannot be deleted\. Set the employee to Inactive instead to preserve history\.$/)
  })
  it("rejects another employee's response", async () => {
    vi.spyOn(employeeDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeleteEmployeeService.a365_DeleteEmployee).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ ...input, employeeId: "another-employee", deleted: true }) } })
    await expect(employeeDeletionService.deleteEmployee(input)).rejects.toThrow("could not be confirmed")
  })
})
