/**
 * Payroll entry operations that combine the pure calculation engine with
 * Dataverse persistence. Business-oriented; keeps Dataverse access behind this
 * layer. The Draft/Processing status guard on recalculation is enforced at the
 * data layer in Phase 7 — this operation computes and writes results.
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { getStatutoryConfig } from "./statutory-config-service"
import { calculatePayroll, type PayrollInput, type StatutoryConfig } from "./payroll-calculation"
import type { PayrollEntryInputValues } from "../types"
import { isPeriodEditable, PayrollStatus } from "../types"
import { payrollPeriodService } from "./payroll-period-service"

const ENTRY_TABLE = "a365_payrollentries"

interface EntryReadModel {
  a365_payrollentryid: string
  a365_basicpay?: number
  a365_allowances?: number
  a365_otherearnings?: number
  a365_otherdeductions?: number
  a365_unpaidleavedays?: number
  a365_withholdingtax?: number
  _a365_employee_value?: string
  _a365_payrollperiod_value?: string
}

/**
 * Calculate one payroll entry and persist the results (gross, statutory
 * deductions, withholding tax, totals, net) plus the calc audit stamps.
 *
 * @param entryId            the `a365_payrollentry` id
 * @param periodEndDate      ISO yyyy-mm-dd; resolves the statutory rules in force then
 * @param calculatedByUserId the acting user's `systemuser` id (audit stamp)
 * @param preloadedConfig    optional `StatutoryConfig` already resolved for `periodEndDate`
 *                           (e.g. by `calculatePeriod`), so it isn't re-fetched from Dataverse
 *                           per entry. When omitted, it is loaded here as before.
 */
export async function calculateAndPersistEntry(
  entryId: string,
  periodEndDate: string,
  calculatedByUserId: string,
  preloadedConfig?: StatutoryConfig,
): Promise<void> {
  const read = await dataClient.retrieveRecordAsync<EntryReadModel>(ENTRY_TABLE, entryId, {
    select: [
      "a365_payrollentryid", "a365_basicpay", "a365_allowances", "a365_otherearnings",
      "a365_otherdeductions", "a365_unpaidleavedays", "a365_withholdingtax", "_a365_employee_value",
    ],
  })
  if (!read.success) throw read.error ?? new Error("Unable to load the payroll entry.")
  const entry = read.data

  await calculateAndPersist(entryId, entry, periodEndDate, calculatedByUserId, preloadedConfig)
}

/** Save edited inputs and their calculation results in one Dataverse update. */
export async function saveAndCalculateEntry(
  entryId: string,
  periodId: string,
  periodEndDate: string,
  calculatedByUserId: string,
  values: PayrollEntryInputValues,
): Promise<void> {
  const period = await payrollPeriodService.getPeriod(periodId)
  if (!isPeriodEditable(period.a365_payrollstatus)) {
    throw new Error("Payroll entries can only be edited while the period is Draft or Processing.")
  }
  const read = await dataClient.retrieveRecordAsync<EntryReadModel>(ENTRY_TABLE, entryId, {
    select: [
      "a365_payrollentryid", "a365_basicpay", "a365_allowances", "a365_otherearnings",
      "a365_otherdeductions", "a365_unpaidleavedays", "a365_withholdingtax", "_a365_employee_value",
      "_a365_payrollperiod_value",
    ],
  })
  if (!read.success) throw read.error ?? new Error("Unable to load the payroll entry.")
  if (read.data._a365_payrollperiod_value !== periodId) {
    throw new Error("The payroll entry does not belong to this period.")
  }
  await calculateAndPersist(entryId, read.data, periodEndDate, calculatedByUserId, undefined, values)
}

function amountFromInput(value: string): number {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Payroll inputs must be non-negative numbers.")
  return amount
}

async function calculateAndPersist(
  entryId: string,
  entry: EntryReadModel,
  periodEndDate: string,
  calculatedByUserId: string,
  preloadedConfig?: StatutoryConfig,
  editedValues?: PayrollEntryInputValues,
): Promise<void> {

  const employeeId = entry._a365_employee_value
  if (!employeeId) throw new Error("Payroll entry has no linked employee.")
  const employee = await employeeService.get(employeeId)

  const edited = editedValues ? {
    basicPay: amountFromInput(editedValues.a365_basicpay),
    allowances: amountFromInput(editedValues.a365_allowances),
    otherEarnings: amountFromInput(editedValues.a365_otherearnings),
    otherDeductions: amountFromInput(editedValues.a365_otherdeductions),
    unpaidLeaveDays: amountFromInput(editedValues.a365_unpaidleavedays),
    withholdingTax: amountFromInput(editedValues.a365_withholdingtax),
  } : null

  const input: PayrollInput = {
    monthlyBasicSalary: employee.a365_basicmonthlysalary ?? 0,
    basicPay: edited?.basicPay ?? entry.a365_basicpay ?? 0,
    allowances: edited?.allowances ?? entry.a365_allowances ?? 0,
    otherEarnings: edited?.otherEarnings ?? entry.a365_otherearnings ?? 0,
    otherDeductions: edited?.otherDeductions ?? entry.a365_otherdeductions ?? 0,
    unpaidLeaveDays: edited?.unpaidLeaveDays ?? entry.a365_unpaidleavedays ?? 0,
    withholdingTax: edited?.withholdingTax ?? entry.a365_withholdingtax ?? 0,
  }

  const config = preloadedConfig ?? (await getStatutoryConfig(periodEndDate))
  const result = calculatePayroll(input, config)

  // a365_withholdingtax is NOT written here — it is a manual input, not a
  // calculated result, so calculate/recalculate must not overwrite it.
  const payload: Record<string, unknown> = {
    a365_grosspay: result.grossPay,
    a365_sss: result.sss,
    a365_philhealth: result.philhealth,
    a365_hdmf: result.hdmf,
    a365_unpaidleave: result.unpaidLeave,
    a365_totaldeductions: result.totalDeductions,
    a365_netpay: result.netPay,
    a365_calculatedon: new Date().toISOString(),
    "a365_CalculatedBy@odata.bind": `/systemusers(${calculatedByUserId})`,
  }
  if (edited && editedValues) {
    Object.assign(payload, {
      a365_basicpay: edited.basicPay,
      a365_allowances: edited.allowances,
      a365_otherearnings: edited.otherEarnings,
      a365_otherdeductions: edited.otherDeductions,
      a365_unpaidleavedays: edited.unpaidLeaveDays,
      a365_withholdingtax: edited.withholdingTax,
      a365_comment: editedValues.a365_comment.trim() || null,
    })
  }
  const update = await dataClient.updateRecordAsync<Record<string, unknown>, EntryReadModel>(
    ENTRY_TABLE,
    entryId,
    payload,
  )
  if (!update.success) throw update.error ?? new Error("Unable to save the calculation results.")
}

/**
 * Calculate every included entry in a period. Aggregates failures rather than
 * failing silently: the first entry error stops the run and is surfaced.
 *
 * The statutory config for `periodEndDate` is resolved once and reused across
 * all entries (CLAUDE.md "Performance") instead of being re-fetched from
 * Dataverse on every iteration.
 */
export async function calculatePeriod(
  periodId: string,
  periodEndDate: string,
  calculatedByUserId: string,
): Promise<{ calculated: number }> {
  const entries = await payrollPeriodService.listEntries(periodId)
  const included = entries.filter((e) => e.a365_isincluded)
  const config = await getStatutoryConfig(periodEndDate)
  let calculated = 0
  for (const entry of included) {
    await calculateAndPersistEntry(entry.a365_payrollentryid, periodEndDate, calculatedByUserId, config)
    calculated += 1
  }
  // First calculation advances the period Draft → Processing (centralized rule).
  const period = await payrollPeriodService.getPeriod(periodId)
  if (period.a365_payrollstatus === PayrollStatus.Draft) {
    await payrollPeriodService.transitionStatus(periodId, PayrollStatus.Processing, calculatedByUserId)
  }
  return { calculated }
}
