# January leave-credit reset

Final owner correction, 2026-10-22: reset on **January 5 every year, starting
January 5, 2027**, to **10 VL and 5 SL**. This supersedes April 1 and the
intermediate January 1 request.

Implementation checklist (functional verification left to the owner):

- [x] Effective date: January 5, 2027; current balances retain existing rules until then.
- [x] New entitlement periods run January 5 through January 4 of the following year.
- [x] The transitional April 2026 period ends January 4, 2027.
- [x] Allocate the full 10 VL and 5 SL annually, replacing monthly VL accrual
      from the effective date; retain old accrual rules before that date.
- [x] Scope balances by the period tag, with no previous-period carryover.
- [x] Preserve all existing Leave, deduction and credit-history records.
- [x] Use the same period boundaries for server validation and preview dates.
- [x] Keep eligibility, holidays, insufficient-credit handling and retry safeguards.
- [x] Tag new annual-cycle deductions with the cycle's starting year, including
      January 1–4 deductions that still belong to the preceding cycle.
- [x] Compile and update only the existing signed Leave assembly in Dev.
- [ ] Functional reset/posting/boundary tests: owner verification pending.

Implementation: `plugins/A365.Leave.Plugins/LeaveCommand.cs`; generic credit
wording in the Add Leave dialog; updated expectations in the existing server
policy check script. No functional tests or financial transactions were run.
Existing credit posting catches up during Leave submission, while preview
projects due credits without writing; deterministic per-period grant keys avoid
duplicate grants. This task does not introduce an unattended scheduler or rewrite
historical records. The existing 2027 holiday-coverage restriction remains.
