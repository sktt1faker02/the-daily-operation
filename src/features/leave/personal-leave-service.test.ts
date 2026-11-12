import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { personalLeaveService } from "./personal-leave-service"
import { calculateBalances } from "./rules"
import type { LeaveFilters } from "./types"

vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
const employeeId = "10000000-0000-0000-0000-000000000001"
const foreignId = "20000000-0000-0000-0000-000000000002"
const recordId = "30000000-0000-0000-0000-000000000003"
const filters: LeaveFilters = { section: "leave", employeeId, year: 2026, search: "O'Brien", status: "749910000", type: "749910002", benefit: "749910001" }
const record = { a365_leaveid: recordId, _a365_employee_value: employeeId, a365_name: "Own leave", a365_leavetype: 749910002, a365_benefit: 749910001, a365_days: 1, a365_leavestatus: 749910000, a365_startdate: "2026-10-27", a365_enddate: "2026-10-27" }
function response(rows: unknown[], extra = {}) { return { success: true, data: { Response: JSON.stringify({ employeeId, employeeName: "Own Employee", rows, ...extra }) } } }
beforeEach(() => vi.resetAllMocks())

describe("personal Leave API boundary", () => {
  it("sends all filters with own scope and preserves paging", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(response([record], { next: "3" }))
    const result = await personalLeaveService.list(filters, "2")
    expect(JSON.parse(vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mock.calls[0][0])).toEqual({ command: "myLeaves", employeeId, year: 2026, search: "O'Brien", status: "749910000", leaveType: 749910002, benefit: 749910001, cursor: "2" })
    expect(result).toMatchObject({ leaves: [record], employees: [{ a365_employeeid: employeeId }], next: "3" })
  })
  it("never makes an unrestricted query for a missing employee", async () => {
    await expect(personalLeaveService.list({ ...filters, employeeId: "" })).rejects.toThrow()
    expect(A365_LeaveCommandService.a365_LeaveCommand).not.toHaveBeenCalled()
  })
  it.each([{ employeeId: foreignId }, { rows: [{ ...record, _a365_employee_value: foreignId }] }, { rows: [{ ...record, a365_days: null }] }, { next: "not-a-page" }])("rejects inconsistent responses: %j", async extra => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(response([record], extra))
    await expect(personalLeaveService.list(filters)).rejects.toThrow()
  })
  it("loads every ledger page and uses the same balance calculation as admin", async () => {
    const credit = { a365_leavecredittransactionid: recordId, _a365_employee_value: employeeId, a365_year: 2026, a365_creditpool: 749910000 as const, a365_days: 4.17 }
    const deduction = { ...credit, a365_leavecredittransactionid: foreignId, a365_days: -1 }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValueOnce(response([credit], { next: "2" })).mockResolvedValueOnce(response([deduction]))
    expect(await personalLeaveService.balances(employeeId, 2026)).toEqual(calculateBalances([credit, deduction], employeeId, 2026))
    expect(JSON.parse(vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mock.calls[1][0])).toEqual({ command: "myCredits", employeeId, year: 2026, cursor: "2" })
  })
  it("fails rather than displaying a partial or repeated ledger", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(response([], { next: "2" }))
    await expect(personalLeaveService.balances(employeeId, 2026)).rejects.toThrow()
  })
  it("does not turn a failed read into a zero balance or leak backend errors", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: false, data: {}, error: { message: "PRIVATE BACKEND DETAILS" } })
    await expect(personalLeaveService.balances(employeeId, 2026)).rejects.toThrow("Unable to read your leave history")
    await expect(personalLeaveService.detail(employeeId, recordId)).rejects.not.toThrow("PRIVATE BACKEND DETAILS")
  })
  it("validates own detail identity even if a different record is returned", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(response([record]))
    await expect(personalLeaveService.detail(employeeId, foreignId)).rejects.toThrow()
    expect((await personalLeaveService.detail(employeeId, recordId)).record).toEqual(record)
  })
})
