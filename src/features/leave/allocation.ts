import { dateOnly, formatDays, formatLeaveDate } from "./rules"
import type { LeaveAllocationFields } from "./types"

export interface AllocatedDay { date: string; paidDays: number; unpaidDays: number }
type AllocationRecord = LeaveAllocationFields & {
  a365_days: number; a365_benefit: number; a365_startdate: string; a365_enddate: string
}
const invalid = () => new Error("The leave paid/unpaid allocation needs review before it can be used.")
function units(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 366 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw invalid()
  return Math.round(value * 100)
}

/** Validate persisted snapshots without reapplying today's holiday policy. */
export function leaveAllocation(record: AllocationRecord): { paidDays: number; unpaidDays: number; days: AllocatedDay[] | null } {
  const total = units(record.a365_days)
  if (total <= 0 || ![749910000, 749910001, 749910002].includes(record.a365_benefit)) throw invalid()
  const hasSnapshot = [record.a365_paiddays, record.a365_unpaiddays, record.a365_allocationjson].some(value => value != null)
  if (!hasSnapshot) {
    if (record.a365_benefit === 749910002) throw invalid()
    return { paidDays: record.a365_benefit === 749910000 ? total / 100 : 0, unpaidDays: record.a365_benefit === 749910001 ? total / 100 : 0, days: null }
  }
  const paid = units(record.a365_paiddays), unpaid = units(record.a365_unpaiddays)
  if (paid + unpaid !== total || (paid === 0 ? 749910001 : unpaid === 0 ? 749910000 : 749910002) !== record.a365_benefit) throw invalid()
  let parsed: unknown
  try { parsed = JSON.parse(record.a365_allocationjson ?? "") } catch { throw invalid() }
  if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1 || !("days" in parsed) || !Array.isArray(parsed.days) || parsed.days.length === 0 || parsed.days.length > 366) throw invalid()
  const start = dateOnly(record.a365_startdate), end = dateOnly(record.a365_enddate)
  let previous = "", sumPaid = 0, sumUnpaid = 0, unpaidStarted = false
  const days: AllocatedDay[] = parsed.days.map((value: unknown) => {
    if (!value || typeof value !== "object" || !("date" in value) || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !("paidDays" in value) || !("unpaidDays" in value)) throw invalid()
    const date = dateOnly(value.date), day = new Date(`${date}T12:00:00Z`)
    if (day.toISOString().slice(0, 10) !== date || date < start || date > end || date <= previous || [0, 6].includes(day.getUTCDay())) throw invalid()
    const dayPaid = units(value.paidDays), dayUnpaid = units(value.unpaidDays)
    if (dayPaid + dayUnpaid !== 100 || (unpaidStarted && dayPaid > 0)) throw invalid()
    if (dayUnpaid > 0) unpaidStarted = true
    previous = date; sumPaid += dayPaid; sumUnpaid += dayUnpaid
    return { date, paidDays: dayPaid / 100, unpaidDays: dayUnpaid / 100 }
  })
  if (sumPaid !== paid || sumUnpaid !== unpaid) throw invalid()
  return { paidDays: paid / 100, unpaidDays: unpaid / 100, days }
}

/** UI errors stay local to the affected record; never invent a zero allocation. */
export function leaveAllocationDisplay(record: AllocationRecord) {
  try {
    const allocation = leaveAllocation(record)
    return { paid: formatDays(allocation.paidDays), unpaid: formatDays(allocation.unpaidDays),
      unpaidDates: allocation.days?.filter(day => day.unpaidDays > 0).map(day => `${formatLeaveDate(day.date)} (${formatDays(day.unpaidDays)} day${day.unpaidDays === 1 ? "" : "s"})`).join(", ") || (allocation.unpaidDays === 0 ? "None" : "See leave dates") }
  } catch { return { paid: "Unavailable — review required", unpaid: "Unavailable — review required", unpaidDates: "Unavailable — review required" } }
}
