import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmployeeRow } from "./conversion-employee-row"
import { useLeaveConversion } from "./use-leave-conversion"

export function ConversionEmployees({ year }: { year: number }) {
  const state = useLeaveConversion(year)
  const { query, page, index, editing, save, markPaid, paid } = state
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false)
  const cannotMarkPaid = !state.allowed || paid || state.transaction?.paid === undefined || state.dirty || Boolean(editing) || save.isPending || markPaid.isPending || query.isError || query.isFetching || !page
  if (query.isPending) return <div role="status" aria-label="Loading employee conversions"><Skeleton className="h-48 w-full" /></div>
  return <section aria-label="Employee conversions" className="space-y-3">
    <h2 className="text-lg font-semibold">Employees</h2>
    {query.isError && <div role="alert" className="space-y-3"><p>Unable to load saved employee conversions. Your edits are retained.</p><p>{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
    {page && <><div className="rounded-md border"><Table aria-label="Employee conversions"><TableHeader><TableRow>{["Employee name", "Daily rate", "Available VL", "VL to convert (max. 5)", "Total amount to be paid", "Action"].map((header, i) => <TableHead key={header} className={i > 0 && i < 5 ? "text-right" : undefined}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>
      {page.rows.map(row => <EmployeeRow key={row.id} row={row} editing={editing?.row.id === row.id} draft={editing?.row.id === row.id ? editing.values : state.drafts[row.id]?.values} disabled={!state.allowed || paid || markPaid.isPending || save.isPending || Boolean(editing && editing.row.id !== row.id)} onEdit={() => state.edit(row)} onChange={values => state.setEditing({ row, values })} onDone={state.done} onCancel={() => state.setEditing(null)} />)}
      {!page.rows.length && <TableRow><TableCell colSpan={6} className="h-16 text-muted-foreground">No employees were recorded for this transaction.</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">Page {index + 1}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={save.isPending || query.isFetching || Boolean(editing) || index === 0} onClick={() => state.setIndex(index - 1)}>Previous page</Button><Button size="sm" variant="outline" disabled={save.isPending || query.isFetching || Boolean(editing) || (!query.hasNextPage && index >= query.data!.pages.length - 1)} onClick={() => void state.next()}>Next page</Button></div></div></>}
    {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    {markPaid.isError && !confirmPaidOpen && <p role="alert" className="text-sm text-destructive">{markPaid.error.message}</p>}
    <div className="flex flex-wrap items-center justify-end gap-3">{state.dirty && <p role="status" className="text-sm text-muted-foreground">Unsaved changes</p>}{!paid && <Button disabled={!state.allowed || !state.dirty || Boolean(editing) || save.isPending || markPaid.isPending || query.isError || query.isFetching} onClick={() => { if (window.confirm(`Save leave conversion for ${year}? This records conversion values without deducting credits or making payments.`)) save.mutate() }}>{save.isPending ? "Saving…" : "Save"}</Button>}<Button disabled={cannotMarkPaid} onClick={() => { markPaid.reset(); setConfirmPaidOpen(true) }}>{paid ? "Paid (locked)" : markPaid.isPending ? "Marking as paid…" : "Mark as paid"}</Button></div>
    <Dialog open={confirmPaidOpen} onOpenChange={open => { if (!markPaid.isPending) setConfirmPaidOpen(open) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!markPaid.isPending} onEscapeKeyDown={event => { if (markPaid.isPending) event.preventDefault() }} onInteractOutside={event => { if (markPaid.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>Mark this leave conversion Paid?</DialogTitle><DialogDescription>Records that the {year} leave conversion has been paid out. Conversion values will be locked.</DialogDescription></DialogHeader>
        {markPaid.isError && <p role="alert" className="text-sm text-destructive">{markPaid.error.message}</p>}
        <DialogFooter><Button variant="outline" disabled={markPaid.isPending} onClick={() => setConfirmPaidOpen(false)}>Cancel</Button><Button disabled={cannotMarkPaid} onClick={() => markPaid.mutate(undefined, { onSuccess: () => setConfirmPaidOpen(false) })}>{markPaid.isPending ? "Marking as paid…" : "Mark as Paid"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={state.blocker.state === "blocked"} onOpenChange={open => { if (!open && state.blocker.state === "blocked") state.blocker.reset() }}><DialogContent><DialogHeader><DialogTitle>Leave without saving?</DialogTitle><DialogDescription>Your unsaved conversion changes will be discarded.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => { if (state.blocker.state === "blocked") state.blocker.reset() }}>Keep editing</Button><Button onClick={() => { if (state.blocker.state === "blocked") state.blocker.proceed() }}>Leave without saving</Button></DialogFooter></DialogContent></Dialog>
  </section>
}
