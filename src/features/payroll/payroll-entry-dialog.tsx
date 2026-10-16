/**
 * Editor for a single payroll entry's variable inputs (Basic Pay, Allowances,
 * Other Earnings, Withholding Tax, Other Deductions, Unpaid Leave days).
 * Withholding tax is a manual admin input (not computed). Calculated values
 * (Gross, SSS/PhilHealth/HDMF, Net) are shown read-only for context. Save
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
    if (Number.isNaN(n) || n < 0) return `${label} must be a non-negative number.`
  }
  return null
}

export function PayrollEntryDialog({
  open,
  onOpenChange,
  entry,
  periodId,
  periodEndDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PayrollEntry | null
  periodId: string
  periodEndDate: string
}) {
  const initial = useMemo(
    () => (entry ? toEntryInputValues(entry) : emptyEntryInputValues),
    [entry],
  )
  const [values, setValues] = useState<PayrollEntryInputValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const updateInputs = useUpdateEntryInputs(periodId)
  const systemUser = useCurrentSystemUserId()

  useEffect(() => {
    if (open) {
      setValues(initial)
      setError(null)
    }
  }, [open, initial])

  if (!entry) return null

  const set = (key: keyof PayrollEntryInputValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && updateInputs.isPending) return
    onOpenChange(nextOpen)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const msg = validate(values)
    setError(msg)
    if (msg) return
    if (!systemUser.data) {
      setError("Your Dataverse user could not be resolved. Please try again.")
      return
    }
    updateInputs.mutate(
      {
        id: entry.a365_payrollentryid,
        periodEndDate,
        calculatedByUserId: systemUser.data,
        values,
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
            Saving recalculates this entry and updates its payroll totals.
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
                  value={values[id]}
                  onChange={(e) => set(id, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a365_comment">Comment</Label>
            <Textarea
              id="a365_comment"
              rows={3}
              value={values.a365_comment}
              onChange={(e) => set("a365_comment", e.target.value)}
              placeholder="Optional note about this entry…"
            />
          </div>

          <div className="rounded-md border bg-surface-subtle p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calculated (Auto)
            </p>
            <PayslipBreakdown entry={entry} />
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
            <Button type="submit" disabled={updateInputs.isPending || systemUser.isPending}>
              {updateInputs.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
