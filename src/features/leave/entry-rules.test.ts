import { describe, expect, it } from "vitest"
import { creditTreatment, emptyLeaveEntry, formatCreditDays, leaveCreditPool, validateLeaveEntry } from "./entry-rules"

const valid = {
  employee: { a365_employeeid: "10000000-0000-0000-0000-000000000001", a365_name: "Test Employee" },
  leaveType: "749910002", benefit: "749910000", startDate: "2026-10-22", endDate: "2026-10-23", note: "",
}

describe("Leave entry validation", () => {
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
  it("maps Emergency to VL and never deducts credits for Unpaid", () => {
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
