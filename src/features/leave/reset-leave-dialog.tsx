import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LeavePostingError, type LeaveResetPreview } from "./posting-service"
import { useLeaveReset } from "./use-leave-reset"

export function ResetLeaveDialog({ onClose }: { onClose: () => void }) {
  const { preview, reset } = useLeaveReset()
  const [operationId] = useState(() => crypto.randomUUID())
  const reviewed = useRef<LeaveResetPreview | null>(null)
  const busy = useRef(false)
  const uncertain = reset.error instanceof LeavePostingError && reset.error.uncertain
  const canClose = !reset.isPending && !uncertain
  const details = uncertain ? reviewed.current : preview.data
  async function confirm() {
    if (busy.current || !details || (!uncertain && (preview.isFetching || !preview.isSuccess))) return
    busy.current = true
    reviewed.current = details
    try {
      const result = await reset.mutateAsync({ reviewed: details, operationId })
      toast.success(`Leave balances reset for ${result.employeeCount} active employees: 10 VL and 5 SL.`)
      onClose()
    } catch {
      // Keep the mutation error visible; uncertain retries keep the same identity.
      busy.current = false
    }
  }
  return <Dialog open onOpenChange={open => { if (!open && canClose) onClose() }}>
    <DialogContent showCloseButton={canClose} onEscapeKeyDown={event => { if (!canClose) event.preventDefault() }} onInteractOutside={event => { if (!canClose) event.preventDefault() }}>
      <DialogHeader>
        <DialogTitle>Reset active employees' leave balances?</DialogTitle>
        <DialogDescription>This sets remaining balances to 10 VL and 5 SL, even when leave has already been used. Existing leave records and credit history are retained.</DialogDescription>
      </DialogHeader>
      <p className="text-sm">Unpaid leave conversions for this year also return to 10 Available VL and 5 conversion days. Paid conversions stay unchanged.</p>
      {!uncertain && preview.isFetching && <p role="status" className="text-sm text-muted-foreground">Checking active employees and credit history...</p>}
      {!uncertain && preview.isError && <div role="alert" className="space-y-2 text-sm"><p>{preview.error instanceof LeavePostingError ? preview.error.message : "Unable to check active employees. No balances were reset."}</p><Button variant="outline" onClick={() => void preview.refetch()}>Retry preview</Button></div>}
      {details && <div className="space-y-2 text-sm"><p><strong>{details.employeeCount} active employees</strong> in {details.year}. Employee and list filters do not restrict this reset.</p><p>VL: <strong>10 days</strong> · SL: <strong>5 days</strong></p>{details.employeeCount === 0 && <p>No active employees need resetting.</p>}<p className="text-muted-foreground">Payroll and previously recorded leave allocations will not be recalculated. The annual reset starts January 1 from 2027.</p></div>}
      {reset.isError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{reset.error instanceof LeavePostingError ? reset.error.message : "The reset could not be confirmed. Retry the same reset before starting another."}</p>{uncertain && <p>The outcome is uncertain. Keep this dialog open and retry to check the same operation safely.</p>}{!uncertain && <Button variant="outline" disabled={preview.isFetching} onClick={() => { reset.reset(); void preview.refetch() }}>Refresh preview</Button>}</div>}
      <DialogFooter>
        <Button variant="outline" disabled={!canClose} onClick={onClose}>Cancel</Button>
        <Button disabled={reset.isPending || reset.isSuccess || !details?.employeeCount || (!uncertain && (preview.isFetching || !preview.isSuccess || reset.isError))} onClick={() => void confirm()}>
          {reset.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}{reset.isPending ? "Resetting..." : uncertain ? "Retry same reset" : "Reset balances"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
