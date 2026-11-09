# Refresh leave balance

Owner-confirmed requirements, 2026-11-09. Replaces the manual 10 VL / 5 SL
remaining-balance reset. The backend is deployed and verified in Dev. The owner
tests the matching client through `npm run dev`; no hosted app was published and
no live balance refresh has been executed by the agent.

## Verification checklist

- [x] Replace Reset leave balances with Refresh balance for Payroll Admin, keeping
  the existing all-Active-employees scope independent of list filters.
- [x] Calculate current-period earned VL with the existing completed-month and
  hire-date rules, capped at 10; SL entitlement is 5.
- [x] Subtract saved paid portions of Issued VL/General Leave or SL in this period.
  Exclude Unpaid, Cancelled and deleted sources; never recalculate saved allocations.
- [x] Subtract current-year paid VL conversions exactly once; retain paid snapshots
  and unpaid conversion limits/rates. Existing conversion reads cap payable days
  against the refreshed ledger balance.
- [x] Preview every employee's recorded and recalculated balances, earned VL,
  used leave and paid conversion days. Negative results block the entire refresh
  for review; do not clamp away overuse or rewrite historical leave.
- [x] Reconcile signed history with append-only adjustments, neutralizing previous
  resets and duplicate grants without deleting history or deducting them twice.
- [x] Materialize due canonical grants before adjustment; repeated refreshes do
  not add spendable credits. Preserve actor/time and a stable operation receipt.
- [x] Preview/cancel makes no writes. Reject changed source/credit/employment
  snapshots; employee locks and the API transaction protect apply/rollback/retry.
- [x] Retire the old reset commands so stale clients cannot restore fixed balances.
- [x] Verify loading, empty, error, pending, uncertain retry, keyboard/mobile and
  admin denial states. Invalidate affected Leave queries after confirmed success.
- [x] Targeted app/server tests, full app tests, lint, build and browser checks.

No schema, generated bindings, roles, payroll snapshots, source leave allocations,
paid conversion snapshots, emails, scheduled jobs or hosted app publication changes.

## Implementation and checks

Implemented in the existing Leave dialog/hook/service and signed Leave command
plugin source (version 1.0.3.10). The button is **Refresh balance**. Existing
filenames are retained to keep the change focused. New commands are
`refreshPreview` and `refreshBalances`; old reset commands fail closed. Generated
bindings, table definitions and permissions do not change.

The server computes entitlement independently of existing credit movements,
subtracts saved paid portions from current-period Issued leave, and deducts
conversion days only when their year header is paid/locked. Source reads are
filtered by period/year and paged. Deleted/cancelled sources and unpaid portions
consume no credits. Existing signed history is reconciled with actor/date/operation
adjustments. Due canonical grants are materialized first so later issuance cannot
post them again. Unchanged repeat refreshes add only a zero-day operation receipt,
not spendable credits. History fingerprints are serialized per record to handle
retained audit histories larger than the response serializer limit.

The preview includes each employee's before/after balances, earned VL, paid VL/SL
used and paid conversion days. Negative recalculated balances remain visible and
block the whole operation. A malformed or ambiguous stored allocation, credit
history or conversion payment status fails for review. No saved allocation is
reclassified as unpaid. Existing unpaid conversion limits are preserved; normal
conversion reads already cap effective payable values against recorded VL.

Verification on 2026-11-09:

- 537 application tests in 53 files pass, including eight refresh-dialog tests
  and 21 posting-service tests.
- 570 synthetic server assertions pass across refresh (23), conversion preservation
  (6), guards (80), policy (57), calendar correction (13), issuance (161), employee
  sync (23), annual allocation (59), deletion (44), conversion (67), conversion
  balance linkage (13) and personal security (24).
- Lint, production build and signed server compilation pass. The existing
  large-bundle build warning remains.
- Seven headless Edge scenarios pass: cancel, success, preview error, uncertain
  retry, empty, mobile and employee denial. All platform data is synthetic and
  external browser requests are blocked.
- `git diff --check` passes.

## Release and remaining verification

Leave backend 1.0.3.10 is deployed to Dev; no live balance refresh, data
reconciliation, email, schema or role change was performed. Real Dataverse rollback/concurrency, ordinary-account privileges
and hosted app behavior remain unverified. The action retains the existing
synchronous all-Active-employees scope; large-workforce transaction limits still
require environment validation.

The combined local source now uses **1.0.3.12**, reserving 1.0.3.11 for the isolated
half-day deletion fix built from the current Dev baseline. This keeps a future
Refresh balance release above that isolated fix without deploying Refresh now.

For an authorized release, deploy the signed Leave plugin 1.0.3.12 and publish the
matching client together. While mixed versions exist, refresh/reset calls fail
closed. Verify `refreshPreview` read-only in the selected environment first, review
each employee's entitlement and source usage, then use the app confirmation only
when intending to apply the audited adjustments. Do not run the old reset-verifier
script: it checks the retired contract. Existing production data is unchanged.

### Release preparation, 2026-11-09

Read-only inspection confirms the active target is The Daily Operation - Dev,
environment `b58b083e-d27d-eabd-a143-2a49dcb9d89a`, and it still runs Leave
1.0.3.9. The tested local assembly is 1.0.3.10, SHA256
`52E8B7870A708A80C53AA2CDFD19401471EA9A902FA7DD39E7E8BE4CC3EAEF90`.
The live 1.0.3.9 DLL was backed up under ignored
`scripts/leave-schema/.work/refresh-release/before-1.0.3.9.dll`, SHA256
`EB451A73C6CEA414831C1E68463B319D06E7D7588BFA7D9F9AC50255BBB74AD4`.

The new [read-only release verifier](../scripts/leave-schema/verify-refresh.ps1)
checks the deployed hash, entitlement/usage preview contract, unchanged credit
count, transaction context and existing guards. Its PowerShell syntax passes;
live execution requires the new server version. It never sends `refreshBalances`.
This preflight preceded the owner-authorized backend deployment documented below.

### Dev backend deployed and verified, 2026-11-09

Owner authorized deployment to Dev and direct application of future plugin/backend
updates to this Dev environment without repeated permission requests. This does
not authorize other environments or executing financial/balance mutations merely
as a deployment test. No hosted app publication was requested for local testing.

The working DLL had been rebuilt with the concurrent half-day deletion fix.
All 663 current synthetic server checks pass, including 137 deletion checks and
29 refresh/conversion-preservation checks. A pinned copy of that tested DLL was
staged before deployment, so subsequent local rebuilds cannot change the release.

PAC updated the existing Leave assembly only. Download verification confirms
version 1.0.3.10 and SHA256
`F01D6CE69B0816A7B42F3D2CC747C00158DA84FE7122011C00D1E7BE96534BC6`,
identical to the staged tested release. The earlier preflight hash above describes
an earlier local build and is not the deployed artifact.

Live `refreshPreview` passes for six Active employees in the 2026 calendar period,
with `canApply: true` and zero blocked employees. Entitlement/usage arithmetic,
synchronous transaction context, all 20 active Leave write guards and unchanged
credit count are verified. No `refreshBalances`, paid conversion, leave or email
mutation was sent. See [deployment evidence](leave-refresh-deployment.json).

The native solution was exported from Dev. Only the Leave DLL/assembly metadata,
34 existing step references and the Leave assembly root were synchronized to
native source, preserving other components. The owner can reload their local
Leave Management page, choose Refresh balance, review before/after balances and
confirm when ready to apply the adjustments. Ordinary-account and hosted-app UAT,
real transaction rollback and concurrent-write exercises remain unverified.

Repeat read-only verification against the pinned release:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/leave-schema/verify-refresh.ps1 -ExpectedSHA256 F01D6CE69B0816A7B42F3D2CC747C00158DA84FE7122011C00D1E7BE96534BC6
```
