import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_leavesService } from "@/generated/services/A365_leavesService"
import type { A365_leaves } from "@/generated/models/A365_leavesModel"
import { payrollUnpaidLeaveService, unpaidLeaveDaysForPeriod, type PayrollLeave } from "./payroll-unpaid-leave"
vi.mock("@/generated/services/A365_leavesService", () => ({ A365_leavesService: { getAll: vi.fn() } }))
const id = "10000000-0000-0000-0000-000000000001"
const row = (overrides: Partial<PayrollLeave> = {}): PayrollLeave => ({ a365_leaveid: "leave-1", _a365_employee_value: id, a365_startdate: "2026-10-22", a365_enddate: "2026-10-23", a365_days: 2, a365_leavestatus: 749910000, a365_benefit: 749910001, ...overrides })
beforeEach(() => vi.clearAllMocks())
describe("unpaidLeaveDaysForPeriod", () => {
  it("fills the owner's October 16–31 cutoff with 2 days", () => expect(unpaidLeaveDaysForPeriod([row()], id, "2026-10-16", "2026-10-31")).toBe(2))
  it("allocates only workdays within a cutoff boundary", () => expect(unpaidLeaveDaysForPeriod([row({ a365_startdate: "2026-10-15", a365_enddate: "2026-10-19", a365_days: 3 })], id, "2026-10-16", "2026-10-31")).toBe(2))
  it("ignores paid, cancelled and other employees", () => expect(unpaidLeaveDaysForPeriod([row({ a365_benefit: 749910000 }), row({ a365_leavestatus: 749910001 }), row({ _a365_employee_value: "other" })], id, "2026-10-16", "2026-10-31")).toBe(0))
  it("handles half days and date-only timezone serialization", () => expect(unpaidLeaveDaysForPeriod([row({ a365_startdate: "2026-10-22T00:00:00+14:00", a365_enddate: "2026-10-22", a365_days: 0.5 })], id, "2026-10-16", "2026-10-31")).toBe(0.5))
  it("excludes weekends and approved holidays", () => expect(unpaidLeaveDaysForPeriod([row({ a365_startdate: "2026-12-23", a365_enddate: "2026-12-28", a365_days: 2 })], id, "2026-12-16", "2026-12-31")).toBe(2))
  it("does not silently guess inconsistent stored days", () => expect(() => unpaidLeaveDaysForPeriod([row({ a365_days: 1 })], id, "2026-10-16", "2026-10-31")).toThrow("review"))
  it("rejects duplicate sources", () => expect(() => unpaidLeaveDaysForPeriod([row(), row()], id, "2026-10-16", "2026-10-31")).toThrow("Duplicate"))
})
it("reads all pages using issued/unpaid employee/date filters", async () => {
  vi.mocked(A365_leavesService.getAll).mockResolvedValueOnce({ success: true, data: [], skipToken: "next" }).mockResolvedValueOnce({ success: true, data: [row() as A365_leaves] })
  expect((await payrollUnpaidLeaveService.daysForEmployees([id], "2026-10-16", "2026-10-31")).get(id)).toBe(2)
  expect(A365_leavesService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ skipToken: "next", filter: expect.stringContaining(`_a365_employee_value eq ${id}`) }))
})
it("fails closed on a Leave read error", async () => {
  vi.mocked(A365_leavesService.getAll).mockResolvedValue({ success: false, data: [], error: new Error("private") })
  await expect(payrollUnpaidLeaveService.daysForEmployees([id], "2026-10-16", "2026-10-31")).rejects.toThrow("Unable to load unpaid leave")
})
