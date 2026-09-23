import { useQuery } from "@tanstack/react-query"
import { getPowerContext } from "@/lib/power/power-context"

/** Query key for the Power Apps host context. */
export const powerContextQueryKey = ["power", "context"] as const

/**
 * Loads the Power Apps host context (app, host, and signed-in user) once and
 * keeps it for the session.
 *
 * The context does not change while the app is running, so it never goes stale
 * and is not garbage-collected. Consumers get the standard TanStack Query
 * states (`isPending`, `isError`, `data`) and should render loading/error
 * fallbacks accordingly.
 */
export function usePowerContext() {
  return useQuery({
    queryKey: powerContextQueryKey,
    queryFn: getPowerContext,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
