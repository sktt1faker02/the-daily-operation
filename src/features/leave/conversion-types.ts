export interface ConversionYear { id: string; year: number; version: string; paid?: boolean }
export interface ConversionRow {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  dailyRate: number
  availableVL: number
  days: number
  amount: number
}
export interface ConversionPage { transaction: ConversionYear; rows: ConversionRow[]; next?: string }
export interface ConversionDraft { availableVL: string; days: string }
export interface ConversionChange { id: string; employeeId: string; availableVL: number; days: number }

export function conversionDraft(row: ConversionRow): ConversionDraft {
  return { availableVL: row.availableVL.toFixed(2), days: row.days.toFixed(2) }
}

export function validateConversionDraft(draft: ConversionDraft): Partial<Record<keyof ConversionDraft, string>> {
  const errors: Partial<Record<keyof ConversionDraft, string>> = {}
  for (const key of ["availableVL", "days"] as const) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(draft[key]) || !Number.isSafeInteger(Math.round(Number(draft[key]) * 100))) errors[key] = "Enter a nonnegative number with up to two decimals."
  }
  if (!errors.days && Number(draft.days) > 5) errors.days = "VL to convert cannot exceed 5.00 days."
  if (!errors.availableVL && Number(draft.availableVL) > 1000000000) errors.availableVL = "Available VL exceeds the supported range."
  if (!errors.days && !errors.availableVL && Number(draft.days) > Number(draft.availableVL)) errors.days = "VL to convert cannot exceed Available VL."
  return errors
}

export function conversionAmount(dailyRate: number, days: number): number {
  const cents = Math.round(Math.round(dailyRate * 100) * Math.round(days * 100) / 100)
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Conversion amount exceeds the supported precision.")
  return cents / 100
}
