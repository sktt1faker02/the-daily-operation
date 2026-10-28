import type { GateInputs, AccessProfile } from "@/features/payroll/access"
import type { CreditRecord } from "./types"

export function leaveAccessState(access: Pick<GateInputs, "roleSettled" | "roleError"> & Pick<AccessProfile, "isAdmin">) {
  if (!access.roleSettled) return "loading"
  if (access.roleError) return "error"
  return access.isAdmin ? "allowed" : "denied"
}

export function validYear(year: number): boolean {
  // Technical Date Only query range, not an entitlement/eligibility policy.
  return Number.isInteger(year) && year >= 1900 && year <= 9998
}

export function requireGuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Select a valid record.")
  }
  return value.toLowerCase()
}

export function dateOnly(value: string): string {
  // Dataverse can serialize Date Only as midnight + an offset. Never convert
  // to the browser's timezone: the calendar portion is the business date.
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$)/.exec(value)
  if (!match) throw new Error("Invalid leave date.")
  const day = match[1]
  const parsed = new Date(`${day}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new Error("Invalid leave date.")
  return day
}

export function formatLeaveDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(`${dateOnly(value)}T00:00:00Z`))
  } catch {
    return "Date unavailable"
  }
}

function hundredths(value: number): number {
  const units = Math.round(value * 100)
  if (!Number.isFinite(value) || !Number.isSafeInteger(units) || Math.abs(value * 100 - units) > 0.001) {
    throw new Error("The credit history contains an invalid day amount.")
  }
  return units
}

/** Complete, scoped history only. Never infer entitlement or filter out
 * deductions because their source was cancelled: restoration rows offset them. */
export function calculateBalances(rows: Pick<CreditRecord, "a365_leavecredittransactionid" | "_a365_employee_value" | "a365_year" | "a365_creditpool" | "a365_days">[], employeeId: string, year: number) {
  const id = requireGuid(employeeId)
  if (!validYear(year)) throw new Error("Select a valid year.")
  const sums = { VL: 0, SL: 0 }
  const ids = new Set<string>()
  for (const row of rows) {
    if (row._a365_employee_value?.toLowerCase() !== id || row.a365_year !== year || ids.has(row.a365_leavecredittransactionid)) {
      throw new Error("The credit history is incomplete or inconsistent. Refresh before using balances.")
    }
    ids.add(row.a365_leavecredittransactionid)
    const pool = row.a365_creditpool === 749910000 ? "VL" : row.a365_creditpool === 749910001 ? "SL" : null
    if (!pool) throw new Error("The credit history contains an unknown credit pool.")
    sums[pool] += hundredths(row.a365_days)
    if (!Number.isSafeInteger(sums[pool])) throw new Error("The balance exceeds the supported precision.")
  }
  return { VL: sums.VL / 100, SL: sums.SL / 100, movements: rows.length }
}

export function choiceLabel(labels: Readonly<Record<number, string>>, value: number): string {
  return labels[value] ?? "Unknown"
}

export const formatDays = (days: number) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(days)
