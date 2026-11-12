# Manual leave balance reset

> Owner update, 2026-11-09: the manual reset is replaced locally by
> [Refresh balance](leave-refresh-balance.md): earned VL / 5 SL minus recorded
> paid usage and paid VL conversions. It preserves conversion limits and snapshots.
> Fixed 10/5 reset behavior below is release history. The backend is deployed to
> Dev for local client testing; hosted app publication was not performed.

**Latest follow-up, 2026-11-03:** reset also restores matching unpaid
current-year conversion limits to 10 Available VL / 5 conversion days, using saved
rates in the same transaction. Paid conversions stay unchanged. This follow-up is
deployed in plugin 1.0.3.6 and the matching Dev client. See
[conversion balance connection](leave-conversion-balance-sync.md). The 1.0.3.5
deployment evidence below records the earlier live reset release.

Owner confirmed 2026-11-03: add Reset leave balances to Leave Management for
Payroll Admin. Set current-year remaining balances to 10 VL / 5 SL for employees
whose employment status is Active, even when leave has already been used. This
is an explicit manual adjustment, not a change to existing leave allocations.
The automatic annual cycle moves from January 5 to January 1, effective 2027.

## Verification checklist

- [x] Admin-only button opens a read-only impact preview and confirmation showing
  current year, employee count, 10 VL / 5 SL and the effect on used balances.
- [x] Preview/cancel causes no writes; empty/error states are clear and retryable.
- [x] Only Active employment status is targeted; inactive and On Leave are excluded.
- [x] Signed adjustments retain existing credit/leave records and actor/time audit.
  Current calendar-year cards and current-period posting preview both reach 10/5.
  Earlier portions of the current year's balances are offset, not deleted.
- [x] Materialize credits already due before adjusting, so the next leave submission
  cannot immediately add the same due grants again. Later normal accrual remains
  unchanged before 2027; from 2027 there is full annual allocation and no carryover.
- [x] Server authorization, employee locks, changed-preview rejection and one atomic
  transaction protect the reset. A completed operation is not applied again on retry,
  even if employees/balances change afterwards. A fresh confirmation is a new reset.
- [x] Disable duplicate confirmation/closing while pending; uncertain failures retain
  the operation identity and require retrying that operation instead of starting over.
- [x] January 1, 2027 starts the new cycle; December 31, 2026 ends the transitional
  cycle. No rewrite of historical transactions or historical period tags.
- [x] Leave allocation, deletion restoration, conversion and finalized payroll remain
  unchanged. No emails are sent by resetting balances.
- [x] Targeted app/server tests, full tests, lint, production build and browser
  checks pass; the existing large-bundle warning remains.
- [x] Deploy signed Leave plugin 1.0.3.5 to the owner-confirmed Dev environment;
  verify the live read-only reset preview, deployed hash, transaction context and
  unchanged credit count. Existing app UI already exposes the reset button.
- [ ] Verify actual ordinary-admin/employee access, real Dataverse concurrency/
  rollback and hosted January 1 behavior. No live reset has been executed.

## Release boundary

This work adds a server command to the existing Leave API; generated bindings and
schema remain unchanged. On 2026-11-03 the owner explicitly confirmed deploying
the Leave plugin to Dev; version 1.0.3.5 is now deployed. This authorization does
not execute a balance reset or authorize role/schema changes, commits or pushes. Resetting from the
app requires its explicit impact confirmation. Existing ledger implementation work
in the workspace is unrelated and must be preserved.

## Implementation and verification

Added Reset leave balances beside Add Leave, with a read-only server preview,
active employee count, current year, confirmation, cancellation, empty/error states,
pending-submit protection and stable-identity retry after uncertain results.
LeaveAccess keeps the feature admin-only; the existing API admin gate enforces it.

Server changes are in ResetBalances.cs and the existing LeaveCommand dispatcher/
write guard. A dedicated reset lock and existing employee locks coordinate with
Leave issuance/deletion. The raw reviewed snapshot is fingerprinted before due
grants are materialized. Signed Grant/Deduction adjustments offset relevant older
portions of the current calendar year and set the current credit period to 10/5.
Original movements/source records remain. Earlier years outside the current period
are untouched. A zero-day completion receipt returns the original result on retry
without resetting a subsequent leave deduction again. A fresh confirmation is a
new intentional reset. No notifications, payroll recalculation or conversion edits.

Local validation: lint and production build pass (existing large-bundle warning);
483 application tests in 48 files; 277 synthetic server checks
(reset 15, policy/allocation 49, write guards 54, deletion 44, issuance 35,
conversions 56, personal access 24); seven Edge scenarios. The first UI test caught
a duplicate click after immediate success and the submit guard was corrected.
The first build caught unsupported Testing Library query options; those were fixed.
The browser harness initially omitted an existing service export; its mock was
corrected and all seven scenarios passed. No test sent real email or wrote live data.

Release artifact: plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll, signed
version 1.0.3.5, SHA256 DB5152E9A84F6383E262DEBD2EBE3264BC695E95000B46BDEE63FC1DC2CACAA6.
The existing API Request/Response shape, generated files, schema and roles remain
unchanged. The owner-confirmed Dev deployment used the existing assembly update
script. A native solution export supplied the matching DLL, assembly metadata and
34 Leave step references plus the assembly manifest reference; unrelated native
source was preserved. No Code App publication was performed in this deployment
step because the displayed reset UI already exists.

Remaining limits: reset is synchronous across Active employees. If platform time or
transaction limits are exceeded, it must fail atomically; large-workforce/live
concurrency behavior is not proven by synthetic tests. Active employees missing a
hire date, unallocated history or invalid balances block the operation for review.
Annual credits remain lazy-posted, not a newly scheduled background flow. Ledger
work already in the workspace was preserved. No commit, push or live reset.

## Dev deployment verification - 2026-11-03

Environment: https://org9a7651f0.crm5.dynamics.com, verified with pac org who.
Live plugin 1.0.3.5 matches the tested/native DLL hash above. The read-only
resetPreview command now succeeds for 7 Active employees in 2026, returning
10 VL / 5 SL and current period start 2026-04-01. All 20 synchronous Leave write
guards remain active, transaction diagnostics pass and credit count is unchanged.
No resetBalances command, financial data writes or emails were sent.
Evidence: [deployment checks](leave-reset-deployment.json); repeatable read-only
checker: scripts/leave-schema/verify-reset.ps1. Actual reset remains an explicit
owner action through the confirmation dialog.
