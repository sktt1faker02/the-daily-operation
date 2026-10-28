import { useRef, useState } from "react"
import type { ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { leaveAccessState } from "./rules"
import { ConversionError, conversionService } from "./conversion-service"

export function YearList({ heading }: { heading: ReactNode }) {
  const navigate = useNavigate()
  const access = useAccessProfile({ loadEmployee: false })
  const client = useQueryClient()
  const operation = useRef<{ id: string; year: number } | null>(null)
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const query = useQuery({ queryKey: ["leave", "conversion", "years"], queryFn: conversionService.years, retry: false })
  const create = useMutation({ mutationFn: async () => {
    if (leaveAccessState(access) !== "allowed") throw new Error("Payroll Admin access is required.")
    if (!operation.current) {
      if (!query.data?.nextYear) throw new Error("The next conversion year could not be verified.")
      operation.current = { id: crypto.randomUUID(), year: query.data.nextYear }
    }
    return conversionService.create(operation.current.id, operation.current.year)
  }, retry: false, onSuccess: transaction => {
    setConfirmCreateOpen(false)
    operation.current = null
    void client.invalidateQueries({ queryKey: ["leave", "conversion", "years"] })
    navigate(`/leave-conversion/${transaction.year}`)
  }, onError: error => {
    if (error instanceof ConversionError && !error.uncertain) { operation.current = null; void query.refetch() }
    toast.error(error.message)
  } })
  const cannotCreate = query.isPending || query.isFetching || query.isError || !query.data?.nextYear || create.isPending
  return <>
    <div className="flex flex-wrap items-center justify-between gap-4">{heading}{leaveAccessState(access) === "allowed" && <Button className="ml-auto" disabled={cannotCreate} onClick={() => { create.reset(); setConfirmCreateOpen(true) }}>{create.isPending ? "Creating transaction…" : "Add new transaction"}</Button>}</div>
    {create.isError && !confirmCreateOpen && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}
    <Dialog open={confirmCreateOpen} onOpenChange={open => { if (!create.isPending) setConfirmCreateOpen(open) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!create.isPending} onEscapeKeyDown={event => { if (create.isPending) event.preventDefault() }} onInteractOutside={event => { if (create.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>Add new leave conversion?</DialogTitle><DialogDescription>Create the {operation.current?.year ?? query.data?.nextYear} transaction for all Active employees. No credits will be deducted or payments made.</DialogDescription></DialogHeader>
        {create.isError && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}
        <DialogFooter><Button variant="outline" disabled={create.isPending} onClick={() => setConfirmCreateOpen(false)}>Cancel</Button><Button disabled={cannotCreate} onClick={() => create.mutate()}>{create.isPending ? "Creating transaction…" : "Add new transaction"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {query.isPending ? <div role="status" aria-label="Loading conversion years"><Skeleton className="h-40 w-full" /></div>
      : query.isError ? <div role="alert" className="space-y-3 rounded-md border p-4"><p>Unable to load conversion years.</p><p>{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
        : <div className="rounded-md border"><Table aria-label="Leave conversion years"><TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{query.data.years.map(value => <TableRow key={value.id}><TableCell><Link className="font-medium text-primary hover:underline" to={`/leave-conversion/${value.year}`}>{value.year}</Link></TableCell><TableCell><Button asChild variant="ghost" size="sm"><Link to={`/leave-conversion/${value.year}`}>View employees</Link></Button></TableCell></TableRow>)}{!query.data.years.length && <TableRow><TableCell colSpan={2} className="h-16 text-muted-foreground">No transactions yet. Add a new transaction to begin.</TableCell></TableRow>}</TableBody></Table></div>}
  </>
}
