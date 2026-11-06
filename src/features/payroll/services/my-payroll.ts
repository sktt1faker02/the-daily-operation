/**
 * Employee-facing payroll (the "My Payroll" portal). Composes an employee's own
 * entries with their periods and exposes only Ready or Locked payslips —
 * Processing cutoffs are never shown to the
 * employee. Record access is Dataverse-enforced; this is the employee's own data.
 */
import { payrollPeriodService } from "./payroll-period-service"
import { isVisibleToEmployee } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

/** One finalized payslip: the entry paired with the period it belongs to. */
export interface Payslip {
  entry: PayrollEntry
  period: PayrollPeriod
}

/** Statuses an employee is allowed to see a payslip for (money released / closed). */
/**
 * Keep only entries whose period is Ready or Locked, pair each with its period,
 * and sort newest cutoff first. Pure so the visibility rule is unit-testable.
 */
export function selectVisiblePayslips(
  entries: PayrollEntry[],
  periods: PayrollPeriod[],
): Payslip[] {
  const periodById = new Map(periods.map((p) => [p.a365_payrollperiodid, p]))
  const slips: Payslip[] = []
  for (const entry of entries) {
    const periodId = entry._a365_payrollperiod_value
    const period = periodId ? periodById.get(periodId) : undefined
    if (period && isVisibleToEmployee(period.a365_payrollstatus)) {
      slips.push({ entry, period })
    }
  }
  slips.sort((a, b) => b.period.a365_periodstart.localeCompare(a.period.a365_periodstart))
  return slips
}

/** All finalized payslips for one employee, newest first. */
export async function listPayslipsForEmployee(employeeId: string): Promise<Payslip[]> {
  const [entries, periods] = await Promise.all([
    payrollPeriodService.listEntriesForEmployee(employeeId),
    payrollPeriodService.listPeriods(),
  ])
  return selectVisiblePayslips(entries, periods)
}
