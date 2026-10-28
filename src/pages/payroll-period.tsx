/**
 * Payroll period detail (Payroll Admin). Load active employees, edit variable
 * inputs, and drive status transitions (Mark Ready / Mark as Paid / Unlock)
 * via the centralized status rules. Loading / Empty / Error
 * / Success states throughout.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { Link, useParams, useNavigate, useBeforeUnload, useBlocker } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, AlertTriangle, Archive, ArrowLeft, Copy, Download, LayoutTemplate, Loader2, Save, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate } from "@/lib/format"
import { usePayrollPeriod, useArchivePeriod } from "@/features/payroll/hooks/use-payroll-periods"
import {
  usePayrollEntries,
  useLoadActiveEmployees,
  useCopyPreviousCutoff,
} from "@/features/payroll/hooks/use-payroll-entries"
import { useCurrentSystemUserId } from "@/features/payroll/hooks/use-current-system-user"
import { PayrollSummaryCards } from "@/features/payroll/payroll-summary-cards"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { PayrollEntryTable } from "@/features/payroll/payroll-entry-table"
import { PayrollAuditTrail } from "@/features/payroll/payroll-audit-trail"
import { PayrollEntryDialog } from "@/features/payroll/payroll-entry-dialog"
import { PayslipReadyNotifications } from "@/features/payroll/payslip-ready-notifications"
import type { PayslipNotificationReport } from "@/features/payroll/services/payslip-ready-notification-service"
import { DeleteEntryDialog } from "@/features/payroll/delete-entry-dialog"
import {
  buildPayrollDetailRows,
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
import { sumEntryTotals } from "@/features/payroll/period-utils"
import { toPayslipDocument } from "@/features/payroll/payslip-data"
import { openPayslip } from "@/features/payroll/payslip-document"
import { employeeService } from "@/features/employees/employee-service"
import { usePositions } from "@/features/employees/use-reference-data"
import type { PayrollEntry } from "@/features/payroll/types"
import {
  ACTION_TARGET,
  isFinalized,
  isPeriodEditable,
  isVisibleToEmployee,
  nextActions,
  normalizePayrollStatus,
  PayrollStatus,
  payrollStatusLabel,
  type PayrollAction,
} from "@/features/payroll/period-status"
import { usePayrollStatusTransition } from "@/features/payroll/hooks/use-payroll-status"
import { useSaveTemplate, useTemplates, useApplyTemplate } from "@/features/payroll/hooks/use-payroll-templates"

const PAYROLL_EXPORT_COLUMNS = selectColumns("full", DEFAULT_PAYROLL_EXPORT_GROUPS)

export default function PayrollPeriodPage() {
  const { periodId = "" } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PayrollEntry | null>(null)
  const [deleting, setDeleting] = useState<PayrollEntry | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false)
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [confirmSaveTemplateOpen, setConfirmSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDesc, setTemplateDesc] = useState("")
  const [confirmLoadTemplateOpen, setConfirmLoadTemplateOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PayrollAction | null>(null)
  const statusBusyRef = useRef(false)
  const [notificationRetryBusy, setNotificationRetryBusy] = useState(false)
  const [notificationReport, setNotificationReport] = useState<PayslipNotificationReport | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [pendingLargeExport, setPendingLargeExport] = useState(false)
  const exportBusyRef = useRef(false)
  const archive = useArchivePeriod()

  const period = usePayrollPeriod(periodId)
  const entries = usePayrollEntries(periodId)
  const systemUser = useCurrentSystemUserId()
  const loadEmployees = useLoadActiveEmployees(periodId)
  const copyPrevious = useCopyPreviousCutoff(periodId)
  const statusTransition = usePayrollStatusTransition(periodId)
  const notificationBusy = statusTransition.isPending || notificationRetryBusy
  const navigationBlocker = useBlocker(notificationBusy)
  useBeforeUnload(useCallback(event => {
    if (notificationBusy) { event.preventDefault(); event.returnValue = "" }
  }, [notificationBusy]))
  const saveTemplate = useSaveTemplate(periodId)
  const templates = useTemplates()
  const applyTemplate = useApplyTemplate(periodId)
  const { data: positions } = usePositions()
  const { data: powerContext } = usePowerContext()
  const { isAdmin } = useAccessProfile({ loadEmployee: false })

  const ACTION_META: Record<
    PayrollAction,
    { label: string; title: string; description: string; variant?: "default" | "destructive" }
  > = {
    markReady: {
      label: "Mark Ready",
      title: "Mark this payroll Ready?",
      description: "Updates outdated gross pay and deduction totals, makes payslips visible to employees, locks entries and emails each included employee at their Work Email. Keep this page open while notifications are sent. Unlock reopens the cutoff for corrections.",
    },
    markPaid: {
      label: "Mark as Paid",
      title: "Mark this payroll Paid?",
      description: "Records that this cutoff has been paid out. Entries remain locked.",
    },
    unlock: {
      label: "Unlock",
      title: "Unlock this payroll?",
      description: "Reopens the cutoff for corrections (returns it to Processing). This is an audited action.",
      variant: "destructive",
    },
  }

  const runAction = (action: PayrollAction) => {
    if (!isAdmin || notificationBusy || statusBusyRef.current) return
    const userId = requireSystemUser()
    if (!userId) return
    statusBusyRef.current = true
    statusTransition.mutate(
      { to: ACTION_TARGET[action], userId },
      {
        onSuccess: (report) => {
          if (report) setNotificationReport(report)
          toast.success(`${ACTION_META[action].label} done.`)
          if (report && (report.error || report.recipients.some(row => row.status !== "accepted"))) {
            toast.warning("Payroll is Ready. Some payslip notifications need attention; review the results below.")
          }
          setPendingAction(null)
        },
        onError: (err) => toast.error(`Unable to ${ACTION_META[action].label.toLowerCase()}.`, { description: err.message }),
        onSettled: () => { statusBusyRef.current = false },
      },
    )
  }

  const actions = nextActions(period.data?.a365_payrollstatus ?? PayrollStatus.Processing)

  const totals = useMemo(
    () => sumEntryTotals((entries.data ?? []).filter((e) => e.a365_isincluded)),
    [entries.data],
  )
  const filtered = useMemo(() => {
    const list = entries.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((e) => (e.a365_employeename ?? "").toLowerCase().includes(q))
  }, [entries.data, search])

  const editable = isPeriodEditable(period.data?.a365_payrollstatus)
  // Ready releases payslips; Processing remains editable and hidden from employees.
  const status = period.data?.a365_payrollstatus
  const canViewPayslip = isVisibleToEmployee(status)
  const periodIsFinalized = isFinalized(status)
  const normalizedStatus = normalizePayrollStatus(status)

  const handleViewPayslip = async (entry: PayrollEntry) => {
    // Open the tab inside the click gesture so the async fetch below doesn't
    // trip the pop-up blocker.
    const win = window.open("", "_blank")
    if (!period.data || !entry._a365_employee_value) {
      win?.close()
      toast.error("Cannot open payslip: missing employee or period information.")
      return
    }
    setViewingId(entry.a365_payrollentryid)
    try {
      const employee = await employeeService.get(entry._a365_employee_value)
      const positionName =
        positions?.find((p) => p.a365_positionid === employee._a365_position_value)?.a365_name ??
        null
      await openPayslip(toPayslipDocument(employee, period.data, entry, positionName), win)
    } catch (err) {
      win?.close()
      toast.error("Unable to prepare the payslip.", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setViewingId(null)
    }
  }

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

  const handleCopyPrevious = () => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    copyPrevious.mutate(
      {
        periodName: period.data.a365_name,
        periodEndDate: period.data.a365_periodend,
        calculatedByUserId: userId,
      },
      {
        onSuccess: ({ created, updated, copiedFrom, skipped }) => {
          if (!copiedFrom) {
            toast.info("No finalized previous cutoff to copy from.")
          } else {
            const parts = [`${created} added`, `${updated} updated`]
            if (skipped) parts.push(`${skipped} unchanged`)
            toast.success(`Copied from ${copiedFrom}: ${parts.join(", ")} and recalculated.`)
          }
          setConfirmCopyOpen(false)
        },
        onError: (err) => toast.error("Unable to copy previous cutoff.", { description: err.message }),
      },
    )
  }

  const handleLoadTemplate = () => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    applyTemplate.mutate(
      { templateId: selectedTemplateId, periodEndDate: period.data.a365_periodend, calculatedByUserId: userId },
      {
        onSuccess: ({ created, updated, skipped, templateName }) => {
          const parts = [`${created} added`, `${updated} updated`]
          if (skipped) parts.push(`${skipped} skipped`)
          toast.success(`Loaded "${templateName}": ${parts.join(", ")} and recalculated.`)
          setConfirmLoadTemplateOpen(false)
          setSelectedTemplateId("")
        },
        onError: (err) => toast.error("Unable to load template.", { description: err.message }),
      },
    )
  }

  const openEditor = (entry: PayrollEntry) => {
    setEditing(entry)
    setEditorOpen(true)
  }

  const handleSaveTemplate = () => {
    saveTemplate.mutate(
      { name: templateName.trim(), description: templateDesc.trim() || null },
      {
        onSuccess: ({ lineCount }) => {
          toast.success(`Template saved with ${lineCount} employee${lineCount === 1 ? "" : "s"}.`)
          setConfirmSaveTemplateOpen(false)
          setTemplateName("")
          setTemplateDesc("")
        },
        onError: (err) => toast.error("Unable to save template.", { description: err.message }),
      },
    )
  }

  const handleArchive = () => {
    if (notificationBusy) return
    archive.mutate(periodId, {
      onSuccess: () => {
        toast.success(`Archived ${period.data?.a365_name ?? "payroll period"}.`)
        setConfirmArchiveOpen(false)
        navigate("/payroll")
      },
      onError: (err) => toast.error("Unable to archive.", { description: err.message }),
    })
  }

  const handleExport = async (confirmedLargeExport = false) => {
    if (exportBusyRef.current) return
    if (!isAdmin) {
      toast.error("Only a Payroll Admin can export payroll.", {
        description: "Contact your administrator if you believe you should have access.",
      })
      return
    }
    if (!period.data || !entries.data) {
      toast.error("Unable to export payroll details.", {
        description: "Wait for the period and its entries to finish loading, then try again.",
      })
      return
    }
    const exportedBy = powerContext?.user.fullName
    if (!exportedBy) {
      toast.error("Unable to identify your account.", {
        description: "Refresh the page and try again. Contact your administrator if the problem continues.",
      })
      return
    }
    const currentPeriod = period.data
    const currentEntries = entries.data
    if (requiresLargeExportConfirmation(currentEntries.length) && !confirmedLargeExport) {
      setPendingLargeExport(true)
      return
    }

    exportBusyRef.current = true
    setExportBusy(true)
    setPendingLargeExport(false)
    try {
      const rows = buildPayrollDetailRows(currentPeriod, currentEntries)
      const notFinalNote = nonFinalPeriodsNote([currentPeriod])
      if (notFinalNote) toast.warning(`${notFinalNote}. This period may still change.`)
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const workbook = await createPayrollWorkbook(currentPeriod, rows, PAYROLL_EXPORT_COLUMNS, exportedBy)
      downloadBlob(workbook, payrollExportFileNameForPeriods([currentPeriod]))
      toast.success(`Exported ${rows.length} payroll row${rows.length === 1 ? "" : "s"}.`)
    } catch (cause) {
      toast.error("Unable to create the Excel workbook.", {
        description: `${cause instanceof Error ? cause.message : "An unexpected error occurred."} Your payroll data is unchanged. Please retry.`,
      })
    } finally {
      exportBusyRef.current = false
      setExportBusy(false)
    }
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
          <div className="flex flex-wrap items-center gap-2">
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
              <Button
                variant="outline"
                onClick={() => setConfirmCopyOpen(true)}
                disabled={copyPrevious.isPending}
              >
                <Copy className="size-4" aria-hidden />
                Copy previous cutoff
              </Button>
            )}
            {hasEntries && editable && (
              <Button
                variant="outline"
                onClick={() => setConfirmLoadTemplateOpen(true)}
                disabled={applyTemplate.isPending}
              >
                <LayoutTemplate className="size-4" aria-hidden />
                Load template
              </Button>
            )}
            {actions.map((action) => (
              <Button
                key={action}
                variant={ACTION_META[action].variant === "destructive" ? "destructive" : action === "unlock" ? "outline" : "default"}
                onClick={() => setPendingAction(action)}
                disabled={notificationBusy}
              >
                {ACTION_META[action].label}
              </Button>
            ))}
            {periodIsFinalized && (
              <Button
                variant="outline"
                onClick={() => setConfirmSaveTemplateOpen(true)}
                disabled={saveTemplate.isPending}
              >
                <Save className="size-4" aria-hidden />
                Save as template
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirmArchiveOpen(true)} disabled={archive.isPending || notificationBusy}>
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={!isAdmin || entries.isPending || entries.isError || exportBusy}
              aria-label="Export payroll period to Excel"
            >
              {exportBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {exportBusy ? "Preparing Excel…" : "Export"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(period.data.a365_periodstart)} – {formatDate(period.data.a365_periodend)} ·
          Pay date {formatDate(period.data.a365_paydate)}
        </p>
        {pendingLargeExport && (
          <div role="alert" className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />This export contains {(entries.data?.length ?? 0).toLocaleString()} detail rows, more than 5,000. Preparing it may take longer and use more memory.</p>
            <div className="flex shrink-0 justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingLargeExport(false)} disabled={exportBusy}>Cancel export</Button>
              <Button type="button" size="sm" onClick={() => void handleExport(true)} disabled={exportBusy}>Continue</Button>
            </div>
          </div>
        )}
      </div>

      {statusTransition.isPending && pendingAction === "markReady" && <p role="status" className="text-sm text-muted-foreground">Marking payroll Ready and sending payslip notifications. Keep this page open…</p>}
      {notificationReport?.periodId === periodId && <PayslipReadyNotifications
        key={`${periodId}-${notificationReport.readyOn ?? "unavailable"}`}
        initial={notificationReport} onSendingChange={setNotificationRetryBusy}
      />}

      <PayrollSummaryCards gross={totals.gross} deductions={totals.deductions} net={totals.net} />

      {!editable && period.data && (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
          {normalizedStatus === PayrollStatus.Locked
            ? `Locked on ${formatDate(period.data.a365_lockedon)}. Unlock to make corrections.`
            : `This period is ${payrollStatusLabel(period.data.a365_payrollstatus)} and is no longer editable in payroll administration.`}
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
              Load active employees to populate this cutoff. Payroll amounts update automatically when you save entry changes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setConfirmLoadOpen(true)} disabled={!editable || loadEmployees.isPending}>
              {loadEmployees.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-4" aria-hidden />
              )}
              Load active employees
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmCopyOpen(true)}
              disabled={!editable || copyPrevious.isPending}
            >
              {copyPrevious.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              Copy previous cutoff
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmLoadTemplateOpen(true)}
              disabled={!editable || applyTemplate.isPending}
            >
              <LayoutTemplate className="size-4" aria-hidden />
              Load template
            </Button>
          </div>
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
            onDelete={isAdmin && editable ? setDeleting : undefined}
            editable={editable}
            onViewPayslip={canViewPayslip ? handleViewPayslip : undefined}
            viewingId={viewingId}
          />
          <p className="text-xs text-muted-foreground">
            Withholding tax is entered manually per employee in Edit; other deductions are calculated.
          </p>
        </div>
      )}

      <PayrollAuditTrail period={period.data} />

      {deleting && period.data && <DeleteEntryDialog key={deleting.a365_payrollentryid} entry={deleting} period={period.data} isAdmin={isAdmin} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); setPendingLargeExport(false) }} />}
      <PayrollEntryDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editing}
        periodId={periodId}
        periodStartDate={period.data?.a365_periodstart ?? ""}
        periodEndDate={period.data?.a365_periodend ?? ""}
        editable={editable}
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

      <Dialog open={confirmCopyOpen} onOpenChange={setConfirmCopyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy from the previous cutoff?</DialogTitle>
            <DialogDescription>
              Copies all inputs from the last Locked cutoff into this period,
              overwriting existing entries and adding any missing employees. Deductions and net pay
              are recalculated. Review and adjust before marking ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCopyOpen(false)} disabled={copyPrevious.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCopyPrevious} disabled={copyPrevious.isPending}>
              {copyPrevious.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Copy previous cutoff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmLoadTemplateOpen}
        onOpenChange={(o) => {
          setConfirmLoadTemplateOpen(o)
          if (!o) setSelectedTemplateId("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load a template into this period?</DialogTitle>
            <DialogDescription>
              Applies the template's saved inputs — overwriting matching employees' entries and
              adding any employees from the template not already in this period. Deductions and
              net pay are recalculated afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="template-picker" className="text-sm font-medium">
              Template
            </label>
            {templates.data && templates.data.length === 0 ? (
              <>
                <Select disabled>
                  <SelectTrigger id="template-picker" className="w-full">
                    <SelectValue placeholder="No templates available" />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                <p className="text-sm text-muted-foreground">
                  No templates yet — save one from a Locked period.
                </p>
              </>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={templates.isLoading || applyTemplate.isPending}
              >
                <SelectTrigger id="template-picker" className="w-full">
                  <SelectValue placeholder="Select a template…" />
                </SelectTrigger>
                <SelectContent>
                  {(templates.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.lineCount} employee{t.lineCount === 1 ? "" : "s"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmLoadTemplateOpen(false)}
              disabled={applyTemplate.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLoadTemplate}
              disabled={applyTemplate.isPending || selectedTemplateId === ""}
            >
              {applyTemplate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Load template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmSaveTemplateOpen}
        onOpenChange={(o) => {
          setConfirmSaveTemplateOpen(o)
          if (!o) {
            setTemplateName("")
            setTemplateDesc("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Saves this period's per-employee inputs — Basic Pay, Allowances, Other
              Earnings/Deductions, Unpaid Leave, Withholding Tax, and Comment — as a reusable
              template you can apply to a future cutoff. Calculated results (gross pay, statutory
              deductions, and net pay) are not saved; they're recalculated when the template is
              applied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="template-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard semi-monthly"
                disabled={saveTemplate.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="template-description" className="text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="template-description"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Notes about when to use this template"
                disabled={saveTemplate.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSaveTemplateOpen(false)}
              disabled={saveTemplate.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saveTemplate.isPending || !templateName.trim()}>
              {saveTemplate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingAction !== null} onOpenChange={(o) => !o && !notificationBusy && setPendingAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction && ACTION_META[pendingAction].title}</DialogTitle>
            <DialogDescription>{pendingAction && ACTION_META[pendingAction].description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={statusTransition.isPending}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "unlock" ? "destructive" : "default"}
              onClick={() => pendingAction && runAction(pendingAction)}
              disabled={statusTransition.isPending}
            >
              {statusTransition.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {pendingAction === "markReady" && statusTransition.isPending ? "Marking Ready and sending emails…" : pendingAction && ACTION_META[pendingAction].label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={navigationBlocker.state === "blocked"} onOpenChange={(open) => !open && navigationBlocker.state === "blocked" && navigationBlocker.reset()}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Payslip notifications</DialogTitle>
          <DialogDescription>{notificationBusy ? "Please keep this page open while the notifications finish sending." : "Notifications have finished. You can continue to the other page."}</DialogDescription>
        </DialogHeader><DialogFooter>
          <Button variant="outline" onClick={() => navigationBlocker.state === "blocked" && navigationBlocker.reset()}>Stay on this page</Button>
          <Button disabled={notificationBusy} onClick={() => navigationBlocker.state === "blocked" && navigationBlocker.proceed()}>Continue</Button>
        </DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={confirmArchiveOpen} onOpenChange={(o) => !o && setConfirmArchiveOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this payroll period?</DialogTitle>
            <DialogDescription>
              {period.data?.a365_name} will be hidden from the payroll lists and dashboard, and
              becomes read-only. This can only be reversed by an administrator in Dataverse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchiveOpen(false)} disabled={archive.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archive.isPending}>
              {archive.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
