/**
 * Resolves the signed-in user's Dataverse `systemuser` id via the Dataverse
 * WhoAmI function. Used only for audit attribution (the CalculatedBy stamp) —
 * never as a security boundary (record access is enforced by Dataverse).
 *
 * WhoAmI asks Dataverse "who is this authenticated caller", so it does not
 * depend on the Power host populating `context.user.objectId` — some hosts
 * leave that empty, which previously broke audit stamping (and Calculate).
 * Cached for the session; the identity is stable.
 */
import { useQuery } from "@tanstack/react-query"
import { WhoAmIService } from "@/generated/services/WhoAmIService"

async function resolveSystemUserId(): Promise<string> {
  const result = await WhoAmIService.WhoAmI()
  if (!result.success) throw result.error ?? new Error("Unable to resolve the current user.")
  const userId = (result.data as { UserId?: string } | undefined)?.UserId
  if (!userId) throw new Error("WhoAmI did not return a Dataverse user id.")
  return userId
}

export function useCurrentSystemUserId() {
  return useQuery({
    queryKey: ["payroll", "systemuser", "whoami"] as const,
    queryFn: resolveSystemUserId,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
