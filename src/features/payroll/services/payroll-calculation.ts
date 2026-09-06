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
}

export interface PayrollResult {
  dailyRate: number
  unpaidLeave: number
  sss: number
  philhealth: number
  hdmf: number
  grossPay: number
  taxableBase: number
  withholdingTax: number
  totalDeductions: number
  netPay: number
  warnings: string[]
}

// --- Money -------------------------------------------------------------------

/** Half-up rounding to 2 decimals for PHP money. Kept separate from display formatting. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
