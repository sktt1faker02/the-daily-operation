/**
 * Payroll status badge. Uses semantic color + text (never color alone) per
 * Status colors: Processing amber, Ready blue, Paid slate (locked internally).
 */
import {
  payrollStatusBadgeTone,
  payrollStatusLabel,
  type PayrollStatusTone,
  type PayrollStatusValue,
} from "./period-status"

const TONE_CLASS: Record<PayrollStatusTone, string> = {
  processing: "bg-warning-soft text-warning border border-warning/20",
  ready: "bg-primary-soft text-primary border border-primary/20",
  locked: "bg-secondary text-locked border border-border",
  unknown: "bg-secondary text-muted-foreground border border-border",
}

export function PayrollStatusBadge({ status }: { status: PayrollStatusValue | null | undefined }) {
  const tone = payrollStatusBadgeTone(status)
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {payrollStatusLabel(status)}
    </span>
  )
}
