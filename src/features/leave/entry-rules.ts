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
}

export function emptyLeaveEntry(): LeaveEntryValues {
  return { employee: null, leaveType: "", benefit: "", startDate: "", endDate: "", note: "" }
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
  if (values.note.length > 2000) errors.note = "Note must be 2,000 characters or fewer."
  return errors
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
