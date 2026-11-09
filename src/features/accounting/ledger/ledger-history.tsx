import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { ledgerService, ledgerCommand } from "./ledger-service"
import { useLedgerHistory, useLedgerWrite } from "./use-ledger"
import type { HistoryPreview, LedgerRow } from "./types"

function ManualReview({ row, preview }: { row: LedgerRow; preview: HistoryPreview }) {
  const [period, setPeriod] = useState(""), [entry, setEntry] = useState(""), [error, setError] = useState("")
  const operation = useRef(crypto.randomUUID())
  const sources = useQuery({ queryKey: ["accounting", "ledger", "sources", period], queryFn: () => ledgerService.sources(period), enabled: Boolean(period), retry: false })
  const save = useLedgerWrite((keepManual: boolean) => keepManual ? ledgerCommand({ command: "reviewManual", id: row.id, version: row.version, operationId: operation.current }) : ledgerService.link(row, entry, operation.current))
  const review = async (keep: boolean) => {
    if (save.isPending) return
    setError("")
    try { await save.mutateAsync(keep) } catch (error) { setError((error as Error).message) }
  }
  return <div className="space-y-2 rounded-md border p-3">
    <p className="text-sm">{row.date} · {row.description} · {formatCurrency(row.amount)}. Confirm the source identity; amount or text alone is insufficient.</p>
    <label className="block text-sm">Source payroll period<select aria-label={`Source period for ${row.description}`} value={period} disabled={save.isPending || save.isError} onChange={e => { setPeriod(e.target.value); setEntry("") }} className="block w-full rounded border bg-background p-2"><option value="">Select period</option>{preview.periods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="block text-sm">Source employee entry<select aria-label={`Source entry for ${row.description}`} value={entry} disabled={!period || save.isPending || save.isError} onChange={e => setEntry(e.target.value)} className="block w-full rounded border bg-background p-2"><option value="">Select verified employee source</option>{sources.data?.rows.map(item => <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.amount)}</option>)}</select></label>
    {sources.isPending && period && <p role="status">Loading sources…</p>}
    {sources.isError && <p role="alert">Sources could not be loaded. <Button variant="outline" onClick={() => void sources.refetch()}>Retry sources</Button></p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={!entry || save.isPending} onClick={() => void review(false)}>Confirm source link</Button><Button variant="outline" disabled={save.isPending || save.isError} onClick={() => void review(true)}>Confirm unrelated manual payment</Button></div>
  </div>
}
export function LedgerHistory({ close }: { close: () => void }) {
  const preview = useLedgerHistory(true), operation = useRef(crypto.randomUUID())
  const reviewedRevision = useRef<string | null>(null)
  const [error, setError] = useState(""), [confirmed, setConfirmed] = useState(false)
  const start = useLedgerWrite((revision: string) => ledgerService.startHistory(revision, operation.current))
  const run = async () => {
    if (!preview.data || start.isPending) return
    setError("")
    reviewedRevision.current ??= preview.data.revision
    try { await start.mutateAsync(reviewedRevision.current); setConfirmed(true) } catch (error) { setError((error as Error).message) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !start.isPending) close() }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Post previous paid payroll</DialogTitle><DialogDescription>Review source matches first. Confirmation queues missing employee rows using saved signed net pay and original Paid On dates. Existing linked rows are skipped. Processing continues on the server after this page closes.</DialogDescription></DialogHeader>
    {preview.isPending && <p role="status">Checking previous paid payroll…</p>}
    {preview.isError && <div role="alert"><p>{preview.error.message}</p><Button onClick={() => void preview.refetch()}>Retry preview</Button></div>}
    {preview.data && <>
      {preview.data.manual.length > 0 && <div className="space-y-3"><h3 className="font-medium">Unlinked manual Payroll payments require review</h3>{preview.data.manual.map(row => <ManualReview key={row.id} row={row} preview={preview.data} />)}</div>}
      <div className="overflow-x-auto"><table className="w-full text-sm" aria-label="Historical payroll preview"><thead><tr><th className="p-2 text-left">Period</th><th>Employees</th><th>Missing rows</th><th>Signed Debit</th><th>Status</th></tr></thead><tbody>{preview.data.periods.map(period => <tr key={period.id} className="border-t"><td className="p-2">{period.name}</td><td className="text-center">{period.employees}</td><td className="text-center">{period.missing}</td><td className="whitespace-nowrap text-right">{formatCurrency(period.total)}</td><td className="p-2">{period.error ?? "Eligible"}</td></tr>)}</tbody></table></div>
      {!preview.data.periods.length && <p>No previous paid payroll periods were found.</p>}
      {preview.data.missing === 0 && <p>{preview.data.periods.some(period => period.error) ? "No postable missing rows remain. The exceptions above still require review." : "All previous paid payroll has been posted"}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {confirmed ? <p role="status">Historical posting queued. Review per-period progress on Ledger.</p> : <Button disabled={start.isPending || preview.data.manual.length > 0 || preview.data.missing === 0} onClick={() => void run()}>{start.isPending ? "Queuing…" : "Confirm and post missing payroll"}</Button>}
    </>}
    <Button variant="outline" disabled={start.isPending} onClick={close}>Close</Button>
  </DialogContent></Dialog>
}
