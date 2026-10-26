import type { PayrollEntry, PayrollEntryInputValues } from "../types"
import { calculatePayroll, type StatutoryConfig } from "./payroll-calculation"

function amountFromInput(value: string): number {
  const amount = Number(value.trim())
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Payroll inputs must be non-negative numbers.")
  }
  return amount
}

/** Shared conversion for the unsaved preview and the persisted calculation. */
export function parsePayrollEntryInputs(values: PayrollEntryInputValues) {
  return {
    basicPay: amountFromInput(values.a365_basicpay),
    allowances: amountFromInput(values.a365_allowances),
    otherEarnings: amountFromInput(values.a365_otherearnings),
    otherDeductions: amountFromInput(values.a365_otherdeductions),
    unpaidLeaveDays: amountFromInput(values.a365_unpaidleavedays),
    withholdingTax: amountFromInput(values.a365_withholdingtax),
  }
}

/** Build a temporary breakdown without changing the saved entry or its audit stamps. */
export function previewPayrollEntry(
  entry: PayrollEntry,
  values: PayrollEntryInputValues,
  monthlyBasicSalary: number,
  config: StatutoryConfig,
): PayrollEntry {
  const input = parsePayrollEntryInputs(values)
  const result = calculatePayroll({ ...input, monthlyBasicSalary }, config)
  return {
    ...entry,
    a365_basicpay: input.basicPay,
    a365_allowances: input.allowances,
    a365_otherearnings: input.otherEarnings,
    a365_otherdeductions: input.otherDeductions,
    a365_unpaidleavedays: input.unpaidLeaveDays,
    a365_withholdingtax: input.withholdingTax,
    a365_comment: values.a365_comment.trim() || null,
    a365_grosspay: result.grossPay,
    a365_sss: result.sss,
    a365_philhealth: result.philhealth,
    a365_hdmf: result.hdmf,
    a365_unpaidleave: result.unpaidLeave,
    a365_totaldeductions: result.totalDeductions,
    a365_netpay: result.netPay,
  }
}
