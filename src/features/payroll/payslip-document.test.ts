import { describe, expect, it } from "vitest"
import {
  buildPayslipDocDefinition,
  derivedRates,
  payslipFileName,
  type PayslipDocumentData,
} from "./payslip-document"

/** Mirrors docs/Payslip 20260331 Michael Tabilin.pdf (the approved reference). */
const reference: PayslipDocumentData = {
  employeeName: "Michael Tabilin",
  employeeNumber: "0004",
  position: "Microsoft Power Apps Developer",
  monthlySalary: 43000,
  periodLabel: "March 16-31, 2026",
  periodStart: "2026-03-16",
  periodEnd: "2026-03-31",
  basicPay: 21500,
  allowances: 1000,
  otherEarnings: 0,
  unpaidLeave: null,
  grossPay: 22500,
  sss: 875,
  philhealth: 537.5,
  hdmf: 100,
  withholdingTax: 1325,
  otherDeductions: null,
  totalDeductions: 2837.5,
  netPay: 19662.5,
}

/** Flatten every `text` value in the doc definition into one searchable string. */
function textOf(node: unknown): string {
  if (node === null || node === undefined) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(" ")
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>
    return [obj.text, obj.content, obj.columns, obj.stack, obj.table, obj.body]
      .map(textOf)
      .join(" ")
  }
  return ""
}

describe("derivedRates", () => {
  it("derives daily (÷22) and hourly (÷8) rates like the reference", () => {
    expect(derivedRates(43000)).toEqual({ daily: 1954.55, hourly: 244.32 })
  })

  it("returns nulls when there is no monthly salary", () => {
    expect(derivedRates(null)).toEqual({ daily: null, hourly: null })
    expect(derivedRates(0)).toEqual({ daily: null, hourly: null })
  })
})

describe("payslipFileName", () => {
  it("suggests a PDF name using period end, employee number, and Last-First", () => {
    expect(payslipFileName(reference)).toBe("Payslip_2026-03-31_0004_Tabilin-Michael.pdf")
  })

  it("falls back when employee number is missing", () => {
    expect(payslipFileName({ ...reference, employeeNumber: null })).toBe(
      "Payslip_2026-03-31_NA_Tabilin-Michael.pdf",
    )
  })
})

describe("buildPayslipDocDefinition", () => {
  const def = buildPayslipDocDefinition(reference)
  const text = textOf(def.content)

  it("renders the corrected Test User totals with aligned itemized columns", () => {
    const definition = buildPayslipDocDefinition({ ...reference, employeeName: "Test User",
      monthlySalary: 40000, periodLabel: "Oct 16–31, 2026", periodStart: "2026-10-16", periodEnd: "2026-10-31",
      basicPay: 20000, allowances: 0, otherEarnings: 0, unpaidLeave: 3636.36,
      grossPay: 20000, sss: 875, philhealth: 500, hdmf: 100, withholdingTax: 0,
      otherDeductions: 0, totalDeductions: 5111.36, netPay: 14888.64,
    })
    const content = definition.content as import("pdfmake/interfaces").Content[]
    const grid = content.find((item): item is import("pdfmake/interfaces").ContentTable =>
      typeof item === "object" && item !== null && "table" in item && item.table !== undefined && textOf(item.table.body[0]).includes("Gross Earnings"),
    )!
    expect(grid.table.body.every((row) => row.length === 4)).toBe(true)
    const lines = grid.table.body.slice(1, -2)
    expect(lines.map((row) => textOf(row[2]).trim())).toEqual([
      "Unpaid Leave", "SSS", "PhilHealth", "HDMF", "Withholding Tax", "Other Deductions",
    ])
    expect(lines.slice(3).every((row) => textOf(row.slice(0, 2)).trim() === "")).toBe(true)
    expect(textOf(grid)).toContain("20,000.00")
    expect(textOf(grid)).toContain("5,111.36")
    expect(textOf(grid)).toContain("14,888.64")
    expect(textOf(grid)).not.toContain("-0.00")
  })

  it("normalizes negative zero in PDF amounts", () => {
    expect(textOf(buildPayslipDocDefinition({ ...reference, unpaidLeave: -0, otherDeductions: -0.001 }).content))
      .not.toContain("-0.00")
  })

  it("names the document with the suggested filename", () => {
    expect(def.info?.title).toBe("Payslip_2026-03-31_0004_Tabilin-Michael.pdf")
  })

  it("renders the reference amounts formatted with two decimals and no ₱", () => {
    expect(text).toContain("21,500.00") // basic pay
    expect(text).toContain("537.50") // philhealth
    expect(text).toContain("2,837.50") // total deductions
    expect(text).toContain("19,662.50") // net pay
    expect(text).not.toContain("₱")
  })

  it("shows derived daily and hourly rates", () => {
    expect(text).toContain("1,954.55")
    expect(text).toContain("244.32")
  })

  it("derives monthly allowances as the semi-monthly figure ×2", () => {
    expect(text).toContain("2,000.00")
  })

  it("prints the employer signatory", () => {
    expect(text).toContain("Adrian Celis")
  })

  it("shows a dash for absent optional amounts (unpaid leave)", () => {
    // unpaidLeave is null → the adjustment line shows a dash, not 0.00.
    const unpaidLeaveRow = textOf(def.content).includes("Unpaid Leave")
    expect(unpaidLeaveRow).toBe(true)
    expect(text).toContain("-")
  })

  it("places unpaid leave in the deductions column as a positive amount", () => {
    const definition = buildPayslipDocDefinition({ ...reference, unpaidLeave: 3636.36,
      grossPay: 22500, totalDeductions: 6473.86, netPay: 16026.14 })
    const content = definition.content as import("pdfmake/interfaces").Content[]
    const grid = content.find((item): item is import("pdfmake/interfaces").ContentTable =>
      typeof item === "object" && item !== null && "table" in item && item.table !== undefined &&
      textOf(item.table.body[0]).includes("Gross Earnings"),
    )
    expect(grid).toBeDefined()
    const row = grid!.table.body.find((cells) => textOf(cells).includes("Unpaid Leave"))!
    expect(textOf(row.slice(0, 2))).not.toContain("Unpaid Leave")
    expect(textOf(row[2])).toContain("Unpaid Leave")
    expect(textOf(row[3])).toContain("3,636.36")
    expect(textOf(row[3])).not.toContain("-")
    expect(textOf(grid)).toContain("6,473.86")
    expect(textOf(grid)).toContain("16,026.14")
  })
})

describe("payslip PDF other-deduction reason", () => {
  const withOtherDeductions = { ...reference, otherDeductions: 5000 }

  it.each([
    ["non-empty comment", "Unpaid Leave", "Reason: Unpaid Leave"],
    ["multi-line comment", "Unpaid Leave\nManual adjustment", "Reason: Unpaid Leave\nManual adjustment"],
    ["very long comment", "x".repeat(5000), `Reason: ${"x".repeat(5000)}`],
    ["HTML characters", "<fee & tax>", "Reason: <fee & tax>"],
  ])("includes a %s under Other Deductions", (_label, comment, expected) => {
    const text = textOf(
      buildPayslipDocDefinition({ ...withOtherDeductions, otherDeductionsComment: comment }).content,
    )
    expect(text).toContain("Other Deductions")
    expect(text).toContain(expected)
  })

  it.each(["", " \n\t "]) ("omits an empty or whitespace-only comment", (comment) => {
    const text = textOf(
      buildPayslipDocDefinition({ ...withOtherDeductions, otherDeductionsComment: comment }).content,
    )
    expect(text).not.toContain("Reason:")
  })

  it("leaves amounts and totals unchanged", () => {
    const before = buildPayslipDocDefinition(withOtherDeductions)
    const after = buildPayslipDocDefinition({
      ...withOtherDeductions,
      otherDeductionsComment: "Unpaid Leave",
    })
    const amounts = (definition: typeof before) =>
      textOf(definition.content).match(/(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}/g)
    expect(amounts(after)).toEqual(amounts(before))
    expect(textOf(after.content)).toContain("5,000.00")
    expect(textOf(after.content)).toContain("2,837.50")
    expect(textOf(after.content)).toContain("19,662.50")
  })
})
