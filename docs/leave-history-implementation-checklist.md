# Employee Leave History implementation checklist

Requirements: [PLANS.md](../PLANS.md). Prepared October 27, 2026.

## Phase 1: Access and implementation review

Goal: establish the personal read scope before implementation.

- [x] Read project requirements, design, Payroll guidance and task phases.
- [x] Locate authenticated employee mapping: `useCurrentEmployee` uses
  `WhoAmIService.WhoAmI` and `employeeService.getBySystemUserId`.
- [x] Locate routing/navigation: `src/router.tsx`, `src/pages/_layout.tsx`.
- [x] Locate reusable leave services, balance display and paged records table.
- [x] Review personal-details risks: existing `LeaveDetail` includes notes,
  cancellation reason, actor lookups, notification status and Resend. Employee
  visibility of internal text is unspecified; do not expose it by default.
- [x] Identify security prerequisite: checked-in Employee role has no Leave or
  Leave Credit Transaction privileges. The existing access design explicitly
  keeps those records admin-owned and unshared with employees. See
  [leave permissions](leave-data-model.md#permissions--applied-and-verified).
- [x] Owner authorized access to each person's own account in chat on October
  27, 2026. Implement server-mediated reads without expanding table privileges.

The existing Leave API and live table/column names were verified before updating
the server. See [deployment evidence](leave-history-access-verification.json)
and [effective-access evidence](leave-history-effective-access.json).

## Phase 2: Application verification checklist

Goal: implement only the approved scope and verify every acceptance criterion.

- [x] Employee and linked-admin navigation both show My Portal with My Payroll
  and Leave History; check desktop and mobile navigation.
- [x] Both roles resolve their own employee; requests and cache keys retain that
  employee ID. Check missing profile, pending lookup and failed lookup/retry.
- [x] No employee selector or Add Leave action appears for either role.
- [x] Year validation, record-name search and all three choice filters combine
  correctly; inspect request filters to verify employee scope is preserved.
- [x] Personal balance reads page through the complete server-scoped ledger and
  use the same `calculateBalances` function and display as admin. Service tests
  compare results for the same ledger; live employee/admin screen comparison
  remains part of signed-in UAT below.
- [x] Search and choice filters leave balances unchanged; Refresh balances only
  reads data. Check empty credit history and failed/incomplete reads.
- [x] Table has Record, Employee, Type, Benefit, Dates, Days, Status and Action;
  verify existing sort order, paging and read-only Details.
- [x] No administrative actions appear on the page or inside details; internal
  fields remain excluded unless their visibility is confirmed.
- [x] Loading, empty history, no filter matches, list/detail failures and retry
  are distinct, accessible states. Check keyboard and small-screen behavior.
- [x] Foreign detail IDs fail closed in server and service tests. Server checks
  also cover spoofed employee IDs, missing/duplicate mappings, paging limits,
  ledger errors and employee attempts to reach admin commands.
- [ ] Verify employee A cannot read employee B through direct Dataverse requests
  and signed-in pages using actual ordinary accounts. Both supported
  impersonation headers were tried; the CLI returned a different caller identity,
  so no ordinary-account success or denial is claimed. The linked admin's own
  live personal read succeeded. Two eligible ordinary accounts were found.
- [x] Existing admin Leave Management and related tests continue to pass; no
  leave calculation, posting, notification or Payroll behavior is changed.
- [x] Run targeted tests, then final `npm test`, `npm run lint`, `npm run build`
  and relevant Playwright checks; report any unavailable checks.
- [x] Record actual-user security results, or explicitly mark them unverified.
- [x] Record delivered changes, verification and limits in Payroll-Enhancements.

Final verification results:

- `npm.cmd test -- src --maxWorkers=2 --testTimeout=30000`: 37 files, 344 tests pass.
- Server: 22 personal security, 56 conversion and 20 leave-policy checks pass.
- `node scripts/leave-history-ui-check.mjs <installed-playwright/index.mjs>`:
  12 synthetic Edge checks pass. All external requests are blocked.
- `npm.cmd run build`: pass; existing large-chunk warning remains.
- `npx.cmd eslint . --ignore-pattern '.playwright-cli/**'`: pass.
- Unfiltered `npm test` also collects imported `.agents` skill tests and was
  stopped after unrelated failures. Unfiltered lint reports 12 existing cache
  errors under `.playwright-cli`. Neither source tree was changed for this task.
- Documentation paths and `git diff --check`: pass.

## Phase 3: Authorized personal access and release limits

Goal: enable own-account access at the Dataverse server boundary.

- `LeaveCommand` dispatches only `myLeaves`, `myLeave` and `myCredits` to
  `PersonalLeaveReads`; all existing commands still require Payroll Admin.
- Each call resolves `InitiatingUserId` to exactly one employee using the existing
  `a365_systemuser` link. A supplied employee ID must match; it cannot select
  another person. Every list, detail and ledger query includes that employee.
- Personal server projections contain the record fields required for history and
  balances. Notes, cancellation reason, actor IDs and email internals are not
  selected or returned. Existing direct table permissions remain unchanged.
- Credits are read under the scoped server operation, avoiding an incomplete
  balance from row-sharing gaps. Repeated/invalid pages and the 50,000-row simple
  paging boundary fail rather than silently producing a partial balance.
- Query keys keep personal/admin results distinct while preserving the existing
  leave-list and employee-balance invalidation prefixes.
- Server assembly 1.0.3.1 is deployed to Development and hash-verified. Its native
  solution export supplies the checked-in DLL and existing step version changes.
  No roles, schema, ownership, sharing, migrations or business records changed.
- The Code App UI has not been deployed. Signed-in employee A/B access and
  employee/admin balance comparison remain release checks.

Manual release checks:

1. After separately authorized Code App deployment, sign in as employee A and B.
2. Compare each person's selected-year balances with admin Leave Management.
3. Attempt the other employee's ID and leave detail ID against the personal API;
   verify denial, and verify direct foreign-table access remains denied.
4. Confirm employees cannot use admin commands or write leave/credits, and a
   linked admin retains admin tools while the personal page shows only themselves.

References: [Microsoft's plug-in identity guidance](https://learn.microsoft.com/power-apps/developer/data-platform/impersonate-a-user),
[Web API impersonation](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/impersonate-another-user-web-api).
