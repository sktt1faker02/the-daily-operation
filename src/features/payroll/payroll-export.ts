import { parseISO } from "date-fns"
import type { PayrollEntry, PayrollPeriod } from "./types"
import { isFinalized, normalizePayrollStatus, payrollStatusLabel } from "./period-status"

export interface PayrollDetailRow {
  periodId?: string
  period: string
  start: Date
  end: Date
  payDate: Date | null
  status: string
  employeeId: string
  employee: string
  department: string
  bankName: string
  bankAccountNumber: string
  basicPay: number | null
  allowances: number | null
  otherEarnings: number | null
  unpaidLeaveDays: number | null
  unpaidLeaveAmount: number | null
  grossPay: number | null
  sss: number | null
  philHealth: number | null
  hdmf: number | null
  withholdingTax: number | null
  otherDeductions: number | null
  comment: string
  totalDeductions: number | null
  netPay: number | null
  /** Used only to keep the export totals aligned with the page's summary cards. */
  included: boolean
}

export type PayrollExportColumnKey = Exclude<keyof PayrollDetailRow, "included" | "start" | "end" | "status" | "payDate" | "period" | "periodId">
export type PayrollExportGroupId = "employeeInfo" | "earnings" | "governmentDeductions" | "otherDeductions" | "bankDetails"
export type PayrollExportDetailLevel = "summary" | "full" | "custom"

interface PayrollExportColumn {
  header: string
  key: PayrollExportColumnKey
  width: number
}

const COLUMN_DEFINITIONS: Record<PayrollExportColumnKey, PayrollExportColumn> = {
  employeeId: { header: "Employee ID", key: "employeeId", width: 16 },
  employee: { header: "Employee", key: "employee", width: 26 },
  department: { header: "Department", key: "department", width: 22 },
  bankName: { header: "Bank Name", key: "bankName", width: 22 },
  bankAccountNumber: { header: "Bank Account Number", key: "bankAccountNumber", width: 24 },
  basicPay: { header: "Basic Pay", key: "basicPay", width: 16 },
  allowances: { header: "Allowances", key: "allowances", width: 16 },
  otherEarnings: { header: "Other Earnings", key: "otherEarnings", width: 18 },
  unpaidLeaveDays: { header: "Unpaid Leave (days)", key: "unpaidLeaveDays", width: 20 },
  unpaidLeaveAmount: { header: "Unpaid Leave (amount)", key: "unpaidLeaveAmount", width: 22 },
  grossPay: { header: "Gross Pay", key: "grossPay", width: 16 },
  sss: { header: "SSS", key: "sss", width: 16 },
  philHealth: { header: "PhilHealth", key: "philHealth", width: 16 },
  hdmf: { header: "HDMF", key: "hdmf", width: 16 },
  withholdingTax: { header: "Withholding Tax", key: "withholdingTax", width: 18 },
  otherDeductions: { header: "Other Deductions", key: "otherDeductions", width: 19 },
  comment: { header: "Comment", key: "comment", width: 32 },
  totalDeductions: { header: "Total Deductions", key: "totalDeductions", width: 20 },
  netPay: { header: "Net Pay", key: "netPay", width: 16 },
}

/** Single source for group membership, labels, UI checkbox defaults, and columns. */
export const PAYROLL_EXPORT_GROUPS: Record<PayrollExportGroupId, {
  label: string
  columns: PayrollExportColumnKey[]
  defaultEnabled: boolean
}> = {
  employeeInfo: { label: "Employee info (ID, department)", columns: ["employeeId", "department"], defaultEnabled: true },
  earnings: {
    label: "Earnings",
    columns: ["basicPay", "allowances", "otherEarnings", "unpaidLeaveDays", "unpaidLeaveAmount"],
    defaultEnabled: true,
  },
  governmentDeductions: {
    label: "Government deductions",
    columns: ["sss", "philHealth", "hdmf", "withholdingTax"],
    defaultEnabled: true,
  },
  otherDeductions: { label: "Other deductions and comment", columns: ["otherDeductions", "comment"], defaultEnabled: true },
  bankDetails: { label: "Bank details", columns: ["bankName", "bankAccountNumber"], defaultEnabled: false },
}

const FIXED_COLUMNS: PayrollExportColumnKey[] = ["employee", "grossPay", "totalDeductions", "netPay"]
const SUMMARY_COLUMNS: PayrollExportColumnKey[] = ["employee", "department", "grossPay", "totalDeductions", "netPay"]
const COLUMN_ORDER = Object.keys(COLUMN_DEFINITIONS) as PayrollExportColumnKey[]
const MONEY_KEYS = new Set<PayrollExportColumnKey>([
  "basicPay", "allowances", "otherEarnings", "unpaidLeaveAmount", "grossPay", "sss", "philHealth", "hdmf",
  "withholdingTax", "otherDeductions", "totalDeductions", "netPay",
])

export type PayrollExportGroups = Record<PayrollExportGroupId, boolean>

export const DEFAULT_PAYROLL_EXPORT_GROUPS: PayrollExportGroups = Object.fromEntries(
  Object.entries(PAYROLL_EXPORT_GROUPS).map(([id, group]) => [id, group.defaultEnabled]),
) as PayrollExportGroups

export function selectColumns(
  level: PayrollExportDetailLevel,
  groups: PayrollExportGroups,
): PayrollExportColumn[] {
  let selected: Set<PayrollExportColumnKey>
  if (level === "summary") {
    selected = new Set(SUMMARY_COLUMNS)
  } else {
    selected = new Set(FIXED_COLUMNS)
    for (const [id, group] of Object.entries(PAYROLL_EXPORT_GROUPS) as [PayrollExportGroupId, typeof PAYROLL_EXPORT_GROUPS[PayrollExportGroupId]][]) {
      if (level === "full" ? group.defaultEnabled : groups[id]) {
        for (const key of group.columns) selected.add(key)
      }
    }
  }
  return COLUMN_ORDER.filter((key) => selected.has(key)).map((key) => COLUMN_DEFINITIONS[key])
}

function excelDate(value: string | null, label: string): Date | null {
  if (value === null) return null
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) throw new Error(`The payroll ${label} date is invalid.`)
  // Excel serializes UTC date parts. Preserve the calendar date shown by the
  // app instead of exporting local midnight as the previous day in UTC+8.
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

/** Map the values already loaded for the period to plain, workbook-ready rows. */
export function buildPayrollDetailRows(
  period: PayrollPeriod,
  entries: PayrollEntry[],
): PayrollDetailRow[] {
  return entries.map((entry) => {
    const sourceValues: Record<PayrollExportColumnKey, string | number | null> = {
      employeeId: entry.a365_employeenumber ?? "",
      employee: entry.a365_employeename ?? "",
      department: entry.a365_departmentname ?? "",
      bankName: entry.a365_bankname ?? "",
      bankAccountNumber: entry.a365_bankaccountnumber ?? "",
      basicPay: entry.a365_basicpay,
      allowances: entry.a365_allowances,
      otherEarnings: entry.a365_otherearnings,
      unpaidLeaveDays: entry.a365_unpaidleavedays,
      unpaidLeaveAmount: entry.a365_unpaidleave,
      grossPay: entry.a365_grosspay,
      sss: entry.a365_sss,
      philHealth: entry.a365_philhealth,
      hdmf: entry.a365_hdmf,
      withholdingTax: entry.a365_withholdingtax,
      otherDeductions: entry.a365_otherdeductions,
      comment: entry.a365_comment ?? "",
      totalDeductions: entry.a365_totaldeductions,
      netPay: entry.a365_netpay,
    }
    const configuredKeys = [
      ...FIXED_COLUMNS,
      ...Object.values(PAYROLL_EXPORT_GROUPS).flatMap((group) => group.columns),
    ]
    const detailValues: Partial<Pick<PayrollDetailRow, PayrollExportColumnKey>> = {}
    for (const key of configuredKeys) Object.assign(detailValues, { [key]: sourceValues[key] })
    return {
      periodId: period.a365_payrollperiodid,
      period: period.a365_name,
      start: excelDate(period.a365_periodstart, "start")!,
      end: excelDate(period.a365_periodend, "end")!,
      payDate: excelDate(period.a365_paydate, "pay"),
      status: payrollStatusLabel(period.a365_payrollstatus),
      ...detailValues,
      included: entry.a365_isincluded,
    } as PayrollDetailRow
  })
}

export interface PayrollExportFilters {
  startDate: string
  endDate: string
  statuses: number[]
  includeArchived: boolean
  departments: string[]
}

export function filterPeriodsAndEntries(
  periods: PayrollPeriod[],
  rows: PayrollDetailRow[],
  filters: PayrollExportFilters,
): { periods: PayrollPeriod[]; rows: PayrollDetailRow[] } {
  const matches = periods.filter((period) => {
    const payDate = period.a365_paydate?.slice(0, 10)
    const normalizedStatus = normalizePayrollStatus(period.a365_payrollstatus)
    return Boolean(payDate && (!filters.startDate || payDate >= filters.startDate) && (!filters.endDate || payDate <= filters.endDate) &&
      (period.statecode !== 1 || filters.includeArchived) && normalizedStatus !== undefined && filters.statuses.includes(normalizedStatus))
  })
  const ids = new Set(matches.map((period) => period.a365_payrollperiodid))
  const rowsForPeriod = rows.filter((row) => row.periodId && ids.has(row.periodId))
  const rowsByDepartment = filters.departments.length
    ? rowsForPeriod.filter((row) => filters.departments.includes(row.department))
    : rowsForPeriod
  return { periods: matches.filter((period) => rowsByDepartment.some((row) => row.periodId === period.a365_payrollperiodid)), rows: rowsByDepartment }
}

export function buildMultiPeriodRows(periods: PayrollPeriod[], entries: Map<string, PayrollEntry[]>): PayrollDetailRow[] {
  return periods.flatMap((period) => buildPayrollDetailRows(period, entries.get(period.a365_payrollperiodid) ?? []))
}

export function sanitizeSheetName(label: string, used: Set<string> = new Set()): string {
  const base = [...label].filter((character) => !"\\/?*[]:".includes(character)).join("").trim().slice(0, 31) || "Payroll"
  let candidate = base
  let index = 2
  while (used.has(candidate.toLocaleLowerCase())) {
    const suffix = ` (${index++})`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
  }
  used.add(candidate.toLocaleLowerCase())
  return candidate
}

export function payrollExportFileNameForPeriods(periods: PayrollPeriod[]): string {
  if (periods.length === 1) return payrollExportFileName(periods[0]!.a365_name)
  const dates = periods.map((period) => period.a365_periodstart.slice(0, 10)).sort()
  const ends = periods.map((period) => period.a365_periodend.slice(0, 10)).sort()
  return `Payroll ${dates[0]} to ${ends[ends.length - 1]}.xlsx`
}

/** Remove filename-reserved characters and return the complete download name. */
export function payrollExportFileName(periodLabel: string): string {
  const safeLabel = periodLabel
    // Windows also rejects ASCII control characters in file names.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/[. ]+$/g, "")
  return `Payroll ${safeLabel || "Period"}.xlsx`
}

/** Periods in any state other than the locked/paid final status remain changeable. */
export function getNonFinalPeriodNames(periods: PayrollPeriod[]): string[] {
  return periods
    .filter((period) => !isFinalized(period.a365_payrollstatus))
    .map((period) => period.a365_name)
}

/** Require an explicit confirmation only when the export exceeds the threshold. */
export function requiresLargeExportConfirmation(detailRowCount: number): boolean {
  return detailRowCount > 5000
}

export function nonFinalPeriodsNote(periods: PayrollPeriod[]): string | null {
  const names = getNonFinalPeriodNames(periods)
  return names.length ? `Includes periods that are not final: ${names.join(", ")}` : null
}

function sumIncluded(rows: PayrollDetailRow[], key: "grossPay" | "totalDeductions" | "netPay"): number {
  return rows.reduce((total, row) => total + (row.included ? row[key] ?? 0 : 0), 0)
}

function styleHeader(row: import("exceljs").Row): void {
  row.font = { bold: true, color: { argb: "FF172554" } }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

/** Add the flat layout that combines every selected period into one sheet. */
async function addCombinedDetailsSheet(
  workbook: import("exceljs").Workbook,
  rows: PayrollDetailRow[],
  columns: PayrollExportColumn[],
  sheetName: string,
): Promise<void> {
  const combinedColumns = [
    { header: "Period", width: 28 },
    { header: "Start", width: 14 },
    { header: "End", width: 14 },
    { header: "Pay date", width: 14 },
    { header: "Status", width: 14 },
    ...columns,
  ]
  const details = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] })
  details.columns = combinedColumns.map(({ width }) => ({ width }))
  details.addRow(combinedColumns.map(({ header }) => header))
  styleHeader(details.getRow(1))
  for (const column of [2, 3, 4]) details.getColumn(column).numFmt = "mmm d, yyyy"
  for (const [index, column] of columns.entries()) {
    if (MONEY_KEYS.has(column.key)) details.getColumn(index + 6).numFmt = '"₱"#,##0.00'
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    details.addRow([row.period, row.start, row.end, row.payDate, row.status, ...columns.map(({ key }) => row[key])])
    if ((index + 1) % 250 === 0) await yieldToBrowser()
  }
  details.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: combinedColumns.length } }
  const totalRow = details.addRow([])
  totalRow.getCell(1).value = "Total"
  for (const [index, column] of columns.entries()) {
    if (!MONEY_KEYS.has(column.key)) continue
    const columnNumber = index + 6
    const references = rows.flatMap((row, rowIndex) => row.included ? [`${details.getColumn(columnNumber).letter}${rowIndex + 2}`] : [])
    totalRow.getCell(columnNumber).value = { formula: references.length ? `SUM(${references.join(",")})` : "SUM(0)" }
    totalRow.getCell(columnNumber).numFmt = '"₱"#,##0.00'
  }
  totalRow.font = { bold: true }
}

/** Create the single-period Payroll Summary and Payroll Details workbook. */
async function createSinglePayrollWorkbook(
  period: PayrollPeriod,
  rows: PayrollDetailRow[],
  columns: PayrollExportColumn[],
  exportedBy: string,
  exportedOn = new Date(),
): Promise<Blob> {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.creator = exportedBy
  workbook.title = "Payroll export"
  workbook.subject = "Payroll period details"
  workbook.calcProperties.fullCalcOnLoad = true

  const summary = workbook.addWorksheet("Payroll Summary", { views: [{ state: "frozen", ySplit: 1 }] })
  const summaryColumns = [
    { header: "Period", width: 28 }, { header: "Start", width: 14 }, { header: "End", width: 14 },
    { header: "Pay date", width: 14 }, { header: "Status", width: 14 }, { header: "Employees", width: 14 },
    { header: "Gross", width: 18 }, { header: "Total Deductions", width: 20 }, { header: "Net", width: 18 },
    { header: "Exported by", width: 24 }, { header: "Exported on", width: 22 },
  ]
  summary.columns = summaryColumns
  summary.addRow([
    period.a365_name,
    excelDate(period.a365_periodstart, "start"),
    excelDate(period.a365_periodend, "end"),
    excelDate(period.a365_paydate, "pay"),
    payrollStatusLabel(period.a365_payrollstatus),
    rows.length,
    sumIncluded(rows, "grossPay"),
    sumIncluded(rows, "totalDeductions"),
    sumIncluded(rows, "netPay"),
    exportedBy,
    exportedOn,
  ])
  styleHeader(summary.getRow(1))
  const note = nonFinalPeriodsNote([period])
  summary.autoFilter = { from: "A1", to: "K2" }
  if (note) {
    summary.addRow([note])
    summary.mergeCells("A3:K3")
    summary.getRow(3).font = { italic: true }
  }
  for (const column of [2, 3, 4]) summary.getColumn(column).numFmt = "mmm d, yyyy"
  for (const column of [7, 8, 9]) summary.getColumn(column).numFmt = '"₱"#,##0.00'
  summary.getColumn(11).numFmt = "mmm d, yyyy h:mm AM/PM"

  const details = workbook.addWorksheet("Payroll Details", { views: [{ state: "frozen", ySplit: 4 }] })
  const detailColumns = columns
  details.columns = detailColumns.map(({ key, width }) => ({ key, width }))
  details.addRow(["Period", period.a365_name, null, "Status", payrollStatusLabel(period.a365_payrollstatus)])
  details.addRow(["Pay date", excelDate(period.a365_paydate, "pay")])
  details.addRow([])
  details.addRow(detailColumns.map(({ header }) => header))
  details.mergeCells("B1:C1")
  details.mergeCells("B2:C2")
  for (const cell of ["A1", "D1", "A2"]) details.getCell(cell).font = { bold: true }
  details.getRow(3).height = 8
  for (const [index, column] of detailColumns.entries()) {
    if (MONEY_KEYS.has(column.key)) details.getColumn(index + 1).numFmt = '"₱"#,##0.00'
  }
  // B2:C2 share their style after merging; apply the date format after money
  // column styles so reduced/custom exports cannot turn Pay date into currency.
  details.getCell("B2").numFmt = "mmm d, yyyy"
  styleHeader(details.getRow(4))
  details.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, rows.length + 4), column: detailColumns.length },
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    details.addRow(detailColumns.map(({ key }) => row[key]))
    if ((index + 1) % 250 === 0) await yieldToBrowser()
  }

  const totalRow = details.addRow([])
  totalRow.getCell(1).value = "Total"
  const includedRows = rows.flatMap((row, index) => (row.included ? [index + 5] : []))
  for (const [index, column] of detailColumns.entries()) {
    if (!MONEY_KEYS.has(column.key)) continue
    const columnNumber = index + 1
    const references = includedRows.map((rowNumber) => `${details.getColumn(columnNumber).letter}${rowNumber}`)
    totalRow.getCell(columnNumber).value = {
      formula: references.length ? `SUM(${references.join(",")})` : "SUM(0)",
    }
    totalRow.getCell(columnNumber).numFmt = '"₱"#,##0.00'
  }
  totalRow.font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/** Builds workbooks containing both combined and per-period detail layouts. */
export async function createPayrollWorkbook(
  periodOrPeriods: PayrollPeriod | PayrollPeriod[],
  rows: PayrollDetailRow[],
  columns: PayrollExportColumn[],
  exportedBy: string,
  exportedOn = new Date(),
): Promise<Blob> {
  const periods = Array.isArray(periodOrPeriods) ? periodOrPeriods : [periodOrPeriods]
  if (periods.length === 1) return createSinglePayrollWorkbook(periods[0]!, rows, columns, exportedBy, exportedOn)

  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.creator = exportedBy
  workbook.title = "Payroll export"
  workbook.subject = "Payroll period details"
  workbook.calcProperties.fullCalcOnLoad = true
  const summary = workbook.addWorksheet("Payroll Summary", { views: [{ state: "frozen", ySplit: 1 }] })
  summary.columns = [
    { header: "Period", width: 28 }, { header: "Start", width: 14 }, { header: "End", width: 14 },
    { header: "Pay date", width: 14 }, { header: "Status", width: 14 }, { header: "Employees", width: 14 },
    { header: "Gross", width: 18 }, { header: "Total Deductions", width: 20 }, { header: "Net", width: 18 },
    { header: "Exported by", width: 24 }, { header: "Exported on", width: 22 },
  ]
  for (const period of periods) {
    const periodRows = rows.filter((row) => row.periodId === period.a365_payrollperiodid)
    summary.addRow([
      period.a365_name, excelDate(period.a365_periodstart, "start"), excelDate(period.a365_periodend, "end"),
      excelDate(period.a365_paydate, "pay"), payrollStatusLabel(period.a365_payrollstatus), periodRows.length,
      sumIncluded(periodRows, "grossPay"), sumIncluded(periodRows, "totalDeductions"), sumIncluded(periodRows, "netPay"), exportedBy, exportedOn,
    ])
  }
  const note = nonFinalPeriodsNote(periods)
  if (note) {
    summary.addRow([note])
    summary.mergeCells(`A${periods.length + 2}:K${periods.length + 2}`)
    summary.getRow(periods.length + 2).font = { italic: true }
  }
  styleHeader(summary.getRow(1))
  summary.autoFilter = { from: "A1", to: `K${periods.length + 1}` }
  for (const column of [2, 3, 4]) summary.getColumn(column).numFmt = "mmm d, yyyy"
  for (const column of [7, 8, 9]) summary.getColumn(column).numFmt = '"₱"#,##0.00'
  summary.getColumn(11).numFmt = "mmm d, yyyy h:mm AM/PM"

  await addCombinedDetailsSheet(workbook, rows, columns, "Payroll Details")
  const usedNames = new Set(["payroll summary", "payroll details"])
  const detailSets = periods.map((period) => ({
    period,
    rows: rows.filter((row) => row.periodId === period.a365_payrollperiodid),
    sheetName: sanitizeSheetName(`Payroll ${period.a365_name}`, usedNames),
  }))
  for (const { rows: detailRows, sheetName } of detailSets) {
    const details = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 4 }] })
    const periodSheetColumns = columns
    details.columns = periodSheetColumns.map(({ width }) => ({ width }))
    const period = detailSets.find((set) => set.sheetName === sheetName)!.period
    details.addRow(["Period", period.a365_name, null, "Status", payrollStatusLabel(period.a365_payrollstatus)])
    details.addRow(["Pay date", excelDate(period.a365_paydate, "pay")])
    details.addRow([])
    details.addRow(periodSheetColumns.map(({ header }) => header))
    details.mergeCells("B1:C1")
    details.mergeCells("B2:C2")
    details.getRow(3).height = 8
    styleHeader(details.getRow(4))
    for (const [index, column] of periodSheetColumns.entries()) {
      if (MONEY_KEYS.has(column.key)) details.getColumn(index + 1).numFmt = '"₱"#,##0.00'
    }
    details.getCell("B2").numFmt = "mmm d, yyyy"
    for (let rowIndex = 0; rowIndex < detailRows.length; rowIndex += 1) {
      const row = detailRows[rowIndex]!
      details.addRow(periodSheetColumns.map(({ key }) => row[key]))
      if ((rowIndex + 1) % 250 === 0) await yieldToBrowser()
    }
    const headerRow = 4
    details.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, headerRow + detailRows.length), column: periodSheetColumns.length } }
    const totalRow = details.addRow([])
    totalRow.getCell(1).value = "Total"
    for (const [index, column] of periodSheetColumns.entries()) {
      if (!MONEY_KEYS.has(column.key)) continue
      const columnNumber = index + 1
      const references = detailRows.flatMap((row, rowIndex) => row.included ? [`${details.getColumn(columnNumber).letter}${headerRow + rowIndex + 1}`] : [])
      totalRow.getCell(columnNumber).value = { formula: references.length ? `SUM(${references.join(",")})` : "SUM(0)" }
      totalRow.getCell(columnNumber).numFmt = '"₱"#,##0.00'
    }
    totalRow.font = { bold: true }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

/** Trigger a browser download for a successfully-created workbook blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
