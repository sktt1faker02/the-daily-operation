/**
 * Payroll period & entry data service. All Dataverse access stays behind this
 * layer (CLAUDE.md "Dataverse Rules"); presentation depends on the hooks, not
 * this module. Business decisions live in the pure helpers (period-utils).
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { EmploymentStatus } from "@/features/employees/types"
import { planLoadEntries } from "../period-utils"
import {
  PAYROLL_PERIOD_TABLE,
  PAYROLL_ENTRY_TABLE,
  PayrollStatus,
  type PayrollPeriod,
  type PayrollEntry,
} from "../types"

const PERIOD_SELECT: (keyof PayrollPeriod)[] = [
  "a365_payrollperiodid",
  "a365_name",
  "a365_periodstart",
  "a365_periodend",
  "a365_paydate",
  "a365_payrollstatus",
  "createdon",
]

const ENTRY_SELECT = [
  "a365_payrollentryid",
  "a365_name",
  "a365_isincluded",
  "a365_basicpay",
  "a365_allowances",
  "a365_otherearnings",
  "a365_otherdeductions",
  "a365_unpaidleavedays",
  "a365_grosspay",
  "a365_sss",
  "a365_philhealth",
  "a365_hdmf",
  "a365_unpaidleave",
  "a365_withholdingtax",
  "a365_totaldeductions",
  "a365_netpay",
  "a365_calculatedon",
  "_a365_employee_value",
]

export const payrollPeriodService = {
  async listPeriods(): Promise<PayrollPeriod[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      { select: PERIOD_SELECT as string[], orderBy: ["a365_periodstart desc"] },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load payroll periods.")
    return result.data ?? []
  },

  async getPeriod(id: string): Promise<PayrollPeriod> {
    const result = await dataClient.retrieveRecordAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      id,
      { select: PERIOD_SELECT as string[] },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load the payroll period.")
    return result.data
  },

  async createPeriod(input: {
    start: string
    end: string
    payDate: string
    name: string
  }): Promise<PayrollPeriod> {
    const payload: Record<string, unknown> = {
      a365_name: input.name,
      a365_periodstart: input.start,
      a365_periodend: input.end,
      a365_paydate: input.payDate || null,
      a365_payrollstatus: PayrollStatus.Draft,
    }
    const result = await dataClient.createRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      payload,
    )
    if (!result.success) throw result.error ?? new Error("Unable to create the payroll period.")
    return result.data
  },

  async listEntries(periodId: string): Promise<PayrollEntry[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollEntry>(
      PAYROLL_ENTRY_TABLE,
      {
        select: ENTRY_SELECT,
        filter: `_a365_payrollperiod_value eq ${periodId}`,
        // Order by the entry name (`{Employee full name} — {Period}`); the entry
        // table has no lookup-name column to sort employees by directly.
        orderBy: ["a365_name asc"],
      },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load payroll entries.")
    const entries = result.data ?? []

    // The entry table exposes only the employee lookup (`_a365_employee_value`),
    // not a display-name column, so resolve names from the employee records and
    // attach them for the UI. One extra query, bounded by employees in the period.
    const employeeIds = [
      ...new Set(entries.map((e) => e._a365_employee_value).filter((v): v is string => Boolean(v))),
    ]
    if (employeeIds.length > 0) {
      const filter = employeeIds.map((id) => `a365_employeeid eq ${id}`).join(" or ")
      const employees = await employeeService.list({ filter })
      const nameById = new Map(employees.map((e) => [e.a365_employeeid, e.a365_name]))
      for (const entry of entries) {
        entry.a365_employeename = entry._a365_employee_value
          ? nameById.get(entry._a365_employee_value) ?? undefined
          : undefined
      }
    }
    return entries
  },

  /**
   * Create one payroll entry per active employee not already in the period.
   * Idempotent: employees already present are skipped. Returns a summary for
   * toast messaging. Business decisions (basic-pay default, naming) come from
   * `planLoadEntries`.
   */
  async loadActiveEmployees(
    periodId: string,
    periodName: string,
  ): Promise<{ created: number; skipped: number }> {
    const [active, existing] = await Promise.all([
      employeeService.list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` }),
      payrollPeriodService.listEntries(periodId),
    ])
    const existingIds = new Set(
      existing.map((e) => e._a365_employee_value).filter((v): v is string => Boolean(v)),
    )
    const plans = planLoadEntries(active, existingIds, { id: periodId, name: periodName })

    let created = 0
    for (const plan of plans) {
      const payload: Record<string, unknown> = {
        "a365_Employee@odata.bind": `/a365_employees(${plan.employeeId})`,
        "a365_PayrollPeriod@odata.bind": `/a365_payrollperiods(${periodId})`,
        a365_isincluded: true,
        a365_name: plan.name,
        a365_basicpay: plan.basicPay,
        a365_allowances: plan.allowances,
        a365_otherearnings: plan.otherEarnings,
        a365_otherdeductions: plan.otherDeductions,
        a365_unpaidleavedays: plan.unpaidLeaveDays,
      }
      const result = await dataClient.createRecordAsync<Record<string, unknown>, PayrollEntry>(
        PAYROLL_ENTRY_TABLE,
        payload,
      )
      if (!result.success) {
        throw result.error ??
          new Error(`Unable to add ${plan.name}. ${created} of ${plans.length} added before this error.`)
      }
      created += 1
    }
    return { created, skipped: active.length - plans.length }
  },
}
