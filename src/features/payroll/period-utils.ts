/**
 * Pure payroll helpers — UI-free, Dataverse-free. These carry the business
 * decisions (semi-monthly cutoff suggestion, confirmed basic-pay default,
 * load-employees planning, and roll-up totals) so services and components stay
 * thin and the logic is unit-testable.
 */
import { round2 } from "./services/payroll-calculation"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import { isFinalized, type PayrollStatusValue } from "./period-status"
import type { PayrollEntry } from "./types"

/**
 * Choose the source for "copy previous cutoff": the most recent Locked period
 * that starts before the target. Processing and Ready periods aren't settled,
 * so they're skipped even if they fall
 * between. Expects `periods` ordered by period start descending (how
 * listPeriods returns them). Returns null when there's no eligible source. Pure.
 */
export function selectPreviousCutoff<
  T extends { a365_payrollperiodid: string; a365_periodstart: string; a365_payrollstatus: PayrollStatusValue },
>(periods: T[], targetId: string): T | null {
  const target = periods.find((p) => p.a365_payrollperiodid === targetId)
  return (
    periods.find(
      (p) =>
        p.a365_payrollperiodid !== targetId &&
        isFinalized(p.a365_payrollstatus) &&
        (!target || p.a365_periodstart < target.a365_periodstart),
    ) ?? null
  )
}

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

export interface LinkedPeriodDateState {
  start: string
  end: string
  payDate: string
  endManuallyPicked: boolean
  payDateManuallyEdited: boolean
}

/** Keep End linked to Start until chosen, then only push it forward if needed. */
export function applyStartChange(
  state: LinkedPeriodDateState,
  start: string,
): LinkedPeriodDateState {
  const startPassedEnd = Boolean(start && state.end && start > state.end)
  const end = !state.endManuallyPicked || startPassedEnd ? start : state.end
  return {
    ...state,
    start,
    end,
    payDate: state.payDateManuallyEdited ? state.payDate : end,
  }
}

/** Update Pay date with End until the admin edits Pay date themselves. */
export function applyEndChange(
  state: LinkedPeriodDateState,
  end: string,
): LinkedPeriodDateState {
  return {
    ...state,
    end,
    payDate: state.payDateManuallyEdited ? state.payDate : end,
    endManuallyPicked: true,
  }
}

export function applyPayDateChange(
  state: LinkedPeriodDateState,
  payDate: string,
): LinkedPeriodDateState {
  return { ...state, payDate, payDateManuallyEdited: true }
}

/** ISO date-only strings sort chronologically, so no UTC conversion is needed. */
export function isEndDateDisabled(date: string, start: string): boolean {
  return Boolean(start && date < start)
}

export function isValidPeriodDates(start: string, end: string): boolean {
  return Boolean(start && end && start <= end)
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
  withholdingTax: number
  comment: string
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
      withholdingTax: 0,
      comment: "",
      systemUserId: e._a365_systemuser_value,
    }))
}

/**
 * All copyable *input* fields carried forward when copying a previous cutoff.
 * Calculated results (gross, statutory, total deductions, net) are never copied
 * — the caller recalculates afterward.
 */
export interface CopiedInputs {
  basicPay: number
  allowances: number
  otherEarnings: number
  otherDeductions: number
  unpaidLeaveDays: number
  withholdingTax: number
  comment: string
}

export interface EntryInputUpdate {
  entryId: string
  inputs: CopiedInputs
}

export interface ApplyInputsPlan {
  updates: EntryInputUpdate[]
  creates: NewEntryPlan[]
  skipped: number
}

/**
 * Decide how to apply a set of inputs (keyed by employee) to a period: overwrite
 * employees already present, add active employees not yet present, skip source
 * employees who are neither present nor active. Period employees absent from the
 * source are left untouched. Pure — the service performs the writes.
 */
export function planApplyInputs(
  sourceByEmployee: Map<string, CopiedInputs>,
  existingEntries: { a365_payrollentryid: string; _a365_employee_value: string | null }[],
  activeEmployees: Employee[],
  period: { id: string; name: string },
): ApplyInputsPlan {
  const entryIdByEmployee = new Map<string, string>()
  for (const e of existingEntries) {
    if (e._a365_employee_value) entryIdByEmployee.set(e._a365_employee_value, e.a365_payrollentryid)
  }

  const updates: EntryInputUpdate[] = []
  for (const [employeeId, inputs] of sourceByEmployee) {
    const entryId = entryIdByEmployee.get(employeeId)
    if (entryId) updates.push({ entryId, inputs })
  }

  const existingIds = new Set(entryIdByEmployee.keys())
  const creates = planLoadEntries(activeEmployees, existingIds, period).map((plan) => {
    const source = sourceByEmployee.get(plan.employeeId)
    return source ? { ...plan, ...source } : plan
  })

  const activeIds = new Set(activeEmployees.map((e) => e.a365_employeeid))
  let skipped = 0
  for (const employeeId of sourceByEmployee.keys()) {
    if (!entryIdByEmployee.has(employeeId) && !activeIds.has(employeeId)) skipped++
  }

  return { updates, creates, skipped }
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
