/**
 * Resolves whether the signed-in user holds a payroll-admin security role, so
 * the app can show the admin experience. Queries the Dataverse `role` table
 * (entity set `roles`, registered as a data source) filtered to the admin roles
 * AND membership by the current user, via the standard `systemuserroles_association`
 * N:N relationship.
 *
 * This drives UI/nav only. Real authorization is always enforced by Dataverse
 * security roles regardless of what the app renders (CLAUDE.md "Security").
 */
import { dataClient } from "@/lib/power/data-client"

const ROLES_TABLE = "roles"

/**
 * Security roles that grant the admin experience. `System Administrator` is
 * included so environment/system admins (who may not hold the custom payroll
 * role) still get the admin UI.
 */
export const ADMIN_ROLE_NAMES = ["A365 - Payroll Admin", "System Administrator"] as const

/**
 * True when `systemUserId` is a member of any admin role. Uses an OData `any()`
 * lambda over the role→user N:N to test membership server-side; returns at most
 * one row.
 */
export async function isCurrentUserPayrollAdmin(systemUserId: string): Promise<boolean> {
  const nameFilter = ADMIN_ROLE_NAMES.map((name) => `name eq '${name}'`).join(" or ")
  const filter = `(${nameFilter}) and systemuserroles_association/any(o:o/systemuserid eq ${systemUserId})`
  const result = await dataClient.retrieveMultipleRecordsAsync<{ roleid: string }>(ROLES_TABLE, {
    select: ["roleid"],
    filter,
    top: 1,
  })
  if (!result.success) throw result.error ?? new Error("Unable to resolve your security role.")
  return (result.data?.length ?? 0) > 0
}
