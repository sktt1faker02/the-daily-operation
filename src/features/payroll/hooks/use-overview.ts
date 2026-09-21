import { useQuery } from "@tanstack/react-query"
import { getPayrollOverview } from "../services/overview-service"
import { payrollKeys } from "./use-payroll-periods"

export function useOverview() {
  return useQuery({
    queryKey: [...payrollKeys.all, "overview"] as const,
    queryFn: getPayrollOverview,
  })
}
