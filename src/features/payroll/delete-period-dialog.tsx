import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ConfirmedDeleteDialog } from "@/components/confirmed-delete-dialog"
import { formatDate } from "@/lib/format"
import { payrollKeys } from "./hooks/use-payroll-periods"
import { isPeriodEditable } from "./period-status"
import { payrollDeletionService } from "./services/payroll-deletion-service"
import type { PayrollPeriod } from "./types"

export function DeletePeriodDialog({ period, isAdmin, onClose, onDeleted }: {
  period: PayrollPeriod; isAdmin: boolean; onClose: () => void; onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  return <ConfirmedDeleteDialog
    title="Delete this payroll period?"
    description={<>Delete {period.a365_name} ({formatDate(period.a365_periodstart)} – {formatDate(period.a365_periodend)}) and all its payroll entries? This permanently removes this Processing payroll and cannot be undone.</>}
    allowed={isAdmin && isPeriodEditable(period.a365_payrollstatus)}
    configured={payrollDeletionService.isConfigured()}
    confirmLabel="Delete payroll"
    onConfirm={(operationId) => payrollDeletionService.deletePeriod({ periodId: period.a365_payrollperiodid, periodName: period.a365_name, operationId })}
    onClose={onClose}
    onDeleted={() => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all })
      toast.success(`Deleted ${period.a365_name}.`)
      onDeleted()
    }}
  />
}
