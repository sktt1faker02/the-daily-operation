import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ledgerService, LedgerError } from "./ledger-service"
import { validateValues, valuesFor } from "./rules"
import { useLedgerWrite } from "./use-ledger"
import type { LedgerCategory, LedgerRow, LedgerValues } from "./types"

export function LedgerForm({ row, categories, close }: { row?: LedgerRow; categories: LedgerCategory[]; close: () => void }) {
  const [values, setValues] = useState(valuesFor(row)), [error, setError] = useState("")
  const operation = useRef(crypto.randomUUID()), submitted = useRef(false)
  const save = useLedgerWrite((input: LedgerValues) => ledgerService.save(input, operation.current, row))
  const uncertain = save.error instanceof LedgerError && save.error.uncertain
  const set = (key: keyof LedgerValues, value: string) => setValues(current => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (save.isPending || submitted.current) return
    try { validateValues(values, categories, Boolean(row?.periodId)) } catch (error) { setError((error as Error).message); return }
    submitted.current = true; setError("")
    try { await save.mutateAsync(values); close() } catch (error) { setError((error as Error).message) }
    finally { submitted.current = false }
  }
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending && !uncertain) close() }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{row ? "Edit ledger record" : "Add ledger record"}</DialogTitle>
        <DialogDescription>{row?.periodId ? `Linked payroll: ${row.periodName}. ${row.reopened ? "Reopened for corrections." : "Paid payroll source."} Re-payment replaces this amount, date and category; optional references are retained.` : "Record one category and one cash direction. Separate combined payments using verified amounts."}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4" aria-busy={save.isPending}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <fieldset disabled={save.isPending || uncertain} className="space-y-4">
          <div><Label htmlFor="ledger-date">Date</Label><Input id="ledger-date" type="date" required value={values.date} onChange={e => set("date", e.target.value)} /></div>
          <div><Label htmlFor="ledger-or">OR Number (optional)</Label><Input id="ledger-or" maxLength={100} value={values.receipt} onChange={e => set("receipt", e.target.value)} /></div>
          <div><Label htmlFor="ledger-reference">Reference (optional)</Label><Input id="ledger-reference" aria-describedby="ledger-reference-help" maxLength={500} value={values.reference} onChange={e => set("reference", e.target.value)} /><p id="ledger-reference-help" className="mt-1 text-xs text-muted-foreground">Enter reference text or a full https:// link. Links open in a new tab.</p></div>
          <div><Label htmlFor="ledger-category">Chart of Account</Label><select id="ledger-category" required value={values.category} onChange={e => set("category", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select category</option>{categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
          <div><Label htmlFor="ledger-direction">Direction</Label><select id="ledger-direction" value={values.direction} onChange={e => set("direction", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="debit">Debit (Money out)</option><option value="credit">Credit (Money in)</option></select></div>
          <div><Label htmlFor="ledger-amount">Amount (PHP)</Label><Input id="ledger-amount" required inputMode="decimal" value={values.amount} onChange={e => set("amount", e.target.value)} /></div>
          <div><Label htmlFor="ledger-description">Description</Label><Input id="ledger-description" required maxLength={2000} value={values.description} onChange={e => set("description", e.target.value)} /></div>
        </fieldset>
        {uncertain && <p className="text-sm">Retry the same values to verify the previous operation. Close after resolving an uncertain result.</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending || uncertain} onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : uncertain ? "Check and retry save" : "Save record"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
