import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import { personalLeaveService } from "./personal-leave-service"
import { choiceLabel, formatDays, formatLeaveDate } from "./rules"
import { benefitLabels, leaveStatusLabels, leaveTypeLabels } from "./types"

export function PersonalLeaveDetail({ employeeId, recordId, onClose }: { employeeId: string; recordId: string | null; onClose: () => void }) {
  const query = useQuery({ queryKey: ["leave", "personal-detail", employeeId, recordId],
    queryFn: () => personalLeaveService.detail(employeeId, recordId!), enabled: Boolean(recordId), retry: false })
  const data = query.isError ? undefined : query.data
  const record = data?.record
  return <Dialog open={recordId !== null} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Leave details</DialogTitle><DialogDescription>Your recorded leave. This information is read-only.</DialogDescription></DialogHeader>
      {query.isPending && <div role="status" aria-label="Loading details"><Skeleton className="h-48 w-full" /></div>}
      {query.isError && <div role="alert" className="space-y-3"><p>Unable to load this leave record. It may be unavailable or your access may have changed.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry details</Button></div>}
      {record && <dl className="grid gap-5 sm:grid-cols-2">{[
        ["Record", record.a365_name], ["Employee", data.employee.a365_name],
        ["Type", choiceLabel(leaveTypeLabels, record.a365_leavetype)], ["Benefit", choiceLabel(benefitLabels, record.a365_benefit)],
        ["Start date", formatLeaveDate(record.a365_startdate)], ["End date", formatLeaveDate(record.a365_enddate)],
        ["Days", formatDays(record.a365_days)], ["Status", <Badge key="status" variant="outline">{choiceLabel(leaveStatusLabels, record.a365_leavestatus)}</Badge>],
        ["Issued on", formatDateTime(record.a365_issuedon)],
      ].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl>}
    </DialogContent>
  </Dialog>
}
