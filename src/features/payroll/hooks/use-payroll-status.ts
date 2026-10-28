import { useMutation, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import { PayrollStatus } from "../period-status"
import { sendPayslipReadyNotifications } from "../services/payslip-ready-notification-service"
import { payrollKeys } from "./use-payroll-periods"

/** One mutation for every lifecycle action; the caller passes the target status. */
export function usePayrollStatusTransition(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ to, userId }: { to: PayrollStatus; userId: string }) => {
      await payrollPeriodService.transitionStatus(periodId, to, userId)
      // Publish the confirmed status before the external email batch completes.
      void queryClient.invalidateQueries({ queryKey: payrollKeys.period(periodId) })
      return to === PayrollStatus.Ready ? sendPayslipReadyNotifications({ periodId }) : null
    },
    retry: false,
    onSuccess: () => {
      // A status change ripples into the periods list and the Overview cards, so
      // invalidate the whole payroll namespace (["payroll", ...]) rather than a
      // couple of narrow keys. Cheap for this org's data size.
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
