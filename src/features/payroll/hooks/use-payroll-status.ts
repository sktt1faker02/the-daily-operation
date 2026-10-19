import { useMutation, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import type { PayrollStatus } from "../period-status"
import { payrollKeys } from "./use-payroll-periods"

/** One mutation for every lifecycle action; the caller passes the target status. */
export function usePayrollStatusTransition(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ to, userId }: { to: PayrollStatus; userId: string }) =>
      payrollPeriodService.transitionStatus(periodId, to, userId),
    onSuccess: () => {
      // A status change ripples into the periods list and the Overview cards, so
      // invalidate the whole payroll namespace (["payroll", ...]) rather than a
      // couple of narrow keys. Cheap for this org's data size.
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
