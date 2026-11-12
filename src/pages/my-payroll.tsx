/**
 * Employee portal — "My Payroll". Shows the signed-in employee's own finalized
 * payslips (Ready / Locked only): the latest cutoff's totals up top, then the
 * full history linking to each payslip. Employees only ever see their own
 * records (Dataverse-enforced; the query is scoped to their employee id).
 */
import { Link } from "react-router-dom"
import { AlertCircle, FileText, Wallet } from "lucide-react"
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
import { formatCurrency, formatDate } from "@/lib/format"
import { PayrollSummaryCards } from "@/features/payroll/payroll-summary-cards"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { useMyPayslips } from "@/features/payroll/hooks/use-my-payroll"

export default function MyPayrollPage() {
  const { data, isPending, isError, error, noEmployeeRecord, employeeLookupFailed, retryEmployeeLookup, refetch } = useMyPayslips()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Payroll</h1>
        <p className="text-sm text-muted-foreground">Your finalized payslips and payroll history.</p>
      </div>

      {isPending ? (
        <div className="space-y-6" aria-busy>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">
            {employeeLookupFailed ? "We couldn't load your employee profile" : "Unable to load your payroll"}
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => employeeLookupFailed ? retryEmployeeLookup() : refetch()}>
            Try again
          </Button>
        </div>
      ) : noEmployeeRecord ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <Wallet className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No employee profile linked</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account isn't linked to an employee record yet. Contact your payroll administrator.
          </p>
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <FileText className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No payslips yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your payslips appear here once your payroll administrator marks the cutoff Ready.
          </p>
        </div>
      ) : (
        <Success slips={data!} />
      )}
    </div>
  )
}

function Success({ slips }: { slips: NonNullable<ReturnType<typeof useMyPayslips>["data"]> }) {
  const latest = slips[0]
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Latest payslip · {latest.period.a365_name}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link to={`/my-payroll/${latest.entry.a365_payrollentryid}`}>
              <FileText className="size-4" aria-hidden />
              View payslip
            </Link>
          </Button>
        </div>
        <PayrollSummaryCards
          gross={latest.entry.a365_grosspay ?? 0}
          deductions={latest.entry.a365_totaldeductions ?? 0}
          net={latest.entry.a365_netpay ?? 0}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Payroll history</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Pay date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map(({ entry, period }) => (
                <TableRow key={entry.a365_payrollentryid}>
                  <TableCell className="font-medium">{period.a365_name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(period.a365_paydate)}</TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={period.a365_payrollstatus} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(entry.a365_netpay)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/my-payroll/${entry.a365_payrollentryid}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
