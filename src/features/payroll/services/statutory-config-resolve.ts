/**
 * Effective-date resolution for statutory configuration. Pure and testable —
 * given rows with an [effectiveFrom, effectiveUntil] window and an as-of date
 * (ISO yyyy-mm-dd), return the rows in force. ISO date strings compare
 * lexicographically, so no Date parsing is needed.
 */
export interface Dated {
  effectiveFrom: string
  effectiveUntil: string | null
}

/** Rows whose [effectiveFrom, effectiveUntil] window contains `asOf` (ISO yyyy-mm-dd). */
export function resolveEffective<T extends Dated>(rows: T[], asOf: string): T[] {
  return rows.filter((r) => r.effectiveFrom <= asOf && (r.effectiveUntil === null || r.effectiveUntil >= asOf))
}
