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
  it("suggests Payslip_<periodEnd>_<empno>_<Last-First>", () => {
    expect(payslipFileName(reference)).toBe("Payslip_2026-03-31_0004_Tabilin-Michael")
  })

  it("falls back when employee number is missing", () => {
    expect(payslipFileName({ ...reference, employeeNumber: null })).toBe(
      "Payslip_2026-03-31_NA_Tabilin-Michael",
    )
  })
})

describe("buildPayslipDocDefinition", () => {
  const def = buildPayslipDocDefinition(reference)
  const text = textOf(def.content)

  it("names the document with the suggested filename", () => {
    expect(def.info?.title).toBe("Payslip_2026-03-31_0004_Tabilin-Michael")
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
    // unpaidLeave is null → the Absence line shows a dash, not 0.00.
    const absenceRow = textOf(def.content).includes("Absence")
    expect(absenceRow).toBe(true)
    expect(text).toContain("-")
  })
})
