# Unpaid Leave to Payroll — 2026-10-22

The latest owner request extends the earlier new-entry-only rule to the existing
Processing entry editor. Opening the editor previews matched Leave days without
writing; Save explicitly persists inputs/results through the existing service.

Verification checklist before editing:
- [x] Issued Unpaid records only, matching employee and inclusive cutoff overlap.
- [x] Weekends/approved holidays excluded; single-day 0.5 supported; no duplicate
  source records or incomplete paging silently inflate/understate totals.
- [x] Load employees, copy previous and load template replace new-entry unpaid
  inputs with the new cutoff's derived value (never copy old cutoff results).
- [x] All required Leave reads succeed before entry-creation writes; failure is visible.
- [x] Existing Processing editor shows October 22–23 as 2 days for October 16–31;
  existing calculation preview responds; Save applies, Cancel writes nothing.
- [x] Manual adjustment stays possible and is not overwritten during editing.
- [x] No Ready/Locked refresh, payroll formula change, leave-note copy or background
  existing-entry sync. No live financial test writes, deployment or email.
- [x] Targeted and full application tests, lint, build and relevant browser checks.

## Verification and behavior

- 266 tests in 27 application test files passed with one worker and a 60-second
  timeout. Integration tests exercise all three population paths, stale copied
  values, zero matching days, lookup failures before writes and Ready protection.
- Five browser scenarios passed in Edge using the actual editor, allocation
  service and calculation preview with synthetic platform boundary responses:
  manual Save, Cancel, read failure, non-editable period and mobile layout.
- Lint and production build passed; existing large-bundle warnings remain.
- The October 22–23 / October 16–31 scenario shows 2.00 days, without writing on
  open. Manual edits remain possible and Save writes through the existing
  save-and-calculate operation; no payroll formula was changed.
- A verified empty Leave result preserves an existing manual input in the
  editor. Explicit Copy/Template operations replace unpaid-day inputs using the
  target cutoff (zero if none), just as they explicitly overwrite other inputs.
- Lookups are employee/date/status/benefit scoped, batched, completely paged and
  select no internal leave notes. Read errors do not become zero-day results.
- No live financial records were created/updated, emails sent, schema/security
  changed, or app deployment performed. Hosted behavior needs verification after
  a separately requested publication. Existing entries are not background-synced.
- Calendar coverage must be complete for records being allocated; inconsistent
  stored leave-day counts fail visibly for review rather than guessing a split.
