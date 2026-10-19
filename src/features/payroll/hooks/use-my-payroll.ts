/**
 * Employee portal data: the signed-in employee's finalized payslips (Paid /
 * Locked only). Depends on the current employee resolving first.
 */
import { useQuery } from "@tanstack/react-query"
import { listPayslipsForEmployee } from "../services/my-payroll"
import { useCurrentEmployee } from "./use-current-employee"

export function useMyPayslips() {
  const employee = useCurrentEmployee()
  const employeeId = employee.data?.a365_employeeid
  const query = useQuery({
    queryKey: ["payroll", "my-payslips", employeeId] as const,
    queryFn: () => listPayslipsForEmployee(employeeId as string),
    enabled: Boolean(employeeId),
  })
  return {
    ...query,
    // Surface the employee-resolution phase so pages can show one loading/error state.
    isPending: employee.isPending || (Boolean(employeeId) && query.isPending),
    isError: employee.isError || query.isError,
    error: employee.error ?? query.error,
    employeeLookupFailed: employee.isError,
    retryEmployeeLookup: employee.refetch,
    /** True once we know the user has no linked employee record (not a payslip owner). */
    noEmployeeRecord: employee.isSuccess && !employee.data,
  }
}
