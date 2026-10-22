import type { A365_leaves } from "@/generated/models/A365_leavesModel"
import type { A365_leavecashconversions } from "@/generated/models/A365_leavecashconversionsModel"
import type { A365_leavecredittransactions } from "@/generated/models/A365_leavecredittransactionsModel"

export {
  A365_leavesa365_benefit as benefitLabels,
  A365_leavesa365_leavestatus as leaveStatusLabels,
  A365_leavesa365_leavetype as leaveTypeLabels,
  A365_leavesa365_notificationstatus as notificationStatusLabels,
} from "@/generated/models/A365_leavesModel"
export { A365_leavecashconversionsa365_conversionstatus as conversionStatusLabels } from "@/generated/models/A365_leavecashconversionsModel"
export {
  A365_leavecredittransactionsa365_creditpool as poolLabels,
  A365_leavecredittransactionsa365_transactiontype as transactionTypeLabels,
} from "@/generated/models/A365_leavecredittransactionsModel"

export type LeaveRecord = Pick<A365_leaves,
  "a365_leaveid" | "a365_name" | "_a365_employee_value" | "a365_leavetype" |
  "a365_benefit" | "a365_startdate" | "a365_enddate" | "a365_days" |
  "a365_leavestatus" | "a365_note" | "_a365_issuedby_value" | "a365_issuedon" |
  "_a365_cancelledby_value" | "a365_cancelledon" | "a365_cancellationreason"> &
  Partial<Pick<A365_leaves, "a365_notificationstatus" | "a365_notifiedon">>
export type ConversionRecord = Pick<A365_leavecashconversions,
  "a365_leavecashconversionid" | "a365_name" | "_a365_employee_value" |
  "a365_year" | "a365_days" | "a365_dailyrateused" | "a365_amount" |
  "a365_conversionstatus" | "_a365_convertedby_value" | "a365_convertedon" |
  "_a365_cancelledby_value" | "a365_cancelledon" | "a365_cancellationreason">
export type CreditRecord = Pick<A365_leavecredittransactions,
  "a365_leavecredittransactionid" | "a365_name" | "_a365_employee_value" |
  "a365_year" | "a365_creditpool" | "a365_days" | "a365_transactiontype" |
  "a365_transactionkey" | "a365_periodkey" | "a365_note" | "createdon" |
  "_a365_leave_value" | "_a365_cashconversion_value">
export interface LeaveEmployee { a365_employeeid: string; a365_name: string; a365_employeenumber?: string }
export type LeaveSection = "leave" | "credits" | "conversions"
export interface LeaveFilters {
  section: LeaveSection
  year: number
  employeeId: string
  search: string
  status: string
  type: string
  benefit: string
}
export interface LeavePage {
  leaves: LeaveRecord[]
  credits: CreditRecord[]
  conversions: ConversionRecord[]
  employees: LeaveEmployee[]
  next?: string
}
export type SourceReference = { kind: "leave" | "conversion"; id: string }
