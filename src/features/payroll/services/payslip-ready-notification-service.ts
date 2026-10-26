import { dataClient } from "@/lib/power/data-client"
import { WhoAmIService } from "@/generated/services/WhoAmIService"
import { getCurrentUserRoles } from "./security-service"
import { payrollPeriodService } from "./payroll-period-service"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { notificationMailboxAddress } from "@/lib/notification-email"
import { buildPayslipReadyEmail, type PayslipEmailEmployee } from "../payslip-ready-email"
import { isVisibleToEmployee } from "../period-status"
import { PAYROLL_ENTRY_TABLE } from "../types"

export type PayslipNotificationStatus = "accepted" | "missing-email" | "unavailable" | "unknown"
export interface PayslipNotificationRecipient {
  entryId: string
  employeeId: string | null
  name: string
  status: PayslipNotificationStatus
  detail: string
}
export interface PayslipNotificationReport {
  periodId: string
  readyOn?: string
  recipients: PayslipNotificationRecipient[]
  error?: string
}
export interface PayslipNotificationRequest {
  periodId: string
  entryIds?: readonly string[]
  expectedReadyOn?: string
}
interface NotificationEntry {
  a365_payrollentryid: string
  a365_name: string
  a365_isincluded: boolean
  _a365_employee_value: string | null
  _a365_payrollperiod_value: string
}

function guid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("A valid payroll record is required.")
  }
  return value.toLowerCase()
}

/** Read every included entry before sending anything; a partial read sends none. */
async function includedEntries(periodId: string): Promise<NotificationEntry[]> {
  const rows: NotificationEntry[] = []
  const seen = new Set<string>()
  const tokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const page = await dataClient.retrieveMultipleRecordsAsync<NotificationEntry>(PAYROLL_ENTRY_TABLE, {
      select: ["a365_payrollentryid", "a365_name", "a365_isincluded", "_a365_employee_value", "_a365_payrollperiod_value"],
      filter: `_a365_payrollperiod_value eq ${periodId} and a365_isincluded eq true`,
      orderBy: ["a365_payrollentryid asc"], maxPageSize: 500, skipToken,
    })
    if (!page.success || !Array.isArray(page.data)) throw new Error("Unable to read all included employees. No notification emails were sent; retry notifications.")
    for (const row of page.data) {
      const id = guid(row.a365_payrollentryid)
      if (seen.has(id) || guid(row._a365_payrollperiod_value) !== periodId) throw new Error("The payroll employee list could not be verified. No notification emails were sent.")
      seen.add(id)
      if (row.a365_isincluded) rows.push(row)
    }
    skipToken = page.skipToken
    if (skipToken && (tokens.has(skipToken) || tokens.size >= 10000)) throw new Error("Unable to read all included employees. No notification emails were sent; retry notifications.")
    if (skipToken) tokens.add(skipToken)
  } while (skipToken)
  return rows
}

/** One private email per included employee. No automatic mail retries or writes
 * to financial data. The connector's acceptance is not proof of inbox delivery. */
export async function sendPayslipReadyNotifications(request: PayslipNotificationRequest): Promise<PayslipNotificationReport> {
  const report: PayslipNotificationReport = { periodId: request.periodId, recipients: [] }
  try {
    const periodId = guid(request.periodId)
    const identity = await WhoAmIService.WhoAmI()
    if (!identity.success || typeof identity.data?.UserId !== "string" || !(await getCurrentUserRoles(guid(identity.data.UserId))).isAdmin) {
      report.error = "Payroll Admin access is required to send payslip notifications."
      return report
    }
    const period = await payrollPeriodService.getPeriod(periodId)
    report.readyOn = period.a365_readyon ?? undefined
    if (!isVisibleToEmployee(period.a365_payrollstatus) || period.statecode === 1 || !report.readyOn ||
      (request.expectedReadyOn && request.expectedReadyOn !== report.readyOn)) {
      report.error = "The payroll release has changed or is not available to employees. No notification emails were sent."
      return report
    }
    const entries = await includedEntries(periodId)
    const selected = request.entryIds ? new Set(request.entryIds.map(guid)) : null
    const employeeIds = new Set<string>()
    const asOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
    for (const entry of entries) {
      if (selected && !selected.has(guid(entry.a365_payrollentryid))) continue
      const employeeId = entry._a365_employee_value?.toLowerCase() ?? null
      if (employeeId && employeeIds.has(employeeId)) continue
      if (employeeId) employeeIds.add(employeeId)
      const result: PayslipNotificationRecipient = { entryId: entry.a365_payrollentryid, employeeId,
        name: entry.a365_name || "Payroll entry", status: "unavailable", detail: "No employee is linked to this entry." }
      report.recipients.push(result)
      if (!employeeId) continue
      let employee: PayslipEmailEmployee
      try {
        const read = await dataClient.retrieveRecordAsync<PayslipEmailEmployee>("a365_employees", guid(employeeId), {
          select: ["a365_employeeid", "a365_name", "a365_workemail"],
        })
        if (!read.success || !read.data || guid(read.data.a365_employeeid) !== employeeId || typeof read.data.a365_name !== "string") throw new Error("Unverified employee")
        employee = read.data
        result.name = employee.a365_name
      } catch {
        result.detail = "Unable to read this employee's Work Email. Retry after checking access."
        continue
      }
      const draft = buildPayslipReadyEmail(employee, period, asOf)
      if (!draft) {
        result.status = "missing-email"
        result.detail = "Add a valid Work Email to the employee profile, then retry this notification."
        continue
      }
      // Mark the attempt uncertain before calling the external sender. Never
      // blindly repeat a request after a lost response or connector error.
      result.status = "unknown"
      result.detail = "Send outcome uncertain. Check the sending account before retrying."
      try {
        const sent = await Office365OutlookService.SharedMailboxSendEmailV2({ MailboxAddress: notificationMailboxAddress, To: draft.to, Subject: draft.subject, Body: draft.html, Importance: "Normal" })
        if (sent.success) {
          result.status = "accepted"
          result.detail = "Accepted by the sending service."
        }
      } catch { /* Preserve the explicit uncertain outcome; continue other employees. */ }
    }
    return report
  } catch {
    report.error = "Unable to prepare payslip notifications. Review the payroll status and your access before retrying."
    return report
  }
}
