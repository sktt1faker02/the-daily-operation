import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { notificationMailboxAddress } from "@/lib/notification-email"
import { buildRecordedLeaveEmail, type LeaveEmailContext } from "./notification-template"
import { dateOnly, requireGuid } from "./rules"
import { leaveService } from "./leave-service"
import type { LeaveEntryValues } from "./entry-rules"
import type { LeaveRecord } from "./types"
import { leaveAllocation, type AllocatedDay } from "./allocation"

export interface PostingPreview {
  policyVersion: string
  periodStart: string
  periodEnd: string
  VL: number
  SL: number
  pendingVL: number
  pendingSL: number
  days: number | null
  benefit: number | null
  pool: "VL" | "SL" | null
  allocationVersion: 1
  paidDays: number | null
  unpaidDays: number | null
  allocation: AllocatedDay[] | null
}
export type NotificationOutcome = "accepted" | "failed" | "unknown"
export interface ReviewedAllocation { paidDays: number; unpaidDays: number }
export interface LeaveDeletionPreview { restoredDays: number; pool: "VL" | "SL"; creditPeriod: string; year: number }

export class LeavePostingError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain: boolean) { super(message); this.name = "LeavePostingError"; this.uncertain = uncertain }
}

function safeError(error: unknown): LeavePostingError {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null
  const message = typeof record?.message === "string" ? record.message : typeof error === "string" ? error : ""
  const safe = /LEAVE: ([^"\\\r\n]+)/.exec(message)?.[1]
  return new LeavePostingError(safe ?? "The Leave service response could not be confirmed. Retry the same request; do not create a replacement.", !safe)
}

async function command(request: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const result = await A365_LeaveCommandService.a365_LeaveCommand(JSON.stringify(request))
    if (!result.success) throw result.error
    const raw = result.data?.Response
    if (typeof raw !== "string") throw new Error("Unconfirmed response")
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Unconfirmed response")
    return parsed as Record<string, unknown>
  } catch (error) { throw safeError(error) }
}

function source(value: unknown): LeaveRecord {
  if (!value || typeof value !== "object") throw new LeavePostingError("The saved Leave response could not be verified. Retry the same operation.", true)
  const row = value as Record<string, unknown>
  try {
    requireGuid(String(row.a365_leaveid ?? ""))
    requireGuid(String(row._a365_employee_value ?? ""))
  } catch {
    throw new LeavePostingError("The saved Leave response could not be verified. Retry the same operation.", true)
  }
  if (typeof row.a365_days !== "number" || !Number.isFinite(row.a365_days) || row.a365_leavestatus !== 749910000 || typeof row.a365_issuedon !== "string") {
    throw new LeavePostingError("The saved Leave response could not be verified. Retry the same operation.", true)
  }
  try { leaveAllocation(row as unknown as LeaveRecord) }
  catch { throw new LeavePostingError("The saved paid/unpaid allocation could not be verified. Retry the same operation.", true) }
  return row as unknown as LeaveRecord
}

export const postingService = {
  async deletionPreview(record: LeaveRecord): Promise<LeaveDeletionPreview> {
    const id = requireGuid(record.a365_leaveid), employeeId = requireGuid(record._a365_employee_value ?? "")
    const result = await command({ command: "deletePreview", operationId: id, employeeId })
    if (result.recordId !== id || result.employeeId !== employeeId || result.deleted !== false || typeof result.restoredDays !== "number" || !Number.isFinite(result.restoredDays) || result.restoredDays < 0 || !["VL", "SL"].includes(String(result.pool)) || typeof result.creditPeriod !== "string" || !Number.isInteger(result.year)) {
      throw new LeavePostingError("The deletion impact could not be verified. Refresh and try again.", false)
    }
    dateOnly(result.creditPeriod)
    return result as unknown as LeaveDeletionPreview
  },
  async deleteLeave(record: LeaveRecord, expectedRestoredDays: number): Promise<void> {
    const id = requireGuid(record.a365_leaveid), employeeId = requireGuid(record._a365_employee_value ?? "")
    const result = await command({ command: "delete", operationId: id, employeeId, expectedRestoredDays })
    if (result.deleted !== true || result.recordId !== id || result.employeeId !== employeeId || result.restoredDays !== expectedRestoredDays) {
      throw new LeavePostingError("The deletion outcome could not be confirmed. Retry the same record; credits will not be restored twice.", true)
    }
  },
  async preview(values: LeaveEntryValues): Promise<PostingPreview> {
    const complete = Boolean(values.startDate && values.endDate && values.leaveType && values.benefit)
    const response = await command({ command: "preview", employeeId: values.employee?.a365_employeeid,
      ...(complete ? { startDate: values.startDate, endDate: values.endDate, leaveType: Number(values.leaveType), benefit: Number(values.benefit) } : {}),
    })
    if (response.allocationVersion !== 1) throw new LeavePostingError("The Leave server update for paid/unpaid allocation is required. Contact your administrator.", false)
    if (["VL", "SL", "pendingVL", "pendingSL"].some(key => typeof response[key] !== "number" || !Number.isFinite(response[key])) || typeof response.periodStart !== "string" || typeof response.periodEnd !== "string" || (response.days !== null && typeof response.days !== "number")) {
      throw new LeavePostingError("Complete period credits could not be verified. Refresh the preview.", false)
    }
    if (response.days !== null) {
      try {
        leaveAllocation({ a365_days: Number(response.days), a365_benefit: Number(response.benefit), a365_startdate: values.startDate, a365_enddate: values.endDate,
          a365_paiddays: response.paidDays as number, a365_unpaiddays: response.unpaidDays as number,
          a365_allocationjson: JSON.stringify({ version: 1, days: response.allocation }) })
      } catch { throw new LeavePostingError("The paid/unpaid preview could not be verified. Refresh the preview.", false) }
    }
    return response as unknown as PostingPreview
  },

  async submit(values: LeaveEntryValues, operationId: string, reviewed: ReviewedAllocation, onCommitted?: () => void) {
    const record = source(await command({ command: "issue", allocationVersion: 1, operationId: requireGuid(operationId), employeeId: values.employee?.a365_employeeid,
      expectedPaidDays: reviewed.paidDays, expectedUnpaidDays: reviewed.unpaidDays,
      leaveType: Number(values.leaveType), benefit: Number(values.benefit), startDate: values.startDate, endDate: values.endDate, note: values.note,
    }))
    if (record.a365_leaveid.toLowerCase() !== operationId.toLowerCase()) throw new LeavePostingError("The operation identity could not be verified. Retry the same request.", true)
    onCommitted?.()
    // A confirmed committed source is returned even if email fails. Sending
    // never turns a successful posting into a false save failure.
    let notification: NotificationOutcome = "unknown"
    try { notification = await postingService.notify(record.a365_leaveid) } catch { /* Outcome remains explicitly unknown; source is committed. */ }
    return { record, notification }
  },

  async notify(operationId: string, reviewedUnknown = false): Promise<NotificationOutcome> {
    const ready = await command({ command: "prepareEmail", operationId: requireGuid(operationId), reviewedUnknown })
    if (ready.alreadySent === true && ready.outcome === "accepted") return "accepted"
    if (typeof ready.attempt !== "string" || !ready.employee || typeof ready.employee !== "object") throw new LeavePostingError("The email attempt could not be verified. Review its status before retrying.", true)
    const record = source(ready.record)
    const employee = ready.employee as { a365_employeeid: string; a365_name: string; a365_workemail?: string }
    const context: LeaveEmailContext = {
      asOf: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    }
    try {
      // Same complete calendar-year ledger balance as the Leave page. Read
      // directly after commit/on retry; never use a cached or pre-submit value.
      context.balances = await leaveService.balances(requireGuid(record._a365_employee_value ?? ""), Number(dateOnly(record.a365_startdate).slice(0, 4)))
    } catch {
      console.warn("Leave email balance unavailable; sending without a balance.")
    }
    const draft = buildRecordedLeaveEmail(record, employee, context)
    let outcome: NotificationOutcome = "failed"
    if (draft.status === "prepared") {
      try {
        const sent = await Office365OutlookService.SharedMailboxSendEmailV2({ MailboxAddress: notificationMailboxAddress, To: draft.to, Subject: draft.subject, Body: draft.html, Importance: "Normal" })
        outcome = sent.success ? "accepted" : "unknown"
      } catch { outcome = "unknown" }
    }
    try {
      await command({ command: "completeEmail", operationId, attempt: ready.attempt, outcome })
    } catch { return "unknown" }
    return outcome
  },
}
