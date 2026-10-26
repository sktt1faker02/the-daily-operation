import type { A365_employees } from "@/generated/models/A365_employeesModel"
import type { LeaveRecord } from "./types"
import { benefitLabels, leaveTypeLabels } from "./types"
import { dateOnly, formatLeaveDate, requireGuid } from "./rules"
import { formatCreditDays, leaveCreditPool } from "./entry-rules"

type RecipientEmployee = Pick<A365_employees, "a365_employeeid" | "a365_name" | "a365_workemail">

export interface LeaveEmailContext {
  balances?: { VL: number; SL: number }
  asOf: string
}

export const leaveEmailStyle = {
  page: "#f3f5f8", card: "#ffffff", border: "#e3e6ea", title: "#3b3b6b",
  text: "#1f2937", muted: "#667085", footer: "#f0f1f3", balance: "#f4f5fb",
  font: "Arial, Helvetica, sans-serif", width: 600, bodySize: 13, titleSize: 19,
  footerText: "This is an automated notification from The Daily Operation.",
} as const

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

/** Composition only; caller must first retrieve a confirmed committed source
 * and its linked employee. No address override, send, status update or logging.
 * Sending, notification fields and retries remain the caller's responsibility. */
export function buildRecordedLeaveEmail(record: LeaveRecord, employee: RecipientEmployee, context?: LeaveEmailContext) {
  if (requireGuid(record._a365_employee_value ?? "") !== requireGuid(employee.a365_employeeid)) {
    throw new Error("The employee does not match the recorded leave.")
  }
  requireGuid(record.a365_leaveid)
  if (record.a365_leavestatus !== 749910000 || !Number.isFinite(Date.parse(record.a365_issuedon))) {
    throw new Error("An Issued leave snapshot is required.")
  }
  if (!Object.hasOwn(leaveTypeLabels, record.a365_leavetype) || !Object.hasOwn(benefitLabels, record.a365_benefit)) {
    throw new Error("The recorded leave has an unsupported type or benefit.")
  }
  if (dateOnly(record.a365_enddate) < dateOnly(record.a365_startdate) || !Number.isFinite(record.a365_days) || record.a365_days < 0.5) {
    throw new Error("The recorded leave dates or days are invalid.")
  }
  const to = employee.a365_workemail?.trim()
  // Exactly one stored address. Reject separators and header injection; never
  // fall back to the signed-in admin or an address entered in a modal.
  if (!to || to.length > 100 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
    return { status: "unavailable", reason: "missing-or-invalid-work-email" } as const
  }
  const asOf = dateOnly(context?.asOf ?? record.a365_issuedon)
  const pool = leaveCreditPool(String(record.a365_leavetype))
  const days = pool ? context?.balances?.[pool] : undefined
  const balanceLine = pool && days !== undefined && Number.isFinite(days)
    ? `Remaining ${pool} balance: ${formatCreditDays(days)} days (as of ${formatLeaveDate(asOf)})` : null
  const details = [
    ["Leave type", leaveTypeLabels[record.a365_leavetype]],
    ["Benefit", benefitLabels[record.a365_benefit]],
    ["Start date", formatLeaveDate(record.a365_startdate)],
    ["End date", formatLeaveDate(record.a365_enddate)],
    ["Recorded days", formatCreditDays(record.a365_days)],
  ]
  const lines = [
    `Hello ${employee.a365_name},`,
    "Your leave has been recorded.",
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(balanceLine ? [balanceLine] : []),
  ]
  const s = leaveEmailStyle
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your leave has been recorded</title></head>
<body bgcolor="${s.page}" style="margin:0;padding:0;background-color:${s.page};color:${s.text};font-family:${s.font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${s.page}" style="background-color:${s.page};color:${s.text};"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="${s.width}" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${s.card}" style="width:100%;max-width:${s.width}px;background-color:${s.card};color:${s.text};border:1px solid ${s.border};border-radius:8px;">
<tr><td bgcolor="${s.card}" style="padding:28px 24px 24px;background-color:${s.card};color:${s.text};font-family:${s.font};font-size:${s.bodySize}px;line-height:1.6;">
<h1 style="margin:0 0 24px;color:${s.title};font-size:${s.titleSize}px;line-height:1.4;">Your leave has been recorded</h1>
<p style="margin:0 0 12px;">${escapeHtml(lines[0])}</p>
<p style="margin:0 0 20px;">Your leave has been recorded.</p>
<p style="margin:0 0 8px;"><strong>Leave details:</strong></p>
<ul style="margin:0;padding-left:20px;">${details.map(([label, value]) => `<li style="padding:3px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>
${balanceLine ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td bgcolor="${s.balance}" style="padding:16px;background-color:${s.balance};color:${s.title};border-radius:6px;">${escapeHtml(balanceLine)}</td></tr></table>` : ""}
</td></tr>
<tr><td align="center" bgcolor="${s.footer}" style="padding:16px 24px;background-color:${s.footer};color:${s.muted};font-family:${s.font};font-size:11px;line-height:1.6;border-top:1px solid ${s.border};">© ${asOf.slice(0, 4)} Automations 365<br>${s.footerText}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
  return {
    status: "prepared",
    to,
    subject: "Your leave has been recorded",
    text: lines.join("\n"),
    html,
  } as const
}
