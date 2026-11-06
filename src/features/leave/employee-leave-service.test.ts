import { beforeEach, expect, it, vi } from "vitest"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { employeeLeaveService } from "./employee-leave-service"

vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
const id = "10000000-0000-0000-0000-000000000001"
const data = { employeeId: id, year: 2026, eligible: true, VL: 8.33, SL: 5, conversionAdded: true }
const success = (value: unknown) => ({ success: true, data: { Response: JSON.stringify(value) } })
beforeEach(() => vi.resetAllMocks())
it("uses the existing API with employee/year and verifies saved credits", async () => {
  vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success(data))
  await expect(employeeLeaveService.sync(id, 2026)).resolves.toEqual(data)
  expect(JSON.parse(vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mock.calls[0][0])).toEqual({ command: "syncEmployee", employeeId: id, year: 2026 })
})
it.each([{ ...data, employeeId: "other" }, { ...data, year: 2027 }, { ...data, VL: null }, { ...data, conversionAdded: undefined }])("rejects unconfirmed outcomes", async value => {
  vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success(value))
  await expect(employeeLeaveService.sync(id, 2026)).rejects.toThrow("Retry Sync leave credits")
})
it("explains an undeployed server update and hides raw backend details", async () => {
  vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValueOnce(new Error("LEAVE: Unknown Leave command."))
  await expect(employeeLeaveService.sync(id, 2026)).rejects.toThrow("server update is required")
  vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValueOnce(new Error("private record details"))
  await expect(employeeLeaveService.sync(id, 2026)).rejects.toThrow("do not create another employee")
})
