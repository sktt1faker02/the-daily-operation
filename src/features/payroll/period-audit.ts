/**
 * Pure builder for a payroll period's lifecycle audit trail (Phase 9). Turns
 * the audit stamps already stored on the period (Created / Ready / Paid /
 * Locked, by whom and when) into an ordered list of events, emitting only the
 * lifecycle points that have actually occurred. No Dataverse, no UI — so it is
 * unit-testable and the presentation layer just renders the result.
 *
 * Field-level "significant salary/deduction changes" are covered by Dataverse
 * native table/column auditing (an environment config step), not rebuilt here.
 */
import type { PayrollPeriod } from "./types"

export interface AuditEvent {
  key: "created" | "ready" | "paid" | "locked"
  label: string
  /** Display name of the acting user, or "—" when unavailable. */
  actor: string
  /** ISO timestamp of the event, or null when not stamped. */
  at: string | null
}

function actor(name: string | null | undefined): string {
  return name?.trim() || "—"
}

/**
 * Ordered lifecycle events for a period. "Created" always appears; Ready, Paid
 * and Locked appear only once their stamp is present. The order mirrors the V1
 * status flow, which is also chronological.
 */
export function buildAuditTrail(period: PayrollPeriod): AuditEvent[] {
  const events: AuditEvent[] = [
    { key: "created", label: "Created", actor: actor(period.createdbyname), at: period.createdon ?? null },
  ]
  if (period.a365_readyon) {
    events.push({ key: "ready", label: "Marked Ready", actor: actor(period.a365_readybyname), at: period.a365_readyon })
  }
  if (period.a365_paidon) {
    events.push({ key: "paid", label: "Marked Paid", actor: actor(period.a365_paidbyname), at: period.a365_paidon })
  }
  if (period.a365_lockedon) {
    events.push({ key: "locked", label: "Locked", actor: actor(period.a365_lockedbyname), at: period.a365_lockedon })
  }
  return events
}
