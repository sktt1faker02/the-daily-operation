import { buildNotificationEmail, storedWorkEmail } from "@/lib/notification-email"
export { notificationEmailStyle as leaveEmailStyle } from "@/lib/notification-email"
import type { A365_employees } from "@/generated/models/A365_employeesModel"
import type { LeaveRecord } from "./types"
import { benefitLabels, leaveTypeLabels } from "./types"
import { dateOnly, formatLeaveDate, requireGuid } from "./rules"
import { formatCreditDays, leaveCreditPool } from "./entry-rules"
import { leaveAllocation } from "./allocation"

type RecipientEmployee = Pick<A365_employees, "a365_employeeid" | "a365_name" | "a365_workemail">

export interface LeaveEmailContext {
  balances?: { VL: number; SL: number }
  asOf: string
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
  const to = storedWorkEmail(employee.a365_workemail)
  const allocation = leaveAllocation(record)
  // Exactly one stored address. Reject separators and header injection; never
  // fall back to the signed-in admin or an address entered in a modal.
  if (!to) {
    return { status: "unavailable", reason: "missing-or-invalid-work-email" } as const
  }
  const asOf = dateOnly(context?.asOf ?? record.a365_issuedon)
  const pool = leaveCreditPool(String(record.a365_leavetype))
  const days = pool ? context?.balances?.[pool] : undefined
  const balanceLine = pool && days !== undefined && Number.isFinite(days)
    ? `Remaining ${pool} balance: ${formatCreditDays(days)} days (as of ${formatLeaveDate(asOf)})` : null
  const details: [string, string][] = [
    ["Leave type", leaveTypeLabels[record.a365_leavetype]],
    ["Benefit", benefitLabels[record.a365_benefit]],
    ["Start date", formatLeaveDate(record.a365_startdate)],
    ["End date", formatLeaveDate(record.a365_enddate)],
    ["Recorded days", formatCreditDays(record.a365_days)],
    ["Paid days", formatCreditDays(allocation.paidDays)],
    ["Unpaid days", formatCreditDays(allocation.unpaidDays)],
    ...(allocation.days && allocation.unpaidDays > 0 ? [["Unpaid dates", allocation.days.filter(day => day.unpaidDays > 0).map(day => `${formatLeaveDate(day.date)} (${formatCreditDays(day.unpaidDays)} days)`).join(", ")] as [string, string]] : []),
  ]
  const lines = [
    `Hello ${employee.a365_name},`,
    "Your leave has been recorded.",
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(balanceLine ? [balanceLine] : []),
  ]
  const html = buildNotificationEmail({
    title: "Your leave has been recorded", greeting: lines[0],
    introduction: "Your leave has been recorded.", detailsHeading: "Leave details",
    details, highlight: balanceLine, asOf,
  })
  return {
    status: "prepared",
    to,
    subject: "Your leave has been recorded",
    text: lines.join("\n"),
    html,
  } as const
}
