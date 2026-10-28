/**
 * Resolves every security role held directly or through a team by the signed-in
 * user. Queries the Dataverse `role` table (entity set `roles`, registered as
 * a data source) using its user and team membership relationships.
 *
 * This drives UI/nav only. Real authorization is always enforced by Dataverse
 * security roles regardless of what the app renders (CLAUDE.md "Security").
 */
import { dataClient } from "@/lib/power/data-client"
import { A365_payrollperiodsService } from "@/generated/services/A365_payrollperiodsService"

const ROLES_TABLE = "roles"

/** Security role that grants the payroll-admin navigation experience. */
export const ADMIN_ROLE_NAMES = ["A365 - Payroll Admin"] as const

/**
 * Resolves direct and team-inherited roles with one Dataverse query. The
 * existing admin flag remains available for navigation decisions.
 */
export interface CurrentUserRoles {
  roleNames: string[]
  isAdmin: boolean
}

/** Detects Dataverse privilege-denied responses, including SDK errors whose
 * `message` contains a JSON-encoded OData error envelope. */
export function isPrivilegeDenied(error: unknown): boolean {
  const pending: unknown[] = [error]
  const visited = new Set<object>()

  while (pending.length > 0) {
    const value = pending.pop()
    if (typeof value === "string") {
      try {
        pending.push(JSON.parse(value) as unknown)
      } catch {
        // Plain text does not contain a structured HTTP status.
      }
      continue
    }
    if (typeof value !== "object" || value === null || visited.has(value)) continue
    visited.add(value)

    const record = value as Record<string, unknown>
    if (Number(record.status) === 403 || Number(record.statusCode) === 403) return true
    pending.push(record.error, record.response, record.cause, record.body, record.message)
  }

  return false
}

/** Checks read access using only a single Payroll Period id, without returning
 * payroll-period details to the caller. */
export async function canReadPayrollData(): Promise<boolean> {
  const result = await A365_payrollperiodsService.getAll({
    select: ["a365_payrollperiodid"],
    top: 1,
  })
  if (!result.success) throw result.error ?? new Error("Unable to verify payroll-data access.")
  return true
}

export async function getCurrentUserRoles(systemUserId: string): Promise<CurrentUserRoles> {
  const userId = systemUserId.replace(/[{}]/g, "")
  const filter = [
    `systemuserroles_association/any(u:u/systemuserid eq ${userId})`,
    `teamroles_association/any(t:t/teammembership_association/any(u:u/systemuserid eq ${userId}))`,
  ].join(" or ")
  const result = await dataClient.retrieveMultipleRecordsAsync<{ roleid: string; name: string }>(ROLES_TABLE, {
    select: ["roleid", "name"],
    filter,
  })
  if (!result.success) throw result.error ?? new Error("Unable to resolve your security roles.")
  const roleNames = [...new Set((result.data ?? []).map((role) => role.name).filter(Boolean))]
  const adminRoles = new Set(ADMIN_ROLE_NAMES.map((name) => name.trim().toLocaleLowerCase()))
  return {
    roleNames,
    isAdmin: roleNames.some((name) => adminRoles.has(name.trim().toLocaleLowerCase())),
  }
}
