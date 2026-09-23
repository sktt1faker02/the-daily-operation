/**
 * TanStack Query hook for the resolved statutory configuration. Presentation
 * code uses this hook; it never calls the service or Dataverse directly.
 */
import { useQuery } from "@tanstack/react-query"
import { getStatutoryConfig } from "../services/statutory-config-service"

export const statutoryConfigKeys = {
  all: ["statutory-config"] as const,
  asOf: (asOf: string) => [...statutoryConfigKeys.all, asOf] as const,
}

/** Load the statutory config effective at `asOf` (ISO yyyy-mm-dd, typically the period end). */
export function useStatutoryConfig(asOf: string) {
  return useQuery({
    queryKey: statutoryConfigKeys.asOf(asOf),
    queryFn: () => getStatutoryConfig(asOf),
    enabled: asOf.length > 0,
  })
}
