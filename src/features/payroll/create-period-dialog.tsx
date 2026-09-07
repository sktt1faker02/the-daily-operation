/**
 * Create a payroll period. Semi-monthly defaults are suggested from today and
 * fully editable. Validates dates; submit disabled while saving; the form is
 * not cleared until the mutation succeeds (CLAUDE.md "Forms").
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
import { suggestSemiMonthlyPeriod, formatPeriodName } from "./period-utils"
import { useCreatePayrollPeriod } from "./hooks/use-payroll-periods"

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

export function CreatePeriodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (periodId: string) => void
}) {
  const suggestion = useMemo(() => suggestSemiMonthlyPeriod(todayISO()), [])
  const [start, setStart] = useState(suggestion.start)
  const [end, setEnd] = useState(suggestion.end)
  const [payDate, setPayDate] = useState(suggestion.payDate)
  const [error, setError] = useState<string | null>(null)

  const createPeriod = useCreatePayrollPeriod()

  // Reopening the dialog should show a fresh suggestion, not the last one left
  // behind by a prior open/cancel (CLAUDE.md "Forms").
  useEffect(() => {
    if (open) {
      const fresh = suggestSemiMonthlyPeriod(todayISO())
      setStart(fresh.start)
      setEnd(fresh.end)
      setPayDate(fresh.payDate)
      setError(null)
    }
  }, [open])

  // Derive the display name during render (no useEffect for derivable state).
  const name = start && end ? formatPeriodName(start, end) : ""

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!start || !end) {
      setError("Start and end dates are required.")
      return
    }
    if (start > end) {
      setError("Start date must be on or before the end date.")
      return
    }
    setError(null)
    createPeriod.mutate(
      { start, end, payDate, name },
      {
        onSuccess: (period) => {
          toast.success("Payroll period created.")
          onOpenChange(false)
          onCreated(period.a365_payrollperiodid)
        },
        onError: (err) =>
          toast.error("Unable to create payroll period.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New payroll period</DialogTitle>
          <DialogDescription>
            Semi-monthly defaults are suggested from today. Adjust the dates if needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">
                Period start<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="period-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">
                Period end<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="period-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Pay date</Label>
            <Input
              id="pay-date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>
          {name && (
            <p className="text-sm text-muted-foreground">
              This period will be named <span className="font-medium text-foreground">{name}</span>.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPeriod.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPeriod.isPending}>
              {createPeriod.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
