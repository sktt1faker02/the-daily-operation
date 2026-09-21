import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import {
  updateEntryInputs,
  calculatePeriod,
  calculateAndPersistEntry,
} from "../services/payroll-service"
import type { PayrollEntryInputValues } from "../types"
import { payrollKeys } from "./use-payroll-periods"

export function usePayrollEntries(periodId: string) {
  return useQuery({
    queryKey: payrollKeys.entries(periodId),
    queryFn: () => payrollPeriodService.listEntries(periodId),
    enabled: Boolean(periodId),
  })
}

export function useLoadActiveEmployees(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodName: string) =>
      payrollPeriodService.loadActiveEmployees(periodId, periodName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useUpdateEntryInputs(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: PayrollEntryInputValues }) =>
      updateEntryInputs(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}

export function useCalculateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      periodEndDate,
      calculatedByUserId,
    }: {
      id: string
      periodEndDate: string
      calculatedByUserId: string
    }) => calculateAndPersistEntry(id, periodEndDate, calculatedByUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useCalculatePeriod(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      periodEndDate,
      calculatedByUserId,
    }: {
      periodEndDate: string
      calculatedByUserId: string
    }) => calculatePeriod(periodId, periodEndDate, calculatedByUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
