# Unpaid Leave to Payroll — 2026-10-22

The latest owner request extends the earlier new-entry-only rule to the existing
Processing entry editor. Opening the editor previews matched Leave days without
writing; Save explicitly persists inputs/results through the existing service.

Verification checklist before editing:
- [ ] Issued Unpaid records only, matching employee and inclusive cutoff overlap.
- [ ] Weekends/approved holidays excluded; single-day 0.5 supported; no duplicate
  source records or incomplete paging silently inflate/understate totals.
- [ ] Load employees, copy previous and load template replace new-entry unpaid
  inputs with the new cutoff's derived value (never copy old cutoff results).
- [ ] All required reads succeed before entry-creation writes; failure is visible.
- [ ] Existing Processing editor shows October 22–23 as 2 days for October 16–31;
  existing calculation preview responds; Save applies, Cancel writes nothing.
- [ ] Manual adjustment stays possible and is not overwritten during editing.
- [ ] No Ready/Locked refresh, payroll formula change, leave-note copy or background
  existing-entry sync. No live financial test writes, deployment or email.
- [ ] Targeted and full application tests, lint, build and relevant browser checks.
