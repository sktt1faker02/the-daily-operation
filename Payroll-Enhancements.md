# Payroll Enhancements

This file is the ongoing change log for Payroll enhancements. Use
`docs/payroll-task-phases.md` as the template and reference for phase-based
planning; keep dated implementation history here.

## Change Log

### 2026-10-22 — Grant Payroll Admin Leave access and complete Stage 3

**Request / business outcome**

The owner explicitly authorized granting Payroll Admin access to the three
Leave tables, superseding the earlier manual-only role instruction, and
continuing Stage 3 without further scope confirmations.

**Changes**

- Added the 13 planned Organization-scope privileges across Leave, Leave Cash
  Conversion and Leave Credit Transaction, plus the missing System User Append
  To privilege, to the verified existing `A365 - Payroll Admin` role in Dev.
  No Delete, Assign, Share, ledger Write, user-role assignment or administrator
  elevation was added. Preserved unrelated existing privileges and the Employee
  role. Saved exact grant and final role-matrix evidence under `docs/`.
- Used the installed Microsoft Power Apps CLI 1.0.1 to register `leaves`,
  `leavecashconversions` and `leavecredittransactions` in `power.config.json`.
  Generated three `.power/schemas/dataverse/` schemas, three typed models and
  three services; the CLI updated its shared index and registry. No generated
  files were edited by hand, and no Leave feature calls were implemented.
- Added scoped grant, export, role-source pull and artifact verification
  commands under `scripts/leave-schema/`; updated the README and
  `docs/leave-data-model.md` with actual artifacts, authorization and results.
- Exported/unpacked the actual unmanaged solution after the grants. Merged
  only the 14 approved native privilege nodes into the existing Payroll Admin
  source definition, preserving unrelated source differences and concurrent
  Payroll work. No solution import, app deployment, commit or push occurred.

**Verification**

- Role read-back: zero differences for both named Payroll roles against the
  planned Leave matrix; required Employee/User Read and Append To verified.
- Artifact checks passed: three unique source registrations, all 39 specified
  columns, seven numeric choice mappings and nine business lookup bindings.
  All three entity definitions match the fresh native export; 43 pre-existing
  generated files and all existing source registrations were preserved.
- `npm.cmd run lint`: passed. `npm.cmd run build`: passed; existing Vite
  large-chunk warning remains. Local `pac solution pack`: passed.
- Unscoped `npm.cmd test` discovered imported skill tests under `.agents`, with
  unrelated failures and one Payroll export timeout under that broad run; it
  was stopped. `npm.cmd test -- src`: passed all 171 application tests across
  19 files, including all 24 Payroll export tests.
- PowerShell/JSON/XML parsing, generated-source preservation checks,
  documentation links/status scan and `git diff --check`: passed.
- No employee/payroll business records or sample Leave records were written;
  application feature source and unrelated working changes were preserved.

**Remaining limitations**

- Effective access through other user/team roles, ownership and sharing was not
  tested using ordinary accounts; verified named-role configuration alone is
  not a claim that all employee access paths are excluded.
- Environment-wide auditing remains disabled as previously inspected. Leave
  operations, server-side validation/concurrency, screens and notifications are
  future work. The generated CRUD methods do not implement those business rules.
- The existing Dev role contains unrelated privileges absent from the old
  repository definition. Only the approved grant nodes were pulled; full
  solution synchronization/promotion readiness is outside this task.
- Test-discovery configuration was left unchanged. No Playwright run is needed
  for this registration-only change, which adds no screen or user flow.

### 2026-10-21 — Prepare Leave Code App source registration (Stage 3 preflight)

**Request / business outcome**

Resume Stage 3 to register the three verified Leave tables with supported Code
App generation while preserving the existing Payroll work and manual security
configuration policy.

**Changes and verification**

- Switched to `feature/leave-module`, which shared the current base commit;
  retained all existing working-tree changes.
- Read the Code Apps Dataverse skill, current Microsoft Learn instructions and
  installed CLI help. Confirmed local grouped CLI version 1.0.1 and the existing
  cached sign-in for the confirmed Dev environment.
- Added read-only `inspect-stage3-permissions.ps1` and its result at
  `docs/leave-permissions-verification.json`. All 13 required Admin privileges
  on the three new tables are missing, together with System User Append To.
  The named Employee role correctly has no privileges on the new tables;
  effective access through other roles/teams/sharing remains unverified.
- Prepared `register-stage3.ps1` using the supported local CLI. Its inspect-only
  preflight passed. The normal command checks existing registrations before
  retries and saves an ignored local snapshot before generation.
- Added the concrete Stage 3 verification checklist and permission findings to
  `docs/leave-data-model.md` and the command instructions to the scripts README.
- PowerShell parsing, document links and `git diff --check` passed. No generated
  files, application features, records, roles or schema were changed in this
  preflight; lint/build await generation.

**Remaining limitation**

PLANS.md explicitly requires manual permission configuration before Stage 3
registration. Source generation is pending that owner action or an explicit
change to the order. No claim of completed registration or enforced admin-only
access is made, and no deployment, import, commit or push was performed.

### 2026-10-21 — Activate Leave ledger duplicate prevention (Stage 2)

**Request / business outcome**

Complete Stage 2 of the approved Leave schema plan in the existing Dev
environment, preventing duplicate employee credit operations while preserving
the existing data and manually managed permissions.

**Changes**

- Created `a365_EmployeePeriodKey` on Employee + Period Key and
  `a365_EmployeeTransactionKey` on Employee + Transaction Key in
  `a365_leavecredittransaction`, within `A365_DailyOperations`.
- Added scoped CLI key payloads and creation/read-only verification commands
  under `scripts/leave-schema/`. Creation checks first, reuses compatible keys,
  waits for metadata propagation and index activation, and stops without
  deleting or changing records if a conflict or failure occurs.
- Updated `docs/leave-data-model.md` with actual key names, Active statuses,
  null-key limitations and the exact manual role checklist. Saved a separate
  Stage 2 read-back in `docs/leave-schema-stage2-verification.json`, preserving
  the historical Stage 1 evidence.
- Exported/unpacked the official unmanaged solution. Pulled only the generated
  ledger `Entity.xml` after verifying its only changes were the two key
  definitions; preserved unrelated solution files and concurrent Payroll work.

**Verification**

- Initial live preflight: zero ledger records and zero existing alternate keys;
  key column types, lengths, required levels and disabled column security passed.
- Both composite keys read back as Active together in the final snapshot;
  neither text column is globally unique on its own.
- Reverified all nine business lookup targets, their five parent/table GUID
  primary IDs, navigation properties and Restrict Delete behavior.
- All three Leave tables remain empty. No employee/payroll data, business
  records, roles, environment settings or application features were written.
- `complete-stage2.ps1 -VerifyOnly`: passed with no Dataverse writes.
- Official solution export/unpack and local `pac solution pack`: passed.
- PowerShell/JSON/XML parsing, documentation links and contradiction scans,
  and `git diff --check`: passed. No runtime or generated Code App source changed;
  lint/build are required again for Stage 3 generated-code changes.

**Remaining limitations**

- Period Key is optional; null participating values bypass key uniqueness.
  Later operations must validate Employee and Transaction Key and reuse the
  original Transaction Key for retries. ApplicationRequired metadata alone
  does not replace server/service validation.
- Keys do not make multi-record operations atomic or prevent concurrent credit
  overspending; business operations remain future work.
- The owner must configure the documented permissions manually; effective
  Admin/Employee access remains unverified. Environment-wide auditing remains
  disabled as previously inspected and was not changed.
- Stage 2 is complete. Per `PLANS.md`, Stage 3 data-source registration awaits
  confirmation that manual permissions have been configured. No app deployment,
  solution import, commit or push was performed.

### 2026-10-21 — Create Leave Management schema (Stage 1)

**Request / business outcome**

Create the three documented Leave tables directly in the confirmed Daily
Operation Dev environment and verify their links to existing Employee and User
records, including parent primary keys.

**Changes**

- Created `a365_leave`, `a365_leavecashconversion` and
  `a365_leavecredittransaction` in the existing `A365_DailyOperations` unmanaged
  solution under publisher `Automations365` / prefix `a365`.
- Created 39 specified columns and nine business relationships, using the
  existing Employee/User keys and the new Dataverse-generated Leave/Conversion
  keys. All business relationships use Restrict Delete and NoCascade for the
  other checked cascade actions.
- Enabled and verified auditing on the new tables and specified columns;
  preserved the disabled environment-wide auditing setting.
- Let Dataverse allocate local choice integers, then configured and verified
  the Issued, Recorded and Not sent defaults using the returned values.
- Added reviewable schema payloads and CLI completion/verification/pull commands
  under `scripts/leave-schema/`, and updated `docs/leave-data-model.md` with the
  actual schema, keys, relationships, choices and stage limitations.
- Saved live read-back evidence in `docs/leave-schema-verification.json`.
- Exported/unpacked the actual unmanaged solution and pulled only the new
  entity definitions and their generated relationships/manifest entries into
  `solution/A365_DailyOperations/src`. Preserved unrelated working-tree changes,
  Payroll entity definitions and security-role source files.

**Verification**

- Full custom-table inventory: 549 definitions inspected before creation;
  no conflicting Leave candidates or additional metadata page.
- Live verification passed for all three tables, their generated GUID primary
  keys, UserOwned ownership, primary names, all 39 specified column types and
  required levels, lengths/bounds/precision, Date Only behavior/format, local
  choices/defaults and audit flags.
- All nine business lookup targets, parent primary keys, case-sensitive
  navigation properties and cascade settings passed read-back verification.
- All three tables belong to the intended solution and contain zero records.
- `complete-stage1.ps1 -VerifyOnly`: passed without Dataverse writes.
- Official unmanaged export/unpack: passed. Local `pac solution pack` of the
  updated solution source: passed.
- `npm.cmd run lint`: passed. `npm.cmd run build`: passed with the existing
  Vite large-chunk warning. No application source was changed by this schema
  task; unrelated concurrent Payroll work was preserved.
- Documentation field coverage, all 15 acceptance rows, relative links and
  `git diff --check`: passed.
- No employee/payroll record writes, sample records, role changes, app feature
  code changes, generated Code App source edits, commits or deployments.

**Remaining limitations**

- Per `PLANS.md`, stopped after Stage 1. The two composite alternate keys await
  Stage 2; primary GUID keys already exist. No duplicate-prevention claim is
  made before those alternate keys are Active.
- Payroll Admin/Employee privileges require the owner's manual configuration
  and effective-access checks. Admin-only access is not claimed as verified.
- Environment auditing remains disabled; enabled table/column flags alone do
  not capture audit history.
- Code App data-source registration and generated models/services await Stage
  3 after the owner confirms permissions. No Leave screens or operations exist.
- Accrual/conversion policy, atomic multi-record operations, concurrent balance
  protection, immutable snapshot controls, notifications and Payroll integration
  remain future implementation work.

### 2026-10-21 — Show the payslip comment only for positive other deductions

**Request / business outcome**

Show the Comment field in the employee payroll entry editor only when the
current Other Deductions value is greater than zero.

**Changes**

- Updated `src/features/payroll/payroll-entry-dialog.tsx` to conditionally render
  the label and text area from the current form value.
- Preserved the comment value when the field is hidden and retained existing
  save, calculation, and validation behavior.

**Verification checklist**

- [x] Code review: positive amounts, including decimal amounts, show Comment.
- [x] Code review: zero, blank, and negative amounts hide the label and text area.
- [x] Code review: visibility derives directly from editable form state and updates
  on each amount change; hiding the field does not clear its value.
- [x] `npm.cmd run lint`: passed.
- [ ] `npm.cmd test -- src`: 143 passed, one unrelated Excel export test timed
  out. Retried that file with `--testTimeout=60000`: 18 passed, one failed at
  `payroll-export.test.ts:279` because cell B2 returned an Excel serial number
  (`46314.66666666667`) rather than a `Date`. Export code was not changed.
  Tests required execution outside the sandbox because esbuild could not load
  the Vite configuration with sandbox permissions.
- [x] `npm.cmd run build`: passed with existing large-chunk warnings.
- [x] `git diff --check`: passed.

**Remaining limitations**

- Interactive browser verification has not been performed; no Playwright tests
  are configured in this project. The Vercel React best practices skill requested
  by project guidance was not found in the available skill locations.
- Unfiltered `npm.cmd test` discovers 537 test files in the imported `.agents`
  skill sources and encounters unrelated failures (including `render-alm-plan`
  cases). Stopped that run and scoped the application check to `src`.

### 2026-10-19 — Separate payroll period date fields

**Request / business outcome**

Replace the combined payroll period range picker with separate Start date and
End date fields, keep Pay date linked to End date until manually edited, and
prevent selecting an End date earlier than Start.

**Changes**

- Added separate single-date pickers and live period-name preview to the New
  Payroll Period dialog.
- Added pure date-linking and validation helpers, plus unit coverage for date
  changes, disabled dates, and one-day periods.
- Disabled earlier dates in the End calendar and exposed their disabled state
  accessibly.
- Preserved the existing semi-monthly Start and End defaults per the user's
  clarification. Pay date starts equal to End date.
- Kept the existing date-only ISO values and create payload shape.

**Files**

- `src/features/payroll/create-period-dialog.tsx`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/components/ui/date-picker.tsx`
- `src/components/ui/calendar.tsx`

**Verification**

- Unit tests: 120 passed across 15 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- No `pac code push` was run; deployed behavior remains unverified.

---

### 2026-10-19 - Simplify payroll period status flow

**Request / business outcome**

Use Processing -> Ready -> Locked. Keep Unlock. Defer the one-time data
migration as requested.

**Changes**

- Added one payroll period status module for transitions, labels, badge tones,
  editability, finalization, and employee visibility.
- New periods start explicitly in Processing. Old stored pre-flow values are
  normalized to Processing or Locked in the app until the deferred migration;
  no Dataverse rows or choice metadata were changed.
- Ready makes payslips visible in My Payroll, after checking included entries
  have calculation timestamps and all entries are owned by their linked users.
  These checks run before the status update and make no writes on failure.
- Mark as Paid now sends one update setting Locked and both Paid/Locked audit
  stamps. Removed the separate Lock action; Unlock remains available from
  Ready and Locked and hides the payslip from the app list when it returns to
  Processing.
- Updated dashboard cutoff selection, previous-cutoff selection, template
  eligibility, employee visibility, status badges, and empty-state wording.
- Kept Archive behavior and payroll calculations unchanged.

**Files**

- `src/features/payroll/period-status.ts`
- `src/features/payroll/period-status.test.ts`
- `src/features/payroll/types.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/services/payroll-service.ts`
- `src/features/payroll/services/my-payroll.ts`
- `src/features/payroll/services/my-payroll.test.ts`
- `src/features/payroll/services/overview-service.ts`
- `src/features/payroll/services/overview-service.test.ts`
- `src/features/payroll/services/payroll-template-service.ts`
- `src/features/payroll/services/payroll-template-service.test.ts`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/features/payroll/period-audit.test.ts`
- `src/features/payroll/payroll-status-badge.tsx`
- `src/features/payroll/hooks/use-my-payroll.ts`
- `src/features/payroll/hooks/use-payroll-status.ts`
- `src/pages/my-payroll.tsx`
- `src/pages/overview.tsx`
- `src/pages/payroll-period.tsx`
- `src/pages/payroll-templates.tsx`
- `src/pages/payslip.tsx`

**Verification**

- Unit tests: 123 passed across 16 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- The migration was deferred and no Dataverse changes were made. Keep old
  choice values available while existing rows still use them; remove unused
  choices and refresh the generated data source after deciding how to handle
  those rows.
- No `pac code push` was run; deployed behavior remains unverified.

---

### 2026-10-19 - Remove Employee link precondition from Mark Ready

**Request / business outcome**

Remove the new validation that blocked Mark Ready when Employee-to-user links
were missing or payroll entry ownership differed.

**Changes**

- Mark Ready still requires all included entries to have calculated results.
- Removed Employee system-user link and Payroll Entry owner matching checks.
- No Dataverse security settings or record ownership were changed.

**Files**

- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/types.ts`

**Verification**

- Targeted service tests: 5 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- Dataverse record ownership and permissions remain responsible for employee
  payslip access.

---

### 2026-10-19 - Display the finalized status as Paid

**Request / business outcome**

Show Paid instead of Locked as the final payroll status.

**Changes**

- Status labels now display Paid for the internally locked/finalized state,
  including existing legacy finalized values.
- Kept the Dataverse status value, lock behavior, and Unlock transition intact;
  no schema change or migration was performed.

**Files**

- `src/features/payroll/period-status.ts`
- `src/features/payroll/period-status.test.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/features/payroll/payroll-status-badge.tsx`

**Verification**

- Targeted status tests: 30 passed across 2 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- None.

---

## Future entries

Append one dated section per completed Payroll enhancement using this outline:

```markdown
### YYYY-MM-DD — Short enhancement title

**Request / business outcome**

**Changes**

**Files**

**Verification**

**Remaining**
```

### 2026-10-20 — Export a payroll period to Excel

**Request / business outcome**

Let Payroll Admins download one payroll period's loaded details as a formatted
Excel workbook.

**Changes**

- Added an admin-route-only Export button beside Archive with progress and
  success/error feedback.
- Added a `Details` workbook with the requested 22 columns, real date cells,
  peso-formatted numeric values, filtering, frozen headers, and formula totals.
- Enriched loaded entry rows with employee number and department name; workbook
  totals use included entries to match the page summary cards.
- Pinned ExcelJS to 4.4.0 and kept it in a separately loaded Vite chunk.

**Files**

- `package.json`
- `package-lock.json`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/types.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/employees/reference-service.ts`

**Verification**

- Export and payroll-service tests: 12 passed.
- App `src` tests: 131 passed across 17 files.
- `npm run lint`: passed.
- `npm run build`: passed; ExcelJS emitted as its own async chunk. Vite still
  reports large chunks for ExcelJS and the existing PDF assets.
- `git diff --check`: passed.

**Remaining**

- The published Power Apps player download path has not been exercised. Verify
  the download and workbook in the published app before relying on it.
- Deployment was not run; the Code Apps CLI requires separate confirmation.
- npm's post-install audit still reports five advisories, including critical
  findings in the existing Vitest/tinypool toolchain and a moderate finding in
  ExcelJS's uuid dependency. No breaking audit fix was applied.
- A workspace-wide Vitest run discovered unrelated skill-source tests with
  failures. The app's complete `src` test suite passes independently.

### 2026-10-20 — Put requested fields first in Excel export

**Request / business outcome**

Show Period, Start, End, Pay date, Status, and Department as the first six
columns in the payroll workbook, in the requested order.

**Changes**

- Moved Department into the sixth position; remaining payroll columns follow.
- Updated the export test's expected header order.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`

**Verification**

- Focused export tests: 6 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- The workbook download path in the published Power Apps player remains
  unverified.

### 2026-10-20 — Fix export status filtering and use full detail by default

**Request / business outcome**

Include payroll periods with legacy status values in date-range exports and
remove the detail-level choice so every export uses the established Full
detail column set.

**Changes**

- Normalize period status values before comparing them with the selected
  Processing, Ready, and Paid filters. This includes older Dataverse choice
  values that already display as their current status labels.
- Removed Summary and Custom detail-level controls. The export now always uses
  the existing Full detail columns; optional bank details remain excluded by
  that preset.
- Added regression coverage for a September 30 period with a legacy Processing
  status and for the full-detail-only dialog.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/payroll-export-dialog.test.tsx`

**Verification**

- `npm run lint`: passed.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vitest and Vite build could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config.

**Remaining**

- A period with no payroll rows matching the selected department remains
  excluded by the existing department filter.

### 2026-10-20 — Simplify payroll export details and add quarter browsing

**Request / business outcome**

Remove duplicate Status and Department detail columns, allow Payroll to be
browsed by quarter, and limit each page to six periods.

**Changes**

- Removed the repeated Status and Department columns from the single-period
  and per-period Details sheets. The report header still shows both values.
- Added a Quarter 1–4 filter based on payroll period start date, with an
  All quarters option. It filters both active and archived period lists.
- Set active and archived period tables to six rows per page and reset their
  page position when the quarter changes.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll.tsx`

**Verification**

- `npm run lint`: passed with one existing React hook dependency warning,
  addressed in this change. The final lint run passed without warnings.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vite build could not complete because the sandbox denies access to the
  workspace parent directory while Vite resolves its config. Runtime export
  tests were not run.

**Remaining**

- Quarter filtering applies across all years and uses the period start date.

### 2026-10-20 — Configure payroll Excel exports (Phase 2)

**Request / business outcome**

Let payroll admins choose a detail level and column groups, then download a
two-sheet workbook with a period summary and selected payroll details.

**Changes**

- Replaced immediate export with an accessible dialog using the existing
  Radix-backed dialog, button, label, and checkbox components.
- Added Summary, Full detail, and Custom presets, a single column/group
  configuration, a live employee/period/column count, and the filename preview.
- Added the sensitive-data warning when Bank details is selected. Bank name
  and account number are mapped from the employee records already loaded for
  the period.
- Added Summary and Details sheets. The Summary sheet contains period dates,
  status, employee count, included-entry totals, and export actor/time; Details
  reflects the selected columns and retains its totals row and filters.
- Used the signed-in Power Apps host name for “Exported by”.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export-dialog.test.tsx`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/types.ts`
- `src/pages/payroll-period.tsx`

**Verification**

- App `src` tests: 136 passed across 18 files, including export selection,
  workbook content, dialog interaction, and employee bank-field mapping.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports large chunks for ExcelJS and PDF assets.
- `git diff --check`: passed.

**Remaining**

- The app has not been pushed to the Power Apps environment. The published
  Power Apps download path remains unverified.

### 2026-10-20 — Extend Excel export to multiple periods and filters

**Request / business outcome**

Continue the staged payroll export with list-page multi-period exports and
filtering while preserving the existing workbook and column-group behavior.

**Changes**

- Added period-batched export entry loading with Dataverse continuation-token
  paging and employee/department enrichment through existing services.
- Added row export buttons for active and archived periods, active-period
  selection, selection export, and an all-period export entry point.
- Added combined and per-period workbook layouts, period sheet-name cleanup,
  multi-period summary rows, and multi-period filename generation.
- Added pay-date, status, archived, department, and currently-visible employee
  filters to the existing dialog. The filters operate on the periods loaded for
  that export and do not mutate saved payroll data.
- Added pure helpers and tests for filtering, sheet names, and period row sets.
- Removed an existing payroll-entry diagnostic log that included comment text.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/types.ts`

**Verification**

- `npm run lint`: passed after the latest changes.
- `npx tsc -b --pretty false`: passed.
- Vite build and Vitest could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config. No test
  results are available for this change.

**Remaining**

- The existing audit is period lifecycle stamps (Ready/Paid/Locked actor and
  date fields), not an append-only event record. Export event auditing remains
  omitted as requested because there is no suitable data source.
- The list-page export is available through row actions, selected periods, or
  the all-periods action. The dialog's date range filters the periods already
  loaded for that action.
- Power Apps deployment and in-player downloads have not been verified.

### 2026-10-20 — Complete available Stage 5 Excel export safeguards

**Request / business outcome**

Finish Stage 5 where the app has a suitable data source, leaving export audit
records out because no appendable audit source exists.

**Changes**

- Added a Payroll Admin check in the export page handlers and workbook dialog.
- Warned in the dialog and Summary sheet when exported periods are not in the
  final Locked/Paid status; retained a Status column in each Details layout.
- Added a Continue/Cancel warning above 5,000 detail rows and progress feedback.
- Yielded to the browser while writing large detail sets to keep the interface
  responsive and prevented duplicate workbook generation.
- Set workbook title and creator, restored focus after dialog close, and gave
  the notification region an explicit accessible label.
- Added unit coverage for final, mixed, non-final, archived, and 5,000-row
  boundary behavior.
- Left export audit persistence out: the existing period lifecycle stamps
  cannot store repeated export events or employee counts.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/providers/sonner-provider.tsx`

**Verification**

- `npm run lint`: passed.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vitest and Vite build could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config.

**Remaining**

- Export auditing requires a confirmed Dataverse event data source and schema.
- Power Apps deployment and in-player download behavior remain unverified.

### 2026-10-20 — Match the payroll workbook report layout

**Request / business outcome**

Adjust the Excel sheet to match the supplied example, with period details above
the employee table.

**Changes**

- Added Period and Status on the first row, then Pay date and Department on the
  second row, followed by a spacer and the employee payroll headers.
- Moved Department out of each detail row and summarized the distinct
  departments represented in the exported entries in the report header.
- Kept filters on the employee table, froze the four header rows, and moved
  totals to the bottom of the new layout.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll-period.tsx`

**Verification**

- Focused export tests: 6 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- The workbook download path in the published Power Apps player remains
  unverified.

### 2026-10-20 — Limit payroll period select-all to the current page

**Request / business outcome**

Make the active-period table's header checkbox select only the periods visible
on the current page, so the selection count matches the user's action.

**Changes**

- Updated the header checkbox to select or clear only the visible active
  periods. Periods selected on other pages remain selected when changing the
  current page.
- Updated the accessible label to describe the current-page behavior.

**Files**

- `src/pages/payroll.tsx`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-20 — Add year filtering and remove the all-period export action

**Request / business outcome**

Remove the global Export all periods button and let admins filter payroll
periods by year and quarter together.

**Changes**

- Removed the global all-period export button. Per-row and selected-period
  exports remain available.
- Added a year selector whose options come from the loaded active and archived
  payroll periods. Year and quarter filters work together on both lists.
- Changing either filter clears period selections and returns both tables to
  their first page.

**Files**

- `src/pages/payroll.tsx`
- `src/features/payroll/period-utils.ts`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Year options reflect periods currently loaded in the app.

### 2026-10-20 — Export selected periods without a configuration modal

**Request / business outcome**

Remove the export configuration modal because periods are already chosen in
the table, while retaining both requested workbook layouts.

**Changes**

- Replaced the modal with direct export actions for one combined Details sheet
  or one Details sheet per selected period.
- Exports use exactly the checked periods and the existing full-detail column
  set. Single-row export actions continue to export that period directly.
- Removed the same configuration modal from the payroll period detail page;
  its Export action now downloads that period's full-detail workbook directly.
- Kept non-final warnings visible beside selected periods and in the workbook
  summary. Single-row exports also show a warning toast before download.
- Kept the 5,000-row safeguard as an inline Continue/Cancel prompt, and kept
  progress, admin, filename, and workbook property behavior in the page handler.
- Removed the unused export dialog component and its tests.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export-dialog.tsx` (removed)
- `src/features/payroll/payroll-export-dialog.test.tsx` (removed)

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Export audit entries remain unavailable because there is no confirmed audit
  data source, as documented in the Stage 5 completion entry.

### 2026-10-20 — Include both detail layouts in one Excel export

**Request / business outcome**

Keep one Export to Excel action and include both requested detail layouts in
the downloaded workbook.

**Changes**

- Replaced the two layout-specific export buttons with one Export to Excel
  button for selected periods.
- Every workbook now contains a combined Details sheet and separate
  period-named detail sheets, alongside the Summary sheet. A single-period
  workbook keeps its existing Summary and Details sheets because both layouts
  are equivalent for one period.

**Files**

- `src/pages/payroll.tsx`
- `src/features/payroll/payroll-export.ts`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-20 — Align export and clear actions

**Request / business outcome**

Place Export to Excel beside Clear in the selected-period action bar.

**Changes**

- Moved Export to Excel into the right-aligned action row beside Clear.
- Kept the non-final period warning below the action row.

**Files**

- `src/pages/payroll.tsx`

**Verification**

- `npm.cmd run lint`: passed.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-21 — Preview payroll totals while editing

**Request / business outcome**

Show the effect of unsaved payroll input changes immediately in the entry
editor's earnings, deductions and net pay breakdown.

**Changes**

- Added a live, explicitly unsaved preview driven by the existing calculation
  engine and the current form inputs, including the other-deduction reason.
- Load the linked employee and the statutory configuration effective at the
  cutoff end date through TanStack Query. Typing recalculates locally without
  further requests or writes.
- Share numeric input conversion between the preview and Save. Existing salary
  basis, statutory rules, unpaid-leave calculation and rounding remain intact.
- Show loading, missing-employee, invalid-input and configuration-error states
  instead of stale saved totals; offer retry for failed dependency reads.
- Disable saving until a valid preview is available and prevent input changes
  during a save. Cancel discards edits; failed saves retain them.
- Preserved the existing working-tree change that shows Comment only when
  Other Deductions is greater than zero.

**Files**

- `src/features/payroll/payroll-entry-dialog.tsx`
- `src/features/payroll/payroll-entry-dialog.test.tsx`
- `src/features/payroll/hooks/use-entry-preview.ts`
- `src/features/payroll/hooks/use-statutory-config.ts`
- `src/features/payroll/services/payroll-entry-preview.ts`
- `src/features/payroll/services/payroll-service.ts`

**Verification checklist and results**

- [x] Reproduced the stale deduction/net-pay bug with a failing regression test
  before implementation.
- [x] All six numeric inputs update the breakdown before saving, including
  fractional unpaid-leave days and the existing money-rounding sequence.
- [x] Changing Other Deductions from 5,000 to 2,000 changes net pay from 34,400
  to 37,400 in the screenshot-equivalent test fixture.
- [x] Comments follow the unsaved values and disappear with the zero-deduction
  row; empty numeric inputs follow the existing zero-on-save behavior.
- [x] Typing performs no saves or repeated dependency fetches; closed editors
  do not fetch preview dependencies.
- [x] Save receives the edited inputs; Cancel/reopen restores saved values;
  a failed save retains the draft. Previewing does not mutate the saved entry.
- [x] Loading, retry, missing employee, invalid negative input and entries
  without saved calculations are covered by regression tests.
- [x] All 16 new dialog regression tests pass in the application test run.
- [x] `npm.cmd run lint` and `npm.cmd run build` pass. Vite reports its existing
  large-chunk warnings.
- [x] `git diff --check` passes.
- [ ] Entire test suite green: `npm.cmd test -- src` reports 159 passing tests
  and one unrelated failure in `payroll-export.test.ts:279` (Excel date read
  back as a numeric serial instead of a Date). Unfiltered `npm.cmd test` also
  discovers unrelated failing tests inside imported `.agents` skill sources;
  that unfiltered run was stopped after these failures were established.
- [ ] Browser/Power Apps runtime verification: no application Playwright suite,
  Playwright package or Playwright CLI is installed; the live app was not
  deployed or tested in this task.

**Remaining**

- Resolve the unrelated export/imported-skill test failures separately.
- Verify the editor in the Power Apps host after deployment. Save reloads
  employee/configuration data, so external changes between preview and Save
  can affect the final calculation.

### 2026-10-21 — Select and export archived payroll periods

**Request / business outcome**

Align archived payroll export actions with the active table and allow batch
export of selected archived payrolls.

**Changes**

- Moved each archived period's Export button into the rightmost cell beside
  Unarchive and displayed the requested `Action` header on both tables.
- Added archived row checkboxes and a select-all checkbox for the current page,
  including a mixed state when only some visible periods are selected.
- Added an archived selection count and right-aligned Export to Excel / Clear
  actions matching the active table. Active and archived selections are independent.
- Reused the existing export handler, workbook layouts, progress indicator,
  access checks, non-final warnings and large-export confirmation.
- Preserve selections across pagination; clear them when year/quarter filters
  change, and remove a period from its selection after archive/unarchive succeeds.
- Added accessible table names and an archived-selection region label.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll.test.tsx`

**Verification checklist and results**

- [x] Visible `Action` headers and Export beside Unarchive verified by UI tests.
- [x] Batch export receives exactly the checked archived periods, independently
  of active selections, and uses their stored payroll values.
- [x] Select-all affects only the current page; other-page selections persist.
- [x] Partial selection, independent Clear, individual row export and selection
  cleanup after restoration pass regression tests (6 new tests total).
- [x] Year/quarter handlers inspected: both selection sets and pending export
  confirmation are cleared, and both tables return to their first page.
- [x] `npm.cmd test -- src`: 165 passed, 1 existing unrelated export test failed
  at `src/features/payroll/payroll-export.test.ts:279` (numeric Excel date serial
  read back instead of a Date). All new archived-export tests pass.
- [x] `npm.cmd run lint` and `npm.cmd run build` pass; existing Vite large-chunk
  warnings remain.
- [x] `git diff --check` passes.
- [ ] Browser/Power Apps host verification remains outstanding: no application
  Playwright suite or installed Playwright tooling; no deployment performed.

**Remaining**

- Existing Excel date round-trip test failure remains outside this UI change.
- Verify the layout in the Power Apps host after deployment.

### 2026-10-21 — Align Action headers with their buttons

**Request / business outcome**

Center the Action column headers over the row actions in both payroll tables.

**Files / changes**

- `src/pages/payroll.tsx`: gave both Action columns the same width and centered
  their headers and row buttons on the same axis.

**Verification**

- Confirmed matching header/cell alignment in both active and archived tables.
- Existing payroll page regression tests: all 6 passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed with existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Visual verification in the Power Apps host after deployment; not deployed.

### 2026-10-21 — Correct exported departments, dates and worksheet names

**Request / business outcome**

Put Department in the employee detail table, show the saved Pay Date as a date
matching the app, and include Payroll in worksheet names.

**Files / changes**

- `src/features/payroll/payroll-export.ts`: removed the Department label/value
  from the metadata area and retained Department as a per-employee table column
  in single-period and batch period sheets.
- Named sheets `Payroll Summary`, `Payroll Details`, and `Payroll <period>`;
  retained sheet-name sanitization, the 31-character limit and deduplication.
- Normalize exported calendar dates to UTC midnight so Excel preserves the
  date shown in the app instead of shifting local midnight to the previous day.
- Apply the merged Pay Date cell's date format after amount-column formatting,
  including reduced/custom exports with money columns occupying B/C.
- `src/features/payroll/payroll-export.test.ts`: updated layout expectations and
  added date, batch export, custom column and missing-pay-date regressions.

**Verification checklist and results**

- [x] Reproduced the worksheet/layout mismatch and calendar-date shift before
  implementation.
- [x] Department is absent from the metadata area and correctly populated for
  each employee, including different departments within the same period.
- [x] Exported Pay Date uses `a365_paydate`, including fixtures where it differs
  from the period end, and has the `mmm d, yyyy` date format after XLSX reload.
- [x] Missing Pay Date stays blank; no cutoff-end fallback is invented.
- [x] Summary, combined details and individual period sheets use Payroll names.
- [x] Detail totals, included-row behavior, filters and optional bank columns
  remain covered by workbook tests.
- [x] All 24 workbook tests and all 171 application tests (`npm.cmd test -- src`)
  pass. This also resolves the Excel date round-trip failure reported in earlier
  entries.
- [x] `npm.cmd run lint`: passed.
- [x] `npm.cmd run build`: passed with existing large-chunk warnings.
- [x] `git diff --check`: passed.

**Remaining**

- Visual verification in Excel and the Power Apps host after deployment;
  workbook checks reload actual generated XLSX files through ExcelJS.
- No deployment performed. Unfiltered test discovery of imported skill-source
  tests remains a separate existing limitation; application tests are green.
