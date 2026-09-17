import { useMutation, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import type { PayrollStatus } from "../types"
import { payrollKeys } from "./use-payroll-periods"

/** One mutation for every lifecycle action; the caller passes the target status. */
export function usePayrollStatusTransition(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ to, userId }: { to: PayrollStatus; userId: string }) =>
      payrollPeriodService.transitionStatus(periodId, to, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.period(periodId) })
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}
