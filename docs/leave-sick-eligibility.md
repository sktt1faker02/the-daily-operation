# Sick leave by employment type

Owner decision, 2026-11-24: Probationary employees have zero sick-leave
entitlement, including January 1. Changing Employment Type to Regular grants the
full five SL for the current year, once. This supersedes unconditional five-SL
wording in earlier annual-reset and employee-initialization documents. Other
employment types and VL rules retain their existing behavior.

## Implementation and verification checklist

- [x] Server initialization, preview, issuance and Refresh balance use zero SL
  entitlement for Probationary (`a365_employmenttype = 749910101`), including
  January 1 in 2026, 2027 and 2028.
- [x] Regular (`749910100`) receives five SL without midyear proration; repeated
  sync/preview does not duplicate the grant. Existing used SL remains deducted.
- [x] Existing automatic SL grants are offset by append-only eligibility
  movements when a probationary employee is synced; original history and prior
  years remain intact. Regularization restores the entitlement once.
- [x] Saving an employee through the app synchronizes current-year leave before
  invalidating affected caches. A leave-sync failure retains the saved employee
  and reports the need to retry **Sync leave credits** in Leave Management.
- [x] Refresh preview reflects employment eligibility; changing employment type
  invalidates a previously reviewed refresh. Existing paid usage above entitlement
  continues to block refresh for review instead of rewriting historical leave.
- [x] Final regression checks and limitations: signed server build, 307 server
  assertions, 15 targeted Vitest tests, 13 Playwright scenarios, production build
  and lint excluding generated artifacts pass. The full run had 20 UI timing/
  interaction failures; all five affected files pass isolated reruns (81 tests)
  with one worker and a 15-second timeout. See the delivery entry in
  [Payroll-Enhancements.md](../Payroll-Enhancements.md).
- [ ] Deploy the updated Leave plugin and browser app together, then verify as
  real Payroll Admin and Employee accounts. No deployment or live data correction
  was performed for this source change.

Changes span the existing Leave plugin accrual/sync/refresh paths, employee update
hook, Refresh balance wording and regression tests. No schema, security-role,
generated service, payroll calculation or finalized leave snapshot changes.

Annual posting retains the existing lazy approach; there is no new scheduler.
Updates outside the app receive the rule on the next existing server sync,
preview or issuance. Stored balances for existing employees are not migrated
automatically by deployment. Use the authorized Sync leave credits or reviewed
Refresh balance action after rollout; unusual manual adjustments and historical
paid probationary leave still require owner review.
