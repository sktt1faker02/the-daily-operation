# Partially paid leave — 2026-10-28

Owner decision: keep one Issued leave record. Apply available credits to the
earliest workdays, record the remainder as unpaid, and count only those unpaid
dates in the matching payroll cutoff. Explicit Unpaid requests remain unpaid.

Status: owner approved the Dev setup on 2026-10-28. The schema is published,
generated Leave source refreshed, and signed Leave plugin 1.0.3.2 deployed.
The live app-equivalent query returns 22 records for 2026; an existing detail,
payroll reads, own personal history and five-workday preview pass. Evidence:
[live verification](partial-paid-leave-verification.json). Existing financial
records and roles are unchanged. Manual UAT remains with the owner.

## Verification checklist

Checked items below are verified with automated/synthetic checks and source
review. Actual Dataverse transactions, concurrency and user-account UAT are not
claimed as live-verified.

- [x] Four credits and five workdays produce one Issued / Partially Paid record,
  four paid days, one unpaid day and a four-day ledger debit.
- [x] Sufficient, zero, negative and fractional balances are handled; explicitly
  Unpaid requests never spend credits. VL, SL and Emergency retain their pools.
- [x] Preview and transactional issuance share the same allocation; retries reuse
  the original snapshot, concurrent posts retain the existing employee lock.
- [x] Stored per-date allocation excludes weekends/holidays and survives later
  policy changes; fractional credits cover the earliest part of a workday.
- [x] Payroll counts only unpaid portions inside each cutoff, once; cancelled and
  other employees' leave is ignored. Invalid/incomplete allocations fail closed.
- [x] Existing Paid/Unpaid records retain their original treatment. No historical
  leave, existing payroll entries or finalized payslips are recalculated.
- [x] Admin and personal tables/details, filters and notification emails show
  Partially Paid and the day breakdown. Personal access stays employee-scoped.
- [x] Older server/client combinations cannot silently save an unreviewed split.
- [x] Automated tests, plugin checks, lint, build and relevant browser checks pass.
- [ ] Owner performs live/manual UAT after the schema/plugin/app release.

## Deployed Dev schema contract

Initial metadata inspection found only Paid and Unpaid, without allocation
fields. The owner subsequently approved these additions to `a365_leave` /
`a365_leaves`; exact logical names, precision, audit flags and labels have been
read back from Dev:

| Component | Definition |
| --- | --- |
| `a365_benefit` | Add Partially Paid, value `749910002`; retain existing values |
| `a365_PaidDays` / `a365_paiddays` | Decimal, precision 2, minimum 0, maximum 366, optional, no default |
| `a365_UnpaidDays` / `a365_unpaiddays` | Decimal, precision 2, minimum 0, maximum 366, optional, no default |
| `a365_AllocationJson` / `a365_allocationjson` | Multiline plain text, maximum length 100000, optional |

New issuance stores all three fields atomically with the source and credit debit.
Allocation JSON is `{ "version": 1, "days": [{ "date": "2026-10-26",
"paidDays": 1, "unpaidDays": 0 }] }`. Each counted workday totals one day;
credit fractions use two decimal places. This is an immutable issuance snapshot,
not a calculated field. Legacy records leave all three fields empty.

## Release procedure

Steps 1–3 are complete in Dev. No hosted Code App push was performed; the local
app uses the refreshed generated source. For another environment, confirm its
target/solution and obtain approval before applying changes.

Subsequent admin view/delete actions use Leave plugin 1.0.3.3; see
[Leave actions](leave-record-actions.md). The 1.0.3.2 evidence below records the
original allocation release and remains historical.

1. Confirm the target environment and existing Daily Operations solution. In that
   solution, add the option and columns above to Leave; publish. Do not change
   roles, ownership/sharing, old records or existing choice values. Include the
   new columns in the existing audit configuration where appropriate.
   The current project target is Dev, `https://org9a7651f0.crm5.dynamics.com/`,
   environment `b58b083e-d27d-eabd-a143-2a49dcb9d89a`, solution
   `A365_DailyOperations`; reconfirm before changes.
2. Refresh the Leave data source with the installed Power Apps CLI:
   `npx --no-install pa app add data-source --connector dataverse --table a365_leave`.
   Review generated names/types; generated files must be produced by tooling.
3. Run `scripts/leave-schema/build-posting.ps1`, then update the existing signed
   Leave plugin assembly using the established release procedure. Preserve all
   current registrations and guards. Pull/export the updated solution metadata.
4. Run the automated checks and build, then deploy the Code App with approval.
   Schema, plugin and app are a coordinated release; do not publish the app
   against a schema that does not contain these required columns.
5. Manually verify the checklist with authorized test users. In particular,
   verify direct employee isolation and direct-write rejection, plus a leave
   spanning two payroll cutoffs. Use a new Processing payroll or its explicit
   unpaid-leave refresh; do not alter finalized payroll for this test.

No migration is needed. Existing fully unpaid requests remain fully unpaid.
Correcting historical financial records requires a separately authorized process.

The missing schema caused the initial Leave Management read error. Installing
the approved fields fixed the actual failing query. New clients require the
allocation-aware server; older clients cannot issue an unreviewed split.

## Automated evidence

### Follow-up: restore records and complete the approved rollout

Owner authorized the previously requested Dev schema/plugin setup. Verification
checklist: confirm the target; add and read back the exact proposed metadata;
refresh the generated Leave source; update the signed plugin; verify actual
record reads, read-only preview and personal history; export changed metadata;
run application checks. All these steps passed; no financial test records or
emails were created. `verify-posting.ps1` also confirms all 20 live synchronous
write guards remain active. The native solution was exported and only the new
Leave fields/benefit and Leave assembly references synced back to source.


- `npm test -- --maxWorkers=2 --testTimeout=60000`: 434 tests in 43 files pass.
- `npm run lint` and `npm run build`: pass; existing large-chunk warning remains.
- `build-posting.ps1`: signed assembly 1.0.3.2 builds locally. The following local
  scripts pass: `test-posting-rules.ps1` (48), `test-partial-paid.ps1` (35),
  `test-personal-reads.ps1` (24), `test-write-guard.ps1` (19) and
  `test-conversions.ps1` (56). No live records are created by these checks.
- Synthetic Edge checks: `leave-ui-check.mjs` (23),
  `leave-history-ui-check.mjs` (12), `payroll-unpaid-ui-check.mjs` (7).
  The admin harness needed its missing `buildLeaveFilter` mock export and
  obsolete Credit History/Cash Conversions tab assertions updated before passing.
- Browser requests to external origins are blocked. Payroll's split scenario
  reads the actual allocation through the generated-service mock and saves an
  unpaid count of 1, leaving gross/net formulas unchanged.
- `partial-paid-schema.ps1`: idempotent, scoped schema preflight/apply procedure;
  metadata propagation retries repeat reads only.
- `verify-partial-paid.ps1`: actual list/detail, payroll, own-history, balance and
  five-workday allocation preview checks, without issuance or email.
- `pull-partial-paid-source.ps1`: imports native metadata nodes and verifies the
  exported DLL hash matches the deployed/local signed assembly. It preserves
  unrelated components and reads source XML as UTF-8.
- Remaining: manual owner UAT, ordinary-account security checks and live
  concurrent-spend/transaction rollback tests. Hosted Code App deployment is not
  included in this backend setup.
