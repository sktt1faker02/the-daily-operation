/**
 * Resolves the current user's access profile: admin status from Dataverse
 * security-role membership, and whether to show "My Payroll" (a linked Employee
 * record). See `../access.ts` for the decision logic and its fail-safe fallback.
 * Cosmetic gating only — Dataverse enforces real access.
 */
import { useQuery } from "@tanstack/react-query"
import { useCurrentSystemUserId } from "./use-current-system-user"
import { useCurrentEmployee } from "./use-current-employee"
import { isCurrentUserPayrollAdmin } from "../services/security-service"
import { deriveAccess, type AccessProfile } from "../access"

export function useAccessProfile(): AccessProfile {
  const systemUser = useCurrentSystemUserId()
  const employee = useCurrentEmployee()
  const adminQuery = useQuery({
    queryKey: ["payroll", "is-admin", systemUser.data] as const,
    queryFn: () => isCurrentUserPayrollAdmin(systemUser.data as string),
    enabled: Boolean(systemUser.data),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false, // an employee may lack read on the role table → fall back, don't spin
  })
  return deriveAccess({
    roleResolved: adminQuery.isSuccess,
    isAdminRole: adminQuery.data ?? false,
    employeeResolved: employee.isSuccess,
    hasEmployeeRecord: Boolean(employee.data),
  })
}
