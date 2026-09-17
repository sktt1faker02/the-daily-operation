/**
 * Resolves the signed-in user's Dataverse `systemuser` id from the Power host
 * context. Used only for audit attribution (the CalculatedBy stamp) — never as
 * a security boundary (record access is enforced by Dataverse). Cached for the
 * session; the context is stable.
 *
 * Matches by Entra object id when the host provides it, and falls back to the
 * user principal name (→ `systemuser.domainname`). Some Power hosts populate one
 * identity field but not the other, so relying on `objectId` alone leaves audit
 * stamping — and therefore Calculate — broken in those hosts.
 */
import { useQuery } from "@tanstack/react-query"
import { dataClient } from "@/lib/power/data-client"
import { usePowerContext } from "@/hooks/use-power-context"

interface SystemUserRow {
  systemuserid: string
}

async function resolveSystemUserId(identity: {
  objectId?: string
  userPrincipalName?: string
}): Promise<string> {
  const clauses: string[] = []
  if (identity.objectId) clauses.push(`azureactivedirectoryobjectid eq ${identity.objectId}`)
  if (identity.userPrincipalName) {
    const upn = identity.userPrincipalName.replace(/'/g, "''") // OData string-literal escape
    clauses.push(`domainname eq '${upn}'`)
  }
  if (clauses.length === 0) {
    throw new Error("The signed-in user's identity is unavailable from the Power host.")
  }
  const result = await dataClient.retrieveMultipleRecordsAsync<SystemUserRow>("systemusers", {
    select: ["systemuserid"],
    filter: clauses.join(" or "),
  })
  if (!result.success) throw result.error ?? new Error("Unable to resolve the current user.")
  const id = result.data?.[0]?.systemuserid
  if (!id) throw new Error("No Dataverse user matches the signed-in account.")
  return id
}

export function useCurrentSystemUserId() {
  const { data: context } = usePowerContext()
  const objectId = context?.user.objectId
  const userPrincipalName = context?.user.userPrincipalName
  return useQuery({
    queryKey: ["payroll", "systemuser", objectId ?? userPrincipalName ?? null] as const,
    queryFn: () => resolveSystemUserId({ objectId, userPrincipalName }),
    enabled: Boolean(objectId || userPrincipalName),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
