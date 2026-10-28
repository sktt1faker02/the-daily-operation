/**
 * Payslip PDF document. Builds a pdfmake document definition that mirrors the
 * approved Automations 365 layout (see docs/Payslip 20260331 Michael Tabilin.pdf)
 * and opens it as a genuine, vector PDF in a new browser tab (the browser's PDF
 * viewer provides download/print). pdfmake is loaded lazily so the ~1MB font VFS
 * only ships when someone actually opens a payslip — and so tests can exercise
 * the pure document builder without pulling it in.
 *
 * Presentation only: entry amounts arrive already calculated. Daily/hourly rate
 * follow Phase 5's rule (daily = monthly / 22, hourly = daily / 8).
 */
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces"
import { round2 } from "./services/payroll-calculation"
import { A365_LOGO_DATA_URI } from "./payslip-logo"

const COMPANY_NAME = "Automations365 Software Development Services"
const COMPANY_ADDRESS =
  "Bldg 1 Unit 1 B33 L13 Jasmin St., TS Cruz Subdivision, Almanza Dos, Las Piñas City"
const EMPLOYER_SIGNATORY = "Adrian Celis"

const INK = "#172033"
const HEADER_FILL = "#f2f2f2"

/** Everything the payslip document needs, resolved from employee + period + entry. */
export interface PayslipDocumentData {
  employeeName: string
  employeeNumber: string | null
  position: string | null
  /** Employee's basic monthly salary; drives the Monthly/Daily/Hourly rate block. */
  monthlySalary: number | null
  periodLabel: string
  periodStart: string
  periodEnd: string
  basicPay: number | null
  allowances: number | null
  otherEarnings: number | null
  unpaidLeave: number | null
  grossPay: number | null
  sss: number | null
  philhealth: number | null
  hdmf: number | null
  withholdingTax: number | null
  otherDeductions: number | null
  otherDeductionsComment?: string | null
  totalDeductions: number | null
  netPay: number | null
}

/** Plain `1,234.56` (two decimals, no ₱) to match the reference document. */
const amountFmt = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-"
  return amountFmt.format(round2(value) === 0 ? 0 : value)
}

/** Derived rates per Phase 5: daily = monthly / 22, hourly = daily / 8. */
export function derivedRates(monthlySalary: number | null): {
  daily: number | null
  hourly: number | null
} {
  if (monthlySalary === null || monthlySalary === 0) return { daily: null, hourly: null }
  const daily = round2(monthlySalary / 22)
  return { daily, hourly: round2(daily / 8) }
}

/** Suggested PDF filename, e.g. `Payslip_2026-03-31_0004_Tabilin-Michael.pdf`. */
export function payslipFileName(data: PayslipDocumentData): string {
  const parts = data.employeeName.trim().split(/\s+/)
  const nameSlug =
    parts.length > 1 ? `${parts[parts.length - 1]}-${parts[0]}` : parts[0] || "Employee"
  const safePart = (value: string) => value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")
  const period = safePart(data.periodEnd) || "Undated"
  const employeeNumber = safePart(data.employeeNumber?.trim() || "NA") || "NA"
  const employee = safePart(nameSlug) || "Employee"
  return `Payslip_${period}_${employeeNumber}_${employee}.pdf`
}

/** Left/right key–value grid under the header (labels bold, values right-aligned). */
function infoGrid(data: PayslipDocumentData): Content {
  const { daily, hourly } = derivedRates(data.monthlySalary)
  // No monthly-allowance field exists; the entry allowance is one semi-monthly
  // half, so the monthly figure is ×2.
  // ponytail: allowances ×2 heuristic for the monthly figure; replace with a real
  // monthly-allowance field if the org ever pays uneven cutoffs.
  const monthlyAllowances = data.allowances === null ? null : round2(data.allowances * 2)

  const side = (rows: [string, string][]): Content => ({
    table: {
      widths: ["auto", "*"],
      body: rows.map(([label, value]) => [
        { text: label, bold: true },
        { text: value, alignment: "right" as const },
      ]),
    },
    layout: "noBorders",
  })

  return {
    columns: [
      side([
        ["Period Covered:", data.periodLabel],
        ["Employee Name:", data.employeeName],
        ["Employee ID:", data.employeeNumber ?? "-"],
        ["Position:", data.position ?? "-"],
      ]),
      { text: "", width: 24 },
      side([
        ["Monthly Rate:", money(data.monthlySalary)],
        ["Daily Rate:", money(daily)],
        ["Hourly Rate:", money(hourly)],
        ["Monthly Allowances:", money(monthlyAllowances)],
      ]),
    ],
    columnGap: 16,
    margin: [0, 0, 0, 16],
  }
}

/** The bordered Earnings / Deductions grid, subtotal row, and Net Pay row. */
function amountsTable(data: PayslipDocumentData): Content {
  const earnings: [string, number | null][] = [
    ["Basic Pay", data.basicPay],
    ["Allowances", data.allowances],
    ["Other Earnings", data.otherEarnings],
  ]
  const deductions: [string, number | null][] = [
    ["Unpaid Leave", data.unpaidLeave],
    ["SSS", data.sss],
    ["PhilHealth", data.philhealth],
    ["HDMF", data.hdmf],
    ["Withholding Tax", data.withholdingTax],
    ["Other Deductions", data.otherDeductions],
  ]

  const headerCell = (text: string): Content => ({
    text,
    bold: true,
    alignment: "center",
    fillColor: HEADER_FILL,
  })
  const label = (text: string): Content => ({ text })
  const deductionLabel = (text: string): Content => {
    const comment = data.otherDeductionsComment?.trim()
    if (text !== "Other Deductions" || !data.otherDeductions || !comment) return label(text)
    return {
      stack: [
        { text },
        {
          text: `Reason: ${comment}`,
          fontSize: 8,
          color: "#667085",
          margin: [0, 2, 0, 0],
          wordBreak: "break-all",
        },
      ],
    }
  }
  const num = (value: number | null): Content => ({ text: money(value), alignment: "right" })

  const body: Content[][] = [
    [
      headerCell("Gross Earnings"),
      headerCell("Amount"),
      headerCell("Deductions"),
      headerCell("Amount"),
    ],
  ]

  const rows = Math.max(earnings.length, deductions.length)
  for (let i = 0; i < rows; i++) {
    const e = earnings[i]
    const d = deductions[i]
    body.push([
      e ? label(e[0]) : label(""),
      e ? num(e[1]) : label(""),
      d ? deductionLabel(d[0]) : label(""),
      d ? num(d[1]) : label(""),
    ])
  }

  const strong = (text: string): Content => ({ text, bold: true })
  const strongNum = (value: number | null): Content => ({
    text: money(value),
    bold: true,
    alignment: "right",
  })

  body.push([
    strong("Gross Pay"),
    strongNum(data.grossPay),
    strong("Total Deductions"),
    strongNum(data.totalDeductions),
  ])
  body.push([strong("Net Pay"), label(""), label(""), strongNum(data.netPay)])

  return {
    table: { widths: ["*", 90, "*", 90], body },
    layout: {
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      hLineColor: () => INK,
      vLineColor: () => INK,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 40],
  }
}

const SIGN_WIDTH = 240

/** One signature block: bold caption, then a fixed-width rule with the printed
 * name (optional) centered over it. */
function signatureBlock(caption: string, name?: string): Content {
  return {
    stack: [
      { text: caption, bold: true, margin: [0, 0, 0, 28] },
      {
        columns: [
          {
            width: SIGN_WIDTH,
            stack: [
              { text: name ?? " ", alignment: "center", margin: [0, 0, 0, 2] },
              {
                canvas: [
                  { type: "line", x1: 0, y1: 0, x2: SIGN_WIDTH, y2: 0, lineWidth: 0.7, lineColor: INK },
                ],
              },
            ],
          },
          { text: "", width: "*" },
        ],
      },
    ],
    margin: [0, 0, 0, 30],
  }
}

/** Build the pdfmake document definition for one payslip. */
export function buildPayslipDocDefinition(data: PayslipDocumentData): TDocumentDefinitions {
  return {
    info: { title: payslipFileName(data) },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 9, color: INK },
    content: [
      { image: A365_LOGO_DATA_URI, width: 130, alignment: "right", margin: [0, 0, 0, 10] },
      { text: "PAYSLIP", bold: true, alignment: "center", fontSize: 11, characterSpacing: 1 },
      { text: COMPANY_NAME, bold: true, alignment: "center", margin: [0, 8, 0, 2] },
      { text: COMPANY_ADDRESS, alignment: "center", fontSize: 8, margin: [0, 0, 0, 18] },
      infoGrid(data),
      amountsTable(data),
      signatureBlock("Employer Signature", EMPLOYER_SIGNATORY),
      signatureBlock("Employee Signature"),
    ],
  }
}

/**
 * Generate the payslip PDF and open it in a new browser tab (real PDF, with the
 * viewer's own download/print). The tab must be opened inside the click gesture
 * so it isn't pop-up blocked: pass a pre-opened `win` when the caller does async
 * work (e.g. fetching the employee) before this runs; omit it to open here.
 */
export async function openPayslip(
  data: PayslipDocumentData,
  win?: Window | null,
): Promise<void> {
  const target = win === undefined ? window.open("", "_blank") : win
  try {
    const def = buildPayslipDocDefinition(data)
    const { default: pdfMake } = await import("pdfmake/build/pdfmake")
    const vfsModule = await import("pdfmake/build/vfs_fonts")
    const vfs = (vfsModule as { default?: unknown }).default ?? vfsModule
    pdfMake.addVirtualFileSystem(vfs as Parameters<typeof pdfMake.addVirtualFileSystem>[0])
    pdfMake.createPdf(def).open(target ?? undefined)
  } catch (err) {
    target?.close()
    throw err
  }
}
