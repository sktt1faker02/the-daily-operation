/**
 * Resolves the current user's access profile: admin status from Dataverse
 * security-role membership, and whether to show "My Payroll" (a linked Employee
 * record). See `../access.ts` for the decision logic and its fail-safe fallback.
 * Cosmetic gating only — Dataverse enforces real access.
 */
import { useQuery } from "@tanstack/react-query"
import { useCurrentSystemUserId } from "./use-current-system-user"
import { useCurrentEmployee } from "./use-current-employee"
import { canReadPayrollData, getCurrentUserRoles, isPrivilegeDenied } from "../services/security-service"
import { deriveAccess, type AccessProfile, type GateInputs } from "../access"

export function useAccessProfile(options: { loadEmployee?: boolean } = {}): AccessProfile & GateInputs {
  const systemUser = useCurrentSystemUserId()
  const employee = useCurrentEmployee({ enabled: options.loadEmployee !== false })
  const rolesQuery = useQuery({
    queryKey: ["payroll", "security-roles", systemUser.data] as const,
    queryFn: async () => {
      try {
        return await getCurrentUserRoles(systemUser.data as string)
      } catch (error) {
        console.error("Unable to resolve the current user's security roles.", error)
        throw error
      }
    },
    enabled: Boolean(systemUser.data),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const roleLookupBlocked = rolesQuery.isError && isPrivilegeDenied(rolesQuery.error)
  const probeQuery = useQuery({
    queryKey: ["payroll", "payroll-data-read-probe", systemUser.data] as const,
    queryFn: async () => {
      try {
        return await canReadPayrollData()
      } catch (error) {
        console.error("Unable to verify payroll-data access.", error)
        throw error
      }
    },
    enabled: Boolean(systemUser.data) && roleLookupBlocked,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const hasSystemUserId = Boolean(systemUser.data)
  const roleSettled = systemUser.isError || (systemUser.isSuccess && !hasSystemUserId) || rolesQuery.isSuccess || rolesQuery.isError
  const roleError = systemUser.isError || (systemUser.isSuccess && !hasSystemUserId) || rolesQuery.isError
  const access = deriveAccess({
    roleResolved: rolesQuery.isSuccess,
    isAdminRole: rolesQuery.data?.isAdmin ?? false,
    employeeResolved: options.loadEmployee !== false && employee.isSuccess,
    hasEmployeeRecord: Boolean(employee.data),
  })
  const employeeRole = rolesQuery.data?.roleNames.some(
    (name) => name.trim().toLocaleLowerCase() === "a365 - payroll employee",
  ) ?? false
  // Keep My Payroll reachable while its profile lookup is pending or failed;
  // a successful empty lookup still removes it from the nav.
  const showMyPayroll = access.showMyPayroll ||
    (employeeRole && !employee.isSuccess) ||
    (roleLookupBlocked && probeQuery.isSuccess && probeQuery.data === true)

  return {
    ...access,
    showMyPayroll,
    isAdmin: roleLookupBlocked ? false : access.isAdmin,
    roleSettled,
    roleError,
    roleNames: rolesQuery.data?.roleNames ?? [],
    roleLookupBlocked,
    probeSettled: !roleLookupBlocked || probeQuery.isSuccess || probeQuery.isError,
    probeAllowed: roleLookupBlocked && probeQuery.isSuccess && probeQuery.data === true,
  }
}
