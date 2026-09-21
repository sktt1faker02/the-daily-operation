/**
 * Pure payroll helpers — UI-free, Dataverse-free. These carry the business
 * decisions (semi-monthly cutoff suggestion, confirmed basic-pay default,
 * load-employees planning, and roll-up totals) so services and components stay
 * thin and the logic is unit-testable.
 */
import { round2 } from "./services/payroll-calculation"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import type { PayrollEntry } from "./types"

/** Confirmed rule (spec §2): per-cutoff basic pay = round2(monthly / 2). */
export function basicPayForCutoff(monthlySalary: number | null | undefined): number {
  if (monthlySalary === null || monthlySalary === undefined || monthlySalary <= 0) return 0
  return round2(monthlySalary / 2)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Last calendar day of the month for the given year (1-based month). */
function endOfMonthDay(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate() // day 0 of next month = last day of this month
}

/**
 * Suggest a semi-monthly cutoff based on a reference date. Day ≤ 15 → the 1–15
 * cutoff; otherwise the 16–end-of-month cutoff. Pay date defaults to the period
 * end. All values are ISO `yyyy-MM-dd` strings; the caller may override them.
 */
export function suggestSemiMonthlyPeriod(refISO: string): {
  start: string
  end: string
  payDate: string
  name: string
} {
  const [y, m, d] = refISO.split("-").map(Number)
  const firstHalf = d <= 15
  const start = firstHalf ? `${y}-${pad2(m)}-01` : `${y}-${pad2(m)}-16`
  const endDay = firstHalf ? 15 : endOfMonthDay(y, m)
  const end = `${y}-${pad2(m)}-${pad2(endDay)}`
  return { start, end, payDate: end, name: formatPeriodName(start, end) }
}

/** e.g. "Sep 1–15, 2026". Assumes start and end share a month (semi-monthly). */
export function formatPeriodName(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split("-").map(Number)
  const [, , ed] = endISO.split("-").map(Number)
  return `${MONTHS[sm - 1]} ${sd}–${ed}, ${sy}`
}

export interface NewEntryPlan {
  employeeId: string
  name: string
  basicPay: number
  allowances: number
  otherEarnings: number
  otherDeductions: number
  unpaidLeaveDays: number
  /** The employee's linked Entra user, so the new entry can be owned by them
   *  (ownership-based access — security-model §4). Null when not linked. */
  systemUserId: string | null
}

/**
 * Plan the entries to create when loading active employees into a period.
 * Only active employees not already present get a plan; basic pay defaults to
 * round2(monthly/2); variable inputs default to 0. Pure — the service performs
 * the actual creates.
 */
export function planLoadEntries(
  activeEmployees: Employee[],
  existingEmployeeIds: Set<string>,
  period: { id: string; name: string },
): NewEntryPlan[] {
  return activeEmployees
    .filter((e) => e.a365_employmentstatus === EmploymentStatus.Active)
    .filter((e) => !existingEmployeeIds.has(e.a365_employeeid))
    .map((e) => ({
      employeeId: e.a365_employeeid,
      name: `${e.a365_name} — ${period.name}`,
      basicPay: basicPayForCutoff(e.a365_basicmonthlysalary),
      allowances: 0,
      otherEarnings: 0,
      otherDeductions: 0,
      unpaidLeaveDays: 0,
      systemUserId: e._a365_systemuser_value,
    }))
}

/** Recurring inputs carried forward when copying a previous cutoff. */
export interface RecurringInputs {
  basicPay: number
  allowances: number
}

/**
 * Plan the entries to create when copying the previous cutoff. Same eligibility
 * as `planLoadEntries` (active employees not already in the period), but each
 * employee present in the source period keeps their recurring inputs (Basic Pay
 * and Allowances) instead of the defaults. Employees hired since the source
 * period fall back to the normal defaults; one-time inputs (unpaid leave, other
 * earnings/deductions, withholding tax) and calculated results are never copied
 * — the caller recalculates afterward. Pure.
 */
export function planCopyEntries(
  activeEmployees: Employee[],
  existingEmployeeIds: Set<string>,
  period: { id: string; name: string },
  sourceByEmployee: Map<string, RecurringInputs>,
): NewEntryPlan[] {
  return planLoadEntries(activeEmployees, existingEmployeeIds, period).map((plan) => {
    const source = sourceByEmployee.get(plan.employeeId)
    return source ? { ...plan, basicPay: source.basicPay, allowances: source.allowances } : plan
  })
}

/** Roll up period totals from entries, treating nulls as 0. */
export function sumEntryTotals(entries: PayrollEntry[]): {
  gross: number
  deductions: number
  net: number
} {
  return entries.reduce(
    (acc, e) => ({
      gross: round2(acc.gross + (e.a365_grosspay ?? 0)),
      deductions: round2(acc.deductions + (e.a365_totaldeductions ?? 0)),
      net: round2(acc.net + (e.a365_netpay ?? 0)),
    }),
    { gross: 0, deductions: 0, net: 0 },
  )
}
