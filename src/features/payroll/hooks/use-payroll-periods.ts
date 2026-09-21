import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"

export const payrollKeys = {
  all: ["payroll"] as const,
  periods: () => [...payrollKeys.all, "periods"] as const,
  archivedPeriods: () => [...payrollKeys.all, "archived-periods"] as const,
  period: (id: string) => [...payrollKeys.all, "period", id] as const,
  entries: (periodId: string) => [...payrollKeys.all, "entries", periodId] as const,
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: payrollKeys.periods(),
    queryFn: () => payrollPeriodService.listPeriods(),
  })
}

export function useArchivedPeriods() {
  return useQuery({
    queryKey: payrollKeys.archivedPeriods(),
    queryFn: () => payrollPeriodService.listArchivedPeriods(),
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
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useArchivePeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodId: string) => payrollPeriodService.archivePeriod(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useUnarchivePeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodId: string) => payrollPeriodService.unarchivePeriod(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
