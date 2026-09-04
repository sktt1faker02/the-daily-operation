/**
 * Centralized display formatting. Keep formatting separate from stored /
 * calculation values (see CLAUDE.md "Money").
 */
import { format, parseISO } from "date-fns"

const phpCurrency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
})

/** Format a peso amount for display, e.g. `₱25,000.00`. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return phpCurrency.format(amount)
}

/** Format a Dataverse date-only string (`yyyy-MM-dd`) as `MMM d, yyyy`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return format(parseISO(value), "MMM d, yyyy")
  } catch {
    return value
  }
}
