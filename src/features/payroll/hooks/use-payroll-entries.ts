import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import {
  calculatePeriod,
  calculateAndPersistEntry,
  saveAndCalculateEntry,
  getPayrollCalculationContext,
  previewPayrollEntry,
} from "../services/payroll-service"
import type { PayrollEntry, PayrollEntryInputValues } from "../types"
import { payrollKeys } from "./use-payroll-periods"

export function usePayrollEntryPreview(entry: PayrollEntry | null, values: PayrollEntryInputValues, periodEndDate: string, enabled: boolean) {
  const employeeId = entry?._a365_employee_value
  const context = useQuery({
    queryKey: [...payrollKeys.all, "calculation-context", employeeId, periodEndDate],
    queryFn: () => getPayrollCalculationContext(employeeId!, periodEndDate),
    enabled: enabled && Boolean(employeeId),
  })
  let preview: PayrollEntry | null = null
  let error: string | null = null
  if (enabled && entry) {
    if (!employeeId) error = "Payroll entry has no linked employee."
    else if (context.isError) error = "Unable to load the calculation preview. Close and reopen the editor to retry."
    else if (context.data) {
      try {
        preview = previewPayrollEntry(entry, values, context.data)
      } catch {
        error = "Enter valid non-negative amounts to preview payroll."
      }
    }
  }
  return { entry: preview, error }
}

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

export function useCopyPreviousCutoff(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Copy recurring inputs from the previous cutoff, then recalculate so the
    // new period lands with statutory deductions and net pay already computed.
    // Composed here (not in the service) to keep the copy service free of a
    // circular dependency on the calculation service.
    mutationFn: async ({
      periodName,
      periodEndDate,
      calculatedByUserId,
    }: {
      periodName: string
      periodEndDate: string
      calculatedByUserId: string
    }) => {
      const result = await payrollPeriodService.copyFromPreviousCutoff(periodId, periodName)
      if (result.created > 0 || result.updated > 0) {
        await calculatePeriod(periodId, periodEndDate, calculatedByUserId)
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export function useUpdateEntryInputs(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, periodEndDate, calculatedByUserId, values }: {
      id: string
      periodEndDate: string
      calculatedByUserId: string
      values: PayrollEntryInputValues
    }) => saveAndCalculateEntry(id, periodId, periodEndDate, calculatedByUserId, values),
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
