import { describe, it, expect } from "vitest"
import {
  round2,
  calculatePayroll,
  type StatutoryConfig,
  type PayrollInput,
} from "./payroll-calculation"

describe("round2", () => {
  it("rounds half up to 2 decimals", () => {
    expect(round2(537.505)).toBe(537.51)
    expect(round2(100)).toBe(100)
    expect(round2(1750 / 2)).toBe(875)
    expect(round2(1075 / 2)).toBe(537.5)
  })
})

const config: StatutoryConfig = {
  sss: [
    { compensationFrom: 0, compensationTo: 5249.99, msc: 5000, employeeAmount: 250, employerAmount: 510, ecAmount: 10 },
    { compensationFrom: 34750, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3500, ecAmount: 30 },
  ],
  philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 },
  hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 },
  taxBrackets: [
    { sequence: 1, incomeFrom: 0, incomeTo: 10417, baseTax: 0, marginalRate: 0 },
    { sequence: 2, incomeFrom: 10417, incomeTo: 16666, baseTax: 0, marginalRate: 0.15 },
    { sequence: 3, incomeFrom: 16667, incomeTo: 33332, baseTax: 937.5, marginalRate: 0.2 },
    { sequence: 4, incomeFrom: 33333, incomeTo: 83332, baseTax: 4270.7, marginalRate: 0.25 },
    { sequence: 5, incomeFrom: 83333, incomeTo: 333332, baseTax: 16770.7, marginalRate: 0.3 },
    { sequence: 6, incomeFrom: 333333, incomeTo: null, baseTax: 91770.7, marginalRate: 0.35 },
  ],
}

const payslip: PayrollInput = {
  monthlyBasicSalary: 43000,
  basicPay: 21500,
  allowances: 1000,
  otherEarnings: 0,
  otherDeductions: 0,
  unpaidLeaveDays: 0,
  withholdingTax: 1325, // manual admin input (accountant decision)
}

describe("calculatePayroll — client payslip golden fixture", () => {
  const r = calculatePayroll(payslip, config)
  it("SSS = 875.00 (half of 5% of 35,000 MSC)", () => expect(r.sss).toBe(875))
  it("PhilHealth = 537.50 (half of 2.5% of 43,000)", () => expect(r.philhealth).toBe(537.5))
  it("HDMF = 100.00 (half of 2% of 10,000 cap)", () => expect(r.hdmf).toBe(100))
  it("Gross Pay = 22,500.00", () => expect(r.grossPay).toBe(22500))
  it("WHT passes through the manual input, not computed", () => expect(r.withholdingTax).toBe(1325))
  it("Total Deductions includes leave, SSS, PhilHealth, HDMF, tax and other deductions = 2,837.50", () =>
    expect(r.totalDeductions).toBe(2837.5))
  it("Net = 19,662.50 (Gross - Total Deductions)", () => expect(r.netPay).toBe(19662.5))
})

describe("manual withholding tax", () => {
  it("uses the entered WHT verbatim regardless of income", () => {
    const r = calculatePayroll({ ...payslip, withholdingTax: 500 }, config)
    expect(r.withholdingTax).toBe(500)
    expect(r.totalDeductions).toBe(round2(875 + 537.5 + 100 + 500))
    expect(r.netPay).toBe(round2(r.grossPay - r.totalDeductions))
  })
  it("zero WHT is honored (no auto-computation)", () => {
    const r = calculatePayroll({ ...payslip, withholdingTax: 0 }, config)
    expect(r.withholdingTax).toBe(0)
  })
})

describe("edge cases", () => {
  it.each([
    [0, 0, 0, 1325, 19662.5],
    [0.5, 750.25, 250.75, 1325, 19184.72],
    [2, 750, 250, 0, 17578.4],
    [2.25, 0, 0, 123.45, 16466.31],
  ])("preserves the historical net to the centavo for %s leave days", (unpaidLeaveDays, otherEarnings, otherDeductions, withholdingTax, expectedNet) => {
    const result = calculatePayroll({ ...payslip, unpaidLeaveDays, otherEarnings, otherDeductions, withholdingTax }, config)
    expect(result.netPay).toBe(expectedNet)
    expect(result.sss).toBe(875)
    expect(result.philhealth).toBe(537.5)
    expect(result.hdmf).toBe(100)
    expect(result.withholdingTax).toBe(withholdingTax)
  })
  it.each([5000, 40000, 43000, 120000])("keeps contributions independent of earnings/leave for salary %s", (monthlyBasicSalary) => {
    const baseline = calculatePayroll({ ...payslip, monthlyBasicSalary }, config)
    const adjusted = calculatePayroll({ ...payslip, monthlyBasicSalary, basicPay: 30000.12,
      allowances: 123.45, otherEarnings: 987.65, unpaidLeaveDays: 2.25, otherDeductions: 321.09 }, config)
    expect([adjusted.sss, adjusted.philhealth, adjusted.hdmf])
      .toEqual([baseline.sss, baseline.philhealth, baseline.hdmf])
  })
  it("unpaid leave belongs in deductions and leaves gross earnings intact", () => {
    const r2 = calculatePayroll({ ...payslip, unpaidLeaveDays: 1 }, config)
    expect(r2.dailyRate).toBe(round2(43000 / 22)) // 1954.55
    expect(r2.unpaidLeave).toBe(1954.55)
    expect(r2.grossPay).toBe(22500)
    expect(r2.totalDeductions).toBe(4792.05)
    expect(r2.netPay).toBe(17707.95)
  })
  it("matches the reported payslip without deducting leave twice", () => {
    const result = calculatePayroll({ ...payslip, monthlyBasicSalary: 40000,
      basicPay: 20000, allowances: 0, unpaidLeaveDays: 2, withholdingTax: 0 }, config)
    expect(result.unpaidLeave).toBe(3636.36)
    expect(result.grossPay).toBe(20000)
    expect(result.totalDeductions).toBe(5111.36)
    expect(result.netPay).toBe(14888.64)
  })
  it.each([0, 0.5, 2])("includes earnings and all deductions with %s unpaid days", (unpaidLeaveDays) => {
    const result = calculatePayroll({ ...payslip, otherEarnings: 750,
      otherDeductions: 250, unpaidLeaveDays }, config)
    expect(result.grossPay).toBe(23250)
    expect(result.totalDeductions).toBe(round2(3087.5 + round2(unpaidLeaveDays * 1954.55)))
    expect(result.netPay).toBe(round2(result.grossPay - result.totalDeductions))
  })
  it("missing SSS config throws, not silent 0", () => {
    expect(() => calculatePayroll(payslip, { ...config, sss: [] })).toThrow()
  })
})
