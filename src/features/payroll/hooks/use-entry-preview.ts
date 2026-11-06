import { useQuery } from "@tanstack/react-query"
import { employeeService } from "@/features/employees/employee-service"
import { employeeKeys } from "@/features/employees/use-employees"
import type { PayrollEntry, PayrollEntryInputValues } from "../types"
import { previewPayrollEntry } from "../services/payroll-entry-preview"
import { useStatutoryConfig } from "./use-statutory-config"

/** Fetch calculation dependencies once, then derive each preview locally as inputs change. */
export function useEntryPreview(
  entry: PayrollEntry | null,
  values: PayrollEntryInputValues,
  periodEndDate: string,
  open: boolean,
) {
  const employeeId = entry?._a365_employee_value ?? ""
  const employee = useQuery({
    queryKey: employeeKeys.detail(employeeId),
    queryFn: () => employeeService.get(employeeId),
    enabled: open && Boolean(employeeId),
  })
  const config = useStatutoryConfig(periodEndDate, open && Boolean(employeeId))
  let preview: PayrollEntry | null = null
  let error: string | null = null

  if (open && entry) {
    if (!employeeId) {
      error = "A linked employee is required to preview payroll."
    } else if (employee.isError || config.isError) {
      error = "Unable to load the salary or contribution configuration for this preview."
    } else if (!periodEndDate) {
      error = "A cutoff end date is required to preview payroll."
    } else if (employee.data && config.data) {
      try {
        preview = previewPayrollEntry(entry, values, employee.data.a365_basicmonthlysalary ?? 0, config.data)
      } catch {
        error = "Unable to preview payroll. Check that all amounts and leave days are non-negative numbers and contribution configuration is available."
      }
    }
  }

  return {
    entry: preview,
    error,
    canRetry: employee.isError || config.isError,
    retry: () => {
      void employee.refetch()
      void config.refetch()
    },
  }
}
