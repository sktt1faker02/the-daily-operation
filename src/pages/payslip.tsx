/**
 * Employee payslip detail (`/my-payroll/:entryId`). Renders the full itemized
 * breakdown for one finalized payslip. The entry is resolved from the current
 * employee's own visible payslips, so an id that isn't theirs (or isn't a
 * Paid/Locked cutoff) simply isn't found — an employee cannot open another
 * employee's payslip by changing the URL. Dataverse enforces this underneath.
 */
import { Link, useParams } from "react-router-dom"
import { AlertCircle, ArrowLeft, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { PayslipBreakdown } from "@/features/payroll/payslip-breakdown"
import { useMyPayslips } from "@/features/payroll/hooks/use-my-payroll"
import { useCurrentEmployee } from "@/features/payroll/hooks/use-current-employee"
import { usePositions } from "@/features/employees/use-reference-data"
import { toPayslipDocument } from "@/features/payroll/payslip-data"
import { openPayslip } from "@/features/payroll/payslip-document"

export default function PayslipPage() {
  const { entryId = "" } = useParams()
  const { data, isPending, isError, error, refetch } = useMyPayslips()
  const employee = useCurrentEmployee()
  const { data: positions } = usePositions()

  const slip = data?.find((s) => s.entry.a365_payrollentryid === entryId)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <Link
        to="/my-payroll"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My Payroll
      </Link>

      {isPending ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load this payslip</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !slip ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Payslip not available</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This payslip doesn't exist or isn't available to you.
          </p>
          <Button asChild variant="outline">
            <Link to="/my-payroll">Back to My Payroll</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payslip</h1>
              <p className="text-sm text-muted-foreground">
                {employee.data?.a365_name ? `${employee.data.a365_name} · ` : ""}
                {slip.period.a365_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PayrollStatusBadge status={slip.period.a365_payrollstatus} />
              {employee.data &&
                (() => {
                  const emp = employee.data
                  const positionName =
                    positions?.find((p) => p.a365_positionid === emp._a365_position_value)
                      ?.a365_name ?? null
                  const doc = toPayslipDocument(emp, slip.period, slip.entry, positionName)
                  return (
                    <Button variant="outline" size="sm" onClick={() => openPayslip(doc)}>
                      <FileText className="size-4" aria-hidden />
                      View Payslip
                    </Button>
                  )
                })()}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(slip.period.a365_periodstart)} – {formatDate(slip.period.a365_periodend)} ·
            Pay date {formatDate(slip.period.a365_paydate)}
          </p>
          <Card>
            <CardContent className="p-5">
              <PayslipBreakdown entry={slip.entry} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
