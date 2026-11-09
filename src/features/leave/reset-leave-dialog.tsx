import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeavePostingError, type LeaveRefreshPreview } from "./posting-service"
import { useLeaveRefresh } from "./use-leave-reset"

export function RefreshLeaveDialog({ onClose }: { onClose: () => void }) {
  const { preview, reset } = useLeaveRefresh()
  const [operationId] = useState(() => crypto.randomUUID())
  const reviewed = useRef<LeaveRefreshPreview | null>(null)
  const busy = useRef(false)
  const uncertain = reset.error instanceof LeavePostingError && reset.error.uncertain
  const canClose = !reset.isPending && !uncertain
  const details = uncertain ? reviewed.current : preview.data
  async function confirm() {
    if (busy.current || !details?.canApply || (!uncertain && (preview.isFetching || !preview.isSuccess))) return
    busy.current = true
    reviewed.current = details
    try {
      const result = await reset.mutateAsync({ reviewed: details, operationId })
      toast.success(`Leave balances refreshed for ${result.employeeCount} active employees.`)
      onClose()
    } catch {
      // Keep the mutation error visible; uncertain retries keep the same identity.
      busy.current = false
    }
  }
  return <Dialog open onOpenChange={open => { if (!open && canClose) onClose() }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl" showCloseButton={canClose} onEscapeKeyDown={event => { if (!canClose) event.preventDefault() }} onInteractOutside={event => { if (!canClose) event.preventDefault() }}>
      <DialogHeader>
        <DialogTitle>Refresh active employees' leave balances?</DialogTitle>
        <DialogDescription>Recalculate this period from earned VL and 5 SL, minus recorded paid leave and paid VL conversions. Maximum entitlement is 10 VL and 5 SL. Existing records and credit history are retained.</DialogDescription>
      </DialogHeader>
      <p className="text-sm">Cancelled, deleted and unpaid leave do not use credits. Saved conversion limits, rates and paid amounts stay unchanged.</p>
      {!uncertain && preview.isFetching && <p role="status" className="text-sm text-muted-foreground">Checking active employees and credit history...</p>}
      {!uncertain && preview.isError && <div role="alert" className="space-y-2 text-sm"><p>{preview.error instanceof LeavePostingError ? preview.error.message : "Unable to check active employees. No balances were refreshed."}</p><Button variant="outline" onClick={() => void preview.refetch()}>Retry preview</Button></div>}
      {details && <div className="min-w-0 space-y-3 text-sm">
        <p><strong>{details.employeeCount} active employees</strong> in {details.year}. Employee and list filters do not restrict this refresh.</p>
        {details.employeeCount === 0 ? <p>No active employees to refresh.</p> : <Table aria-label="Balance refresh preview">
          <TableHeader><TableRow>{["Employee", "Earned VL", "Paid VL used", "Paid VL converted", "VL before / after", "Paid SL used", "SL before / after"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{details.employees.map(row => <TableRow key={row.employeeId}>
            <TableCell className="whitespace-normal font-medium">{row.employeeName}{row.issue && <p className="mt-1 text-xs text-destructive">{row.issue}</p>}</TableCell>
            <TableCell>{row.earnedVL.toFixed(2)}</TableCell><TableCell>{row.usedVL.toFixed(2)}</TableCell><TableCell>{row.convertedVL.toFixed(2)}</TableCell>
            <TableCell>{row.beforeVL.toFixed(2)} / {row.VL.toFixed(2)}</TableCell><TableCell>{row.usedSL.toFixed(2)}</TableCell><TableCell>{row.beforeSL.toFixed(2)} / {row.SL.toFixed(2)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
        {!details.canApply && details.employeeCount > 0 && <p role="alert" className="text-destructive">Resolve the flagged records before refreshing. No balances will be changed.</p>}
        <p className="text-muted-foreground">Payroll and previously recorded leave allocations will not be recalculated.</p>
      </div>}
      {reset.isError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{reset.error instanceof LeavePostingError ? reset.error.message : "The refresh could not be confirmed. Retry the same refresh before starting another."}</p>{uncertain && <p>The outcome is uncertain. Keep this dialog open and retry to check the same operation safely.</p>}{!uncertain && <Button variant="outline" disabled={preview.isFetching} onClick={() => { reset.reset(); void preview.refetch() }}>Refresh preview</Button>}</div>}
      <DialogFooter>
        <Button variant="outline" disabled={!canClose} onClick={onClose}>Cancel</Button>
        <Button disabled={reset.isPending || reset.isSuccess || !details?.canApply || (!uncertain && (preview.isFetching || !preview.isSuccess || reset.isError))} onClick={() => void confirm()}>
          {reset.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}{reset.isPending ? "Refreshing..." : uncertain ? "Retry same refresh" : "Refresh balance"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
