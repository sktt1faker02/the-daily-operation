import { useRef, useState } from "react"
import { BookOpen, Download, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { LedgerForm } from "@/features/accounting/ledger/ledger-form"
import { LedgerHistory } from "@/features/accounting/ledger/ledger-history"
import { ledgerService } from "@/features/accounting/ledger/ledger-service"
import { downloadLedger } from "@/features/accounting/ledger/ledger-export"
import { useLedger, useLedgerJobs, useLedgerHistory, useLedgerWrite } from "@/features/accounting/ledger/use-ledger"
import { emptyFilters, type LedgerFilters, type LedgerRow } from "@/features/accounting/ledger/types"

function DeleteRecord({ row, close }: { row: LedgerRow; close: () => void }) {
  const operation = useRef(crypto.randomUUID())
  const remove = useLedgerWrite(() => ledgerService.delete(row, operation.current))
  return <Dialog open onOpenChange={open => { if (!open && !remove.isPending) close() }}><DialogContent>
    <DialogHeader><DialogTitle>Delete this ledger record?</DialogTitle><DialogDescription>{row.description}. This removes {formatCurrency(row.amount)} from {row.direction === "debit" ? "Money out" : "Money in"} and changes the recorded company balance. Audit history is retained.{row.periodId ? " Re-payment or historical posting may recreate this linked payroll row. Source payroll is unchanged." : ""}</DialogDescription></DialogHeader>
    {remove.isError && <p role="alert" className="text-destructive">{remove.error.message}</p>}
    <DialogFooter><Button variant="outline" disabled={remove.isPending} onClick={close}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={async () => { try { await remove.mutateAsync(); close() } catch { /* Mutation error remains visible. */ } }}>{remove.isPending ? "Deleting…" : "Confirm deletion"}</Button></DialogFooter>
  </DialogContent></Dialog>
}

export default function LedgerPage() {
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const cursor = cursors[cursors.length - 1]
  const ledger = useLedger(filters, cursor), jobs = useLedgerJobs()
  const preview = useLedgerHistory(true)
  const historyComplete = preview.data?.missing === 0 && preview.data.manual.length === 0
  const [form, setForm] = useState<LedgerRow | "new" | null>(null), [deleting, setDeleting] = useState<LedgerRow | null>(null)
  const [history, setHistory] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState("")
  const exportBusy = useRef(false)
  const retry = useLedgerWrite((id: string) => ledgerService.retryJob(id, crypto.randomUUID()))
  const set = (key: keyof LedgerFilters, value: string) => setDraft(current => ({ ...current, [key]: value }))
  const refresh = () => { setCursors([undefined]); void ledger.refetch() }
  const runExport = async () => {
    if (exportBusy.current) return
    exportBusy.current = true; setExporting(true); setError("")
    try { await downloadLedger(await ledgerService.export(filters)) } catch (error) { setError((error as Error).message) }
    finally { exportBusy.current = false; setExporting(false) }
  }
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Ledger Management</h1><p className="mt-1 text-sm text-muted-foreground">Record and review business receipts and payments.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={historyComplete} onClick={() => setHistory(true)}><BookOpen className="size-4" aria-hidden />{historyComplete ? preview.data?.periods.some(period => period.error) ? "No postable missing payroll" : "All previous paid payroll has been posted" : "Post previous paid payroll"}</Button><Button variant="outline" disabled={!ledger.data || exporting || ledger.isError} onClick={() => void runExport()}><Download className="size-4" aria-hidden />{exporting ? "Exporting…" : "Export to Excel"}</Button><Button disabled={!ledger.data || ledger.isError} onClick={() => setForm("new")}><Plus className="size-4" aria-hidden />Add record</Button></div>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview.data?.periods.filter(period => period.error).map(period => <p key={period.id} role="status" className="text-sm text-muted-foreground">{period.name}: {period.error}</p>)}
    {ledger.isPending && <p role="status">Loading ledger records and balances…</p>}
    {ledger.isError && <div role="alert" className="space-y-2 rounded-md border p-4"><p>{ledger.error.message}</p><Button variant="outline" onClick={refresh}>Retry ledger</Button></div>}
    {ledger.data && !ledger.isError && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Company balance", ledger.data.balance], ["Filtered Money out", ledger.data.totals.debit], ["Filtered Money in", ledger.data.totals.credit], ["Filtered net movement", ledger.data.totals.net],
      ].map(([label, amount]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold tabular-nums">{formatCurrency(Number(amount))}</p></CardContent></Card>)}</div>
      <p className="text-xs text-muted-foreground">Company balance covers all recorded entries, independent of filters and pages. Filtered totals cover all {ledger.data.totals.count} matching records. Excluded or unrecorded movements limit completeness.</p>
    </>}
    <form className="grid items-end gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-6" onSubmit={e => { e.preventDefault(); setFilters({ ...draft }); setCursors([undefined]) }}>
      <div><Label htmlFor="ledger-from">From</Label><Input id="ledger-from" type="date" value={draft.start} onChange={e => set("start", e.target.value)} /></div>
      <div><Label htmlFor="ledger-to">To</Label><Input id="ledger-to" type="date" value={draft.end} onChange={e => set("end", e.target.value)} /></div>
      <div><Label htmlFor="filter-category">Chart of Account</Label><select id="filter-category" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={draft.category} onChange={e => set("category", e.target.value)}><option value="">All categories</option>{ledger.data?.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div><Label htmlFor="filter-direction">Direction</Label><select id="filter-direction" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={draft.direction} onChange={e => set("direction", e.target.value)}><option value="">All directions</option><option value="debit">Money out</option><option value="credit">Money in</option></select></div>
      <div><Label htmlFor="ledger-search">Search</Label><Input id="ledger-search" placeholder="Description, OR or reference" maxLength={200} value={draft.search} onChange={e => set("search", e.target.value)} /></div>
      <div className="flex gap-2"><Button type="submit" variant="outline">Apply</Button><Button type="button" variant="ghost" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setCursors([undefined]) }}>Clear</Button></div>
    </form>
    {ledger.data && !ledger.isError && <div className="rounded-lg border">
      {ledger.data.rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{Object.values(filters).some(Boolean) ? "No records match these filters. Clear or adjust the filters." : "No ledger records yet. Add a record, including Capital Deposits for opening funds."}</p> :
        <Table aria-label="Ledger records"><TableHeader><TableRow>{["Date", "OR Number", "Reference", "Debit (Money out)", "Credit (Money in)", "Chart of Account", "Description", "Action"].map(label => <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{ledger.data.rows.map(row => <TableRow key={row.id}><TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell><TableCell>{row.receipt || "—"}</TableCell><TableCell className="max-w-48 break-words whitespace-normal">{row.reference || "—"}</TableCell><TableCell className="text-right tabular-nums">{row.direction === "debit" ? formatCurrency(row.amount) : "—"}</TableCell><TableCell className="text-right tabular-nums">{row.direction === "credit" ? formatCurrency(row.amount) : "—"}</TableCell><TableCell>{ledger.data.categories.find(category => category.value === row.category)?.label ?? "Unknown category"}</TableCell><TableCell className="min-w-44 whitespace-normal">{row.description}{row.periodId && <span className="mt-1 block text-xs text-muted-foreground">{row.periodName} · {row.reopened ? "Reopened" : "Paid payroll"}</span>}</TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${row.description}`} onClick={() => setForm(row)}><Pencil className="size-4" aria-hidden /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${row.description}`} onClick={() => setDeleting(row)}><Trash2 className="size-4" aria-hidden /></Button></div></TableCell></TableRow>)}</TableBody>
        </Table>}
      <div className="flex items-center justify-between gap-3 border-t p-3"><Button variant="outline" disabled={cursors.length === 1 || ledger.isFetching} onClick={() => setCursors(current => current.slice(0, -1))}>Previous</Button><span className="text-sm">Page {cursors.length}{ledger.isFetching ? " · Updating…" : ""}</span><Button variant="outline" disabled={!ledger.data.next || ledger.isFetching} onClick={() => setCursors(current => [...current, ledger.data?.next ?? undefined])}>Next</Button></div>
    </div>}
    {jobs.isError && <div role="alert" className="text-sm">Historical progress could not be loaded. <Button variant="outline" onClick={() => void jobs.refetch()}>Retry progress</Button></div>}
    {Boolean(jobs.data?.jobs.length) && <section className="space-y-3" aria-label="Historical posting progress"><h2 className="font-semibold">Historical posting progress</h2>{jobs.data?.jobs.map(job => <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm" key={job.id}><span>{job.period} · {job.status}</span><span>{job.created} created · {job.skipped} skipped · {job.failed} failed</span>{job.error && <span role="status">{job.error}</span>}{job.status === "failed" && <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>Retry posting</Button>}</div>)}{retry.isError && <p role="alert">{retry.error.message}</p>}</section>}
    {form && ledger.data && <LedgerForm row={form === "new" ? undefined : form} categories={ledger.data.categories} close={() => { setForm(null); setCursors([undefined]) }} />}
    {deleting && <DeleteRecord row={deleting} close={() => { setDeleting(null); setCursors([undefined]) }} />}
    {history && <LedgerHistory close={() => setHistory(false)} />}
  </div>
}
