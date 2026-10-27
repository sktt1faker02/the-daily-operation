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
  a365_grosspay: 31000,
  a365_sss: 875,
  a365_philhealth: 500,
  a365_hdmf: 100,
  a365_unpaidleave: 1818.18,
  a365_withholdingtax: 0,
  a365_totaldeductions: 8293.18,
  a365_netpay: 22706.82,
  a365_calculatedon: null,
  a365_comment: null,
  _a365_employee_value: "employee-1",
  _a365_payrollperiod_value: "period-1",
}

describe("PayslipBreakdown payroll comments", () => {
  it("renders the corrected Oct 16–31 Test User snapshot", () => {
    render(<PayslipBreakdown entry={{ ...entry,
      a365_basicpay: 20000, a365_allowances: 0, a365_unpaidleave: 3636.36,
      a365_otherdeductions: 0, a365_grosspay: 20000,
      a365_totaldeductions: 5111.36, a365_netpay: 14888.64,
    }} />)
    expect(screen.getAllByText("₱20,000.00")).toHaveLength(2)
    expect(screen.getByText("₱5,111.36")).toBeInTheDocument()
    expect(screen.getByText("₱14,888.64")).toBeInTheDocument()
    expect(screen.queryByText("Other Deductions")).not.toBeInTheDocument()
  })
  it("shows earnings, leave and saved totals in their respective sections", () => {
    render(<PayslipBreakdown entry={entry} />)
    const amount = (label: string) => screen.getByText(label).closest("dt")?.nextElementSibling?.textContent
    expect(amount("Gross Pay")).toBe("₱31,000.00")
    expect(amount("Unpaid Leave")).toBe("₱1,818.18")
    expect(amount("Total Deductions")).toBe("₱8,293.18")
    expect(amount("Net Pay")).toBe("₱22,706.82")
    expect(screen.getByText("Earnings").closest("section")).not.toHaveTextContent("Unpaid Leave")
    expect(screen.getByText("Deductions").closest("section")).toHaveTextContent("Unpaid Leave")
  })
  it.each([
    ["non-empty comment", "Unpaid Leave", "Unpaid Leave"],
    ["multi-line comment", "Unpaid Leave\nManual adjustment", "Unpaid Leave\nManual adjustment"],
    ["very long comment", "x".repeat(5000), "x".repeat(5000)],
    ["HTML characters", "<fee & tax>", "<fee & tax>"],
  ])("renders a %s as plain text", (_label, comment, expected) => {
    render(<PayslipBreakdown entry={{ ...entry, a365_comment: comment }} />)
    const note = screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent === expected,
    )
    expect(screen.getByRole("heading", { name: "Comments" }).closest("section")).toContainElement(note)
    expect(screen.getByText("Deductions").closest("section")).not.toContainElement(note)
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument()
    expect(note.querySelector("*")).toBeNull()
    expect(note).toHaveClass("whitespace-pre-wrap")
    expect(note).toHaveClass("break-words")
  })

  it.each([null, "", " \n\t "]) ("omits an empty or whitespace-only comment", (comment) => {
    render(<PayslipBreakdown entry={{ ...entry, a365_comment: comment }} />)
    expect(screen.queryByRole("heading", { name: "Comments" })).not.toBeInTheDocument()
  })

  it.each([0, null])("shows saved comments below Net Pay even with %s deductions", (amount) => {
    render(
      <PayslipBreakdown
        entry={{ ...entry, a365_otherdeductions: amount, a365_comment: "Great performance" }}
      />,
    )
    expect(screen.queryByText("Other Deductions")).not.toBeInTheDocument()
    const comments = screen.getByRole("heading", { name: "Comments" }).closest("section")!
    expect(comments).toHaveTextContent("Great performance")
    expect(screen.getByText("Net Pay").closest("dl")?.nextElementSibling).toBe(comments)
  })
})
