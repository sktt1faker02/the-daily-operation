import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ConfirmedDeleteDialog } from "@/components/confirmed-delete-dialog"
import { employeeDeletionService } from "./employee-deletion-service"
import { employeeKeys } from "./use-employees"
import type { Employee } from "./types"

export function DeleteEmployeeDialog({ employee, isAdmin, onClose, onDeleted }: {
  employee: Employee; isAdmin: boolean; onClose: () => void; onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  return <ConfirmedDeleteDialog
    title="Delete this employee?"
    description={<>Permanently delete {employee.a365_name}{employee.a365_employeenumber ? ` (${employee.a365_employeenumber})` : ""}? This cannot be undone. Employees with payroll, leave or template records cannot be deleted; set them to Inactive to preserve their history.</>}
    allowed={isAdmin}
    configured={employeeDeletionService.isConfigured()}
    confirmLabel="Delete employee"
    onConfirm={(operationId) => employeeDeletionService.deleteEmployee({ employeeId: employee.a365_employeeid, employeeName: employee.a365_name, operationId })}
    onClose={onClose}
    onDeleted={() => {
      void queryClient.invalidateQueries({ queryKey: employeeKeys.all })
      void queryClient.invalidateQueries({ queryKey: ["payroll", "current-employee"] })
      toast.success(`Deleted ${employee.a365_name}.`)
      onDeleted()
    }}
  />
}
