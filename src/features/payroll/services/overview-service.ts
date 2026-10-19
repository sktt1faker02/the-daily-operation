/**
 * Payroll Overview dashboard data: headline stat cards (active employees +
 * latest cutoff's gross/deductions/net) and a recent-payroll table. Aggregation
 * is a pure function so it's unit-testable; the fetch pulls periods, all entries
 * (grouped client-side), and the active-employee count in parallel.
 */
import { payrollPeriodService } from "./payroll-period-service"
import { employeeService } from "@/features/employees/employee-service"
import { EmploymentStatus } from "@/features/employees/types"
import { sumEntryTotals } from "../period-utils"
import { isFinalized } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

export interface RecentPeriodRow {
  period: PayrollPeriod
  employees: number
  net: number
}

export interface PayrollOverview {
  activeEmployees: number
  /** Totals for the most recent cutoff ("this cutoff"). */
  cutoff: { gross: number; deductions: number; net: number }
  cutoffPeriod: PayrollPeriod | null
  recent: RecentPeriodRow[]
}

const RECENT_LIMIT = 5

/** Group included entries by period, then roll up the latest cutoff and recent rows. */
export function buildOverview(
  periods: PayrollPeriod[],
  entries: PayrollEntry[],
  activeEmployees: number,
  recentLimit = RECENT_LIMIT,
): PayrollOverview {
  const byPeriod = new Map<string, PayrollEntry[]>()
  for (const entry of entries) {
    const periodId = entry._a365_payrollperiod_value
    if (!periodId || !entry.a365_isincluded) continue
    const list = byPeriod.get(periodId) ?? []
    list.push(entry)
    byPeriod.set(periodId, list)
  }

  // Headline cards summarize the latest Locked cutoff. `periods`
  // arrives newest-first (listPeriods orders by period start desc), so the first
  // finalized one is the most recent. In-progress cutoffs don't drive the cards.
  const cutoffPeriod = periods.find((p) => isFinalized(p.a365_payrollstatus)) ?? null
  const cutoffEntries = cutoffPeriod ? byPeriod.get(cutoffPeriod.a365_payrollperiodid) ?? [] : []
  const cutoff = sumEntryTotals(cutoffEntries)

  const recent = periods.slice(0, recentLimit).map((period) => {
    const periodEntries = byPeriod.get(period.a365_payrollperiodid) ?? []
    return { period, employees: periodEntries.length, net: sumEntryTotals(periodEntries).net }
  })

  return { activeEmployees, cutoff, cutoffPeriod, recent }
}

export async function getPayrollOverview(): Promise<PayrollOverview> {
  const [periods, entries, activeEmployees] = await Promise.all([
    payrollPeriodService.listPeriods(),
    payrollPeriodService.listAllEntries(),
    employeeService
      .list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` })
      .then((rows) => rows.length),
  ])
  return buildOverview(periods, entries, activeEmployees)
}
