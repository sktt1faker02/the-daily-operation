import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"

export const payrollKeys = {
  all: ["payroll"] as const,
  periods: () => [...payrollKeys.all, "periods"] as const,
  period: (id: string) => [...payrollKeys.all, "period", id] as const,
  entries: (periodId: string) => [...payrollKeys.all, "entries", periodId] as const,
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: payrollKeys.periods(),
    queryFn: () => payrollPeriodService.listPeriods(),
  })
}

export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: payrollKeys.period(id),
    queryFn: () => payrollPeriodService.getPeriod(id),
    enabled: Boolean(id),
  })
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { start: string; end: string; payDate: string; name: string }) =>
      payrollPeriodService.createPeriod(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() })
    },
  })
}
