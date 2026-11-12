/**
 * Maps the domain records (employee + period + entry) into the flat
 * PayslipDocumentData the printable payslip needs. Shared by the employee
 * payslip page and the admin entry dialog so both produce identical documents.
 */
import type { Employee } from "@/features/employees/types"
import type { PayrollEntry, PayrollPeriod } from "./types"
import type { PayslipDocumentData } from "./payslip-document"

/** Return displayable comment text, suppressing null, empty, and whitespace-only values. */
export function normalizeOtherDeductionsComment(comment: string | null | undefined): string | null {
  const trimmed = comment?.trim()
  return trimmed ? trimmed : null
}

export function toPayslipDocument(
  employee: Pick<
    Employee,
    "a365_name" | "a365_employeenumber" | "a365_basicmonthlysalary" | "_a365_position_value"
  >,
  period: Pick<PayrollPeriod, "a365_name" | "a365_periodstart" | "a365_periodend">,
  entry: PayrollEntry,
  positionName: string | null,
): PayslipDocumentData {
  return {
    employeeName: employee.a365_name,
    employeeNumber: employee.a365_employeenumber ?? null,
    position: positionName,
    monthlySalary: employee.a365_basicmonthlysalary ?? null,
    periodLabel: period.a365_name,
    periodStart: period.a365_periodstart,
    periodEnd: period.a365_periodend,
    basicPay: entry.a365_basicpay,
    allowances: entry.a365_allowances,
    otherEarnings: entry.a365_otherearnings,
    unpaidLeave: entry.a365_unpaidleave,
    grossPay: entry.a365_grosspay,
    sss: entry.a365_sss,
    philhealth: entry.a365_philhealth,
    hdmf: entry.a365_hdmf,
    withholdingTax: entry.a365_withholdingtax,
    otherDeductions: entry.a365_otherdeductions,
    otherDeductionsComment: normalizeOtherDeductionsComment(entry.a365_comment),
    totalDeductions: entry.a365_totaldeductions,
    netPay: entry.a365_netpay,
  }
}
