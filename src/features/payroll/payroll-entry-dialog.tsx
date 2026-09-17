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
import { formatCurrency } from "@/lib/format"
import {
  toEntryInputValues,
  emptyEntryInputValues,
  type PayrollEntry,
  type PayrollEntryInputValues,
} from "./types"
import { useUpdateEntryInputs } from "./hooks/use-payroll-entries"

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PayrollEntry | null
  periodId: string
}) {
  const initial = useMemo(
    () => (entry ? toEntryInputValues(entry) : emptyEntryInputValues),
    [entry],
  )
  const [values, setValues] = useState<PayrollEntryInputValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const updateInputs = useUpdateEntryInputs(periodId)

  useEffect(() => {
    if (open) {
      setValues(initial)
      setError(null)
    }
  }, [open, initial])

  if (!entry) return null

  const set = (key: keyof PayrollEntryInputValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const msg = validate(values)
    setError(msg)
    if (msg) return
    updateInputs.mutate(
      { id: entry.a365_payrollentryid, values },
      {
        onSuccess: () => {
          toast.success("Payroll entry saved.")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error("Unable to save payroll entry.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry.a365_employeename ?? "Payroll entry"}</DialogTitle>
          <DialogDescription>
            Edit the variable inputs, then calculate to update the deductions and net pay.
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

          <div className="rounded-md border bg-surface-subtle p-3 text-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calculated (Auto)
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
              <dt className="text-muted-foreground">Gross Pay</dt>
              <dd className="text-right">{formatCurrency(entry.a365_grosspay)}</dd>
              <dt className="text-muted-foreground">Total Deductions</dt>
              <dd className="text-right">{formatCurrency(entry.a365_totaldeductions)}</dd>
              <dt className="text-muted-foreground">Net Pay</dt>
              <dd className="text-right font-medium text-foreground">
                {formatCurrency(entry.a365_netpay)}
              </dd>
            </dl>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateInputs.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateInputs.isPending}>
              {updateInputs.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
