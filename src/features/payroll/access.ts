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
