/**
 * TanStack Query hook for the environment-user list backing the employee form's
 * "Entra User" picker. Small and stable, so it caches well.
 */
import { useQuery } from "@tanstack/react-query"
import { userService } from "./user-service"

export function useEnvironmentUsers() {
  return useQuery({
    queryKey: ["environment-users"] as const,
    queryFn: () => userService.listEnvironmentUsers(),
    staleTime: 5 * 60_000,
  })
}
