import { buildNotificationEmail, storedWorkEmail } from "@/lib/notification-email"
import { formatDate } from "@/lib/format"
import type { PayrollPeriod } from "./types"

export interface PayslipEmailEmployee {
  a365_employeeid: string
  a365_name: string
  a365_workemail?: string | null
}

/** Notification only: no salary, bank information, deductions or PDF attachment. */
export function buildPayslipReadyEmail(employee: PayslipEmailEmployee, period: PayrollPeriod, asOf: string) {
  const to = storedWorkEmail(employee.a365_workemail)
  if (!to) return null
  const title = "Your payslip is ready"
  const greeting = `Hello ${employee.a365_name},`
  const introduction = "Your payslip for this payroll period is ready to be viewed."
  const details: [string, string][] = [
    ["Payroll period", period.a365_name],
    ["Start date", formatDate(period.a365_periodstart.slice(0, 10))],
    ["End date", formatDate(period.a365_periodend.slice(0, 10))],
  ]
  if (period.a365_paydate) details.push(["Pay date", formatDate(period.a365_paydate.slice(0, 10))])
  const highlight = "Open The Daily Operation and select My Payroll to view your payslip."
  return {
    to, subject: title,
    text: [greeting, introduction, ...details.map(([key, value]) => `${key}: ${value}`), highlight].join("\n"),
    html: buildNotificationEmail({ title, greeting, introduction, detailsHeading: "Payroll details", details, highlight, asOf }),
  }
}
