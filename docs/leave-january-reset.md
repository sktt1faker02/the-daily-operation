# January leave-credit reset

Latest owner correction, 2026-11-03: annual reset on **January 1**, starting
**January 1, 2027**, to **10 VL and 5 SL**. This supersedes the October 22
January 5 decision, including the old January 5-January 4 cycle boundaries.

Local implementation:

- Effective date January 1, 2027; new cycles run January 1-December 31.
- The transitional April 2026 cycle ends December 31, 2026.
- Full annual 10 VL / 5 SL allocation replaces monthly VL accrual from that date;
  no previous-period carryover. Before 2027, existing accrual rules remain.
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
subsequent submission. Later normal accrual is unchanged before 2027.

The existing 2027 holiday-coverage restriction remains. This date change does not
claim a complete 2027 holiday calendar or update finalized payroll/leave snapshots.

Release: signed Leave plugin **1.0.3.5** was deployed to owner-confirmed Dev on
2026-11-03. Its hash, live read-only reset preview and unchanged credit count
are verified in [deployment evidence](leave-reset-deployment.json). Native Leave
assembly/step references were synchronized from the actual solution export.
No live balance reset or schema/role changes were performed. January 1 behavior
is covered locally; real-user boundary UAT remains pending. See
[manual reset verification/release notes](leave-manual-reset.md).
