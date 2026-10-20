# Payroll Enhancements

This file is the ongoing change log for Payroll enhancements. Use
`docs/payroll-task-phases.md` as the template and reference for phase-based
planning; keep dated implementation history here.

## Change Log

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
