/**
 * Payroll dashboard (Payroll Admin). Lists payroll periods with status and
 * links into each period's detail. Loading / Empty / Error / Success states.
 * Authorization is enforced in Dataverse, not this UI (CLAUDE.md "Security").
 */
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, Archive, ArchiveRestore, Loader2, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import {
  usePayrollPeriods,
  useArchivedPeriods,
  useArchivePeriod,
  useUnarchivePeriod,
} from "@/features/payroll/hooks/use-payroll-periods"
import { CreatePeriodDialog } from "@/features/payroll/create-period-dialog"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import type { PayrollPeriod } from "@/features/payroll/types"

export default function PayrollDashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingArchive, setPendingArchive] = useState<PayrollPeriod | null>(null)
  const navigate = useNavigate()
  const { data: periods, isPending, isError, error, refetch } = usePayrollPeriods()
  const archivedQuery = useArchivedPeriods()
  const archive = useArchivePeriod()
  const unarchive = useUnarchivePeriod()
  const [pendingUnarchive, setPendingUnarchive] = useState<PayrollPeriod | null>(null)

  const handleArchive = () => {
    if (!pendingArchive) return
    archive.mutate(pendingArchive.a365_payrollperiodid, {
      onSuccess: () => {
        toast.success(`Archived ${pendingArchive.a365_name}.`)
        setPendingArchive(null)
      },
      onError: (err) => toast.error("Unable to archive.", { description: err.message }),
    })
  }

  const handleUnarchive = () => {
    if (!pendingUnarchive) return
    unarchive.mutate(pendingUnarchive.a365_payrollperiodid, {
      onSuccess: () => {
        toast.success(`Restored ${pendingUnarchive.a365_name}.`)
        setPendingUnarchive(null)
      },
      onError: (err) => toast.error("Unable to unarchive.", { description: err.message }),
    })
  }

  const archived = archivedQuery.data ?? []

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Create and process payroll cutoffs.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New payroll period
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2 rounded-md border p-4" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Unable to load payroll periods</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <Wallet className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No payroll periods yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first payroll period to begin processing a cutoff.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New payroll period
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Pay date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow
                  key={p.a365_payrollperiodid}
                  className="cursor-pointer"
                  onClick={() => navigate(`/payroll/${p.a365_payrollperiodid}`)}
                >
                  <TableCell className="font-medium">
                    <Link
                      to={`/payroll/${p.a365_payrollperiodid}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.a365_name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(p.a365_periodstart)}</TableCell>
                  <TableCell>{formatDate(p.a365_periodend)}</TableCell>
                  <TableCell>{formatDate(p.a365_paydate)}</TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={p.a365_payrollstatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingArchive(p)
                      }}
                      aria-label={`Archive ${p.a365_name}`}
                    >
                      <Archive className="size-3.5" aria-hidden />
                      Archive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {archived.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Archived</h2>
            <p className="text-xs text-muted-foreground">
              Hidden from the active lists and read-only. Unarchive to restore.
            </p>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map((p) => (
                  <TableRow key={p.a365_payrollperiodid} className="text-muted-foreground">
                    <TableCell className="font-medium text-foreground">{p.a365_name}</TableCell>
                    <TableCell>{formatDate(p.a365_periodstart)}</TableCell>
                    <TableCell>{formatDate(p.a365_periodend)}</TableCell>
                    <TableCell>{formatDate(p.a365_paydate)}</TableCell>
                    <TableCell>
                      <PayrollStatusBadge status={p.a365_payrollstatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingUnarchive(p)}
                        aria-label={`Unarchive ${p.a365_name}`}
                      >
                        <ArchiveRestore className="size-3.5" aria-hidden />
                        Unarchive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <CreatePeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/payroll/${id}`)}
      />

      <Dialog open={pendingArchive !== null} onOpenChange={(o) => !o && setPendingArchive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this payroll period?</DialogTitle>
            <DialogDescription>
              {pendingArchive?.a365_name} will be hidden from the payroll lists and dashboard, and
              becomes read-only. This can only be reversed by an administrator in Dataverse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)} disabled={archive.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archive.isPending}>
              {archive.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingUnarchive !== null} onOpenChange={(o) => !o && setPendingUnarchive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unarchive this payroll period?</DialogTitle>
            <DialogDescription>
              {pendingUnarchive?.a365_name} will be restored to Active and reappear in the payroll
              lists and dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingUnarchive(null)} disabled={unarchive.isPending}>
              Cancel
            </Button>
            <Button onClick={handleUnarchive} disabled={unarchive.isPending}>
              {unarchive.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Unarchive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
