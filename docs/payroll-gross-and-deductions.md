# Payroll gross pay and deductions correction

Scope: `PLANS.md`, reviewed in full on 2026-10-26. Branch:
`fix/payroll-gross-and-deductions`. The separate lifecycle proposal currently
in `DESIGN.md` is outside this task. Existing workspace edits are preserved.

## Investigation

- `services/payroll-calculation.ts`: the shared engine; existing workspace edits
  already move unpaid leave from gross earnings into deductions. SSS, PhilHealth
  and HDMF depend on monthly basic salary, not gross earnings. Their basis,
  configuration and rounding remain unchanged. Tax is a manual input.
- `services/payroll-service.ts`: save/recalculate persistence calls that engine;
  recalculation does not write withholding tax. Copy/template hooks also call it.
- `payroll-entry-dialog.tsx`: before this fix, the Auto panel rendered the saved entry,
  rather than calculating a preview of the edited inputs.
- `services/payroll-period-service.ts`: before this fix, Mark Ready checked only for populated
  calculation columns; old totals with a calculation timestamp pass that check.
- `payslip-breakdown.tsx`, `payslip-data.ts`, `payslip-document.ts`: screen and PDF
  consume saved values. Employee Other Deductions/comment visibility must stay.
- `period-utils.ts`, `services/overview-service.ts`, period tables/cards and
  dashboard: aggregate saved results; they must not independently recalculate.
- Earlier formula text occurred in the Phase 5 specification/implementation
  plan, `docs/payroll-task-phases.md`, `docs/phase-12-test-plan.md` and
  `docs/statutory-contributions.md`; these instructions have been corrected.

## Acceptance and verification checklist

- [x] 1. Shared formula: gross includes basic, allowances and other earnings only.
- [x] 2. Deductions include leave, other deductions, SSS, PhilHealth, HDMF and tax.
- [x] 3. Centavo regression coverage proves unchanged net pay for identical inputs,
  including fractional leave, nonzero additions/deductions and zero amounts.
- [x] 4. The supplied Oct 16–31 fixture renders 20,000.00 / 5,111.36 / 14,888.64
  on screen and in PDF; itemized rows reconcile and PDF columns remain aligned.
- [x] 5. Edit preview uses the shared calculation; save, copy/template, period
  summaries, dashboard and payslip consume that result or its saved columns.
- [x] 6. Contribution formulas/bases and manual tax remain unchanged; regression
  tests cover their independence from gross/leave/allowance/earnings inputs.
- [x] 7. One totals formula; Mark Ready detects old totals and corrects them before
  changing status, without changing stored contributions, leave or manual tax.
  Old affirmative formula instructions are updated throughout code/tests/docs.
- [ ] 8. Targeted tests, full tests, lint, build, diff checks and relevant browser
  checks pass. Hosted verification after deployment is recorded separately.
- [x] 9. No existing records, schema, generated files, roles, ownership/sharing,
  statuses or access rules are changed by implementing or testing the code.

## Verification results (2026-10-26)

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed; Vite reports its existing large-chunk advisory.
- `npm.cmd test -- src --exclude src/features/payroll/payroll-export.test.ts
  --maxWorkers=2 --testTimeout=60000`: 153 tests passed across 18 files.
- Full `src` run: one unrelated Excel-export failure. Independently reproduced
  with `npm.cmd test -- src/features/payroll/payroll-export.test.ts
  --testTimeout=60000`: 18 passed, 1 failed. Line 279 expects a Date in Details B2;
  ExcelJS reloads numeric serial `46314.66666666667`. Both export files are
  unchanged. The exporter assigns the date format before assigning column money
  formats, which can override B2's format. This is outside the formula fix.
- Unrestricted `npm test` also discovers upstream tests under
  `.agents/power-platform-skills-source/`; it was stopped after many unrelated
  Node-test/skill failures. Test discovery configuration has not been changed.
- Playwright with installed Chrome: desktop/mobile fixture screen, summary cards,
  live edit preview, cancel preserving the saved snapshot and real PDF generation
  passed without browser errors. Artifacts are local and ignored by Git under
  `artifacts/payroll-formula.local/`, including `Test-User-Oct-16-31.pdf`.
- Browser comparison against the original engine from Git HEAD: 10,000
  deterministic fixtures had exactly equal net pay, SSS, PhilHealth, HDMF,
  unpaid leave, daily rate and withholding tax. Inputs included currency centavos,
  fractional leave days, varied salaries, allowances, earnings, deductions and tax.
- Diff/contradiction scan: changed files pass `git diff --check`. The pre-existing
  user edit to `PLANS.md` retains an extra blank line at EOF; it was preserved.
  The obsolete formula remains only as explicitly rejected problem text in that
  requirements document (and the ignored baseline verification artifact).
- The requested Vercel React skill was not found in the project/user skill
  locations or plugin cache. Existing React/TanStack patterns were followed.
  Power Platform skills and Microsoft Learn MCP documentation were consulted.

Criteria 4 and 6 above are verified with fixtures and source comparison; the live
Test User record was not changed or read. Criterion 8 remains incomplete because
of the existing test failures and pending hosted deployment verification.

## Data and release boundary

No migration or background correction runs on startup, query, preview or build.
Existing screens/PDFs continue to show stored snapshots until a correction is
explicitly approved. Normal admin save/recalculate actions use the corrected
engine. Mark Ready will correct stale totals as part of that explicit action.
Finalized periods are never automatically rewritten or unlocked.

Mark Ready validates all included entries before beginning corrections, then
writes only stale totals and calculation audit stamps. Already correct/excluded
entries are not rewritten. It blocks if the corrected net would differ. If a
write fails, status stays Processing and the action can be retried; corrections
already saved for earlier entries are retained. There is no multi-record
transaction in the current dataClient API. Lifecycle and access rules are unchanged.

Before any approved existing-record correction: inventory affected periods and
entries read-only; capture old inputs, contribution amounts, leave, tax and totals;
propose the exact records/fields; verify net to the centavo and preserve all
contributions and inputs; obtain approval. Finalized records require an approved
correction process. Do not use a bulk full recalculation that could pick up newer
salary/configuration values.

Deployment target and existing-record correction approval remain pending.
The configured target is The Daily Operation - Dev,
`b58b083e-d27d-eabd-a143-2a49dcb9d89a`,
`https://org9a7651f0.crm5.dynamics.com/` (per `docs/deployment.md`).
The deployed Test User record and Power Apps host must be verified after an
approved deployment/correction; local fixtures alone do not verify live records.
