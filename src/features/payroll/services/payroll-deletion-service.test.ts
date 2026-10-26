import { afterEach, describe, expect, it, vi } from "vitest"
import { A365_DeletePayrollPeriodService } from "@/generated/services/A365_DeletePayrollPeriodService"
import { A365_DeletePayrollEntryService } from "@/generated/services/A365_DeletePayrollEntryService"
import { payrollDeletionService } from "./payroll-deletion-service"

vi.mock("@/generated/services/A365_DeletePayrollPeriodService", () => ({ A365_DeletePayrollPeriodService: { a365_DeletePayrollPeriod: vi.fn() } }))
vi.mock("@/generated/services/A365_DeletePayrollEntryService", () => ({ A365_DeletePayrollEntryService: { a365_DeletePayrollEntry: vi.fn() } }))
const input = { periodId: "11111111-1111-1111-1111-111111111111", periodName: "Oct 16–31, 2026", operationId: "22222222-2222-2222-2222-222222222222" }
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })
describe("Payroll deletion transport", () => {
  it("makes no request when the generated API binding is absent", async () => {
    vi.spyOn(payrollDeletionService, "isConfigured").mockReturnValue(false)
    await expect(payrollDeletionService.deletePeriod(input)).rejects.toThrow("server setup")
    expect(A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod).not.toHaveBeenCalled()
  })
  it("sends one command with the confirmation identity and verifies the response", async () => {
    vi.spyOn(payrollDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ ...input, deleted: true }) } })
    await payrollDeletionService.deletePeriod(input)
    expect(A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod).toHaveBeenCalledExactlyOnceWith(JSON.stringify(input))
  })
  it.each([
    { success: false, data: {} },
    { success: true, data: {} },
    { success: true, data: { Response: "invalid json" } },
    { success: true, data: { Response: JSON.stringify({ ...input, periodId: "another-period", deleted: true }) } },
  ])("treats a failed or mismatched response as unconfirmed", async (result) => {
    vi.spyOn(payrollDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod).mockResolvedValue(result)
    await expect(payrollDeletionService.deletePeriod(input)).rejects.toThrow("Deletion could not be confirmed")
  })
  it("uses the entry API and validates the entry identity", async () => {
    const request = { ...input, entryId: "entry", employeeId: "employee", employeeName: "Synthetic Employee" }
    vi.spyOn(payrollDeletionService, "isConfigured").mockReturnValue(true)
    vi.mocked(A365_DeletePayrollEntryService.a365_DeletePayrollEntry).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ ...request, deleted: true }) } })
    await payrollDeletionService.deleteEntry(request)
    expect(A365_DeletePayrollEntryService.a365_DeletePayrollEntry).toHaveBeenCalledExactlyOnceWith(JSON.stringify(request))
    expect(A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod).not.toHaveBeenCalled()
  })
})
