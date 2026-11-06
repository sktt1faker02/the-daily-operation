import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ConfirmedDeleteDialog } from "@/components/confirmed-delete-dialog"
import { payrollKeys } from "./hooks/use-payroll-periods"
import { isPeriodEditable } from "./period-status"
import { payrollDeletionService } from "./services/payroll-deletion-service"
import type { PayrollEntry, PayrollPeriod } from "./types"

export function DeleteEntryDialog({ entry, period, isAdmin, onClose, onDeleted }: {
  entry: PayrollEntry; period: PayrollPeriod; isAdmin: boolean; onClose: () => void; onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  return <ConfirmedDeleteDialog
    title="Remove employee from this payroll?"
    description={<>Delete the payroll entry for {entry.a365_employeename ?? "this employee"} from {period.a365_name}? This permanently removes this entry and its amounts from this Processing payroll. The employee’s master record and other payroll periods are kept.</>}
    allowed={isAdmin && isPeriodEditable(period.a365_payrollstatus) && Boolean(entry._a365_employee_value && entry.a365_employeename)}
    configured={payrollDeletionService.isConfigured("entry")}
    confirmLabel="Delete payroll entry"
    onConfirm={(operationId) => payrollDeletionService.deleteEntry({
      periodId: period.a365_payrollperiodid, periodName: period.a365_name,
      entryId: entry.a365_payrollentryid, employeeId: entry._a365_employee_value ?? "",
      employeeName: entry.a365_employeename ?? "", operationId,
    })}
    onClose={onClose}
    onDeleted={() => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all })
      toast.success(`Removed ${entry.a365_employeename} from ${period.a365_name}.`)
      onDeleted()
    }}
  />
}
