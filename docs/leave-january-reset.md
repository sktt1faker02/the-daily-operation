# January leave-credit reset

## 2026 calendar-period correction - 2026-11-06

Owner requested changing the current balance period to **January 1-December 31,
2026**, independently of the annual allocation change below. Calendar-year
boundaries now apply from January 1, 2026; earlier dates retain their April
start, with the last legacy period ending December 31, 2025. The allocation
effective date remains January 1, 2027. The monthly accrual formula and the
separate 0 VL / 5 SL annual allocation edits are preserved. In 2026, monthly
accrual is evaluated from the new January period start.

Verification checklist:

- [x] January, March, April and December 2026 resolve to January 1, 2026.
- [x] The 2026 period ends December 31; March-April leave no longer crosses periods.
- [x] January 6 half-day calculation succeeds; cross-year leave remains blocked.
- [x] Earlier April-start periods and future calendar-year boundaries are tested.
- [x] Server issuance, allocation, reset and conversion regression checks pass.
- [x] Lint and app build pass. Full Vitest run: 505 passed, three Leave dialog
  timeouts; isolated rerun of all 24 Leave page tests passes. No UI change or
  configured Playwright suite; live browser verification remains pending.
- [x] Deploy the updated server plugin to owner-confirmed Dev; production pending.
- [ ] Reconcile existing April-tagged credits/deductions before live use; no
  migration, balance reset, retagging or historical snapshot changes were run.
- [ ] Production preview, issuance and ordinary-account security UAT.

Release gate: `a365_creditperiod` is used for exact balance selection and automatic
grant keys. Existing `2026-04-01` rows will not count in the new `2026-01-01`
balance, and new grants use different keys. An authorized administrator must
inventory affected grants, deductions, restorations, conversions and reset
adjustments, agree the reconciled opening balances and an auditable correction
process, and verify those balances before enabling new operations. Do not blindly
retag rows or use Reset leave balances as a migration: that action sets balances
to its own targets. Updating only the browser app does not deploy this server rule.

The release history below describes the earlier period implementation; the
2026 calendar-period correction above supersedes its April 2026 boundary.

### Dev deployment preflight - 2026-11-06

Owner confirmed `https://org9a7651f0.crm5.dynamics.com` for deployment; `pac org
who` verified The Daily Operation - Dev and environment ID
`b58b083e-d27d-eabd-a143-2a49dcb9d89a`. The signed local plugin compiles and
passes 367 server assertions, including the owner's expanded annual allocation
tests. Live assembly `1d8034c7-e2cd-f111-a05a-000d3a8014e4` is version 1.0.3.8
but differs from the tested local DLL. Read-only inspection found 70 transactions
tagged `2026-04-01` (46 VL, 24 SL) and no `2026-01-01` transactions.

The owner subsequently instructed **replace it** after the April-balance impact
was explained. Updated only the existing Dev Leave assembly, retaining existing
history without reconciliation. The downloaded DLL matches the tested SHA256;
a live read-only reset preview returns `periodStart: 2026-01-01` and year 2026.
See [deployment evidence](leave-calendar-period-deployment.json). No business-data,
schema, security or browser-app changes. Existing April-tagged transactions remain
excluded from the January-period balance; no correction or reset was run.

A local backup of the live DLL and aggregate preflight output are retained under
ignored `scripts/leave-schema/.work/calendar-release/`. Native solution DLL,
assembly metadata, 34 existing step registrations and the assembly root were
exported and synchronized to the repository; local solution repack passes.
Unrelated entities/roles were not copied. Production is outside
this Dev authorization. Live issuance and ordinary-account security UAT remain
unverified.

## Annual allocation and previous release history

Latest owner correction, 2026-11-06: annual reset on **January 1**, starting
**January 1, 2027**, to **0 VL and 5 SL**. This supersedes the November 3
10 VL annual allocation and the October 22
January 5 decision, including the old January 5-January 4 cycle boundaries.

Local implementation:

- Annual allocation effective date January 1, 2027; calendar-year boundaries
  now start in 2026 as documented above.
- Each year opens at 0 VL / 5 SL. Monthly VL accrual continues from January
  2027 onward: completed eligible months earn rounded increments toward 10 days
  per 12 months, in arrears (January becomes due February 1). A partial hire
  month is excluded. There is no previous-period carryover.
- January 1-4, 2027 now belong to the 2027 cycle for new operations. Existing
  historical transactions/period tags are not rewritten.
- Eligibility, holiday coverage and insufficient-credit handling remain unchanged.
- The manual [Reset leave balances button](leave-manual-reset.md) is a separate
  explicit admin operation: current-year remaining balances become 10/5 for
  Active employees, including when leave was already used.

Annual allocation retains the existing lazy posting pattern: preview projects due
credits without writing; Leave submission materializes them. There is no new
unattended scheduler. Manual reset first materializes already-due credits, then
adds signed adjustments to the targets so those due grants are not duplicated by
subsequent submission. Later monthly accrual continues, including from 2027.

The existing 2027 holiday-coverage restriction remains. This date change does not
claim a complete 2027 holiday calendar or update finalized payroll/leave snapshots.

The November 6 allocation change is local and requires a server plugin deployment
to take effect in Dataverse. No existing credits are rewritten; the annual path
creates the 5 SL opening grant and due monthly VL credits. Manual reset remains
a separate 10 VL / 5 SL operation.

Verification checklist for the monthly-accrual follow-up:

- [x] January opens at 0 VL / 5 SL in 2027 and 2028.
- [x] January earns 0.83 VL on February 1; two months total 1.67 and six total 5.
- [x] Twelve eligible months total exactly 10; December is due the following January
  and remains tagged to its earned year, with no carryover into the new cycle.
- [x] Mid-month hires exclude the partial month; repeated previews add no duplicates.
- [x] The existing 2026 accrual formula remains intact.
- [ ] Deploy the server plugin and verify live balances through the release process.

Previous release: signed Leave plugin **1.0.3.5** was deployed to owner-confirmed Dev on
2026-11-03. Its hash, live read-only reset preview and unchanged credit count
are verified in [deployment evidence](leave-reset-deployment.json). Native Leave
assembly/step references were synchronized from the actual solution export.
No live balance reset or schema/role changes were performed. January 1 behavior
is covered locally; real-user boundary UAT remains pending. See
[manual reset verification/release notes](leave-manual-reset.md).
