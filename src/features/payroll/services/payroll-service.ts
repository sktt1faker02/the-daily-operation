/**
 * Payroll entry operations that combine the pure calculation engine with
 * Dataverse persistence. Business-oriented; keeps Dataverse access behind this
 * layer. The Draft/Processing status guard on recalculation is enforced at the
 * data layer in Phase 7 — this operation computes and writes results.
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { getStatutoryConfig } from "./statutory-config-service"
import { calculatePayroll, type PayrollInput } from "./payroll-calculation"

const ENTRY_TABLE = "a365_payrollentries"

interface EntryReadModel {
  a365_payrollentryid: string
  a365_basicpay?: number
  a365_allowances?: number
  a365_otherearnings?: number
  a365_otherdeductions?: number
  a365_unpaidleavedays?: number
  _a365_employee_value?: string
}

/**
 * Calculate one payroll entry and persist the results (gross, statutory
 * deductions, withholding tax, totals, net) plus the calc audit stamps.
 *
 * @param entryId            the `a365_payrollentry` id
 * @param periodEndDate      ISO yyyy-mm-dd; resolves the statutory rules in force then
 * @param calculatedByUserId the acting user's `systemuser` id (audit stamp)
 */
export async function calculateAndPersistEntry(
  entryId: string,
  periodEndDate: string,
  calculatedByUserId: string,
): Promise<void> {
  const read = await dataClient.retrieveRecordAsync<EntryReadModel>(ENTRY_TABLE, entryId, {
    select: [
      "a365_payrollentryid", "a365_basicpay", "a365_allowances", "a365_otherearnings",
      "a365_otherdeductions", "a365_unpaidleavedays", "_a365_employee_value",
    ],
  })
  if (!read.success) throw read.error ?? new Error("Unable to load the payroll entry.")
  const entry = read.data

  const employeeId = entry._a365_employee_value
  if (!employeeId) throw new Error("Payroll entry has no linked employee.")
  const employee = await employeeService.get(employeeId)

  const input: PayrollInput = {
    monthlyBasicSalary: employee.a365_basicmonthlysalary ?? 0,
    basicPay: entry.a365_basicpay ?? 0,
    allowances: entry.a365_allowances ?? 0,
    otherEarnings: entry.a365_otherearnings ?? 0,
    otherDeductions: entry.a365_otherdeductions ?? 0,
    unpaidLeaveDays: entry.a365_unpaidleavedays ?? 0,
  }

  const config = await getStatutoryConfig(periodEndDate)
  const result = calculatePayroll(input, config)

  const payload: Record<string, unknown> = {
    a365_grosspay: result.grossPay,
    a365_sss: result.sss,
    a365_philhealth: result.philhealth,
    a365_hdmf: result.hdmf,
    a365_unpaidleave: result.unpaidLeave,
    a365_withholdingtax: result.withholdingTax,
    a365_totaldeductions: result.totalDeductions,
    a365_netpay: result.netPay,
    a365_calculatedon: new Date().toISOString(),
    "a365_CalculatedBy@odata.bind": `/systemusers(${calculatedByUserId})`,
  }
  const update = await dataClient.updateRecordAsync<Record<string, unknown>, EntryReadModel>(
    ENTRY_TABLE,
    entryId,
    payload,
  )
  if (!update.success) throw update.error ?? new Error("Unable to save the calculation results.")
}
