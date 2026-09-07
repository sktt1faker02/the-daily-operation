/**
 * Resolves the signed-in user's Dataverse `systemuser` id from the Power host
 * context's Entra object id. Used only for audit attribution (the CalculatedBy
 * stamp) — never as a security boundary (record access is enforced by
 * Dataverse). Cached for the session; the context is stable.
 */
import { useQuery } from "@tanstack/react-query"
import { dataClient } from "@/lib/power/data-client"
import { usePowerContext } from "@/hooks/use-power-context"

interface SystemUserRow {
  systemuserid: string
}

async function resolveSystemUserId(objectId: string): Promise<string> {
  const result = await dataClient.retrieveMultipleRecordsAsync<SystemUserRow>("systemusers", {
    select: ["systemuserid"],
    filter: `azureactivedirectoryobjectid eq ${objectId}`,
  })
  if (!result.success) throw result.error ?? new Error("Unable to resolve the current user.")
  const id = result.data?.[0]?.systemuserid
  if (!id) throw new Error("No Dataverse user matches the signed-in account.")
  return id
}

export function useCurrentSystemUserId() {
  const { data: context } = usePowerContext()
  const objectId = context?.user.objectId
  return useQuery({
    queryKey: ["payroll", "systemuser", objectId] as const,
    queryFn: () => resolveSystemUserId(objectId as string),
    enabled: Boolean(objectId),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
