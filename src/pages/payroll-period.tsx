/**
 * Payroll period detail (Payroll Admin). Load active employees, edit variable
 * inputs, and calculate. Status transitions (Ready/Paid/Lock) are Phase 7 and
 * are not performed here. Loading / Empty / Error / Success states throughout.
 */
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Calculator, Loader2, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { usePayrollPeriod } from "@/features/payroll/hooks/use-payroll-periods"
import {
  usePayrollEntries,
  useLoadActiveEmployees,
  useCalculateEntry,
  useCalculatePeriod,
} from "@/features/payroll/hooks/use-payroll-entries"
import { useCurrentSystemUserId } from "@/features/payroll/hooks/use-current-system-user"
import { PayrollSummaryCards } from "@/features/payroll/payroll-summary-cards"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { PayrollEntryTable } from "@/features/payroll/payroll-entry-table"
import { PayrollEntryDialog } from "@/features/payroll/payroll-entry-dialog"
import { sumEntryTotals } from "@/features/payroll/period-utils"
import { isPeriodEditable, type PayrollEntry } from "@/features/payroll/types"

export default function PayrollPeriodPage() {
  const { periodId = "" } = useParams()
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PayrollEntry | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false)
  const [calculatingId, setCalculatingId] = useState<string | null>(null)

  const period = usePayrollPeriod(periodId)
  const entries = usePayrollEntries(periodId)
  const systemUser = useCurrentSystemUserId()
  const loadEmployees = useLoadActiveEmployees(periodId)
  const calcEntry = useCalculateEntry(periodId)
  const calcPeriod = useCalculatePeriod(periodId)

  const totals = useMemo(
    () => sumEntryTotals(entries.data ?? []),
    [entries.data],
  )
  const filtered = useMemo(() => {
    const list = entries.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((e) => (e.a365_employeename ?? "").toLowerCase().includes(q))
  }, [entries.data, search])

  const editable = isPeriodEditable(period.data?.a365_payrollstatus)

  const requireSystemUser = (): string | null => {
    if (!systemUser.data) {
      toast.error("Cannot calculate yet.", {
        description: "Your Dataverse user could not be resolved for the audit stamp.",
      })
      return null
    }
    return systemUser.data
  }

  const handleLoadEmployees = () => {
    const name = period.data?.a365_name ?? ""
    loadEmployees.mutate(name, {
      onSuccess: ({ created, skipped }) => {
        toast.success(
          `Loaded employees: ${created} added${skipped ? `, ${skipped} already present` : ""}.`,
        )
        setConfirmLoadOpen(false)
      },
      onError: (err) => toast.error("Unable to load employees.", { description: err.message }),
    })
  }

  const handleRecalculateEntry = (entry: PayrollEntry) => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    setCalculatingId(entry.a365_payrollentryid)
    calcEntry.mutate(
      {
        id: entry.a365_payrollentryid,
        periodEndDate: period.data.a365_periodend,
        calculatedByUserId: userId,
      },
      {
        onSuccess: () => toast.success("Entry recalculated."),
        onError: (err) => toast.error("Unable to recalculate.", { description: err.message }),
        onSettled: () => setCalculatingId(null),
      },
    )
  }

  const handleCalculateAll = () => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    calcPeriod.mutate(
      { periodEndDate: period.data.a365_periodend, calculatedByUserId: userId },
      {
        onSuccess: ({ calculated }) => toast.success(`Calculated ${calculated} entries.`),
        onError: (err) => toast.error("Unable to calculate payroll.", { description: err.message }),
      },
    )
  }

  const openEditor = (entry: PayrollEntry) => {
    setEditing(entry)
    setEditorOpen(true)
  }

  if (period.isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (period.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load this payroll period</p>
          <p className="text-sm text-muted-foreground">
            {period.error instanceof Error ? period.error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => period.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const hasEntries = (entries.data?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="space-y-3">
        <Link
          to="/payroll"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Payroll
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{period.data.a365_name}</h1>
            <PayrollStatusBadge status={period.data.a365_payrollstatus} />
          </div>
          <div className="flex items-center gap-2">
            {hasEntries && editable && (
              <Button
                variant="outline"
                onClick={() => setConfirmLoadOpen(true)}
                disabled={loadEmployees.isPending}
              >
                <UserPlus className="size-4" aria-hidden />
                Load employees
              </Button>
            )}
            {hasEntries && editable && (
              <Button onClick={handleCalculateAll} disabled={calcPeriod.isPending}>
                {calcPeriod.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Calculator className="size-4" aria-hidden />
                )}
                Calculate all
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(period.data.a365_periodstart)} – {formatDate(period.data.a365_periodend)} ·
          Pay date {formatDate(period.data.a365_paydate)}
        </p>
      </div>

      <PayrollSummaryCards gross={totals.gross} deductions={totals.deductions} net={totals.net} />

      {!editable && (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
          This period is no longer editable in payroll administration.
        </p>
      )}

      {entries.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load payroll entries</p>
          <p className="text-sm text-muted-foreground">
            {entries.error instanceof Error ? entries.error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => entries.refetch()}>
            Try again
          </Button>
        </div>
      ) : !hasEntries ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <UserPlus className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No employees loaded</p>
            <p className="text-sm text-muted-foreground">
              Load active employees to populate this cutoff, then enter inputs and calculate.
            </p>
          </div>
          <Button onClick={() => setConfirmLoadOpen(true)} disabled={!editable || loadEmployees.isPending}>
            {loadEmployees.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            Load active employees
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="pl-8"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <PayrollEntryTable
            entries={filtered}
            onEdit={openEditor}
            onRecalculate={handleRecalculateEntry}
            calculatingId={calculatingId}
          />
          <p className="text-xs text-muted-foreground">
            Withholding tax is provisional pending accountant confirmation of the taxable-base rule.
          </p>
        </div>
      )}

      <PayrollEntryDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editing}
        periodId={periodId}
      />

      <Dialog open={confirmLoadOpen} onOpenChange={setConfirmLoadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load active employees?</DialogTitle>
            <DialogDescription>
              This adds a payroll entry for every active employee not already in this period. Basic
              Pay defaults to half of each employee's monthly salary and can be edited afterward.
              Employees already present are skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmLoadOpen(false)}
              disabled={loadEmployees.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleLoadEmployees} disabled={loadEmployees.isPending}>
              {loadEmployees.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Load employees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
