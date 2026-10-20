import { describe, expect, it } from "vitest"
import { LEGACY_PROCESSING_STATUS, PayrollStatus } from "./period-status"
import type { PayrollEntry, PayrollPeriod } from "./types"
import {
  buildPayrollDetailRows,
  createPayrollWorkbook,
  DEFAULT_PAYROLL_EXPORT_GROUPS,
  PAYROLL_EXPORT_GROUPS,
  payrollExportFileName,
  selectColumns,
  sanitizeSheetName,
  filterPeriodsAndEntries,
  buildMultiPeriodRows,
  nonFinalPeriodsNote,
  requiresLargeExportConfirmation,
  type PayrollExportGroups,
} from "./payroll-export"

const period: PayrollPeriod = {
  a365_payrollperiodid: "period-1",
  a365_name: "October 1-15, 2026",
  a365_periodstart: "2026-10-01",
  a365_periodend: "2026-10-15",
  a365_paydate: "2026-10-20",
  a365_payrollstatus: PayrollStatus.Ready,
}

function entry(overrides: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    a365_payrollentryid: "entry-1",
    a365_name: "Payroll entry",
    a365_isincluded: true,
    a365_basicpay: 0,
    a365_allowances: 0,
    a365_otherearnings: 0,
    a365_otherdeductions: 0,
    a365_unpaidleavedays: 0,
    a365_grosspay: 0,
    a365_sss: 0,
    a365_philhealth: 0,
    a365_hdmf: 0,
    a365_unpaidleave: 0,
    a365_withholdingtax: 0,
    a365_totaldeductions: 0,
    a365_netpay: 0,
    a365_calculatedon: null,
    a365_comment: null,
    _a365_employee_value: "employee-1",
    _a365_payrollperiod_value: "period-1",
    a365_employeename: "Ada Employee",
    a365_employeenumber: "EMP-001",
    a365_departmentname: "Operations",
    a365_bankname: "Test Bank",
    a365_bankaccountnumber: "1234567890",
    ...overrides,
  }
}

describe("buildPayrollDetailRows", () => {
  it("maps zero values, optional text and the app's status label without recalculating", () => {
    const [row] = buildPayrollDetailRows(period, [entry()])

    expect(row).toMatchObject({
      period: period.a365_name,
      employeeId: "EMP-001",
      employee: "Ada Employee",
      department: "Operations",
      status: "Ready",
      basicPay: 0,
      unpaidLeaveDays: 0,
      unpaidLeaveAmount: 0,
      grossPay: 0,
      totalDeductions: 0,
      netPay: 0,
      comment: "",
      included: true,
    })
    expect(row.start).toBeInstanceOf(Date)
    expect(row.end).toBeInstanceOf(Date)
    expect(row.payDate).toBeInstanceOf(Date)
    expect(row?.bankAccountNumber).toBe("1234567890")
  })

  it("keeps one row per entry and uses the existing label for the locked status", () => {
    const rows = buildPayrollDetailRows(
      { ...period, a365_payrollstatus: PayrollStatus.Locked },
      [
        entry({ a365_payrollentryid: "entry-1", a365_employeenumber: "EMP-001" }),
        entry({ a365_payrollentryid: "entry-2", a365_employeenumber: "EMP-002", a365_comment: "Adjustment" }),
      ],
    )

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.employeeId)).toEqual(["EMP-001", "EMP-002"])
    expect(rows.map((row) => row.status)).toEqual(["Paid", "Paid"])
    expect(rows[1]?.comment).toBe("Adjustment")
  })

  it("leaves missing employee and department display values blank", () => {
    const [row] = buildPayrollDetailRows(
      period,
      [entry({ a365_employeenumber: null, a365_employeename: undefined, a365_departmentname: undefined })],
    )
    expect(row?.employeeId).toBe("")
    expect(row?.employee).toBe("")
    expect(row?.department).toBe("")
  })
})

describe("payrollExportFileName", () => {
  it("removes filename-reserved characters from the period label", () => {
    expect(payrollExportFileName('October 1/15: 2026*? "Final"')).toBe(
      "Payroll October 115 2026 Final.xlsx",
    )
  })

  it("uses a safe fallback when the label contains no filename characters", () => {
    expect(payrollExportFileName("<>:/\\|?*")).toBe("Payroll Period.xlsx")
  })
})

describe("selectColumns", () => {
  it("defaults Full detail to every group except bank details and always includes totals", () => {
    const columns = selectColumns("full", DEFAULT_PAYROLL_EXPORT_GROUPS)
    const keys = columns.map((column) => column.key)
    expect(keys).toContain("employeeId")
    expect(keys).toContain("basicPay")
    expect(keys).toContain("comment")
    expect(keys).toContain("grossPay")
    expect(keys).toContain("totalDeductions")
    expect(keys).toContain("netPay")
    expect(keys).not.toContain("bankName")
    expect(keys).not.toContain("bankAccountNumber")
    expect(PAYROLL_EXPORT_GROUPS.bankDetails.defaultEnabled).toBe(false)
  })

  it("Summary includes only employee, department and the three always-included totals", () => {
    expect(selectColumns("summary", DEFAULT_PAYROLL_EXPORT_GROUPS).map((column) => column.key)).toEqual([
      "employee", "department", "grossPay", "totalDeductions", "netPay",
    ])
  })

  it("Custom includes only selected groups plus the always-included columns", () => {
    const groups: PayrollExportGroups = {
      employeeInfo: false,
      earnings: true,
      governmentDeductions: false,
      otherDeductions: false,
      bankDetails: true,
    }
    const keys = selectColumns("custom", groups).map((column) => column.key)
    expect(keys).toEqual([
      "employee", "bankName", "bankAccountNumber", "basicPay", "allowances", "otherEarnings",
      "unpaidLeaveDays", "unpaidLeaveAmount", "grossPay", "totalDeductions", "netPay",
    ])
  })
})

describe("multi-period export helpers", () => {
  it("sanitizes and de-duplicates long sheet names", () => {
    const used = new Set<string>()
    expect(sanitizeSheetName("Oct/16:31 [2026]", used)).toBe("Oct1631 2026")
    expect(sanitizeSheetName("Oct/16:31 [2026]", used)).toBe("Oct1631 2026 (2)")
    expect(sanitizeSheetName("A very long payroll period label beyond 31 chars", used).length).toBeLessThanOrEqual(31)
  })

  it("builds rows for every selected period, including periods with no entries", () => {
    expect(buildMultiPeriodRows([period, { ...period, a365_payrollperiodid: "period-2" }], new Map([
      ["period-1", [entry()]], ["period-2", []],
    ]))).toHaveLength(1)
    expect(buildMultiPeriodRows([], new Map())).toEqual([])
  })

  it("filters by inclusive pay-date boundaries, status, archived state and department", () => {
    const archived = { ...period, a365_payrollperiodid: "archived", statecode: 1 }
    const rows = [
      ...buildPayrollDetailRows(period, [entry()]),
      ...buildPayrollDetailRows(archived, [entry({ a365_payrollentryid: "entry-archived" })]),
    ]
    const base = { startDate: "2026-10-20", endDate: "2026-10-20", statuses: [PayrollStatus.Ready], includeArchived: false, departments: ["Operations"] }
    expect(filterPeriodsAndEntries([period, archived], rows, base).periods).toHaveLength(1)
    expect(filterPeriodsAndEntries([period, archived], rows, { ...base, includeArchived: true }).periods).toHaveLength(2)
    expect(filterPeriodsAndEntries([period], rows, { ...base, departments: ["Finance"] })).toEqual({ periods: [], rows: [] })
    expect(filterPeriodsAndEntries([period], rows, { ...base, startDate: "2026-10-21" }).periods).toEqual([])
  })

  it("includes a September 30 period whose legacy Processing value is displayed as Processing", () => {
    const septemberPeriod: PayrollPeriod = {
      ...period,
      a365_payrollperiodid: "september-period",
      a365_name: "September 16-30, 2026",
      a365_periodstart: "2026-09-16",
      a365_periodend: "2026-09-30",
      a365_paydate: "2026-09-30",
      a365_payrollstatus: LEGACY_PROCESSING_STATUS,
    }
    const septemberRows = buildPayrollDetailRows(septemberPeriod, [entry({ a365_departmentname: "IT" })])
    const result = filterPeriodsAndEntries([septemberPeriod], septemberRows, {
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      statuses: [PayrollStatus.Processing, PayrollStatus.Ready, PayrollStatus.Locked],
      includeArchived: false,
      departments: ["IT"],
    })

    expect(result.periods).toEqual([septemberPeriod])
    expect(result.rows).toHaveLength(1)
  })
})

describe("Stage 5 export safeguards", () => {
  it("does not add a note when every period is final", () => {
    expect(nonFinalPeriodsNote([{ ...period, a365_payrollstatus: PayrollStatus.Locked }])).toBeNull()
  })

  it("lists only non-final periods for mixed exports", () => {
    expect(nonFinalPeriodsNote([
      { ...period, a365_payrollstatus: PayrollStatus.Locked },
      { ...period, a365_payrollperiodid: "processing", a365_name: "Open cutoff", a365_payrollstatus: PayrollStatus.Processing },
    ])).toBe("Includes periods that are not final: Open cutoff")
  })

  it("lists every period when none are final", () => {
    expect(nonFinalPeriodsNote([
      { ...period, a365_payrollstatus: PayrollStatus.Processing },
      { ...period, a365_payrollperiodid: "ready", a365_name: "Ready cutoff", a365_payrollstatus: PayrollStatus.Ready },
    ])).toBe("Includes periods that are not final: October 1-15, 2026, Ready cutoff")
  })

  it("uses the payroll status for archived records, since Archived is a separate record state", () => {
    expect(nonFinalPeriodsNote([{ ...period, statecode: 1, a365_payrollstatus: PayrollStatus.Locked }])).toBeNull()
    expect(nonFinalPeriodsNote([{ ...period, statecode: 1, a365_payrollstatus: PayrollStatus.Processing }])).toContain(period.a365_name)
  })

  it("asks before exports above 5,000 rows, but not at the boundary", () => {
    expect(requiresLargeExportConfirmation(5000)).toBe(false)
    expect(requiresLargeExportConfirmation(5001)).toBe(true)
  })
})

it("creates one formatted Details sheet with totals for included entries only", async () => {
  const rows = buildPayrollDetailRows(period, [
    entry({ a365_basicpay: 100, a365_grosspay: 100, a365_isincluded: true }),
    entry({ a365_basicpay: 250, a365_isincluded: false, a365_payrollentryid: "entry-2" }),
  ])
  const blob = await createPayrollWorkbook(
    period,
    rows,
    selectColumns("full", DEFAULT_PAYROLL_EXPORT_GROUPS),
    "Payroll Admin",
    new Date("2026-10-20T10:00:00.000Z"),
  )
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())

  const sheet = workbook.getWorksheet("Details")
  const summary = workbook.getWorksheet("Summary")
  expect(sheet).toBeDefined()
  expect(summary).toBeDefined()
  expect(workbook.worksheets).toHaveLength(2)
  expect(workbook.title).toBe("Payroll export")
  expect(workbook.creator).toBe("Payroll Admin")
  expect(summary?.getRow(1).values).toEqual([
    undefined, "Period", "Start", "End", "Pay date", "Status", "Employees", "Gross", "Total Deductions", "Net", "Exported by", "Exported on",
  ])
  expect(summary?.getRow(1).font.bold).toBe(true)
  expect(summary?.views[0]?.state).toBe("frozen")
  expect(summary?.getCell("A2").value).toBe(period.a365_name)
  expect(summary?.getCell("F2").value).toBe(2)
  expect(summary?.getCell("G2").value).toBe(100)
  expect(summary?.getCell("G2").numFmt).toBe('"₱"#,##0.00')
  expect(summary?.getCell("J2").value).toBe("Payroll Admin")
  expect(sheet?.getCell("A1").value).toBe("Period")
  expect(sheet?.getCell("B1").value).toBe(period.a365_name)
  expect(sheet?.getCell("D1").value).toBe("Status")
  expect(sheet?.getCell("E1").value).toBe("Ready")
  expect(sheet?.getCell("A2").value).toBe("Pay date")
  expect(sheet?.getCell("B2").value).toBeInstanceOf(Date)
  expect(sheet?.getCell("B2").numFmt).toBe("mmm d, yyyy")
  expect(sheet?.getCell("D2").value).toBe("Department")
  expect(sheet?.getCell("E2").value).toBe("Operations")
  expect(sheet?.getRow(4).getCell(16).value).toBe("Net Pay")
  expect(
    Array.from({ length: 16 }, (_, index) => sheet?.getRow(4).getCell(index + 1).value),
  ).toEqual([
    "Employee ID",
    "Employee",
    "Basic Pay",
    "Allowances",
    "Other Earnings",
    "Unpaid Leave (days)",
    "Unpaid Leave (amount)",
    "Gross Pay",
    "SSS",
    "PhilHealth",
    "HDMF",
    "Withholding Tax",
    "Other Deductions",
    "Comment",
    "Total Deductions",
    "Net Pay",
  ])
  expect(sheet?.views[0]?.state).toBe("frozen")
  expect(sheet?.autoFilter).toBe("A4:P6")
  expect(sheet?.getCell("C5").value).toBe(100)
  expect(sheet?.getCell("C5").numFmt).toBe('"₱"#,##0.00')
  expect(sheet?.getCell("C7").value).toEqual({ formula: "SUM(C5)" })
  expect(sheet?.getCell("H7").value).toEqual({ formula: "SUM(H5)" })
  expect(sheet?.getRow(4).font.bold).toBe(true)
  expect(sheet?.getRow(7).font.bold).toBe(true)
  expect(sheet?.getRow(4).values).not.toContain("Bank Account Number")
  expect(summary?.getCell("A3").value).toContain("Includes periods that are not final")
})

it("writes bank fields into Details only when the bank group is selected", async () => {
  const rows = buildPayrollDetailRows(period, [entry()])
  const groups = { ...DEFAULT_PAYROLL_EXPORT_GROUPS, bankDetails: true }
  const blob = await createPayrollWorkbook(period, rows, selectColumns("custom", groups), "Payroll Admin")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())

  const sheet = workbook.getWorksheet("Details")
  const headerValues = sheet?.getRow(4).values
  const accountColumn = Array.isArray(headerValues) ? headerValues.indexOf("Bank Account Number") : -1
  expect(accountColumn).toBeGreaterThan(0)
  expect(sheet?.getRow(5).getCell(accountColumn).value).toBe("1234567890")
})
