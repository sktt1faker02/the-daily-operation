import { describe, expect, it } from "vitest"
import type { Employee } from "@/features/employees/types"
import type { PayrollEntry, PayrollPeriod } from "./types"
import { normalizeOtherDeductionsComment, toPayslipDocument } from "./payslip-data"

const employee: Pick<Employee, "a365_name" | "a365_employeenumber" | "a365_basicmonthlysalary" | "_a365_position_value"> = {
  a365_name: "Test User",
  a365_employeenumber: "0001",
  a365_basicmonthlysalary: 30000,
  _a365_position_value: null,
}

const period: Pick<PayrollPeriod, "a365_name" | "a365_periodstart" | "a365_periodend"> = {
  a365_name: "Nov 15, 2026",
  a365_periodstart: "2026-11-15",
  a365_periodend: "2026-11-15",
}

const entry: PayrollEntry = {
  a365_payrollentryid: "entry-1",
  a365_name: "Test User",
  a365_isincluded: true,
  a365_basicpay: 30000,
  a365_allowances: 1000,
  a365_otherearnings: 0,
  a365_otherdeductions: 5000,
  a365_unpaidleavedays: 1,
  a365_grosspay: 29181.82,
  a365_sss: 875,
  a365_philhealth: 500,
  a365_hdmf: 100,
  a365_unpaidleave: 1818.18,
  a365_withholdingtax: 0,
  a365_totaldeductions: 6475,
  a365_netpay: 22706.82,
  a365_calculatedon: null,
  a365_comment: "Unpaid Leave",
  _a365_employee_value: "employee-1",
  _a365_payrollperiod_value: "period-1",
}

describe("payslip comment mapping", () => {
  it.each([
    ["non-empty comment", "  Unpaid Leave  ", "Unpaid Leave"],
    ["empty comment", "", null],
    ["whitespace-only comment", " \n\t ", null],
    ["multi-line comment", "Unpaid Leave\nManual adjustment", "Unpaid Leave\nManual adjustment"],
    ["very long comment", "x".repeat(5000), "x".repeat(5000)],
    ["HTML characters", "<fee & tax>", "<fee & tax>"],
  ])("normalizes the %s", (_label, input, expected) => {
    expect(normalizeOtherDeductionsComment(input)).toBe(expected)
  })

  it("maps the Employee entry comment into the shared payslip view model", () => {
    expect(toPayslipDocument(employee, period, entry, null).otherDeductionsComment).toBe("Unpaid Leave")
  })

  it("keeps a missing employee-visible comment optional", () => {
    expect(
      toPayslipDocument(employee, period, { ...entry, a365_comment: null }, null)
        .otherDeductionsComment,
    ).toBeNull()
  })
})
