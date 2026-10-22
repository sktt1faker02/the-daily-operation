import type { A365_employees } from "@/generated/models/A365_employeesModel"
import type { LeaveRecord } from "./types"
import { benefitLabels, leaveTypeLabels } from "./types"
import { dateOnly, formatLeaveDate, requireGuid } from "./rules"
import { formatCreditDays } from "./entry-rules"

type RecipientEmployee = Pick<A365_employees, "a365_employeeid" | "a365_name" | "a365_workemail">

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

/** Composition only; caller must first retrieve a confirmed committed source
 * and its linked employee. No address override, send, status update or logging.
 * Dispatcher/Failed persistence/retry require the approved server/provider path. */
export function buildRecordedLeaveEmail(record: LeaveRecord, employee: RecipientEmployee) {
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
  const lines = [
    `Hello ${employee.a365_name},`,
    "Your leave has been recorded.",
    `Leave type: ${leaveTypeLabels[record.a365_leavetype]}`,
    `Benefit: ${benefitLabels[record.a365_benefit]}`,
    `Start date: ${formatLeaveDate(record.a365_startdate)}`,
    `End date: ${formatLeaveDate(record.a365_enddate)}`,
    `Recorded days: ${formatCreditDays(record.a365_days)}`,
  ]
  return {
    status: "prepared",
    to,
    subject: "Your leave has been recorded",
    text: lines.join("\n"),
    html: lines.map(line => `<p>${escapeHtml(line)}</p>`).join(""),
  } as const
}
