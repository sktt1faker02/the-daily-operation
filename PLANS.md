# Active: Role Gate Fallback When Role Lookup Is Blocked

## Requirements

- Integrate Power Platform Skills
- The two allowed Dataverse security roles are `A365 - Payroll Admin` and `A365 - Payroll Employee`.
- Do NOT change any Dataverse security role or environment setting. All fixes happen in the app code.
- The role gate already exists (`access.ts` with `deriveGate`, `RoleGate.tsx`, `NoAccess.tsx`, `security-service.ts`, `use-access-profile.ts`). Extend these files. Do not rewrite them, and do not change `deriveAccess`.
- Use the generated Dataverse service/model files and the existing `dataClient`. Do not use raw fetch.

## Feature: Allow access when the role lookup is blocked, using a payroll-read check

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". The gate allows users who hold `A365 - Payroll Admin` or `A365 - Payroll Employee`. Any other user sees a no-access card that lists their current security roles. The role names come from `getCurrentUserRoles`, which reads the Dataverse `roles` table.

### Current problem
Users with `A365 - Payroll Employee` get 403 `PrivilegeDenied` (code `0x80040220`) from the `roles` table, because that role has no Read on the Security Role table. The role lookup fails, so the gate denies access. `A365 - Payroll Admin` users work because their role lookup succeeds. The role will not be changed in the environment.

### Expected behavior
1. Run the role lookup first, as today.
2. Role lookup succeeded: allow if the user holds an allowed role (exact name match, case-insensitive, trimmed). Otherwise deny and show the user's current security roles on the no-access card.
3. Role lookup failed with HTTP 403: run a payroll-read probe. If the user can read payroll data, allow. If the probe also returns 403, deny.
4. Role lookup failed with any other error: deny (fail closed). Do not probe.
5. While the role lookup or the probe is running, show the loading skeleton. Never flash app content.
6. On the probe path the user is never shown the admin sections, because their role names could not be confirmed.

### Access constants (`access.ts`)
- Set `ALLOWED_ROLES` to exactly `"A365 - Payroll Admin"` and `"A365 - Payroll Employee"`. Remove `"A365 - Admin"`.
- In `deriveGate`, use `toLowerCase()` instead of `toLocaleLowerCase()`.

### Gate decision logic (`access.ts`)
Extend `GateInputs` with optional fields so existing tests keep passing:
```ts
export interface GateInputs {
  roleSettled: boolean
  roleError: boolean
  roleNames: string[]
  /** The role lookup was blocked with a 403, so the payroll-read probe decides. */
  roleLookupBlocked?: boolean
  probeSettled?: boolean
  probeAllowed?: boolean
}
```
Update `deriveGate`:
```ts
export function deriveGate(i: GateInputs): GateState {
  if (!i.roleSettled) return "loading"
  if (!i.roleError) {
    const allowed = new Set(ALLOWED_ROLES.map((n) => n.trim().toLowerCase()))
    return i.roleNames.some((n) => allowed.has(n.trim().toLowerCase())) ? "allowed" : "denied"
  }
  if (!i.roleLookupBlocked) return "denied"
  if (!i.probeSettled) return "loading"
  return i.probeAllowed ? "allowed" : "denied"
}
```

### Service changes (`security-service.ts`)
- Set `ADMIN_ROLE_NAMES` to `["A365 - Payroll Admin"]`. `System Administrator` and `A365 - Admin` are no longer allowed through the gate, so they have no effect on the nav.
- Move the "True when `systemUserId` is a member of any admin role" doc comment so it sits above `getCurrentUserRoles`, not `CurrentUserRoles`.
- Add the probe and a helper:
```ts
const PAYROLL_PROBE_TABLE = "a365_payrollperiods" // confirm against the generated service

export function isPrivilegeDenied(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 403
}

/** True if the user can read payroll data, false on 403, throws on anything else. */
export async function canReadPayrollData(): Promise<boolean> {
  const result = await dataClient.retrieveMultipleRecordsAsync<{ a365_payrollperiodid: string }>(
    PAYROLL_PROBE_TABLE,
    { select: ["a365_payrollperiodid"], top: 1 },
  )
  if (result.success) return true
  if (isPrivilegeDenied(result.error)) return false
  throw result.error ?? new Error("Unable to check payroll access.")
}
```
- Confirm the entity set name, the primary key name, and that the client supports `top`. Adjust to match the generated service. An empty table still counts as success.

### Hook changes (`use-access-profile.ts`)
- Run the probe query only when the roles query failed with a 403:
```ts
const rolesBlocked = rolesQuery.isError && isPrivilegeDenied(rolesQuery.error)
const probeQuery = useQuery({
  queryKey: ["payroll", "access-probe", systemUser.data] as const,
  queryFn: canReadPayrollData,
  enabled: rolesBlocked,
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
})
```
- Treat a successful system-user lookup that returns no id as an error, so the skeleton never spins forever:
```ts
const noUser = systemUser.isSuccess && !systemUser.data
```
- Return value:
```ts
const access = deriveAccess({ /* unchanged */ })
return {
  ...access,
  // Role names could not be confirmed on the probe path, so never show admin sections.
  isAdmin: rolesBlocked ? false : access.isAdmin,
  roleSettled: systemUser.isError || noUser || rolesQuery.isSuccess || rolesQuery.isError,
  roleError: systemUser.isError || noUser || rolesQuery.isError,
  roleNames: rolesQuery.data?.roleNames ?? [],
  roleLookupBlocked: rolesBlocked,
  probeSettled: probeQuery.isSuccess || probeQuery.isError,
  probeAllowed: probeQuery.data === true,
}
```
- Keep the shared query key so the gate and nav still make one role request.

### NoAccess screen (`NoAccess.tsx`)
- Keep the "Roles detected" block. Rename its label to "Your current security roles".
- When the role lookup failed, change the message to: "We couldn't read your security roles, and your account has no payroll access."
- Keep the existing card styling and `role="alert"`.

### Tests (`access.test.ts`)
The file must be named `access.test.ts`. Update and add:
- "allows either configured role": `A365 - Payroll Admin` and `A365 - Payroll Employee`, each alone.
- "allows a user with both configured roles": both names.
- "denies a non-allowed role only": use `["A365 - Admin", "System Administrator"]`.
- Blocked lookup and probe not settled: `"loading"`.
- Blocked lookup and probe allowed: `"allowed"`.
- Blocked lookup and probe denied: `"denied"`.
- Role error that is not a 403 (`roleLookupBlocked` false): `"denied"`.
- Keep the existing tests for loading, error, no roles, team-inherited role and case/whitespace matching.

### Implementation requirements
- Keep all role names in `ALLOWED_ROLES` and `ADMIN_ROLE_NAMES`. Do not hardcode them elsewhere.
- Probe only after a 403 from the role lookup. Users whose role lookup works must never trigger it.
- The probe reads at most one row and only the id column.
- Never treat a non-403 error as allowed. Fail closed.
- Do not change `deriveAccess` or the nav behavior for users who pass the gate through the role lookup.
- Client-side gating is UX only. Dataverse security roles remain the real boundary.

### Acceptance criteria
- User with `A365 - Payroll Admin` (role lookup works): sees the app and the admin sections.
- User with `A365 - Payroll Employee` (role lookup blocked, probe passes): sees the app, no admin sections, and "My Payroll" if linked to an employee record.
- User with both roles: sees the app.
- User with neither role whose lookup works: sees the no-access card listing their current security roles.
- User whose lookup and probe are both blocked: sees the no-access card with the "couldn't read your security roles" message.
- Network or other non-403 error: sees the no-access card.
- A user without a system-user id sees the no-access card, not an endless skeleton.
- Probe request fires only after a 403 on the role lookup.
- All unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Before changing code, briefly tell me which files hold `ALLOWED_ROLES`, `deriveGate`, the role query and the admin role list, the access hook, and the no-access card, plus the generated service name for the Payroll Period table. Then make the changes.