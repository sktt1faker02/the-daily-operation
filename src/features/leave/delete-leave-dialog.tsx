import { toast } from "sonner"
import { ConfirmedDeleteDialog } from "@/components/confirmed-delete-dialog"
import { Button } from "@/components/ui/button"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { leaveAccessState, formatDays, formatLeaveDate } from "./rules"
import { LeavePostingError } from "./posting-service"
import { useLeaveDeletion } from "./use-leave-deletion"
import type { LeaveRecord } from "./types"

export function DeleteLeaveDialog({ record, employeeName, onClose, onDeleted }: {
  record: LeaveRecord; employeeName: string; onClose: () => void; onDeleted: () => void
}) {
  const access = useAccessProfile({ loadEmployee: false })
  const allowed = leaveAccessState(access) === "allowed"
  const { preview, deleteRecord } = useLeaveDeletion(record, allowed)
  return <ConfirmedDeleteDialog
    title="Delete leave record?" confirmLabel="Delete leave"
    configured allowed={allowed && preview.isSuccess && !preview.isFetching}
    description={<>
      <span className="block">Permanently delete {record.a365_name} for {employeeName} ({formatLeaveDate(record.a365_startdate)} – {formatLeaveDate(record.a365_enddate)})?</span>
      {(preview.isPending || preview.isFetching) && <span role="status" className="mt-3 block">Checking credits to restore…</span>}
      {preview.isError && <span role="alert" className="mt-3 block">{preview.error instanceof LeavePostingError ? preview.error.message : "Unable to verify credits. No deletion has been made."}<Button type="button" variant="outline" size="sm" className="mt-2 block" onClick={() => void preview.refetch()}>Retry credit check</Button></span>}
      {preview.isSuccess && !preview.isFetching && <span className="mt-3 block">{preview.data.restoredDays > 0
        ? `${formatDays(preview.data.restoredDays)} ${preview.data.pool} days will be restored to the original balance period starting ${formatLeaveDate(preview.data.creditPeriod)}.`
        : "No credits need restoring. This leave record will be removed."}</span>}
      <span className="mt-3 block">Any unpaid days will no longer be included in future payroll lookups.</span>
      <span className="mt-3 block">Credit history and a deletion audit receipt are retained. Existing payroll entries and finalized payslips will not be recalculated.</span>
    </>}
    onConfirm={deleteRecord} onClose={onClose}
    onDeleted={() => { toast.success("Leave deleted. Any used credits have been restored."); onDeleted() }}
  />
}
