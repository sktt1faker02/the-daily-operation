import { describe, expect, it } from "vitest"
import { buildRecordedLeaveEmail } from "./notification-template"
import type { LeaveRecord } from "./types"

const employee = { a365_employeeid: "10000000-0000-0000-0000-000000000001", a365_name: "Test <Employee>", a365_workemail: "test@example.invalid" }
const record: LeaveRecord = {
  a365_leaveid: "20000000-0000-0000-0000-000000000002", a365_name: "Test leave",
  _a365_employee_value: employee.a365_employeeid, a365_leavetype: 749910002, a365_benefit: 749910001,
  a365_startdate: "2026-10-22T00:00:00+14:00", a365_enddate: "2026-10-23", a365_days: 1.5,
  a365_leavestatus: 749910000, a365_issuedon: "2026-10-22T00:00:00Z", a365_note: "Private internal note",
}

describe("Recorded Leave email composition", () => {
  it("uses the linked employee's stored email and snapshot, escapes HTML and excludes internal notes", () => {
    const draft = buildRecordedLeaveEmail(record, employee)
    expect(draft.status).toBe("prepared")
    if (draft.status !== "prepared") throw new Error("Expected a prepared draft.")
    expect(draft.to).toBe(employee.a365_workemail)
    expect(draft.subject).toBe("Your leave has been recorded")
    expect(draft.text).toContain("Leave type: Emergency")
    expect(draft.text).toContain("Benefit: Unpaid")
    expect(draft.text).toContain("Start date: Oct 22, 2026")
    expect(draft.text).toContain("Recorded days: 1.50")
    expect(draft.html).toContain("Test &lt;Employee&gt;")
    expect(draft.html).not.toContain("Private internal note")
    expect(draft.text).not.toMatch(/approved|approval|Private internal note|remaining credits/i)
  })
  it.each([undefined, "", "bad", "a@example.invalid; b@example.invalid", "a@example.invalid\r\nBcc: another@example.invalid"])("does not invent a recipient for an unavailable or unsafe stored address", a365_workemail => {
    expect(buildRecordedLeaveEmail(record, { ...employee, a365_workemail })).toEqual({ status: "unavailable", reason: "missing-or-invalid-work-email" })
  })
  it("rejects mismatched employees and non-issued/invalid snapshots", () => {
    expect(() => buildRecordedLeaveEmail({ ...record, _a365_employee_value: "30000000-0000-0000-0000-000000000003" }, employee)).toThrow("does not match")
    expect(() => buildRecordedLeaveEmail({ ...record, a365_leavestatus: 749910001 }, employee)).toThrow("Issued")
    expect(() => buildRecordedLeaveEmail({ ...record, a365_days: Number.NaN }, employee)).toThrow("invalid")
  })
})
