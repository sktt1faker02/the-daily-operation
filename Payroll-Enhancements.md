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
