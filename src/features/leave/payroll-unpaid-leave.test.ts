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
  it("counts only the one unpaid day from a five-day, four-credit leave", () => {
    const days = [26, 27, 28, 29, 30].map((date, index) => ({ date: `2026-10-${date}`, paidDays: index < 4 ? 1 : 0, unpaidDays: index < 4 ? 0 : 1 }))
    const split = row({ a365_benefit: 749910002, a365_startdate: "2026-10-26", a365_enddate: "2026-10-30", a365_days: 5, a365_paiddays: 4, a365_unpaiddays: 1, a365_allocationjson: JSON.stringify({ version: 1, days }) })
    expect(unpaidLeaveDaysForPeriod([split], id, "2026-10-16", "2026-10-31")).toBe(1)
    expect(unpaidLeaveDaysForPeriod([split], id, "2026-10-26", "2026-10-29")).toBe(0)
    expect(unpaidLeaveDaysForPeriod([split], id, "2026-10-30", "2026-10-31")).toBe(1)
    expect(() => unpaidLeaveDaysForPeriod([{ ...split, a365_allocationjson: undefined }], id, "2026-10-16", "2026-10-31")).toThrow("review")
  })
  it("splits fractional unpaid portions across cutoffs using the saved dates", () => {
    const days = [{ date: "2026-10-15", paidDays: 0.75, unpaidDays: 0.25 }, { date: "2026-10-16", paidDays: 0, unpaidDays: 1 }]
    const split = row({ a365_benefit: 749910002, a365_startdate: "2026-10-15", a365_enddate: "2026-10-16", a365_days: 2, a365_paiddays: 0.75, a365_unpaiddays: 1.25, a365_allocationjson: JSON.stringify({ version: 1, days }) })
    expect(unpaidLeaveDaysForPeriod([split], id, "2026-10-01", "2026-10-15")).toBe(0.25)
    expect(unpaidLeaveDaysForPeriod([split], id, "2026-10-16", "2026-10-31")).toBe(1)
    expect(unpaidLeaveDaysForPeriod([{ ...split, a365_leavestatus: 749910001 }], id, "2026-10-01", "2026-10-31")).toBe(0)
  })
  it("does not use the current holiday calendar to recalculate saved allocations", () => {
    const split = row({ a365_startdate: "2027-02-01", a365_enddate: "2027-02-01", a365_days: 1, a365_paiddays: 0, a365_unpaiddays: 1,
      a365_allocationjson: JSON.stringify({ version: 1, days: [{ date: "2027-02-01", paidDays: 0, unpaidDays: 1 }] }) })
    expect(unpaidLeaveDaysForPeriod([split], id, "2027-02-01", "2027-02-15")).toBe(1)
  })
})
it("reads all pages using issued/unpaid employee/date filters", async () => {
  vi.mocked(A365_leavesService.getAll).mockResolvedValueOnce({ success: true, data: [], skipToken: "next" }).mockResolvedValueOnce({ success: true, data: [row() as A365_leaves] })
  expect((await payrollUnpaidLeaveService.daysForEmployees([id], "2026-10-16", "2026-10-31")).get(id)).toBe(2)
  expect(A365_leavesService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ skipToken: "next", filter: expect.stringContaining(`_a365_employee_value eq ${id}`) }))
  expect(A365_leavesService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.arrayContaining(["a365_paiddays", "a365_unpaiddays", "a365_allocationjson"]), filter: expect.stringContaining("or a365_benefit eq 749910002") }))
})
it("fails closed on a Leave read error", async () => {
  vi.mocked(A365_leavesService.getAll).mockResolvedValue({ success: false, data: [], error: new Error("private") })
  await expect(payrollUnpaidLeaveService.daysForEmployees([id], "2026-10-16", "2026-10-31")).rejects.toThrow("Unable to load unpaid leave")
})
