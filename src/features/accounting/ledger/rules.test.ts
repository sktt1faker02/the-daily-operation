import { describe, expect, it } from "vitest"
import { categoryLabels, ledgerAccess, minorUnits, validateFilters, validateValues, validDate } from "./rules"
import { emptyFilters, type LedgerValues } from "./types"

const categories = categoryLabels.map((label, value) => ({ label, value }))
const valid: LedgerValues = { date: "2026-11-03", receipt: "0001", reference: "", category: "0", direction: "debit", amount: "100.01", description: "Internet" }
describe("Ledger financial validation", () => {
  it("keeps receipt zeros and accepts optional blank references", () => { expect(() => validateValues(valid, categories)).not.toThrow(); expect(valid.receipt).toBe("0001") })
  it.each(["0", "-0.01", "1.001", "Infinity", "NaN", "1e3", "", "1,000", "1000000001"])("rejects invalid manual money %s", amount => expect(() => validateValues({ ...valid, amount }, categories)).toThrow())
  it.each(["0", "-100", "25000.25"])("accepts signed saved payroll Debit %s", amount => expect(() => validateValues({ ...valid, amount, category: "1" }, categories, true)).not.toThrow())
  it("does not allow negative generated money in Credit", () => expect(() => validateValues({ ...valid, amount: "-100", direction: "credit" }, categories, true)).toThrow())
  it("keeps exact minor units and avoids floating-point money comparisons", () => { expect(minorUnits("0.10") + minorUnits("0.20")).toBe(30); expect(minorUnits("-100.01")).toBe(-10001) })
  it("requires date, description, category and direction", () => {
    for (const key of ["date", "description", "category", "direction"] as const) expect(() => validateValues({ ...valid, [key]: "" }, categories)).toThrow()
    expect(() => validateValues({ ...valid, category: "99" }, categories)).toThrow()
  })
  it("requires capital deposits in Credit and withdrawals in Debit", () => {
    expect(() => validateValues({ ...valid, category: "6" }, categories)).toThrow("Capital Deposits")
    expect(() => validateValues({ ...valid, category: "6", direction: "credit" }, categories)).not.toThrow()
    expect(() => validateValues({ ...valid, category: "7", direction: "credit" }, categories)).toThrow("Capital Withdrawals")
  })
  it("has exactly nine choices without excluded categories", () => { expect(categories).toHaveLength(9); expect(categoryLabels).not.toContain("Office Supplies"); expect(categoryLabels).not.toContain("Bank and Payment Fees") })
  it("rejects impossible dates and inverted ranges", () => { expect(validDate("2026-02-30")).toBe(false); expect(validDate("2028-02-29")).toBe(true); expect(() => validateFilters({ ...emptyFilters, start: "2026-11-02", end: "2026-11-01" })).toThrow() })
  it("fails closed without confirmed Payroll Admin membership", () => {
    expect(ledgerAccess({ roleSettled: false, roleError: false, roleNames: [] })).toBe("loading")
    for (const roleNames of [[], ["A365 - Payroll Employee"], ["System Administrator"]]) expect(ledgerAccess({ roleSettled: true, roleError: false, roleNames })).toBe("denied")
    expect(ledgerAccess({ roleSettled: true, roleError: true, roleNames: ["A365 - Payroll Admin"] })).toBe("denied")
    expect(ledgerAccess({ roleSettled: true, roleError: false, roleNames: ["A365 - Payroll Admin"] })).toBe("allowed")
  })
})
