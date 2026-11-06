/**
 * Create a payroll period. Semi-monthly defaults are suggested from today and
 * fully editable. Validates dates; submit disabled while saving; the form is
 * not cleared until the mutation succeeds (CLAUDE.md "Forms").
 */
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
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
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  applyEndChange,
  applyPayDateChange,
  applyStartChange,
  formatPeriodName,
  isEndDateDisabled,
  isValidPeriodDates,
  suggestSemiMonthlyPeriod,
} from "./period-utils"
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
  const [endManuallyPicked, setEndManuallyPicked] = useState(false)
  const [payDateManuallyEdited, setPayDateManuallyEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPeriod = useCreatePayrollPeriod()

  // Reopening the dialog should show a fresh suggestion, not the last one left
  // behind by a prior open/cancel (CLAUDE.md "Forms").
  useEffect(() => {
    if (open) {
      const fresh = suggestSemiMonthlyPeriod(todayISO())
      setStart(fresh.start)
      setEnd(fresh.end)
      setPayDate(fresh.end)
      setEndManuallyPicked(false)
      setPayDateManuallyEdited(false)
      setError(null)
    }
  }, [open])

  // Derive the display name during render (no useEffect for derivable state).
  const name = start && end ? formatPeriodName(start, end) : ""
  const validDates = isValidPeriodDates(start, end)

  const handleStartChange = (nextStart: string) => {
    const next = applyStartChange(
      { start, end, payDate, endManuallyPicked, payDateManuallyEdited },
      nextStart,
    )
    setStart(next.start)
    setEnd(next.end)
    setPayDate(next.payDate)
    setError(null)
  }

  const handleEndChange = (nextEnd: string) => {
    const next = applyEndChange(
      { start, end, payDate, endManuallyPicked, payDateManuallyEdited },
      nextEnd,
    )
    setEnd(next.end)
    setPayDate(next.payDate)
    setEndManuallyPicked(next.endManuallyPicked)
    setError(null)
  }

  const handlePayDateChange = (nextPayDate: string) => {
    const next = applyPayDateChange(
      { start, end, payDate, endManuallyPicked, payDateManuallyEdited },
      nextPayDate,
    )
    setPayDate(next.payDate)
    setPayDateManuallyEdited(next.payDateManuallyEdited)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!start || !end) {
      setError("Start and end dates are required.")
      return
    }
    if (!validDates) {
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
      <DialogContent className="sm:max-w-lg">
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
                Start date<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DatePicker
                id="period-start"
                value={start}
                onChange={handleStartChange}
                required
                invalid={Boolean(error && !start)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">
                End date<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DatePicker
                id="period-end"
                value={end}
                onChange={handleEndChange}
                required
                invalid={Boolean(error && !validDates)}
                defaultMonth={start}
                disabledDates={(date) => isEndDateDisabled(format(date, "yyyy-MM-dd"), start)}
              />
              <p className="text-xs text-muted-foreground">
                Dates before the start date are unavailable.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Pay date</Label>
            <DatePicker
              id="pay-date"
              value={payDate}
              onChange={handlePayDateChange}
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
            <Button type="submit" disabled={createPeriod.isPending || !validDates}>
              {createPeriod.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
