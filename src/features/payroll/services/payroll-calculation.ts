/**
 * Payroll calculation engine — pure, UI-free, Dataverse-free business logic.
 * Statutory rules arrive as `StatutoryConfig` (loaded from Dataverse elsewhere);
 * this module only computes. Rules verified against the client payslip + official
 * 2025 sources — see docs/superpowers/specs/2026-09-06-phase-5-payroll-calculation-engine-design.md.
 */

// --- Config types (mirror the Dataverse statutory config tables) -------------

export interface SssBracket {
  compensationFrom: number
  compensationTo: number | null
  msc: number
  employeeAmount: number
  employerAmount: number
  ecAmount: number
}

export interface PhilHealthConfig {
  premiumRate: number // fraction, e.g. 0.05
  employeeShare: number // fraction, e.g. 0.5
  incomeFloor: number
  incomeCeiling: number
}

export interface HdmfConfig {
  employeeRate: number // fraction, e.g. 0.02
  employerRate: number
  compensationCap: number
}

export interface TaxBracket {
  sequence: number
  incomeFrom: number
  incomeTo: number | null
  baseTax: number
  marginalRate: number // fraction, e.g. 0.20
}

export interface StatutoryConfig {
  sss: SssBracket[]
  philhealth: PhilHealthConfig
  hdmf: HdmfConfig
  taxBrackets: TaxBracket[]
}

// --- Engine I/O --------------------------------------------------------------

export interface PayrollInput {
  monthlyBasicSalary: number // statutory basis
  basicPay: number // per-cutoff
  allowances: number // per-cutoff
  otherEarnings: number // per-cutoff
  otherDeductions: number // per-cutoff
  unpaidLeaveDays: number // per-cutoff input
  withholdingTax: number // per-cutoff MANUAL admin input (accountant decision — not computed)
}

export interface PayrollResult {
  dailyRate: number
  unpaidLeave: number
  sss: number
  philhealth: number
  hdmf: number
  grossPay: number
  withholdingTax: number // echoes the manual input, for a consistent result shape
  totalDeductions: number
  netPay: number
}

// --- Money -------------------------------------------------------------------

/** Half-up rounding to 2 decimals for PHP money. Kept separate from display formatting. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// --- Statutory contributions (monthly basis) ---------------------------------

export function sssEmployeeMonthly(monthlySalary: number, brackets: SssBracket[]): number {
  if (brackets.length === 0) throw new Error("Missing SSS contribution configuration.")
  const match = brackets.find(
    (b) => monthlySalary >= b.compensationFrom && (b.compensationTo === null || monthlySalary <= b.compensationTo),
  )
  // Below the lowest floor -> lowest bracket; above the top -> the open-ended top bracket.
  const bracket = match ?? (monthlySalary < brackets[0].compensationFrom ? brackets[0] : brackets[brackets.length - 1])
  return bracket.employeeAmount
}

export function philhealthEmployeeMonthly(monthlySalary: number, cfg: PhilHealthConfig): number {
  const base = Math.min(Math.max(monthlySalary, cfg.incomeFloor), cfg.incomeCeiling)
  return round2(base * cfg.premiumRate * cfg.employeeShare)
}

export function hdmfEmployeeMonthly(monthlySalary: number, cfg: HdmfConfig): number {
  const base = Math.min(monthlySalary, cfg.compensationCap)
  return round2(base * cfg.employeeRate)
}

// Withholding tax is entered manually by the Payroll Admin (accountant decision);
// the engine no longer computes it, so there is no taxable-base rule here. The
// `taxBrackets` config is retained on StatutoryConfig for now but is unused.

// --- The engine --------------------------------------------------------------

export interface PayrollTotalsInput {
  basicPay: number
  allowances: number
  otherEarnings: number
  unpaidLeave: number
  sss: number
  philhealth: number
  hdmf: number
  withholdingTax: number
  otherDeductions: number
}

/** One totals formula, also used to validate stored snapshots before Mark Ready.
 * Accept resolved deductions so correcting totals never changes their basis. */
export function calculatePayrollTotals(input: PayrollTotalsInput): Pick<PayrollResult, "grossPay" | "totalDeductions" | "netPay"> {
  const grossPay = round2(input.basicPay + input.allowances + input.otherEarnings)
  const totalDeductions = round2(input.unpaidLeave + input.sss + input.philhealth + input.hdmf + input.withholdingTax + input.otherDeductions)
  return { grossPay, totalDeductions, netPay: round2(grossPay - totalDeductions) }
}

export function calculatePayroll(input: PayrollInput, config: StatutoryConfig): PayrollResult {
  const dailyRate = round2(input.monthlyBasicSalary / 22)
  const unpaidLeave = round2(input.unpaidLeaveDays * dailyRate)

  const sss = round2(sssEmployeeMonthly(input.monthlyBasicSalary, config.sss) / 2)
  const philhealth = round2(philhealthEmployeeMonthly(input.monthlyBasicSalary, config.philhealth) / 2)
  const hdmf = round2(hdmfEmployeeMonthly(input.monthlyBasicSalary, config.hdmf) / 2)

  const withholdingTax = round2(input.withholdingTax) // manual admin input, used as-is
  const totals = calculatePayrollTotals({ ...input, unpaidLeave, sss, philhealth, hdmf, withholdingTax })

  return {
    dailyRate,
    unpaidLeave,
    sss,
    philhealth,
    hdmf,
    withholdingTax,
    ...totals,
  }
}
