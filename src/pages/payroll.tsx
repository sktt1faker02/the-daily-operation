/**
 * Payroll dashboard (Payroll Admin). Lists payroll periods with status and
 * links into each period's detail. Loading / Empty / Error / Success states.
 * Authorization is enforced in Dataverse, not this UI (CLAUDE.md "Security").
 */
import { useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  type ColumnDef,
  type Table as TableInstance,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react"
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
import { DeletePeriodDialog } from "@/features/payroll/delete-period-dialog"
import { isPeriodEditable } from "@/features/payroll/period-status"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import type { PayrollPeriod } from "@/features/payroll/types"
import { Checkbox } from "@/components/ui/checkbox"
import { payrollPeriodService } from "@/features/payroll/services/payroll-period-service"
import {
  buildMultiPeriodRows,
  createPayrollWorkbook,
  DEFAULT_PAYROLL_EXPORT_GROUPS,
  downloadBlob,
  nonFinalPeriodsNote,
  payrollExportFileNameForPeriods,
  requiresLargeExportConfirmation,
  selectColumns,
} from "@/features/payroll/payroll-export"
import { usePowerContext } from "@/hooks/use-power-context"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { filterPayrollPeriodsByYearAndQuarter, getPayrollPeriodYear, type PayrollQuarterFilter, type PayrollYearFilter } from "@/features/payroll/period-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PendingLargeExport = {
  periods: PayrollPeriod[]
  rows: ReturnType<typeof buildMultiPeriodRows>
}

const PAYROLL_EXPORT_COLUMNS = selectColumns("full", DEFAULT_PAYROLL_EXPORT_GROUPS)

/** Prev/Next page controls, shown only when the table has more than one page. */
function TablePagination({ table }: { table: TableInstance<PayrollPeriod> }) {
  if (table.getPageCount() <= 1) return null
  return (
    <div className="flex items-center justify-end gap-4">
      <p className="text-sm text-muted-foreground">
        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

export default function PayrollDashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingArchive, setPendingArchive] = useState<PayrollPeriod | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PayrollPeriod | null>(null)
  const navigate = useNavigate()
  const { data: periods, isPending, isError, error, refetch } = usePayrollPeriods()
  const archivedQuery = useArchivedPeriods()
  const archive = useArchivePeriod()
  const unarchive = useUnarchivePeriod()
  const [pendingUnarchive, setPendingUnarchive] = useState<PayrollPeriod | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([])
  const [selectedQuarter, setSelectedQuarter] = useState<PayrollQuarterFilter>("all")
  const [selectedYear, setSelectedYear] = useState<PayrollYearFilter>("all")
  const [pendingLargeExport, setPendingLargeExport] = useState<PendingLargeExport | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportProgress, setExportProgress] = useState("")
  const exportBusyRef = useRef(false)
  const { data: powerContext } = usePowerContext()
  const { isAdmin } = useAccessProfile({ loadEmployee: false })

  const exportPayroll = async (
    targets: PayrollPeriod[],
    confirmedLargeExport = false,
    preparedRows?: ReturnType<typeof buildMultiPeriodRows>,
  ) => {
    if (exportBusyRef.current) return
    if (!isAdmin) {
      toast.error("Only a Payroll Admin can export payroll.", { description: "Contact your administrator if you believe you should have access." })
      return
    }
    const exportedBy = powerContext?.user.fullName
    if (!exportedBy) {
      toast.error("Unable to identify your account.", { description: "Refresh the page and try again. Contact your administrator if the problem continues." })
      return
    }
    if (targets.length === 0) {
      toast.error("No payroll periods are selected.", { description: "Select at least one period, then try again." })
      return
    }
    exportBusyRef.current = true
    setExportBusy(true)
    setExportProgress(`Preparing 0 of ${targets.length} periods…`)
    try {
      const rows = preparedRows ?? buildMultiPeriodRows(targets, await payrollPeriodService.listEntriesForExport(
        targets.map((period) => period.a365_payrollperiodid),
        (completed) => setExportProgress(`Preparing ${completed} of ${targets.length} periods…`),
      ))
      if (rows.length === 0) {
        toast.error("No payroll details are available for these periods.", { description: "Choose periods that contain payroll entries and try again." })
        return
      }
      if (!confirmedLargeExport && requiresLargeExportConfirmation(rows.length)) {
        setPendingLargeExport({ periods: targets, rows })
        return
      }

      const notFinalNote = nonFinalPeriodsNote(targets)
      if (notFinalNote) toast.warning(`${notFinalNote}. These periods may still change.`)
      setPendingLargeExport(null)
      setExportProgress("Building your Excel workbook…")
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const workbook = await createPayrollWorkbook(targets, rows, PAYROLL_EXPORT_COLUMNS, exportedBy)
      downloadBlob(workbook, payrollExportFileNameForPeriods(targets))
      toast.success(`Exported ${rows.length} payroll row${rows.length === 1 ? "" : "s"}.`)
    } catch (cause) {
      toast.error("Unable to create the Excel workbook.", { description: `${cause instanceof Error ? cause.message : "An unexpected error occurred."} Your payroll data is unchanged. Please retry.` })
    } finally {
      exportBusyRef.current = false
      setExportBusy(false)
      setExportProgress("")
    }
  }

  const handleArchive = () => {
    if (!pendingArchive) return
    archive.mutate(pendingArchive.a365_payrollperiodid, {
      onSuccess: () => {
        toast.success(`Archived ${pendingArchive.a365_name}.`)
        setSelectedIds((ids) => ids.filter((id) => id !== pendingArchive.a365_payrollperiodid))
        setPendingLargeExport(null)
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
        setSelectedArchivedIds((ids) => ids.filter((id) => id !== pendingUnarchive.a365_payrollperiodid))
        setPendingLargeExport(null)
        setPendingUnarchive(null)
      },
      onError: (err) => toast.error("Unable to unarchive.", { description: err.message }),
    })
  }

  const archived = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data])
  const availableYears = useMemo(() => Array.from(new Set(
    [...(periods ?? []), ...archived]
      .map(getPayrollPeriodYear)
      .filter((year): year is number => year !== null),
  )).sort((a, b) => b - a), [periods, archived])
  const quarterPeriods = useMemo(() => filterPayrollPeriodsByYearAndQuarter(periods ?? [], selectedYear, selectedQuarter), [periods, selectedYear, selectedQuarter])
  const quarterArchived = useMemo(() => filterPayrollPeriodsByYearAndQuarter(archived, selectedYear, selectedQuarter), [archived, selectedYear, selectedQuarter])
  const selectedPeriods = useMemo(() => quarterPeriods.filter((period) => selectedIds.includes(period.a365_payrollperiodid)), [quarterPeriods, selectedIds])
  const selectedPeriodsNote = nonFinalPeriodsNote(selectedPeriods)
  const selectedArchivedPeriods = useMemo(() => quarterArchived.filter((period) => selectedArchivedIds.includes(period.a365_payrollperiodid)), [quarterArchived, selectedArchivedIds])
  const selectedArchivedPeriodsNote = nonFinalPeriodsNote(selectedArchivedPeriods)

  // Client-side pagination for the active periods list (6 rows/page). Columns are
  // a stub — rows render with custom markup below; the table only drives paging.
  const columns = useMemo<ColumnDef<PayrollPeriod>[]>(() => [{ id: "period" }], [])
  const table = useReactTable({
    data: quarterPeriods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  })
  const visibleActivePeriodIds = table.getRowModel().rows.map((row) => row.original.a365_payrollperiodid)
  const archivedTable = useReactTable({
    data: quarterArchived,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  })
  const visibleArchivedPeriodIds = archivedTable.getRowModel().rows.map((row) => row.original.a365_payrollperiodid)
  const allVisibleArchivedSelected = visibleArchivedPeriodIds.length > 0 && visibleArchivedPeriodIds.every((id) => selectedArchivedIds.includes(id))
  const someVisibleArchivedSelected = visibleArchivedPeriodIds.some((id) => selectedArchivedIds.includes(id))

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
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New payroll period
          </Button>
        </div>
      </div>

      {exportProgress && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{exportProgress}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Label id="payroll-year-filter-label">Year</Label>
        <Select value={String(selectedYear)} onValueChange={(value) => {
          setSelectedYear(value === "all" ? "all" : Number(value))
          setSelectedIds([])
          setSelectedArchivedIds([])
          setPendingLargeExport(null)
          table.setPageIndex(0)
          archivedTable.setPageIndex(0)
        }}>
          <SelectTrigger aria-labelledby="payroll-year-filter-label" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label id="payroll-quarter-filter-label">Quarter</Label>
        <Select value={String(selectedQuarter)} onValueChange={(value) => {
          setSelectedQuarter(value === "all" ? "all" : Number(value) as PayrollQuarterFilter)
          setSelectedIds([])
          setSelectedArchivedIds([])
          setPendingLargeExport(null)
          table.setPageIndex(0)
          archivedTable.setPageIndex(0)
        }}>
          <SelectTrigger aria-labelledby="payroll-quarter-filter-label" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All quarters</SelectItem>
            <SelectItem value="1">Quarter 1 (Jan–Mar)</SelectItem>
            <SelectItem value="2">Quarter 2 (Apr–Jun)</SelectItem>
            <SelectItem value="3">Quarter 3 (Jul–Sep)</SelectItem>
            <SelectItem value="4">Quarter 4 (Oct–Dec)</SelectItem>
          </SelectContent>
        </Select>
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
        <div className="space-y-3">
          <div className="rounded-md border">
            <Table aria-label="Active payroll periods">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="Select all periods on this page"
                      checked={visibleActivePeriodIds.length > 0 && visibleActivePeriodIds.every((id) => selectedIds.includes(id))}
                      onCheckedChange={(checked) => {
                        setPendingLargeExport(null)
                        setSelectedIds((ids) => {
                          const visibleIds = new Set(visibleActivePeriodIds)
                          return checked
                            ? [...new Set([...ids, ...visibleActivePeriodIds])]
                            : ids.filter((id) => !visibleIds.has(id))
                        })
                      }}
                    />
                  </TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44 text-center">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const p = row.original
                  return (
                    <TableRow
                      key={p.a365_payrollperiodid}
                      className="cursor-pointer"
                      onClick={() => navigate(`/payroll/${p.a365_payrollperiodid}`)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${p.a365_name}`} checked={selectedIds.includes(p.a365_payrollperiodid)} onCheckedChange={(checked) => {
                        setPendingLargeExport(null)
                        setSelectedIds((ids) => checked ? [...new Set([...ids, p.a365_payrollperiodid])] : ids.filter((id) => id !== p.a365_payrollperiodid))
                      }} /></TableCell>
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
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" aria-label={`Export ${p.a365_name} to Excel`} title="Export to Excel" disabled={!isAdmin || exportBusy} onClick={(event) => { event.stopPropagation(); void exportPayroll([p]) }}><FileDown className="size-4" aria-hidden /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Archive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingArchive(p)
                          }}
                          aria-label={`Archive ${p.a365_name}`}
                        >
                          <Archive className="size-4" aria-hidden />
                        </Button>
                        {isAdmin && isPeriodEditable(p.a365_payrollstatus) && <Button variant="ghost" size="icon" title="Delete" aria-label={`Delete ${p.a365_name}`} className="text-destructive" onClick={(event) => { event.stopPropagation(); setPendingDelete(p) }}><Trash2 className="size-4" aria-hidden /></Button>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {table.getRowModel().rows.length === 0 && <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No payroll periods in this quarter.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>

          {selectedIds.length > 0 && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{selectedIds.length} periods selected</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void exportPayroll(selectedPeriods)} disabled={!isAdmin || exportBusy}>
                    <FileDown className="size-4" aria-hidden />
                    Export to Excel
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedIds([]); setPendingLargeExport(null) }}>Clear</Button>
                </div>
              </div>
              {selectedPeriodsNote && <p role="status" className="flex items-start gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{selectedPeriodsNote}. These periods may still change.</p>}
            </div>
          )}

          <TablePagination table={table} />
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
            <Table aria-label="Archived payroll periods">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="Select all archived periods on this page"
                      checked={allVisibleArchivedSelected ? true : someVisibleArchivedSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => {
                        setPendingLargeExport(null)
                        setSelectedArchivedIds((ids) => {
                          const visibleIds = new Set(visibleArchivedPeriodIds)
                          return checked
                            ? [...new Set([...ids, ...visibleArchivedPeriodIds])]
                            : ids.filter((id) => !visibleIds.has(id))
                        })
                      }}
                    />
                  </TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44 text-center">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedTable.getRowModel().rows.map((row) => {
                  const p = row.original
                  return (
                    <TableRow key={p.a365_payrollperiodid} className="text-muted-foreground">
                      <TableCell>
                        <Checkbox
                          aria-label={`Select archived ${p.a365_name}`}
                          checked={selectedArchivedIds.includes(p.a365_payrollperiodid)}
                          onCheckedChange={(checked) => {
                            setPendingLargeExport(null)
                            setSelectedArchivedIds((ids) => checked
                              ? [...new Set([...ids, p.a365_payrollperiodid])]
                              : ids.filter((id) => id !== p.a365_payrollperiodid))
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{p.a365_name}</TableCell>
                      <TableCell>{formatDate(p.a365_periodstart)}</TableCell>
                      <TableCell>{formatDate(p.a365_periodend)}</TableCell>
                      <TableCell>{formatDate(p.a365_paydate)}</TableCell>
                      <TableCell>
                        <PayrollStatusBadge status={p.a365_payrollstatus} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" aria-label={`Export ${p.a365_name} to Excel`} title="Export to Excel" disabled={!isAdmin || exportBusy} onClick={() => void exportPayroll([p])}><FileDown className="size-4" aria-hidden /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Unarchive"
                          onClick={() => setPendingUnarchive(p)}
                          aria-label={`Unarchive ${p.a365_name}`}
                        >
                          <ArchiveRestore className="size-4" aria-hidden />
                        </Button>
                        {isAdmin && isPeriodEditable(p.a365_payrollstatus) && <Button variant="ghost" size="icon" title="Delete" aria-label={`Delete ${p.a365_name}`} className="text-destructive" onClick={(event) => { event.stopPropagation(); setPendingDelete(p) }}><Trash2 className="size-4" aria-hidden /></Button>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {archivedTable.getRowModel().rows.length === 0 && <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No archived payroll periods in this quarter.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          {selectedArchivedPeriods.length > 0 && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm" role="region" aria-label="Archived payroll selection">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{selectedArchivedPeriods.length} archived periods selected</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void exportPayroll(selectedArchivedPeriods)} disabled={!isAdmin || exportBusy}>
                    <FileDown className="size-4" aria-hidden />
                    Export to Excel
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedArchivedIds([]); setPendingLargeExport(null) }}>Clear</Button>
                </div>
              </div>
              {selectedArchivedPeriodsNote && <p role="status" className="flex items-start gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{selectedArchivedPeriodsNote}. These periods may still change.</p>}
            </div>
          )}
          <TablePagination table={archivedTable} />
        </section>
      )}

      <CreatePeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/payroll/${id}`)}
      />

      {pendingLargeExport && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>This export contains {pendingLargeExport.rows.length.toLocaleString()} detail rows, more than 5,000. Preparing it may take longer and use more memory.</p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingLargeExport(null)} disabled={exportBusy}>Cancel export</Button>
            <Button type="button" onClick={() => void exportPayroll(pendingLargeExport.periods, true, pendingLargeExport.rows)} disabled={exportBusy}>Continue</Button>
          </div>
        </div>
      )}

      {pendingDelete && <DeletePeriodDialog key={pendingDelete.a365_payrollperiodid} period={pendingDelete} isAdmin={isAdmin} onClose={() => setPendingDelete(null)} onDeleted={() => {
        setSelectedIds((ids) => ids.filter((id) => id !== pendingDelete.a365_payrollperiodid))
        setSelectedArchivedIds((ids) => ids.filter((id) => id !== pendingDelete.a365_payrollperiodid))
        setPendingLargeExport(null)
        setPendingDelete(null)
      }} />}

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
