/**
 * Pure access-decision logic for the app's nav/route gating. Kept separate from
 * the data hooks so the branching is unit-testable. Cosmetic only — Dataverse
 * security roles remain the real boundary (CLAUDE.md "Security").
 *
 * Admin is decided by security-role membership (see `security-service.ts`). If
 * that role query can't be resolved (e.g. an employee without read on the role
 * table), we fall back to the older link-based rule — a user with no linked
 * Employee record is treated as an admin — so behavior never regresses below
 * what shipped before role detection.
 */
export interface AccessInputs {
  /** The admin role-membership query resolved successfully. */
  roleResolved: boolean
  /** Result of the role query (member of an admin role). */
  isAdminRole: boolean
  /** The current-employee lookup resolved successfully. */
  employeeResolved: boolean
  /** The current user has a linked Employee record. */
  hasEmployeeRecord: boolean
}

export interface AccessProfile {
  /** Show the admin sections (Employees, Payroll administration). */
  isAdmin: boolean
  /** Show "My Payroll" — anyone with a linked Employee record has own payslips. */
  showMyPayroll: boolean
  /** Enough has resolved to render the real nav (avoids flashing the wrong menu). */
  ready: boolean
}

export function deriveAccess(i: AccessInputs): AccessProfile {
  const isAdmin = i.roleResolved
    ? i.isAdminRole
    : i.employeeResolved
      ? !i.hasEmployeeRecord // fallback: no employee record => treat as admin
      : false
  return {
    isAdmin,
    showMyPayroll: i.employeeResolved && i.hasEmployeeRecord,
    ready: i.roleResolved || i.employeeResolved,
  }
}

export const ALLOWED_ROLES = [
  "A365 - Payroll Admin",
  "A365 - Payroll Employee",
] as const

export const NO_ACCESS = {
  title: "No access",
  message:
    "Your account doesn't have a role for this app. Contact your payroll administrator.",
} as const

export type GateState = "loading" | "allowed" | "denied"

export interface GateInputs {
  /** The role-membership query has settled (success or error). */
  roleSettled: boolean
  /** The role-membership query failed. */
  roleError: boolean
  /** Names of every role the user holds (direct + team-inherited). */
  roleNames: string[]
  /** The role lookup failed specifically because Dataverse denied privilege. */
  roleLookupBlocked: boolean
  /** The payroll-data permission probe has settled or was not needed. */
  probeSettled: boolean
  /** The payroll-data permission probe succeeded. */
  probeAllowed: boolean
}

export function deriveGate(i: GateInputs): GateState {
  if (!i.roleSettled) return "loading"
  if (!i.roleError) {
    const allowed = new Set(ALLOWED_ROLES.map((name) => name.trim().toLocaleLowerCase()))
    return i.roleNames.some((name) => allowed.has(name.trim().toLocaleLowerCase()))
      ? "allowed"
      : "denied"
  }
  if (!i.roleLookupBlocked) return "denied"
  if (!i.probeSettled) return "loading"
  return i.probeAllowed ? "allowed" : "denied"
}
