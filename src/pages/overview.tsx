/**
 * Payroll Overview dashboard (admin). Headline stats for the active workforce
 * and the latest cutoff, plus a recent-payroll table. Distinct from the Payroll
 * page (period management) — this is a read-only summary. Loading / Empty /
 * Error / Success states throughout.
 */
import { Link } from "react-router-dom"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { useOverview } from "@/features/payroll/hooks/use-overview"

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  const { data, isPending, isError, error, refetch } = useOverview()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your workforce and latest cutoff.</p>
      </div>

      {isPending ? (
        <div className="space-y-6" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load the dashboard</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {(() => {
            const cutoffSub = data.cutoffPeriod?.a365_name ?? "No finalized cutoff yet"
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Employees"
                  value={String(data.activeEmployees)}
                  sub="Active employees"
                />
                <StatCard label="Gross Payroll" value={formatCurrency(data.cutoff.gross)} sub={cutoffSub} />
                <StatCard
                  label="Total Deductions"
                  value={formatCurrency(data.cutoff.deductions)}
                  sub={cutoffSub}
                />
                <StatCard label="Net Payroll" value={formatCurrency(data.cutoff.net)} sub={cutoffSub} />
              </div>
            )
          })()}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">Recent Payroll</h2>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/payroll">View all</Link>
              </Button>
            </div>

            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-12 text-center">
                <p className="font-medium">No payroll periods yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first cutoff to see it summarized here.
                </p>
                <Button asChild variant="outline" className="mt-1">
                  <Link to="/payroll">Go to Payroll</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Pay date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Net Payroll</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent.map(({ period, employees, net }) => (
                      <TableRow key={period.a365_payrollperiodid}>
                        <TableCell>
                          <Link
                            to={`/payroll/${period.a365_payrollperiodid}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {period.a365_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(period.a365_paydate)}
                        </TableCell>
                        <TableCell>
                          <PayrollStatusBadge status={period.a365_payrollstatus} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{employees}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
