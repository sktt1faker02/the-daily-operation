import { describe, expect, it } from "vitest"
import { buildPayslipReadyEmail } from "./payslip-ready-email"
import { PayrollStatus } from "./period-status"

const period = { a365_payrollperiodid: "period", a365_name: "Oct 16–31, 2026",
  a365_periodstart: "2026-10-16T00:00:00+14:00", a365_periodend: "2026-10-31",
  a365_paydate: "2026-10-31", a365_payrollstatus: PayrollStatus.Ready }

describe("Payslip-ready email", () => {
  it("uses the reference layout, correct dates and My Payroll instructions without financial data", () => {
    const draft = buildPayslipReadyEmail({ a365_employeeid: "employee", a365_name: "Test <Employee>", a365_workemail: "test@example.invalid" }, period, "2026-10-26")!
    expect(draft.subject).toBe("Your payslip is ready")
    expect(draft.to).toBe("test@example.invalid")
    expect(draft.text).toContain("Payroll period: Oct 16–31, 2026")
    expect(draft.text).toContain("Start date: Oct 16, 2026")
    expect(draft.text).toContain("End date: Oct 31, 2026")
    expect(draft.text).toContain("Pay date: Oct 31, 2026")
    expect(draft.html).toContain("Test &lt;Employee&gt;")
    expect(draft.html).toContain("My Payroll")
    expect(draft.html).toContain("#f3f5f8")
    expect(draft.html).toContain("© 2026 Automations 365")
    expect(draft.html).not.toMatch(/<script|<img|<link|salary|Net Pay|Bank Account|Withholding Tax/i)
  })
  it.each([null, "", "bad", "a@example.invalid; b@example.invalid", "a@example.invalid\r\nBcc: other@example.invalid"])("rejects unsafe stored addresses: %s", a365_workemail => {
    expect(buildPayslipReadyEmail({ a365_employeeid: "employee", a365_name: "Test", a365_workemail }, period, "2026-10-26")).toBeNull()
  })
  it("escapes period text and omits absent pay dates", () => {
    const draft = buildPayslipReadyEmail({ a365_employeeid: "employee", a365_name: "Test", a365_workemail: "test@example.invalid" },
      { ...period, a365_name: '<img src=x onerror="alert(1)">', a365_paydate: null }, "2026-10-26")!
    expect(draft.html).toContain("&lt;img")
    expect(draft.html).not.toContain("<img")
    expect(draft.text).not.toContain("Pay date:")
  })
})
