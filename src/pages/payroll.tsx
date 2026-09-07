/**
 * Payroll dashboard (Payroll Admin). Lists payroll periods with status and
 * links into each period's detail. Loading / Empty / Error / Success states.
 * Authorization is enforced in Dataverse, not this UI (CLAUDE.md "Security").
 */
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircle, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { usePayrollPeriods } from "@/features/payroll/hooks/use-payroll-periods"
import { CreatePeriodDialog } from "@/features/payroll/create-period-dialog"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"

export default function PayrollDashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()
  const { data: periods, isPending, isError, error, refetch } = usePayrollPeriods()

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/payroll/${id}`)}
      />
    </div>
  )
}
