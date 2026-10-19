import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PayslipBreakdown } from "./payslip-breakdown"
import type { PayrollEntry } from "./types"

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
  a365_comment: null,
  _a365_employee_value: "employee-1",
  _a365_payrollperiod_value: "period-1",
}

describe("PayslipBreakdown other-deduction reason", () => {
  it.each([
    ["non-empty comment", "Unpaid Leave", "Reason: Unpaid Leave"],
    ["multi-line comment", "Unpaid Leave\nManual adjustment", "Reason: Unpaid Leave\nManual adjustment"],
    ["very long comment", "x".repeat(5000), `Reason: ${"x".repeat(5000)}`],
    ["HTML characters", "<fee & tax>", "Reason: <fee & tax>"],
  ])("renders a %s as plain text", (_label, comment, expected) => {
    render(<PayslipBreakdown entry={entry} otherDeductionsComment={comment} />)
    const note = screen.getByText((_, element) =>
      element?.tagName === "SPAN" && element.textContent === expected,
    )
    expect(note.tagName).toBe("SPAN")
    expect(note).toHaveClass("whitespace-pre-wrap")
    expect(note).toHaveClass("break-words")
  })

  it.each(["", " \n\t "]) ("omits an empty or whitespace-only comment", (comment) => {
    render(<PayslipBreakdown entry={entry} otherDeductionsComment={comment} />)
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument()
  })

  it("hides the comment with the Other Deductions row when the amount is zero", () => {
    render(
      <PayslipBreakdown
        entry={{ ...entry, a365_otherdeductions: 0 }}
        otherDeductionsComment="Unpaid Leave"
      />,
    )
    expect(screen.queryByText("Other Deductions")).not.toBeInTheDocument()
    expect(screen.queryByText("Reason: Unpaid Leave")).not.toBeInTheDocument()
  })
})
