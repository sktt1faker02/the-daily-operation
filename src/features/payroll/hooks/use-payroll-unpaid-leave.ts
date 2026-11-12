import { useQuery } from "@tanstack/react-query"
import { payrollUnpaidLeaveService } from "@/features/leave/payroll-unpaid-leave"

export function usePayrollUnpaidLeave(employeeId: string, start: string, end: string, enabled: boolean) {
  return useQuery({
    queryKey: ["leave", "payroll-days", employeeId, start, end],
    queryFn: async () => (await payrollUnpaidLeaveService.daysForEmployees([employeeId], start, end)).get(employeeId.toLowerCase()) ?? 0,
    enabled: enabled && Boolean(employeeId && start && end),
    staleTime: 0, retry: false,
  })
}
