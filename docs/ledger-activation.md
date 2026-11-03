# Ledger activation — 2026-11-03

The owner explicitly authorized all activation steps after reviewing why record
creation was disabled: enable auditing, register the server/guards/worker, apply
the planned Payroll Admin permissions, generate the API binding, verify and deploy
the existing app to The Daily Operation – Dev. No commit or Git push is authorized.
Historical payroll posting and modification of real payroll records are excluded
from activation verification; they retain their normal explicit confirmations.

## Activation checklist

- [x] Verify the existing environment/solution and preserve working-tree changes.
- [x] Enable organization auditing without changing retention or other settings.
- [x] Compile/test the reviewed server, register API/guards/async worker and verify.
- [x] Apply only the planned Payroll Admin grants; preserve unrelated privileges.
- [x] Generate the API binding with the installed CLI; no manual generated edits.
- [x] Verify live list/totals, controlled test record save/retry/delete/audit, and
  direct-write rejection; remove only activation-created test records afterwards.
- [x] Check available low-privilege security boundaries; disclose unavailable tests.
- [x] Run required app tests/lint/build and relevant browser checks after changes.
- [x] Deploy the app and confirm the generated binding is in its built package.
- [x] Export/unpack native changes, update evidence and report remaining limits.

## Completed activation

- Dev app deployed successfully to the existing solution/app:
  [The Daily Operation](https://apps.powerapps.com/play/e/b58b083e-d27d-eabd-a143-2a49dcb9d89a/app/d4f0731a-e91a-40d4-ac0b-3f7e2400fa0f).
- Signed `A365.Ledger.Plugins` **1.0.0.2**, API and **36 active steps** registered,
  including two async worker registrations. No historical run was started.
- Applied the **10 missing additive Payroll Admin grants**. Existing unrelated
  privileges were verified unchanged. Payroll Employee has no privileges on any
  of the four Ledger tables; no role assignments or broad admin roles were added.
- `isauditenabled=true`. `auditretentionperiodv2` remains unset, exactly as before;
  no retention duration, read-audit or user-access-audit setting was changed.
- Generated the binding via `pa app add dataverse-api`; `.power` and generated
  service/model/index changes are CLI output, not manual edits.
- Fixed a live retry fingerprint mismatch before release: request fingerprints
  and filter/page identities now use a fixed field order and length prefixes,
  rather than depending on JSON reflection ordering across server workers.
- **45 live checks passed**, including manual save/edit, duplicate prevention,
  replay preserving a later edit, stale edit rejection, amount/category validation,
  native-write rejection, totals and native deletion audit after cleanup.
- **38 final read-only checks passed** against server 1.0.0.2, including role
  privilege inspection and live list/aggregate/history-preview/progress reads.
- Controlled test rows were removed through the validated command; original count
  and balance were restored. Native audit entries and operation receipts remain.
  No real payroll, employee financial sources, notifications or history posting changed.
- Full release suite **474 tests / 47 files**, lint, build and Playwright at
  **1280px/390px** passed. Signed server compilation and **65 contract assertions**
  passed. Build retains large-chunk warnings.

Evidence: [live CRUD checks](ledger-live-verification.json),
[final runtime checks](ledger-runtime-verification.json),
[metadata/release status](ledger-schema-verification.json).
Native activated solution exported/unpacked at
`artifacts/ledger.local/activated-solution`. The exported app's main bundle matches
the tested build SHA-256 and contains `a365_ledgercommand`:
`98D57334DE808565F5DF37A7950960CD9A960751B97349E397EE55D54BED93E9`.

## Remaining verification limits

- Ordinary-account impersonation could not be verified: **zero employee identities
  verified**. Employee-role metadata and local route gating pass, but signed-in
  employee A/B direct-record/API/export tests remain unverified.
- Actual paid-payroll posting, live injected multi-row rollback/concurrency,
  uncertain-network delivery, and async history execution/resume were not exercised
  against real payroll. The server contract tests simulate their SDK boundary;
  registration/preview checks do not prove async job execution.
- Signed-in Power Apps browser UAT remains separate from CLI tests and synthetic
  local Playwright checks. Reload/reopen the deployed app to load its new binding.
- Technical posting/preview/aggregate/progress limits remain in the
  [release runbook](ledger-release.md).
- Concurrent Leave-reset edits appeared after the validated Ledger build. They
  were preserved and are not part of this deployed build or its reported checks.
  The native exported app bundle matches the pre-existing verified build exactly.
- No commit or Git push performed.
