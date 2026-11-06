/**
 * Resolves the signed-in user's own Employee record (via WhoAmI → the
 * `a365_systemuser` link). Returns the Employee, or null when the user isn't a
 * payrolled employee (i.e. a Payroll Admin). This doubles as the app's
 * employee/admin nav gate — cosmetic only; Dataverse enforces record access.
 */
import { useQuery } from "@tanstack/react-query"
import { WhoAmIService } from "@/generated/services/WhoAmIService"
import { employeeService } from "@/features/employees/employee-service"

async function resolveCurrentEmployee() {
  const who = await WhoAmIService.WhoAmI()
  if (!who.success) throw who.error ?? new Error("Unable to resolve the current user.")
  const userId = (who.data as { UserId?: string } | undefined)?.UserId
  if (!userId) throw new Error("WhoAmI did not return a Dataverse user id.")
  return employeeService.getBySystemUserId(userId)
}

export function useCurrentEmployee(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["payroll", "current-employee"] as const,
    queryFn: resolveCurrentEmployee,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: options.enabled !== false,
  })
}
