import { A365_leavesService } from "@/generated/services/A365_leavesService"
import type { A365_leaves } from "@/generated/models/A365_leavesModel"
import policy from "./approved-policy.json"
import { dateOnly, requireGuid } from "./rules"

export type PayrollLeave = Pick<A365_leaves, "a365_leaveid" | "_a365_employee_value" | "a365_startdate" | "a365_enddate" | "a365_days" | "a365_benefit" | "a365_leavestatus">

function workdays(start: string, end: string): number {
  const holidays = new Set(policy.holidays.map(day => day.date))
  const day = new Date(`${start}T12:00:00`)
  let total = 0
  while (true) {
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    if (iso > end) break
    if (!policy.calendars.some(calendar => calendar.year === day.getFullYear() && calendar.complete)) {
      throw new Error("The holiday calendar is incomplete for this payroll cutoff.")
    }
    if (day.getDay() !== 0 && day.getDay() !== 6 && !holidays.has(iso)) total++
    day.setDate(day.getDate() + 1)
  }
  return total
}

/** Date-only allocation; never copies an entire multi-cutoff leave into each cutoff. */
export function unpaidLeaveDaysForPeriod(leaves: PayrollLeave[], employeeId: string, startDate: string, endDate: string): number {
  const start = dateOnly(startDate), end = dateOnly(endDate)
  if (end < start) throw new Error("Payroll cutoff dates are invalid.")
  const seen = new Set<string>()
  let total = 0
  for (const leave of leaves) {
    if (leave._a365_employee_value?.toLowerCase() !== employeeId.toLowerCase() || leave.a365_leavestatus !== 749910000 || leave.a365_benefit !== 749910001) continue
    if (seen.has(leave.a365_leaveid)) throw new Error("Duplicate leave records were returned. Refresh and try again.")
    seen.add(leave.a365_leaveid)
    const from = dateOnly(leave.a365_startdate), to = dateOnly(leave.a365_enddate)
    if (to < from || !Number.isFinite(leave.a365_days) || leave.a365_days <= 0) throw new Error("An unpaid leave record has invalid dates or days.")
    const overlapStart = from > start ? from : start, overlapEnd = to < end ? to : end
    if (overlapEnd < overlapStart) continue
    const fullDays = workdays(from, to)
    if (from === to && leave.a365_days === 0.5 && fullDays === 1) total += 0.5
    else {
      if (leave.a365_days !== fullDays) throw new Error("An unpaid leave record needs review before its days can be allocated to payroll.")
      total += workdays(overlapStart, overlapEnd)
    }
  }
  return total
}

/** Read-only boundary reused by entry creation and the explicit Processing editor. */
export const payrollUnpaidLeaveService = {
  async daysForEmployees(employeeIds: string[], startDate: string, endDate: string): Promise<Map<string, number>> {
    const ids = [...new Set(employeeIds.map(requireGuid))]
    const start = dateOnly(startDate), end = dateOnly(endDate)
    if (end < start) throw new Error("Payroll cutoff dates are invalid.")
    const totals = new Map<string, number>()
    for (let offset = 0; offset < ids.length; offset += 40) {
      const batch = ids.slice(offset, offset + 40)
      const rows: PayrollLeave[] = []
      const tokens = new Set<string>()
      let skipToken: string | undefined
      do {
        const result = await A365_leavesService.getAll({
          select: ["a365_leaveid", "_a365_employee_value", "a365_startdate", "a365_enddate", "a365_days", "a365_benefit", "a365_leavestatus"],
          filter: `a365_leavestatus eq 749910000 and a365_benefit eq 749910001 and a365_startdate le ${end} and a365_enddate ge ${start} and (${batch.map(id => `_a365_employee_value eq ${id}`).join(" or ")})`,
          orderBy: ["a365_leaveid asc"], maxPageSize: 500, skipToken,
        })
        if (!result.success || !result.data) throw new Error("Unable to load unpaid leave. No payroll entries were created. Check access and retry.")
        rows.push(...result.data)
        skipToken = result.skipToken
        if (skipToken && (tokens.has(skipToken) || tokens.size >= 10000)) throw new Error("Unable to load complete unpaid leave history.")
        if (skipToken) tokens.add(skipToken)
      } while (skipToken)
      for (const id of batch) totals.set(id, unpaidLeaveDaysForPeriod(rows, id, start, end))
    }
    return totals
  },
}
