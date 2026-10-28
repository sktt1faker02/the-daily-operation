import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { choiceLabel, formatDays, formatLeaveDate } from "./rules"
import { benefitLabels, conversionStatusLabels, leaveStatusLabels, leaveTypeLabels, notificationStatusLabels } from "./types"
import type { SourceReference } from "./types"
import { useLeaveDetail } from "./use-leave"
import { RetryLeaveEmail } from "./retry-email-button"
import { leaveAllocationDisplay } from "./allocation"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{children ?? "—"}</dd></div>
}

export function LeaveDetail({ source, onClose }: { source: SourceReference | null; onClose: () => void }) {
  const query = useLeaveDetail(source)
  const data = query.isError ? undefined : query.data
  const record = data ? data.record : null
  const allocation = record && "a365_startdate" in record ? leaveAllocationDisplay(record) : null
  const employee = data?.employees[0]
  const actor = (id?: string) => id ? data?.actors.get(id) || "User name unavailable" : "—"
  return <Dialog open={source !== null} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{source?.kind === "conversion" ? "Cash conversion details" : "Leave details"}</DialogTitle><DialogDescription>Historical record and original issue or conversion information.</DialogDescription></DialogHeader>
      {query.isPending && <div role="status" aria-label="Loading details"><Skeleton className="h-48 w-full" /></div>}
      {query.isError && <div role="alert" className="space-y-3"><p>Unable to load this record. It may be unavailable or your access may have changed.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry details</Button></div>}
      {record && <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="Record">{record.a365_name}</Field><Field label="Employee">{employee?.a365_name ?? "Employee name unavailable"}</Field>
        {"a365_startdate" in record ? <>
          <Field label="Type">{choiceLabel(leaveTypeLabels, record.a365_leavetype)}</Field><Field label="Benefit">{choiceLabel(benefitLabels, record.a365_benefit)}</Field>
          <Field label="Status"><Badge variant="outline">{choiceLabel(leaveStatusLabels, record.a365_leavestatus)}</Badge></Field><Field label="Days">{formatDays(record.a365_days)}</Field>
          <Field label="Paid days">{allocation?.paid}</Field><Field label="Unpaid days">{allocation?.unpaid}</Field>
          <Field label="Unpaid dates">{allocation?.unpaidDates}</Field>
          <Field label="Start date">{formatLeaveDate(record.a365_startdate)}</Field><Field label="End date">{formatLeaveDate(record.a365_enddate)}</Field>
          <Field label="Issued by">{actor(record._a365_issuedby_value)}</Field><Field label="Issued on">{formatDateTime(record.a365_issuedon)}</Field>
          <Field label="Note">{record.a365_note}</Field>
          <Field label="Email status">{record.a365_notificationstatus === undefined ? "Unavailable" : choiceLabel(notificationStatusLabels, record.a365_notificationstatus)}</Field>
          <Field label="Email accepted on">{formatDateTime(record.a365_notifiedon)}</Field>
        </> : <>
          <Field label="Status"><Badge variant="outline">{choiceLabel(conversionStatusLabels, record.a365_conversionstatus)}</Badge></Field><Field label="Year">{record.a365_year}</Field>
          <Field label="Days">{formatDays(record.a365_days)}</Field><Field label="Daily rate used">{formatCurrency(record.a365_dailyrateused)}</Field><Field label="Amount">{formatCurrency(record.a365_amount)}</Field>
          <Field label="Converted by">{actor(record._a365_convertedby_value)}</Field><Field label="Converted on">{formatDateTime(record.a365_convertedon)}</Field>
        </>}
        <Field label="Cancelled by">{actor(record._a365_cancelledby_value)}</Field><Field label="Cancelled on">{formatDateTime(record.a365_cancelledon)}</Field><Field label="Cancellation reason">{record.a365_cancellationreason}</Field>
      </dl>}
      {record && "a365_leaveid" in record && record.a365_leavestatus === 749910000 && <RetryLeaveEmail leaveId={record.a365_leaveid} />}
    </DialogContent>
  </Dialog>
}
