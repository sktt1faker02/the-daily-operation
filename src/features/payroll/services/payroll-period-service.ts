/**
 * Payroll period & entry data service. All Dataverse access stays behind this
 * layer (CLAUDE.md "Dataverse Rules"); presentation depends on the hooks, not
 * this module. Business decisions live in the pure helpers (period-utils).
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { referenceService } from "@/features/employees/reference-service"
import { userService } from "@/features/employees/user-service"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import { calculateStoredEntryTotals, planLoadEntries, planApplyInputs, selectPreviousCutoff, type NewEntryPlan, type CopiedInputs } from "../period-utils"
import { round2 } from "./payroll-calculation"
import { canTransition, PayrollStatus, payrollStatusLabel } from "../period-status"
import {
  PAYROLL_PERIOD_TABLE,
  PAYROLL_ENTRY_TABLE,
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
  "statecode",
  "a365_lockedon",
  "createdon",
  // Audit trail (Phase 9): lifecycle date stamps + actor lookup GUIDs. Actor
  // display names are resolved from these `_value`s in getPeriod — the `...name`
  // columns are not valid Web API `$select` properties.
  "modifiedon",
  "a365_readyon",
  "a365_paidon",
  "_createdby_value",
  "_modifiedby_value",
  "_a365_readyby_value",
  "_a365_paidby_value",
  "_a365_lockedby_value",
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
  "a365_comment",
  "_a365_employee_value",
  "_a365_payrollperiod_value",
]

async function retrieveAllPages<T>(table: string, options: Parameters<typeof dataClient.retrieveMultipleRecordsAsync<T>>[1]): Promise<T[]> {
  const records: T[] = []
  let skipToken: string | undefined
  do {
    const result = await dataClient.retrieveMultipleRecordsAsync<T>(table, {
      ...options,
      maxPageSize: 500,
      ...(skipToken ? { skipToken } : {}),
    })
    if (!result.success) throw result.error ?? new Error("Unable to load payroll export data.")
    records.push(...(result.data ?? []))
    skipToken = result.skipToken
  } while (skipToken)
  return records
}

export const payrollPeriodService = {
  async listPeriods(): Promise<PayrollPeriod[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      {
        select: PERIOD_SELECT as string[],
        // Only active periods; archived (deactivated) periods are hidden.
        filter: "statecode eq 0",
        // Tie-break by creation time so "latest cutoff" is deterministic when two
        // periods share a start date (e.g. duplicate cutoffs created during testing).
        orderBy: ["a365_periodstart desc", "createdon desc"],
      },
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
    const period = result.data

    // Resolve audit actor names for the detail page's audit trail. One bounded
    // query; the list/dashboard don't show actors so they skip this.
    const names = await userService.getNamesByIds([
      period._createdby_value,
      period._modifiedby_value,
      period._a365_readyby_value,
      period._a365_paidby_value,
      period._a365_lockedby_value,
    ])
    const nameOf = (value: string | null | undefined) => (value ? names.get(value) : undefined)
    period.createdbyname = nameOf(period._createdby_value)
    period.modifiedbyname = nameOf(period._modifiedby_value)
    period.a365_readybyname = nameOf(period._a365_readyby_value)
    period.a365_paidbyname = nameOf(period._a365_paidby_value)
    period.a365_lockedbyname = nameOf(period._a365_lockedby_value)
    return period
  },

  /**
   * Move a period to `to`, validated against the centralized lifecycle rules,
   * and stamp all matching audit columns in the same update. Unlock (→ Processing)
   * clears the lock date.
   * The plug-in enforces entry immutability; this writes the period lifecycle.
   */
  async transitionStatus(
    periodId: string,
    to: PayrollStatus,
    actingUserId: string,
  ): Promise<void> {
    const period = await payrollPeriodService.getPeriod(periodId)
    const from = period.a365_payrollstatus
    if (!canTransition(from, to)) {
      throw new Error(
        `Cannot change payroll from ${payrollStatusLabel(from)} to ${payrollStatusLabel(to)}.`,
      )
    }
    if (to === PayrollStatus.Ready) {
      const entries = await payrollPeriodService.listEntries(periodId)
      const uncalculatedCount = entries.filter(
        (entry) => entry.a365_isincluded && !hasCalculatedResults(entry),
      ).length
      if (uncalculatedCount > 0) {
        throw new Error(
          `Calculate all included payroll entries before marking this period Ready (${uncalculatedCount} remaining).`,
        )
      }
      // Reconcile old populated totals before finalization. Use saved deduction
      // amounts so a formula correction never picks up newer salaries or rules.
      const corrections = entries.filter((entry) => entry.a365_isincluded).map((entry) => {
        const totals = calculateStoredEntryTotals(entry)
        if (!Object.values(totals).every(Number.isFinite) ||
          Math.round(totals.netPay * 100) !== Math.round(round2(entry.a365_netpay ?? 0) * 100)) {
          throw new Error(`Recalculate ${entry.a365_name || "the payroll entry"} before marking this period Ready; its saved net pay does not reconcile.`)
        }
        return { entry, totals }
      }).filter(({ entry, totals }) =>
        Math.round(round2(entry.a365_grosspay ?? 0) * 100) !== Math.round(totals.grossPay * 100) ||
        Math.round(round2(entry.a365_totaldeductions ?? 0) * 100) !== Math.round(totals.totalDeductions * 100),
      )
      for (const { entry, totals } of corrections) {
        const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollEntry>(
          PAYROLL_ENTRY_TABLE, entry.a365_payrollentryid, {
            a365_grosspay: totals.grossPay,
            a365_totaldeductions: totals.totalDeductions,
            a365_netpay: totals.netPay,
            a365_calculatedon: new Date().toISOString(),
            "a365_CalculatedBy@odata.bind": `/systemusers(${actingUserId})`,
          },
        )
        if (!result.success) throw result.error ?? new Error("Unable to correct payroll totals. The period is still Processing; retry Mark Ready.")
      }
    }
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = { a365_payrollstatus: to }
    if (to === PayrollStatus.Ready) {
      payload.a365_readyon = now
      payload["a365_ReadyBy@odata.bind"] = `/systemusers(${actingUserId})`
    } else if (to === PayrollStatus.Locked) {
      payload.a365_paidon = now
      payload["a365_PaidBy@odata.bind"] = `/systemusers(${actingUserId})`
      payload.a365_lockedon = now
      payload["a365_LockedBy@odata.bind"] = `/systemusers(${actingUserId})`
    } else if (to === PayrollStatus.Processing) {
      payload.a365_lockedon = null // Unlock: no longer locked; status is the source of truth
    }
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      periodId,
      payload,
    )
    if (!result.success) throw result.error ?? new Error("Unable to update payroll status.")
  },

  /** Archived (deactivated) periods, newest first — for the admin Archived table. */
  async listArchivedPeriods(): Promise<PayrollPeriod[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      {
        select: PERIOD_SELECT as string[],
        filter: "statecode eq 1",
        orderBy: ["a365_periodstart desc", "createdon desc"],
      },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load archived periods.")
    return (result.data ?? []).map((period) => ({ ...period, statecode: 1 }))
  },

  /**
   * Archive a period by deactivating the record (statecode Inactive). It drops
   * out of the active period lists and becomes read-only in Dataverse.
   */
  async archivePeriod(periodId: string): Promise<void> {
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      periodId,
      { statecode: 1, statuscode: 2 },
    )
    if (!result.success) throw result.error ?? new Error("Unable to archive the payroll period.")
  },

  /** Reactivate an archived period (statecode/statuscode back to Active). */
  async unarchivePeriod(periodId: string): Promise<void> {
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      periodId,
      { statecode: 0, statuscode: 1 },
    )
    if (!result.success) throw result.error ?? new Error("Unable to unarchive the payroll period.")
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
      a365_payrollstatus: PayrollStatus.Processing,
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
      const employeeById = new Map(employees.map((employee) => [employee.a365_employeeid, employee]))
      const departmentNames = await referenceService.getDepartmentNamesByIds(
        employees
          .map((employee) => employee._a365_department_value)
          .filter((id): id is string => Boolean(id)),
      )
      for (const entry of entries) {
        const employee = entry._a365_employee_value
          ? employeeById.get(entry._a365_employee_value)
          : undefined
        entry.a365_employeename = employee?.a365_name
        entry.a365_employeenumber = employee?.a365_employeenumber
        entry.a365_departmentname = employee?._a365_department_value
          ? departmentNames.get(employee._a365_department_value)
          : undefined
        entry.a365_bankname = employee?.a365_bankname
        entry.a365_bankaccountnumber = employee?.a365_bankaccountnumber
      }
    }
    return entries
  },

  /** Loads export entries in bounded period batches and follows Dataverse continuation tokens. */
  async listEntriesForExport(periodIds: string[], onProgress?: (completedPeriods: number) => void): Promise<Map<string, PayrollEntry[]>> {
    const result = new Map<string, PayrollEntry[]>(periodIds.map((id) => [id, []]))
    const periodBatches: string[][] = []
    for (let index = 0; index < periodIds.length; index += 10) periodBatches.push(periodIds.slice(index, index + 10))
    let completed = 0
    for (const batch of periodBatches) {
      const filter = batch.map((id) => `_a365_payrollperiod_value eq ${id}`).join(" or ")
      const entries = await retrieveAllPages<PayrollEntry>(PAYROLL_ENTRY_TABLE, {
        select: ENTRY_SELECT,
        filter,
        orderBy: ["a365_name asc"],
      })
      const employeeIds = [...new Set(entries.map((entry) => entry._a365_employee_value).filter((id): id is string => Boolean(id)))]
      const employeeRecords: Employee[] = []
      for (let index = 0; index < employeeIds.length; index += 20) {
        const employeeFilter = employeeIds.slice(index, index + 20).map((id) => `a365_employeeid eq ${id}`).join(" or ")
        employeeRecords.push(...await employeeService.list({ filter: employeeFilter }))
      }
      const employeesById = new Map(employeeRecords.map((employee) => [employee.a365_employeeid, employee]))
      const departmentNames = await referenceService.getDepartmentNamesByIds(
        employeeRecords.map((employee) => employee._a365_department_value).filter((id): id is string => Boolean(id)),
      )
      for (const entry of entries) {
        const employee = entry._a365_employee_value ? employeesById.get(entry._a365_employee_value) : undefined
        entry.a365_employeename = employee?.a365_name
        entry.a365_employeenumber = employee?.a365_employeenumber
        entry.a365_departmentname = employee?._a365_department_value ? departmentNames.get(employee._a365_department_value) : undefined
        entry.a365_bankname = employee?.a365_bankname
        entry.a365_bankaccountnumber = employee?.a365_bankaccountnumber
        const periodId = entry._a365_payrollperiod_value
        if (periodId && result.has(periodId)) result.get(periodId)!.push(entry)
      }
      completed += batch.length
      onProgress?.(completed)
    }
    return result
  },

  /**
   * All payroll entries across every period, with a lean select for roll-ups
   * (no employee-name resolution). Used by the Overview dashboard, which groups
   * them by period client-side. Fine for this org's small data volume.
   */
  async listAllEntries(): Promise<PayrollEntry[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollEntry>(PAYROLL_ENTRY_TABLE, {
      select: [
        "a365_payrollentryid",
        "a365_isincluded",
        "a365_grosspay",
        "a365_totaldeductions",
        "a365_netpay",
        "_a365_payrollperiod_value",
      ],
    })
    if (!result.success) throw result.error ?? new Error("Unable to load payroll entries.")
    return result.data ?? []
  },

  /** Every payroll entry belonging to one employee (across all periods). */
  async listEntriesForEmployee(employeeId: string): Promise<PayrollEntry[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollEntry>(
      PAYROLL_ENTRY_TABLE,
      { select: ENTRY_SELECT, filter: `_a365_employee_value eq ${employeeId}` },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load your payroll entries.")
    return result.data ?? []
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
    const created = await createPlannedEntries(periodId, plans)
    return { created, skipped: active.length - plans.length }
  },

  /**
   * Populate a period by copying the previous cutoff. Source = the most recent
   * most recent Locked period that starts before the target; Processing and
   * Ready periods are skipped, since their inputs aren't
   * settled. Each returning employee's ALL inputs are carried forward — Basic Pay,
   * Allowances, Other Earnings, Other Deductions, Unpaid Leave days, and
   * Withholding Tax — so the admin starts from a full copy and manually adjusts
   * only what changed. Employees not yet in the period are added; employees
   * already present are **updated** (overwritten) with the source values.
   * Calculated results (gross, statutory, total deductions, net) are never copied
   * — the caller recalculates afterward. Employees absent from the source (e.g.
   * newly hired) are left untouched. Returns a summary for toast messaging;
   * `copiedFrom` is null when there is no finalized previous period to copy from.
   */
  async copyFromPreviousCutoff(
    periodId: string,
    periodName: string,
  ): Promise<{ created: number; updated: number; copiedFrom: string | null; skipped: number }> {
    const periods = await payrollPeriodService.listPeriods()
    const source = selectPreviousCutoff(periods, periodId)
    if (!source) return { created: 0, updated: 0, copiedFrom: null, skipped: 0 }

    const [sourceEntries, active, existing] = await Promise.all([
      payrollPeriodService.listEntries(source.a365_payrollperiodid),
      employeeService.list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` }),
      payrollPeriodService.listEntries(periodId),
    ])

    const sourceByEmployee = new Map<string, CopiedInputs>()
    for (const entry of sourceEntries) {
      if (entry._a365_employee_value) {
        sourceByEmployee.set(entry._a365_employee_value, {
          basicPay: entry.a365_basicpay ?? 0,
          allowances: entry.a365_allowances ?? 0,
          otherEarnings: entry.a365_otherearnings ?? 0,
          otherDeductions: entry.a365_otherdeductions ?? 0,
          unpaidLeaveDays: entry.a365_unpaidleavedays ?? 0,
          withholdingTax: entry.a365_withholdingtax ?? 0,
          comment: entry.a365_comment ?? "",
        })
      }
    }

    const { created, updated } = await applyInputsToPeriod(periodId, periodName, sourceByEmployee, active, existing)
    return { created, updated, copiedFrom: source.a365_name, skipped: Math.max(0, active.length - created - updated) }
  },

  /** Create entries from precomputed plans. Exposed so payroll-template-service
   *  can reuse the shared create logic when applying a template. */
  async createEntriesFromPlans(periodId: string, plans: NewEntryPlan[]): Promise<number> {
    return createPlannedEntries(periodId, plans)
  },
}

/**
 * Apply a set of inputs keyed by employee to a period: overwrite present
 * employees, add active-and-missing ones. Returns counts. Shared by copy-previous
 * and template-load. Caller recalculates afterward.
 */
async function applyInputsToPeriod(
  periodId: string,
  periodName: string,
  sourceByEmployee: Map<string, CopiedInputs>,
  active: Employee[],
  existing: PayrollEntry[],
): Promise<{ created: number; updated: number; skipped: number }> {
  const plan = planApplyInputs(sourceByEmployee, existing, active, { id: periodId, name: periodName })
  for (const { entryId, inputs } of plan.updates) {
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollEntry>(
      PAYROLL_ENTRY_TABLE,
      entryId,
      {
        a365_basicpay: inputs.basicPay,
        a365_allowances: inputs.allowances,
        a365_otherearnings: inputs.otherEarnings,
        a365_otherdeductions: inputs.otherDeductions,
        a365_unpaidleavedays: inputs.unpaidLeaveDays,
        a365_withholdingtax: inputs.withholdingTax,
        a365_comment: inputs.comment || null,
      },
    )
    if (!result.success) throw result.error ?? new Error("Unable to update payroll entry.")
  }
  const created = await createPlannedEntries(periodId, plan.creates)
  return { created, updated: plan.updates.length, skipped: plan.skipped }
}

/**
 * Create one payroll entry per plan. Shared by loadActiveEmployees and
 * copyFromPreviousCutoff. Stops on the first failure and reports how many were
 * added before it (partial-write visibility). Returns the created count.
 */
async function createPlannedEntries(periodId: string, plans: NewEntryPlan[]): Promise<number> {
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
      a365_withholdingtax: plan.withholdingTax,
      a365_comment: plan.comment || null,
    }
    // Own the entry as the employee's linked user so they can read their own
    // payslip at User level (security-model §4). Set at creation, while the
    // period is editable — a locked entry's owner can no longer be changed.
    if (plan.systemUserId) {
      payload["ownerid@odata.bind"] = `/systemusers(${plan.systemUserId})`
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
  return created
}

function hasCalculatedResults(entry: PayrollEntry): boolean {
  return Boolean(entry.a365_calculatedon) && [
    entry.a365_grosspay,
    entry.a365_sss,
    entry.a365_philhealth,
    entry.a365_hdmf,
    entry.a365_unpaidleave,
    entry.a365_withholdingtax,
    entry.a365_totaldeductions,
    entry.a365_netpay,
  ].every((value) => value !== null && value !== undefined && Number.isFinite(value))
}
