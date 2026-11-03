import type { LedgerCategory, LedgerFilters, LedgerRow, LedgerValues } from "./types"

export const categoryLabels = ["Utilities", "Payroll", "Government Contributions", "Taxes", "Software and Licenses", "Rent and Coworking", "Capital Deposits", "Capital Withdrawals", "Client Payments"] as const

/** Decimal text to integer centavos; never silently round an entered amount. */
export function minorUnits(value: string): number {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter an amount with at most two decimal places.")
  const negative = value.startsWith("-")
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".")
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  if (!Number.isSafeInteger(units) || Math.abs(units) > 100000000000) throw new Error("The amount is outside the supported range.")
  return negative ? -units : units
}
export function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validateValues(values: LedgerValues, categories: LedgerCategory[], generated = false): void {
  if (!validDate(values.date)) throw new Error("Enter a valid Date.")
  if (!values.description.trim() || values.description.length > 2000) throw new Error("Enter a Description of at most 2,000 characters.")
  if (values.receipt.length > 100 || values.reference.length > 500) throw new Error("OR Number allows 100 characters; Reference allows 500.")
  const category = categories.find(item => String(item.value) === values.category)
  if (!category || !categoryLabels.includes(category.label as typeof categoryLabels[number])) throw new Error("Select a valid Chart of Account.")
  if (!["debit", "credit"].includes(values.direction)) throw new Error("Select Money out or Money in.")
  const units = minorUnits(values.amount)
  if (units <= 0 && !(generated && values.direction === "debit")) throw new Error("Manual amounts must be positive. Signed zero/negative payroll must remain in Debit.")
  if (category.label === "Capital Deposits" && values.direction !== "credit") throw new Error("Capital Deposits must use Credit (Money in).")
  if (category.label === "Capital Withdrawals" && values.direction !== "debit") throw new Error("Capital Withdrawals must use Debit (Money out).")
}
export function validateFilters(filters: LedgerFilters): void {
  if ((filters.start && !validDate(filters.start)) || (filters.end && !validDate(filters.end))) throw new Error("Enter valid filter dates.")
  if (filters.start && filters.end && filters.start > filters.end) throw new Error("From must be on or before To.")
}
export function valuesFor(row?: LedgerRow): LedgerValues {
  return row ? { date: row.date, receipt: row.receipt, reference: row.reference, direction: row.direction, amount: row.amount.toFixed(2), category: String(row.category), description: row.description }
    : { date: "", receipt: "", reference: "", direction: "debit", amount: "", category: "", description: "" }
}
export function ledgerAccess(access: { roleSettled: boolean; roleError: boolean; roleNames: string[] }): "loading" | "allowed" | "denied" {
  if (!access.roleSettled) return "loading"
  return !access.roleError && access.roleNames.some(name => name.trim().toLowerCase() === "a365 - payroll admin") ? "allowed" : "denied"
}
