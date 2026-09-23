/**
 * Single source of truth for payroll period status transitions (V1). Pure —
 * no Dataverse, no UI — so it is unit-testable and every service/component
 * asks it rather than scattering status checks (CLAUDE.md).
 *
 * This is a client-side convenience, not a security boundary: a direct Web API
 * PATCH to a period's `a365_payrollstatus` bypasses `canTransition`. Finalized
 * *entry* immutability is enforced server-side by the ProtectFinalizedPayroll
 * plug-in; period-status writes are gated only by Dataverse role privileges.
 */
import { PayrollStatus } from "./types"

export type PayrollAction = "markReady" | "markPaid" | "lock" | "unlock"

const TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  [PayrollStatus.Draft]: [PayrollStatus.Processing],
  [PayrollStatus.Processing]: [PayrollStatus.Ready],
  [PayrollStatus.Ready]: [PayrollStatus.Paid, PayrollStatus.Processing],
  [PayrollStatus.Paid]: [PayrollStatus.Locked, PayrollStatus.Processing],
  [PayrollStatus.Locked]: [PayrollStatus.Processing],
}

export const ACTION_TARGET: Record<PayrollAction, PayrollStatus> = {
  markReady: PayrollStatus.Ready,
  markPaid: PayrollStatus.Paid,
  lock: PayrollStatus.Locked,
  unlock: PayrollStatus.Processing,
}

export function canTransition(from: PayrollStatus, to: PayrollStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function nextActions(status: PayrollStatus): PayrollAction[] {
  switch (status) {
    case PayrollStatus.Processing:
      return ["markReady"]
    case PayrollStatus.Ready:
      return ["markPaid", "unlock"]
    case PayrollStatus.Paid:
      return ["lock", "unlock"]
    case PayrollStatus.Locked:
      return ["unlock"]
    default:
      return [] // Draft advances to Processing automatically on first calculate
  }
}
