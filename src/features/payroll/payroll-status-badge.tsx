/**
 * Payroll status badge. Uses semantic color + text (never color alone) per
 * DESIGN.md "Status Mapping": Draft gray, Processing amber, Ready blue,
 * Paid green, Locked slate.
 */
import { payrollStatusBadgeTone, payrollStatusLabel, type PayrollStatus } from "./types"

const TONE_CLASS: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground border border-border",
  processing: "bg-warning-soft text-warning border border-warning/20",
  ready: "bg-primary-soft text-primary border border-primary/20",
  paid: "bg-success-soft text-success border border-success/20",
  locked: "bg-secondary text-locked border border-border",
  unknown: "bg-secondary text-muted-foreground border border-border",
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus | null | undefined }) {
  const tone = payrollStatusBadgeTone(status)
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {payrollStatusLabel(status)}
    </span>
  )
}
