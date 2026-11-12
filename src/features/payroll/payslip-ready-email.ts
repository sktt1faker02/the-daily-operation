import { buildNotificationEmail, storedWorkEmail } from "@/lib/notification-email"
import { formatDate } from "@/lib/format"
import type { PayrollPeriod } from "./types"
import type { PowerContext } from "@/lib/power/power-context"

/** Use host identity so the same pipeline artifact works in every environment. */
export function payslipAppUrl(app: Pick<PowerContext["app"], "appId" | "environmentId">): string {
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
  if (!app || !new RegExp(`^${id}$`, "i").test(app.appId) ||
    !new RegExp(`^(?:Default-)?${id}$`, "i").test(app.environmentId)) {
    throw new Error("The running application's identity is unavailable.")
  }
  return `https://apps.powerapps.com/play/e/${app.environmentId}/app/${app.appId}`
}

export interface PayslipEmailEmployee {
  a365_employeeid: string
  a365_name: string
  a365_workemail?: string | null
}

/** Notification only: no salary, bank information, deductions or PDF attachment. */
export function buildPayslipReadyEmail(employee: PayslipEmailEmployee, period: PayrollPeriod, asOf: string, appUrl: string) {
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
  const action = { label: "Open The Daily Operation", href: appUrl }
  return {
    to, subject: title,
    text: [greeting, introduction, ...details.map(([key, value]) => `${key}: ${value}`), highlight, `${action.label}: ${action.href}`].join("\n"),
    html: buildNotificationEmail({ title, greeting, introduction, detailsHeading: "Payroll details", details, highlight, action, asOf }),
  }
}
