import { describe, expect, it } from "vitest"
import { creditTreatment, emptyLeaveEntry, formatCreditDays, leaveCreditPool, validateLeaveEntry } from "./entry-rules"

const valid = {
  employee: { a365_employeeid: "10000000-0000-0000-0000-000000000001", a365_name: "Test Employee" },
  leaveType: "749910002", benefit: "749910000", startDate: "2026-10-22", endDate: "2026-10-23", note: "",
}

describe("Leave entry validation", () => {
  it.each(["", "-0.5", "0.001", "NaN", "1e2", "367"])("rejects invalid manual Paid days %s", manualPaidDays => {
    expect(validateLeaveEntry({ ...valid, manualPaidDays }).manualPaidDays).toBeTruthy()
  })
  it("accepts explicit paid portions only with the Paid benefit", () => {
    for (const manualPaidDays of ["0", "0.5", "1.25"]) expect(validateLeaveEntry({ ...valid, manualPaidDays })).toEqual({})
    expect(validateLeaveEntry({ ...valid, benefit: "749910001", manualPaidDays: "0.5" }).manualPaidDays).toContain("Select Paid")
  })
  it.each(["749910000", "749910001", "749910002"])("allows half-day leave type %s on a single date", leaveType => {
    const halfDay = { ...valid, halfDay: true, leaveType, endDate: valid.startDate }
    expect(validateLeaveEntry(halfDay)).toEqual({})
    expect(validateLeaveEntry({ ...halfDay, leaveType: "unknown" }).leaveType).toBeTruthy()
    expect(validateLeaveEntry({ ...halfDay, endDate: "2026-10-23" }).endDate).toContain("same date")
  })
  it("requires a real employee, known numeric choices and both dates", () => {
    expect(Object.keys(validateLeaveEntry(emptyLeaveEntry()))).toEqual(["employee", "leaveType", "benefit", "startDate", "endDate"])
    expect(validateLeaveEntry(valid)).toEqual({})
    expect(validateLeaveEntry({ ...valid, leaveType: "Approved" }).leaveType).toBeTruthy()
    expect(validateLeaveEntry({ ...valid, benefit: "Paid" }).benefit).toBeTruthy()
  })
  it.each(["2026-02-30", "2026-13-01", "2026-10-22T00:00:00Z", "22/10/2026"])("rejects invalid or non-local date input %s", startDate => {
    expect(validateLeaveEntry({ ...valid, startDate }).startDate).toBeTruthy()
  })
  it("rejects reversed dates and oversized notes without inventing leave-day rules", () => {
    expect(validateLeaveEntry({ ...valid, endDate: "2026-10-21" }).endDate).toBe("End Date cannot precede Start Date.")
    expect(validateLeaveEntry({ ...valid, endDate: valid.startDate })).toEqual({})
    expect(validateLeaveEntry({ ...valid, note: "x".repeat(2001) }).note).toBeTruthy()
  })
  it("maps General Leave to VL and never deducts credits for Unpaid", () => {
    expect(leaveCreditPool("749910002")).toBe("VL")
    expect(leaveCreditPool("749910001")).toBe("SL")
    expect(leaveCreditPool("")).toBeNull()
    expect(creditTreatment("749910001", "VL")).toBe("Unpaid leave creates no credit deduction.")
    expect(creditTreatment("749910000", "VL")).toContain("Paid leave uses VL")
    expect(creditTreatment("", "VL")).toContain("Select a leave type")
  })
  it("formats credit amounts to exactly two decimal places", () => {
    expect(formatCreditDays(5)).toBe("5.00")
    expect(formatCreditDays(-0.5)).toBe("-0.50")
  })
})
