import type { IGetAllOptions } from "@/generated/models/CommonModels"
import type { IOperationResult } from "@microsoft/power-apps/data"
import { A365_leavesService } from "@/generated/services/A365_leavesService"
import { A365_leavecashconversionsService } from "@/generated/services/A365_leavecashconversionsService"
import { A365_leavecredittransactionsService } from "@/generated/services/A365_leavecredittransactionsService"
import { dataClient } from "@/lib/power/data-client"
import { userService } from "@/features/employees/user-service"
import { calculateBalances, requireGuid, validYear } from "./rules"
import { benefitLabels, conversionStatusLabels, leaveStatusLabels, leaveTypeLabels, poolLabels, transactionTypeLabels } from "./types"
import type { ConversionRecord, CreditRecord, LeaveEmployee, LeaveFilters, LeavePage, LeaveRecord, SourceReference } from "./types"
import { postingService } from "./posting-service"
import { emptyLeaveEntry } from "./entry-rules"
import { calculateConversion, currentLeaveYear } from "./conversion-rules"

const leaveSelect = ["a365_leaveid", "a365_name", "_a365_employee_value", "a365_leavetype", "a365_benefit", "a365_startdate", "a365_enddate", "a365_days", "a365_leavestatus", "a365_note", "_a365_issuedby_value", "a365_issuedon", "_a365_cancelledby_value", "a365_cancelledon", "a365_cancellationreason", "a365_notificationstatus", "a365_notifiedon", "a365_paiddays", "a365_unpaiddays", "a365_allocationjson"] satisfies (keyof LeaveRecord)[]
const conversionSelect = ["a365_leavecashconversionid", "a365_name", "_a365_employee_value", "a365_year", "a365_days", "a365_dailyrateused", "a365_amount", "a365_conversionstatus", "_a365_convertedby_value", "a365_convertedon", "_a365_cancelledby_value", "a365_cancelledon", "a365_cancellationreason"] satisfies (keyof ConversionRecord)[]
const creditSelect = ["a365_leavecredittransactionid", "a365_name", "_a365_employee_value", "a365_year", "a365_creditpool", "a365_days", "a365_transactiontype", "a365_transactionkey", "a365_periodkey", "a365_note", "createdon", "_a365_leave_value", "_a365_cashconversion_value"] satisfies (keyof CreditRecord)[]
const employeeSelect = ["a365_employeeid", "a365_name", "a365_employeenumber"]
const textLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`

function checked<T>(result: IOperationResult<T>): T {
  if (!result.success || result.data === undefined || result.data === null) {
    // SDK error payloads may contain sensitive record values. Do not forward them.
    throw new Error("Unable to read Leave data. Check your access and try again.")
  }
  return result.data
}

function choiceFilter(field: string, value: string, labels: Readonly<Record<number, string>>): string[] {
  if (value === "all") return []
  if (!Object.hasOwn(labels, value)) throw new Error("Select a valid filter.")
  return [`${field} eq ${Number(value)}`]
}

export function buildLeaveFilter(filters: LeaveFilters): string {
  if (!validYear(filters.year)) throw new Error("Select a valid year.")
  const clauses = filters.section === "leave"
    ? [`a365_startdate lt ${filters.year + 1}-01-01`, `a365_enddate ge ${filters.year}-01-01`]
    : [`a365_year eq ${filters.year}`]
  if (filters.employeeId) clauses.push(`_a365_employee_value eq ${requireGuid(filters.employeeId)}`)
  if (filters.search.trim()) clauses.push(`contains(a365_name,${textLiteral(filters.search.trim())})`)
  if (filters.section === "leave") {
    clauses.push(...choiceFilter("a365_leavestatus", filters.status, leaveStatusLabels), ...choiceFilter("a365_leavetype", filters.type, leaveTypeLabels), ...choiceFilter("a365_benefit", filters.benefit, benefitLabels))
  } else if (filters.section === "conversions") {
    clauses.push(...choiceFilter("a365_conversionstatus", filters.status, conversionStatusLabels))
  } else {
    clauses.push(...choiceFilter("a365_creditpool", filters.type, poolLabels), ...choiceFilter("a365_transactiontype", filters.status, transactionTypeLabels))
  }
  return clauses.join(" and ")
}

async function allPages<T>(read: (options: IGetAllOptions) => Promise<IOperationResult<T[]>>, options: IGetAllOptions): Promise<T[]> {
  const rows: T[] = []
  const tokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await read({ ...options, maxPageSize: 500, skipToken })
    rows.push(...checked(result))
    skipToken = result.skipToken
    if (skipToken && (tokens.has(skipToken) || tokens.size >= 10000)) throw new Error("Unable to load complete credit history. Try again.")
    if (skipToken) tokens.add(skipToken)
  } while (skipToken)
  return rows
}

async function employeeNames(ids: (string | undefined)[]): Promise<LeaveEmployee[]> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)).map(requireGuid))]
  if (!unique.length) return []
  return checked(await dataClient.retrieveMultipleRecordsAsync<LeaveEmployee>("a365_employees", {
    select: employeeSelect, filter: unique.map(id => `a365_employeeid eq ${id}`).join(" or "), maxPageSize: 100,
  }))
}

/** Read-only until policy and transactional server commands are authorized and verified. */
export const leaveService = {
  async conversionEmployees(year: number, skipToken?: string) {
    if (!validYear(year)) throw new Error("Select a valid year.")
    type ConversionEmployee = LeaveEmployee & { a365_basicmonthlysalary?: number }
    const result = await dataClient.retrieveMultipleRecordsAsync<ConversionEmployee>("a365_employees", {
      select: [...employeeSelect, "a365_basicmonthlysalary"], maxPageSize: 20, skipToken,
      orderBy: ["a365_name asc", "a365_employeeid asc"],
    })
    const employees = checked(result)
    const currentYear = currentLeaveYear()
    const rows = await Promise.all(employees.map(async employee => {
      try {
        if (year > currentYear) throw new Error("This leave year has not started.")
        const id = requireGuid(employee.a365_employeeid)
        const conversions = await allPages<ConversionRecord>(options => A365_leavecashconversionsService.getAll(options), {
          select: conversionSelect, filter: `_a365_employee_value eq ${id} and a365_year eq ${year}`,
          orderBy: ["a365_leavecashconversionid asc"],
        })
        if (conversions.some(row => ![749910000, 749910001].includes(row.a365_conversionstatus) || !Number.isFinite(row.a365_days) || row.a365_days < 0)) throw new Error("Recorded conversion days could not be verified.")
        const converted = conversions.filter(row => row.a365_conversionstatus === 749910000).reduce((total, row) => total + Math.round(row.a365_days * 100), 0) / 100
        let availableVL: number
        if (year === currentYear) {
          const preview = await postingService.preview({ ...emptyLeaveEntry(), employee })
          if (Number(preview.periodStart.slice(0, 4)) !== year) throw new Error("The leave year changed. Refresh to check the balance.")
          availableVL = preview.VL
        } else availableVL = (await leaveService.balances(id, year)).VL
        return { employee, preview: { ...calculateConversion(employee.a365_basicmonthlysalary, availableVL, converted), availableVL, converted }, error: null }
      } catch (error) {
        // Only locally generated policy/validation errors are safe to display.
        const message = error instanceof Error && (error.message === "This leave year has not started." || error.message === "Monthly basic salary is missing or invalid.") ? error.message : "Unable to verify this employee’s conversion balance. Refresh to retry."
        return { employee, preview: null, error: message }
      }
    }))
    return { rows, next: result.skipToken }
  },
  async conversionYears(): Promise<number[]> {
    const rows = await allPages<Pick<ConversionRecord, "a365_year">>(options => A365_leavecashconversionsService.getAll(options), {
      select: ["a365_year"], orderBy: ["a365_leavecashconversionid asc"],
    })
    if (rows.some(row => !validYear(row.a365_year))) throw new Error("Conversion history contains an invalid year.")
    return [...new Set([new Date().getFullYear(), ...rows.map(row => row.a365_year)])].sort((a, b) => b - a)
  },
  async searchEmployees(search: string, skipToken?: string) {
    const result = await dataClient.retrieveMultipleRecordsAsync<LeaveEmployee>("a365_employees", {
      select: employeeSelect, maxPageSize: 20, skipToken,
      filter: search.trim() ? `(contains(a365_name,${textLiteral(search.trim())}) or contains(a365_employeenumber,${textLiteral(search.trim())}))` : undefined,
      orderBy: ["a365_name asc", "a365_employeeid asc"],
    })
    return { rows: checked(result), next: result.skipToken }
  },

  async list(filters: LeaveFilters, skipToken?: string): Promise<LeavePage> {
    const options = { filter: buildLeaveFilter(filters), maxPageSize: 20, skipToken }
    const page: LeavePage = { leaves: [], conversions: [], credits: [], employees: [] }
    if (filters.section === "leave") {
      const result = await A365_leavesService.getAll({ ...options, select: leaveSelect, orderBy: ["a365_startdate desc", "a365_leaveid asc"] })
      page.leaves = checked(result); page.next = result.skipToken
    } else if (filters.section === "conversions") {
      const result = await A365_leavecashconversionsService.getAll({ ...options, select: conversionSelect, orderBy: ["a365_convertedon desc", "a365_leavecashconversionid asc"] })
      page.conversions = checked(result); page.next = result.skipToken
    } else {
      const result = await A365_leavecredittransactionsService.getAll({ ...options, select: creditSelect, orderBy: ["createdon desc", "a365_leavecredittransactionid asc"] })
      page.credits = checked(result); page.next = result.skipToken
    }
    page.employees = await employeeNames([...page.leaves, ...page.conversions, ...page.credits].map(row => row._a365_employee_value))
    return page
  },

  async balances(employeeId: string, year: number) {
    const id = requireGuid(employeeId)
    if (!validYear(year)) throw new Error("Select a valid year.")
    const rows = await allPages<CreditRecord>(options => A365_leavecredittransactionsService.getAll(options), {
      filter: `_a365_employee_value eq ${id} and a365_year eq ${year}`, select: creditSelect,
      orderBy: ["a365_leavecredittransactionid asc"],
    })
    return calculateBalances(rows, id, year)
  },

  async detail(source: SourceReference) {
    const id = requireGuid(source.id)
    const record: LeaveRecord | ConversionRecord = source.kind === "leave"
      ? checked(await A365_leavesService.get(id, { select: leaveSelect }))
      : checked(await A365_leavecashconversionsService.get(id, { select: conversionSelect }))
    const actorIds = [record._a365_cancelledby_value, "a365_issuedon" in record ? record._a365_issuedby_value : record._a365_convertedby_value]
    const [employees, actors] = await Promise.all([
      employeeNames([record._a365_employee_value]), userService.getNamesByIds(actorIds),
    ])
    return { record, employees, actors }
  },
}
