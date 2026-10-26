import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { buildRecordedLeaveEmail, type LeaveEmailContext } from "./notification-template"
import { dateOnly, requireGuid } from "./rules"
import { leaveService } from "./leave-service"
import type { LeaveEntryValues } from "./entry-rules"
import type { LeaveRecord } from "./types"

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
}
export type NotificationOutcome = "accepted" | "failed" | "unknown"

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
  return row as unknown as LeaveRecord
}

export const postingService = {
  async preview(values: LeaveEntryValues): Promise<PostingPreview> {
    const complete = Boolean(values.startDate && values.endDate && values.leaveType && values.benefit)
    const response = await command({ command: "preview", employeeId: values.employee?.a365_employeeid,
      ...(complete ? { startDate: values.startDate, endDate: values.endDate, leaveType: Number(values.leaveType), benefit: Number(values.benefit) } : {}),
    })
    if (["VL", "SL", "pendingVL", "pendingSL"].some(key => typeof response[key] !== "number" || !Number.isFinite(response[key])) || typeof response.periodStart !== "string" || typeof response.periodEnd !== "string" || (response.days !== null && typeof response.days !== "number")) {
      throw new LeavePostingError("Complete period credits could not be verified. Refresh the preview.", false)
    }
    return response as unknown as PostingPreview
  },

  async submit(values: LeaveEntryValues, operationId: string, onCommitted?: () => void) {
    const record = source(await command({ command: "issue", operationId: requireGuid(operationId), employeeId: values.employee?.a365_employeeid,
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
        const sent = await Office365OutlookService.SendEmailV2({ To: draft.to, Subject: draft.subject, Body: draft.html, Importance: "Normal" })
        outcome = sent.success ? "accepted" : "unknown"
      } catch { outcome = "unknown" }
    }
    try {
      await command({ command: "completeEmail", operationId, attempt: ready.attempt, outcome })
    } catch { return "unknown" }
    return outcome
  },
}
