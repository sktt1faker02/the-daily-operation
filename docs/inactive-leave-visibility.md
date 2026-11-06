# Inactive employees in Leave Management and Leave Conversion

Owner request, 2026-11-06: employees with employment status Inactive must not
appear in either module. Support 11 User is confirmed Inactive in Dev. This is
an application visibility/eligibility rule, not a replacement for Dataverse roles.

## Verification checklist

- [x] Leave employee search and leave/credit/conversion lists filter Inactive on
  the server before paging, using metadata-verified `a365_Employee` navigation.
- [x] A stale selected employee shows no balances or sync actions when inactive;
  unverified status shows an error rather than an assumed zero balance.
- [x] Leave record details reject a stale inactive selection without displaying it.
- [x] Conversion rows exclude inactive employees through an inner join before
  paging, for both unpaid and paid years. No records are deleted or cancelled.
- [x] Stale conversion edits for an inactive employee are rejected by the server.
- [x] When an admin confirms a new conversion payment, employee status is rechecked
  and inactive employees' payable days/amounts freeze at zero. Reactivation cannot
  invent a historical payout. Previously paid snapshots are not recalculated.
- [x] Changing employee status invalidates affected leave/picker/conversion caches.
- [x] Existing credits, deductions, salary snapshots, paid history and payroll
  leave deductions remain intact. Other employment statuses keep existing rules.
- [x] Targeted and full Vitest (535 tests), server regression, lint/build and
  six Playwright browser scenarios pass. Native solution repack passes.
- [x] Deploy the tested plugin to authorized Dev and verify Support 11 User is
  excluded while existing credit movements and unpaid conversion history remain
  saved. The older 8.33 VL baseline had already been adjusted to 10 VL before
  this deployment; the most recent credit modification is 10:29 UTC, before the
  11:22 UTC visibility deployment. No financial data is changed by this release.

No schema, role, statutory formula or scheduled-job changes. Employee-facing
personal Leave History remains a separate read-only history flow. Ordinary-account
live security UAT is outside the available admin session and remains unverified.

Release evidence: [Dev plugin and live visibility checks](inactive-leave-deployment.json).
The downloaded and repository-native DLL match the tested SHA256. The local app
uses the changed source; a separate hosted-app publication was not performed.
