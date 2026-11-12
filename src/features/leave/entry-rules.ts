import type { LeaveEmployee } from "./types"
import { requestedBenefitLabels, leaveTypeLabels } from "./types"
import { dateOnly, requireGuid } from "./rules"

export interface LeaveEntryValues {
  employee: LeaveEmployee | null
  leaveType: string
  benefit: string
  startDate: string
  endDate: string
  note: string
  halfDay?: boolean
  manualPaidDays?: string
}

export function emptyLeaveEntry(): LeaveEntryValues {
  return { employee: null, leaveType: "", benefit: "", startDate: "", endDate: "", note: "", halfDay: false }
}

export function validateLeaveEntry(values: LeaveEntryValues): Partial<Record<keyof LeaveEntryValues, string>> {
  const errors: Partial<Record<keyof LeaveEntryValues, string>> = {}
  try { requireGuid(values.employee?.a365_employeeid ?? "") } catch { errors.employee = "Select an employee." }
  if (!Object.hasOwn(leaveTypeLabels, values.leaveType)) errors.leaveType = "Select a leave type."
  if (!Object.hasOwn(requestedBenefitLabels, values.benefit)) errors.benefit = "Select Paid or Unpaid."
  for (const field of ["startDate", "endDate"] as const) {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values[field])) throw new Error("Invalid date.")
      dateOnly(values[field])
    } catch { errors[field] = `Enter a valid ${field === "startDate" ? "start" : "end"} date.` }
  }
  if (!errors.startDate && !errors.endDate && values.endDate < values.startDate) errors.endDate = "End Date cannot precede Start Date."
  if (values.halfDay && !errors.endDate && values.startDate !== values.endDate) errors.endDate = "Half-day leave must start and end on the same date."
  try { manualPaidDays(values) } catch (error) { errors.manualPaidDays = (error as Error).message }
  if (values.note.length > 2000) errors.note = "Note must be 2,000 characters or fewer."
  return errors
}

/** Undefined keeps automatic treatment; zero is an explicit unpaid portion. */
export function manualPaidDays(values: LeaveEntryValues): number | undefined {
  if (values.manualPaidDays === undefined) return undefined
  if (values.benefit !== "749910000") throw new Error("Select Paid to specify a paid/unpaid split.")
  if (!/^\d+(\.\d{1,2})?$/.test(values.manualPaidDays) || Number(values.manualPaidDays) > 366) throw new Error("Enter Paid days from 0 to 366 with at most two decimal places.")
  return Number(values.manualPaidDays)
}

/** Approved pool mapping only. This does not compute an entitlement or debit. */
export function leaveCreditPool(type: string): "VL" | "SL" | null {
  if (type === "749910000" || type === "749910002") return "VL"
  if (type === "749910001") return "SL"
  return null
}

export function creditTreatment(benefit: string, pool: "VL" | "SL" | null): string {
  if (benefit === "749910001") return "Unpaid leave creates no credit deduction."
  if (benefit === "749910000" && pool) return `Paid leave uses ${pool}. The deduction is unavailable until days and spendable credits are verified.`
  return "Select a leave type and benefit to preview the credit treatment."
}

const creditNumber = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatCreditDays = (days: number) => creditNumber.format(days)
