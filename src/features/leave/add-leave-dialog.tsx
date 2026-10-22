import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { LeaveEmployeePicker } from "./employee-picker"
import { benefitLabels, leaveTypeLabels } from "./types"
import { leaveAccessState } from "./rules"
import { useIssueLeave, useLeavePostingPreview } from "./use-leave-posting"
import { LeavePostingError } from "./posting-service"
import { emptyLeaveEntry, formatCreditDays, validateLeaveEntry } from "./entry-rules"
import { formatLeaveDate } from "./rules"
import type { LeaveEntryValues } from "./entry-rules"

function EntryChoice({ id, label, value, labels, onChange }: {
  id: string; label: string; value: string; labels: Readonly<Record<number, string>>; onChange: (value: string) => void
}) {
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label} aria-required="true"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
      <SelectContent>{Object.entries(labels).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent>
    </Select>
  </div>
}

function EntryForm({ onClose, onBlockedChange }: { onClose: () => void; onBlockedChange: (blocked: boolean) => void }) {
  const access = useAccessProfile({ loadEmployee: false })
  const [values, setValues] = useState<LeaveEntryValues>(emptyLeaveEntry)
  const [submitError, setSubmitError] = useState("")
  const [operationId] = useState(() => crypto.randomUUID())
  const [uncertain, setUncertain] = useState(false)
  const [committed, setCommitted] = useState(false)
  const errors = validateLeaveEntry(values)
  const preview = useLeavePostingPreview(values)
  const issue = useIssueLeave()
  const locked = issue.isPending || uncertain
  const canSubmit = Object.keys(errors).length === 0 && preview.isSuccess && !preview.isFetching && preview.data.days !== null && !issue.isPending

  function update<K extends keyof LeaveEntryValues>(key: K, value: LeaveEntryValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }))
    setSubmitError("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Recheck even when the button is disabled: implicit/programmatic submits
    // must not bypass failed/revoked role resolution. Dataverse is the boundary.
    if (leaveAccessState(access) !== "allowed") {
      setSubmitError("Your Leave access could not be verified. No leave has been saved.")
      return
    }
    if (!canSubmit) {
      setSubmitError("Complete the required fields and correct the dates. No leave has been saved.")
      return
    }
    onBlockedChange(true)
    setCommitted(false)
    setSubmitError("")
    try {
      const result = await issue.mutateAsync({ values, operationId, onCommitted: () => setCommitted(true) })
      if (result.notification === "accepted") toast.success("Leave recorded. Email accepted by the sending service.")
      else if (result.notification === "failed") toast.warning("Leave recorded, but the email notification could not be sent.")
      else toast.warning("Leave recorded. The email outcome is uncertain; review its status before retrying.")
      onBlockedChange(false)
      onClose()
    } catch (error) {
      const unknown = error instanceof LeavePostingError && error.uncertain
      setUncertain(unknown)
      onBlockedChange(unknown)
      setSubmitError(error instanceof LeavePostingError ? error.message : "Unable to save leave. Your entries have been kept.")
    }
  }

  return <form aria-label="Add Leave form" className="space-y-5" onSubmit={event => void submit(event)} noValidate>
    <fieldset disabled={locked} className="space-y-5">
    <div className="space-y-2">
      <Label>Employee</Label>
      <LeaveEmployeePicker allowAll={false} value={values.employee} onSelect={employee => update("employee", employee)} />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <EntryChoice id="add-leave-type" label="Leave Type" value={values.leaveType} labels={leaveTypeLabels} onChange={value => update("leaveType", value)} />
      <EntryChoice id="add-leave-benefit" label="Benefit" value={values.benefit} labels={benefitLabels} onChange={value => update("benefit", value)} />
      <div className="space-y-2">
        <Label htmlFor="add-leave-start">Start Date</Label>
        <Input id="add-leave-start" type="date" required value={values.startDate} onChange={event => update("startDate", event.target.value)} aria-invalid={Boolean(values.startDate && errors.startDate)} aria-describedby={values.startDate && errors.startDate ? "add-leave-start-error" : undefined} />
        {values.startDate && errors.startDate && <p id="add-leave-start-error" role="alert" className="text-sm text-destructive">{errors.startDate}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-leave-end">End Date</Label>
        <Input id="add-leave-end" type="date" required value={values.endDate} onChange={event => update("endDate", event.target.value)} aria-invalid={Boolean(values.endDate && errors.endDate)} aria-describedby={values.endDate && errors.endDate ? "add-leave-end-error" : undefined} />
        {values.endDate && errors.endDate && <p id="add-leave-end-error" role="alert" className="text-sm text-destructive">{errors.endDate}</p>}
      </div>
    </div>

    <section aria-label="Credit preview" className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">Credit preview</h3>
      {preview.data && !preview.isError && <p className="text-xs text-muted-foreground">Balance period: {formatLeaveDate(preview.data.periodStart)} – {formatLeaveDate(preview.data.periodEnd)}</p>}
      {!values.employee ? <p className="text-sm text-muted-foreground">Select an employee to view their recorded credits.</p>
        : preview.isPending || preview.isFetching ? <div role="status" aria-label="Loading employee credits"><Skeleton className="h-12 w-full" /><span className="sr-only">Loading complete credit history…</span></div>
          : preview.isError ? <div role="alert" className="space-y-2"><p className="text-sm">{preview.error instanceof LeavePostingError ? preview.error.message : "Employee credits are unavailable. No zero balance has been assumed."}</p><Button type="button" size="sm" variant="outline" onClick={() => void preview.refetch()}>Retry employee credits</Button></div>
            : <><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt>VL available</dt><dd className="font-semibold tabular-nums">{formatCreditDays(preview.data.VL)} days</dd></div><div><dt>SL available</dt><dd className="font-semibold tabular-nums">{formatCreditDays(preview.data.SL)} days</dd></div></dl>
              {(preview.data.pendingVL > 0 || preview.data.pendingSL > 0) && <p className="text-xs text-muted-foreground">Includes earned credits due to post: VL {formatCreditDays(preview.data.pendingVL)}, SL {formatCreditDays(preview.data.pendingSL)} days. These post together with the Leave when submitted.</p>}
              {preview.data.benefit !== null && <p className="text-sm">{preview.data.benefit === 749910001 ? "This request will be Unpaid; no credits will be deducted." : `${formatCreditDays(preview.data.days ?? 0)} days will be deducted from ${preview.data.pool}.`}</p>}</>}
      <div><Label htmlFor="add-leave-days">Calculated leave days</Label><output id="add-leave-days" className="mt-1 block text-sm text-muted-foreground">{preview.isSuccess && !preview.isFetching && preview.data.days !== null ? `${formatCreditDays(preview.data.days)} workdays` : "Select valid dates, type and benefit to calculate workdays."}</output></div>
    </section>

    <div className="space-y-2"><Label htmlFor="add-leave-note">Note (optional)</Label><Textarea id="add-leave-note" maxLength={2000} value={values.note} onChange={event => update("note", event.target.value)} aria-describedby="add-leave-note-help" /><p id="add-leave-note-help" className="text-xs text-muted-foreground">Internal note, up to 2,000 characters. Excluded from the employee email.</p></div>
    <p className="text-xs text-muted-foreground">Full Monday–Friday workdays; holidays are excluded. Paid requests without enough credits become fully Unpaid. Credits and dates are checked again when submitted. Email follows after the Leave is recorded.</p>
    </fieldset>
    {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
    {uncertain && <p role="status" className="text-sm">Keep this request unchanged and retry to check the same operation. Do not create a replacement Leave.</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={locked} onClick={onClose}>Cancel</Button><Button type="submit" disabled={!canSubmit}>{issue.isPending ? committed ? "Sending confirmation…" : "Saving Leave…" : uncertain ? "Retry Submit" : "Submit"}</Button></DialogFooter>
  </form>
}

export function AddLeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [blocked, setBlocked] = useState(false)
  return <Dialog open={open} onOpenChange={next => { if (!blocked) onOpenChange(next) }}>
    <DialogContent showCloseButton={!blocked} onEscapeKeyDown={event => { if (blocked) event.preventDefault() }} onInteractOutside={event => { if (blocked) event.preventDefault() }} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Add Leave</DialogTitle><DialogDescription>Record employee leave and review its credit treatment before submission.</DialogDescription></DialogHeader>
      {open && <EntryForm onClose={() => onOpenChange(false)} onBlockedChange={setBlocked} />}
    </DialogContent>
  </Dialog>
}
