import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { buildLeaveFilter } from "./leave-service"
import { calculateBalances, dateOnly, requireGuid, validYear } from "./rules"
import { benefitLabels, leaveStatusLabels, leaveTypeLabels } from "./types"
import type { CreditRecord, LeaveFilters, LeavePage, LeaveRecord } from "./types"

type BalanceCredit = Pick<CreditRecord, "a365_leavecredittransactionid" | "_a365_employee_value" | "a365_year" | "a365_creditpool" | "a365_days">
const unavailable = () => new Error("Unable to read your leave history. Check your access and try again.")
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable()
  return value as Record<string, unknown>
}
async function read(employeeId: string, request: Record<string, unknown>) {
  try {
    const id = requireGuid(employeeId)
    const result = await A365_LeaveCommandService.a365_LeaveCommand(JSON.stringify({ ...request, employeeId: id }))
    if (!result.success || typeof result.data?.Response !== "string") throw unavailable()
    const response = object(JSON.parse(result.data.Response))
    if (requireGuid(String(response.employeeId)) !== id || typeof response.employeeName !== "string" || !Array.isArray(response.rows) || (response.next != null && (typeof response.next !== "string" || !/^[1-9]\d*$/.test(response.next)))) throw unavailable()
    const rows = response.rows.map(value => {
      const row = object(value)
      if (requireGuid(String(row._a365_employee_value)) !== id) throw unavailable()
      return row
    })
    return { rows, employee: { a365_employeeid: id, a365_name: response.employeeName }, next: response.next == null ? undefined : String(response.next) }
  } catch { throw unavailable() }
}
function leave(row: Record<string, unknown>): LeaveRecord {
  requireGuid(String(row.a365_leaveid))
  if (typeof row.a365_name !== "string" || typeof row.a365_days !== "number" || !Number.isFinite(row.a365_days) || !Object.hasOwn(leaveTypeLabels, String(row.a365_leavetype)) || !Object.hasOwn(benefitLabels, String(row.a365_benefit)) || !Object.hasOwn(leaveStatusLabels, String(row.a365_leavestatus))) throw unavailable()
  dateOnly(String(row.a365_startdate)); dateOnly(String(row.a365_enddate))
  return row as unknown as LeaveRecord
}
export const personalLeaveService = {
  async list(filters: LeaveFilters, cursor?: string): Promise<LeavePage> {
    requireGuid(filters.employeeId)
    if (filters.section !== "leave") throw unavailable()
    buildLeaveFilter(filters)
    const result = await read(filters.employeeId, { command: "myLeaves", year: filters.year, search: filters.search, status: filters.status,
      leaveType: filters.type === "all" ? 0 : Number(filters.type), benefit: filters.benefit === "all" ? 0 : Number(filters.benefit), cursor })
    return { leaves: result.rows.map(leave), credits: [], conversions: [], employees: [result.employee], next: result.next }
  },
  async balances(employeeId: string, year: number) {
    if (!validYear(year)) throw unavailable()
    const rows: BalanceCredit[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    do {
      const result = await read(employeeId, { command: "myCredits", year, cursor })
      for (const row of result.rows) {
        requireGuid(String(row.a365_leavecredittransactionid))
        rows.push(row as unknown as BalanceCredit)
      }
      cursor = result.next
      if (cursor && (seen.has(cursor) || seen.size >= 100)) throw unavailable()
      if (cursor) seen.add(cursor)
    } while (cursor)
    return calculateBalances(rows, employeeId, year)
  },
  async detail(employeeId: string, recordId: string) {
    const result = await read(employeeId, { command: "myLeave", operationId: requireGuid(recordId) })
    if (result.rows.length !== 1 || requireGuid(String(result.rows[0].a365_leaveid)) !== requireGuid(recordId)) throw unavailable()
    return { record: leave(result.rows[0]), employee: result.employee }
  },
}
