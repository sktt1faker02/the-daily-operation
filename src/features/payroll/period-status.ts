/**
 * Payroll-period lifecycle rules. Persisted values stay aligned with the
 * Dataverse global choice. Old pre-flow values are normalized for compatibility
 * while the one-time data migration is deferred.
 */
export const PayrollStatus = {
  Processing: 749910001,
  Ready: 749910002,
  Locked: 749910004,
} as const

export type PayrollStatus = (typeof PayrollStatus)[keyof typeof PayrollStatus]

/** Existing Dataverse values retained until the deferred migration is approved. */
export const LEGACY_PROCESSING_STATUS = 749910000
export const LEGACY_LOCKED_STATUS = 749910003
export type PayrollStatusValue = PayrollStatus | typeof LEGACY_PROCESSING_STATUS | typeof LEGACY_LOCKED_STATUS

export type PayrollStatusTone = "processing" | "ready" | "locked" | "unknown"
export type PayrollAction = "markReady" | "markPaid" | "unlock"

const LABELS: Record<PayrollStatus, string> = {
  [PayrollStatus.Processing]: "Processing",
  [PayrollStatus.Ready]: "Ready",
  [PayrollStatus.Locked]: "Paid",
}

const TONES: Record<PayrollStatus, PayrollStatusTone> = {
  [PayrollStatus.Processing]: "processing",
  [PayrollStatus.Ready]: "ready",
  [PayrollStatus.Locked]: "locked",
}

const TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  [PayrollStatus.Processing]: [PayrollStatus.Ready],
  [PayrollStatus.Ready]: [PayrollStatus.Locked, PayrollStatus.Processing],
  [PayrollStatus.Locked]: [PayrollStatus.Processing],
}

export const ACTION_TARGET: Record<PayrollAction, PayrollStatus> = {
  markReady: PayrollStatus.Ready,
  markPaid: PayrollStatus.Locked,
  unlock: PayrollStatus.Processing,
}

/** Normalize pre-migration values without displaying their old status names. */
export function normalizePayrollStatus(value: number | null | undefined): PayrollStatus | undefined {
  if (value === LEGACY_PROCESSING_STATUS) return PayrollStatus.Processing
  if (value === LEGACY_LOCKED_STATUS) return PayrollStatus.Locked
  return value === PayrollStatus.Processing || value === PayrollStatus.Ready || value === PayrollStatus.Locked
    ? value
    : undefined
}

export function payrollStatusLabel(value: PayrollStatusValue | null | undefined): string {
  const normalized = normalizePayrollStatus(value)
  return normalized === undefined ? "—" : LABELS[normalized]
}

export function payrollStatusBadgeTone(value: PayrollStatusValue | null | undefined): PayrollStatusTone {
  const normalized = normalizePayrollStatus(value)
  return normalized === undefined ? "unknown" : TONES[normalized]
}

export function isPeriodEditable(value: PayrollStatusValue | null | undefined): boolean {
  return normalizePayrollStatus(value) === PayrollStatus.Processing
}

export function isVisibleToEmployee(value: PayrollStatusValue | null | undefined): boolean {
  const status = normalizePayrollStatus(value)
  return status === PayrollStatus.Ready || status === PayrollStatus.Locked
}

export function isFinalized(value: PayrollStatusValue | null | undefined): boolean {
  return normalizePayrollStatus(value) === PayrollStatus.Locked
}

export function canTransition(
  from: PayrollStatusValue | null | undefined,
  to: PayrollStatus,
): boolean {
  const status = normalizePayrollStatus(from)
  return status !== undefined && (TRANSITIONS[status]?.includes(to) ?? false)
}

export function nextActions(value: PayrollStatusValue | null | undefined): PayrollAction[] {
  switch (normalizePayrollStatus(value)) {
    case PayrollStatus.Processing:
      return ["markReady"]
    case PayrollStatus.Ready:
      return ["markPaid", "unlock"]
    case PayrollStatus.Locked:
      return ["unlock"]
    default:
      return []
  }
}
