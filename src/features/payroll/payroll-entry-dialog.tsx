/**
 * Editor for a single payroll entry's variable inputs (Basic Pay, Allowances,
 * Other Earnings, Withholding Tax, Other Deductions, Unpaid Leave days).
 * Withholding tax is a manual admin input (not computed). Calculated values
 * (Gross, SSS/PhilHealth/HDMF, Net) preview the unsaved inputs. Save
 * disabled while pending; form not cleared until success (CLAUDE.md "Forms").
 */
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PayslipBreakdown } from "./payslip-breakdown"
import {
  toEntryInputValues,
  emptyEntryInputValues,
  type PayrollEntry,
  type PayrollEntryInputValues,
} from "./types"
import { useUpdateEntryInputs } from "./hooks/use-payroll-entries"
import { useCurrentSystemUserId } from "./hooks/use-current-system-user"
import { useEntryPreview } from "./hooks/use-entry-preview"
import { usePayrollUnpaidLeave } from "./hooks/use-payroll-unpaid-leave"

const FIELDS: { id: keyof PayrollEntryInputValues; label: string }[] = [
  { id: "a365_basicpay", label: "Basic Pay" },
  { id: "a365_allowances", label: "Allowances" },
  { id: "a365_otherearnings", label: "Other Earnings" },
  { id: "a365_withholdingtax", label: "Withholding Tax" },
  { id: "a365_otherdeductions", label: "Other Deductions" },
  { id: "a365_unpaidleavedays", label: "Unpaid Leave (days)" },
]

function validate(values: PayrollEntryInputValues): string | null {
  for (const { id, label } of FIELDS) {
    const raw = values[id].trim()
    if (raw === "") continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return `${label} must be a non-negative number.`
  }
  return null
}

export function PayrollEntryDialog({
  open,
  onOpenChange,
  entry,
  periodId,
  periodStartDate,
  periodEndDate,
  editable,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PayrollEntry | null
  periodId: string
  periodStartDate: string
  periodEndDate: string
  editable: boolean
}) {
  const initial = useMemo(
    () => (entry ? toEntryInputValues(entry) : emptyEntryInputValues),
    [entry],
  )
  const [values, setValues] = useState<PayrollEntryInputValues>(initial)
  const [unpaidEdited, setUnpaidEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateInputs = useUpdateEntryInputs(periodId)
  const systemUser = useCurrentSystemUserId()
  const unpaid = usePayrollUnpaidLeave(entry?._a365_employee_value ?? "", periodStartDate, periodEndDate, open && editable)
  const effectiveValues = editable && !unpaidEdited && unpaid.isSuccess && unpaid.data > 0
    ? { ...values, a365_unpaidleavedays: String(unpaid.data) } : values
  const leaveReady = editable && unpaid.isSuccess && !unpaid.isFetching
  const preview = useEntryPreview(entry, effectiveValues, periodEndDate, open)

  useEffect(() => {
    if (open) {
      setValues(initial)
      setUnpaidEdited(false)
      setError(null)
    }
  }, [open, initial])

  if (!entry) return null

  const set = (key: keyof PayrollEntryInputValues, value: string) => {
    if (key === "a365_unpaidleavedays") setUnpaidEdited(true)
    setValues((prev) => ({ ...prev, [key]: value }))
  }
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && updateInputs.isPending) return
    onOpenChange(nextOpen)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!leaveReady) {
      setError("Wait for unpaid leave to load, or retry the failed lookup before saving.")
      return
    }
    const msg = validate(effectiveValues)
    setError(msg)
    if (msg) return
    if (!preview.entry) {
      setError(preview.error ?? "Please wait for the payroll preview to load.")
      return
    }
    if (!systemUser.data) {
      setError("Your Dataverse user could not be resolved. Please try again.")
      return
    }
    updateInputs.mutate(
      {
        id: entry.a365_payrollentryid,
        periodEndDate,
        calculatedByUserId: systemUser.data,
        values: effectiveValues,
      },
      {
        onSuccess: () => {
          toast.success("Payroll entry saved and recalculated.")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error("Unable to save payroll entry.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry.a365_employeename ?? "Payroll entry"}</DialogTitle>
          <DialogDescription>
            Totals update as you type. Save changes to apply them to payroll.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ id, label }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={updateInputs.isPending || !editable || (id === "a365_unpaidleavedays" && !leaveReady)}
                  value={effectiveValues[id]}
                  onChange={(e) => set(id, e.target.value)}
                />
              </div>
            ))}
          </div>

          {editable && (unpaid.isPending || unpaid.isFetching) && <p role="status" className="text-xs text-muted-foreground">Loading unpaid leave for this cutoff…</p>}
          {editable && unpaid.isError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Unable to load unpaid leave. Saving is blocked until it can be verified.</p><Button type="button" variant="outline" size="sm" onClick={() => void unpaid.refetch()}>Retry unpaid leave</Button></div>}
          {editable && unpaid.isSuccess && unpaid.data > 0 && <p className="text-xs text-muted-foreground">{unpaid.data.toFixed(2)} unpaid leave days recorded for this cutoff. {unpaidEdited ? "Your manual adjustment will be saved." : "Included in this preview; Save changes to apply."}</p>}

          {Number(values.a365_otherdeductions) > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="a365_comment">Comment</Label>
              <Textarea
                id="a365_comment"
                rows={3}
                disabled={updateInputs.isPending}
                value={values.a365_comment}
                onChange={(e) => set("a365_comment", e.target.value)}
                placeholder="Reason for other deductions (shown to the employee on their payslip)"
              />
            </div>
          )}

          <div className="rounded-md border bg-surface-subtle p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live preview (unsaved)
            </p>
            {preview.entry ? (
              <PayslipBreakdown entry={preview.entry} />
            ) : preview.error ? (
              <div role="alert" className="space-y-2 text-sm">
                <p>{preview.error}</p>
                {preview.canRetry && (
                  <Button type="button" variant="outline" size="sm" onClick={preview.retry}>
                    Retry preview
                  </Button>
                )}
              </div>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">Loading payroll preview…</p>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateInputs.isPending || systemUser.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateInputs.isPending || systemUser.isPending || !preview.entry || !leaveReady}>
              {updateInputs.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
