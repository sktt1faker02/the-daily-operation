# Active: Build Leave Management in The Daily Operation

## Requirements

- Read `AGENTS.md`, `DESIGN.md`, the full `PLANS.md`, this prompt and
  [leave-data-model.md](leave-data-model.md) before starting. Convert every
  acceptance criterion below into a concrete verification checklist.
- This prompt defines the next application phase. Its Leave feature scope
  supersedes the earlier schema-only prohibition on Leave feature development
  in PLANS.md; the completed table setup must be reused. Follow this prompt's
  application workflow; the completed schema stages in PLANS.md are history.
- This is a Microsoft Power Apps Code App. Preserve its hosting, authentication,
  routing, existing `dataClient` and generated services.
- Use the relevant installed Power Platform skills and MCP Microsoft Learn for
  current documentation. Use Vercel React best-practices guidance if that skill
  is installed; report its absence without inventing a skill or blocking
  unrelated work.
- Work on `feature/leave-module`. Preserve unrelated working-tree changes.
- Reuse the existing UI components, navigation and styling. DESIGN.md currently
  contains Payroll status requirements rather than a complete visual system;
  inspect the implemented application for established visual patterns.
- Keep business rules in the Leave domain, outside presentation components.
  Use TanStack Query for server data and mutations.
- Do not recreate tables, duplicate data sources, hand-edit generated files or
  introduce a second database. Verify live names instead of guessing them.
- Preserve existing Employee records, Payroll calculations and historical
  Payroll data. Do not automatically change an employee's employment status.
- The planned Payroll Admin permissions were explicitly authorized and applied.
  Do not request the same setup approval again. Any additional schema or
  security change needs a concrete justification and authorization covering it.
- Do not create sample records, migrate/delete existing records, enable
  environment-wide auditing, commit, push or deploy unless separately requested.
- Creating this prompt does not start implementation. Follow the workflow below
  when I instruct you to use it.

## Feature: Admin-issued leave, credit history and cash conversion

### Context

The Daily Operation is Automations 365's internal operational hub. Payroll
already exists; the next module is Leave Management.

The Leave tables, relationships, duplicate-prevention keys, Code App data
sources and planned Payroll Admin permissions have been created and verified.
There are no implemented Leave screens or business operations yet.

The existing target is **The Daily Operation - Dev**, environment
`b58b083e-d27d-eabd-a143-2a49dcb9d89a`, at
`https://org9a7651f0.crm5.dynamics.com`. Reuse solution
`A365_DailyOperations` and publisher prefix `a365`.

There is **no approval workflow**. Payroll Admin directly issues and cancels
leave and records cash conversions. Payroll Employees have no Leave access in
this version, including their own Leave records.

### Current problem

The data foundation is ready, but admins cannot yet view leave balances,
record leave, review credit movements or manage cash-conversion records in the
application. Generated CRUD methods alone do not implement the business rules,
safe retries, concurrent spending protection or financial record integrity.

### Existing data sources — reuse these

| Business record | Logical table / entity set | Generated model and service |
|---|---|---|
| Leave | `a365_leave` / `a365_leaves` | `A365_leavesModel.ts`, `A365_leavesService.ts` |
| Leave Cash Conversion | `a365_leavecashconversion` / `a365_leavecashconversions` | `A365_leavecashconversionsModel.ts`, `A365_leavecashconversionsService.ts` |
| Leave Credit Transaction | `a365_leavecredittransaction` / `a365_leavecredittransactions` | `A365_leavecredittransactionsModel.ts`, `A365_leavecredittransactionsService.ts` |

Models and services are under `src/generated/`; schema files are under
`.power/schemas/dataverse/`. The configuration aliases are `leaves`,
`leavecashconversions` and `leavecredittransactions`.

Use the actual field names, choice numbers, primary IDs and relationship
bindings in [leave-data-model.md](leave-data-model.md). The setup evidence is in
[leave-stage3-verification.json](leave-stage3-verification.json),
[leave-schema-stage2-verification.json](leave-schema-stage2-verification.json),
and [leave-permissions-verification.json](leave-permissions-verification.json).
These files document prior verification; inspect live metadata when a new
assumption or change depends on it.

### Investigation first

Before implementing, report:

- The existing routing, navigation, access checks, employee picker, table,
  dialog, loading/error patterns and current-user lookup that can be reused.
- Whether Leave navigation or feature code already exists, to avoid duplicates.
- The three data-source registrations and actual generated fields/bindings.
- Actual role privileges, including other roles/teams that could affect access.
  The previous check verified the two named roles, not every user's effective
  access. Do not infer Leave authority from a missing Employee record or a
  failed role lookup; show a clear loading/error/access-denied state instead.
- The supported approach for saving a Leave/Conversion record and its credit
  movements together, validating changes on the server, handling retries and
  preventing simultaneous requests from overspending the same balance.
- Any additional server component, metadata, operation binding or privilege
  required. Explain its purpose and exact scope before applying an uncovered
  environment change. Do not assume the Code App SDK exposes transactions or
  alternate-key upserts; check the installed APIs and current documentation.
- A requirement checklist showing ready, missing and decision-dependent items.

### Business decisions to confirm

Ask these together in plain language, unless an approved project requirement
already supplies the answer. Record the decisions; do not silently invent
defaults or apply generic employment/legal rules.

1. **Credit entitlement:** How many VL/SL days are granted or earned, when, and
   who qualifies? How are opening balances entered? Are grant/accrual amounts
   manual or automatic? No scheduler or entitlement rate is approved yet.
2. **Counting leave:** Are weekends counted? What about holidays, start/end
   dates and partial days? Are only half-day increments allowed? The field's
   minimum of 0.50 does not enforce 0.50 increments. No holiday table is planned.
3. **Employee eligibility and dates:** Which employees can receive leave? Are
   backdated/future records allowed? What is the policy for overlapping leave?
4. **Emergency leave:** Which credit pool does paid Emergency leave use, and
   what happens when that pool has insufficient credits?
5. **Insufficient credits:** Block the operation or allow a negative balance?
   If negative balances are permitted, define the exact allowed cases/limits.
6. **Year boundaries:** How is leave spanning two years allocated? Do unused
   credits carry forward or expire? Do not implement resets or carryovers by
   assumption. Any multi-year allocation needs compatible unique transaction
   keys as well as an agreed counting rule.
7. **Cash conversion:** Confirm eligibility, permitted year/date, annual total
   limits, whether cancellations free capacity, the daily-rate source/formula,
   amount calculation and rounding. The table's 5-day maximum is per record;
   it does not establish a 5-day annual policy.
8. **Cancellation and correction:** Who can cancel, what dates are allowed,
   whether a reason is mandatory, and how mistaken historical entries are
   corrected. Define how to treat conversion records relating to money already
   paid outside this module; Recorded is not a payment status.

Unanswered policies block their dependent actions, not independent read-only
screens. Do not present an incomplete financial operation as working.

### Expected behavior

1. **Admin navigation and overview.** Add Leave Management using existing
   application patterns. Show employee/year-scoped VL and SL balances and
   provide access to Leave, Credit History and Cash Conversions. Include clear
   loading, empty, error and permission-denied states. An unreadable balance
   must not appear as zero or permit spending.

2. **Leave records.** Provide a searchable, filtered, paged list and a details
   view. Show employee, type, Paid/Unpaid, start/end date, days, Issued/Cancelled,
   note and issue/cancellation actor and time. Preserve Date Only values across
   time zones. Do not add Pending, For Review, Approved or Rejected states.

3. **Issue leave.** After the counting and eligibility decisions are supplied,
   let an admin select an Employee, type, benefit, dates and note. Show the day
   count and credit impact before saving. Save the actual actor/time and Issued
   status. Paid leave deducts the correct approved pool/year allocation; Unpaid
   leave creates no credit deduction. Validate source employee/pool/year
   consistency. Do not overwrite an issued record to correct it silently.

4. **Balances and credit history.** Calculate balances from signed credit
   transactions, grouped by Employee + Credit Pool + Year. Grants/accruals and
   restorations are positive; leave and conversion deductions are negative.
   Show dated movements, type, days, source record and note. Do not add a mutable
   balance column, annual reset records or unexplained opening balances. Never
   calculate a complete balance from only the first page of results; use
   supported aggregation or fully paged, appropriately scoped reads.

5. **Grants/accruals.** Implement only the confirmed entitlement policy and
   mechanism. Manual entry, if chosen, requires validation and a meaningful
   record of why the credit was added. Automatic scheduling remains excluded
   unless separately requested. Do not invent a new credit transaction type.

6. **Cash conversion.** After the policy is confirmed, show balance, permitted
   days, the approved daily rate and amount before confirmation. Preserve Year,
   Days, Daily Rate Used, Amount, Converted By/On and Recorded status as a
   historical snapshot. Create the corresponding negative VL transaction
   together with the conversion. Later salary changes must not alter it.
   Display PHP consistently. Do not execute payments or insert amounts into
   Payroll.

7. **Cancellation.** Require a clear confirmation showing the effect, and apply
   the confirmed reason/date policy. Preserve the original source, quantities,
   money and issue/conversion actor fields. Mark Cancelled and set cancellation
   actor/time/reason. Restore exactly the original deducted days to the original
   employee/pool/year allocations once. Cancelling Unpaid leave creates no
   restoration. Do not delete a source or edit/delete old credit transactions.

8. **Retries and simultaneous actions.** Double clicks, network timeouts and
   retrying after an uncertain response must not create extra Leave/Conversion
   records, deductions, conversions or restorations. Reuse a stable operation
   identity; idempotency must cover the source record as well as its ledger
   rows. Reuse Transaction Keys on retries. Populate Period Key only for the
   scheduled grant/accrual it identifies; a null Period Key does not replace
   Transaction Key. Do not reuse the original Period Key on a compensating
   transaction. Treat an existing matching result as a completed retry only
   after verifying it actually matches the requested operation.

9. **Consistent saves and server validation.** Source and related credit changes
   must either all succeed or all fail. The balance policy must hold when two
   admins act at once. Separate client calls, `Promise.all`, disabled buttons
   and unique keys do not provide those guarantees. Use a documented Dataverse
   server approach; prove its transaction and concurrency behavior. Protect
   invariants on permitted direct write paths as well as app commands. Do not
   use Payroll/Employee data as an improvised lock. If the required server path
   is unavailable, finish independent read-only work and clearly report the
   posting actions as blocked; do not ship a partial multi-record save.

10. **Access and future boundaries.** Use the existing role resolution for
    navigation, while Dataverse/server privileges enforce actual access.
    Payroll Employees cannot read or change any of the three Leave tables.
    Payroll Admin has no Delete/Assign/Share on them, and no Write on Credit
    Transactions. Do not expand those grants merely to make a UI action work.
    Test direct requests as ordinary accounts. Notifications, attachments,
    Payroll integration, Accounting, employee self-service and approval queues
    remain outside this version. Do not mark notifications Sent or set
    Notified On merely because a form saved.

### Existing data and environment

- Reuse actual Employee/User records via lookups; do not copy their names or
  identifiers into substitute text fields.
- Treat existing Leave and conversion records as historical business records.
  No silent remapping, deletion, credit reset, backfill or automatic recalculation.
- Do not invent balances for employees without transactions. Distinguish a
  verified empty history from missing permissions or incomplete data.
- Keep the existing table/column audit flags. Environment-wide auditing was
  disabled at the last inspection; report this accurately rather than claiming
  that audit history is being captured or silently enabling it.
- No real financial test entries or sample records in Dev without explicit
  authorization covering the test data and its handling.

### Implementation requirements

- Keep Leave types, business rules, services and hooks under a distinct Leave
  module. Reuse generated services and the existing Power Apps data boundary.
- Use strict TypeScript; verify numeric choices and case-sensitive lookup
  bindings. Do not add raw fetch/axios or hand-written authentication.
- Use TanStack Query with server filtering/paging and targeted invalidation
  after a confirmed mutation. Do not duplicate fetched collections in Zustand.
- Use existing shadcn/Radix controls and professional, accessible tables/forms.
  Support keyboard interaction, labelled inputs and readable status text.
- Disable duplicate submission while saving. Keep entered values after an
  error. Show useful validation and retry messages without leaking raw sensitive
  backend information. Do not claim success on a partial or unknown result.
- Keep date handling, day arithmetic, money rounding, entitlement rules and
  operation state transitions centralized and tested. Take actor IDs from the
  authenticated identity and validate them on the server.
- If adding a server component or operation binding, verify the supported
  deployment/generation path and keep it in the existing solution. Do not
  assume a Power Automate flow alone makes several writes atomic. Follow
  Microsoft's guidance on transaction context; do not nest ExecuteTransaction
  inside a synchronous plug-in that already runs in a database transaction.
- Inspect existing tests first. Use meaningful unit/integration tests for
  business rules and failure/retry behavior, and relevant Playwright tests for
  the new screens. No employee/payroll values in logs or committed artifacts.
- Run `npm test -- src`, `npm run lint`, `npm run build`, and relevant UI tests.
  Unscoped `npm test` currently also collects unrelated imported skill-source
  tests under `.agents`; document that distinction without silently changing
  unrelated test configuration. Record any failing or unverified check.
- Update this requirement checklist, `docs/leave-data-model.md` when its
  documented behavior changes, and `Payroll-Enhancements.md` with dated scope,
  files, verification and limitations. Keep decisions separate from assumptions.

### Acceptance criteria

- AC-01: Existing tables, data sources, Employee/User links and unrelated Payroll
  behavior are preserved; no duplicate setup or hand-edited generated files.
- AC-02: Admin navigation, lists, details and forms follow existing application
  patterns, with accessible loading, empty, error and permission-denied states.
- AC-03: VL/SL balances are correct for the complete selected employee/year
  history, including signed transactions, cancellations and paging; read errors
  cannot masquerade as zero balances.
- AC-04: Leave uses confirmed date/day/eligibility rules. Paid leave deducts the
  approved pool/year allocations; Unpaid leave creates no credit deduction.
- AC-05: Grants/accruals follow recorded policy and create no duplicate scheduled
  credit. No invented entitlements, automatic reset or unapproved scheduler.
- AC-06: Cash conversion follows the approved eligibility, rate, rounding and
  annual-limit rules and preserves its rate/amount snapshot without affecting
  Payroll or executing a payment.
- AC-07: Cancellation preserves originals and restores exactly the original
  allocations once; Unpaid cancellation creates no restoration. No deletes or
  ordinary edits of ledger history.
- AC-08: Retrying or double-submitting produces one source operation and only
  its intended transactions, including after a timeout with an unknown outcome.
- AC-09: A failure during a multi-record operation leaves no incomplete business
  result. Two concurrent spending/cancellation requests cannot violate the
  approved balance/restoration policy. Test these at the server boundary.
- AC-10: Both UI and direct-data tests show that an ordinary Payroll Employee
  cannot read/write Leave data, and Payroll Admin has only intended privileges.
  A failed role lookup does not grant admin access; a System Administrator test
  account is not evidence for an ordinary account.
- AC-11: Correct numeric choices, lookup targets, Date Only handling, actor/time
  stamps and immutable financial snapshots are verified.
- AC-12: Existing Payroll calculations, employee data and locked Payroll values
  remain unchanged. Notifications and Payroll/Accounting integration are not
  introduced as side effects of saving Leave records.
- AC-13: Relevant automated and UI tests, lint and build pass. Any limitation in
  test accounts, server safeguards or environment auditing is reported clearly.
- AC-14: Documentation identifies the files and behavior delivered, decisions
  made, checks run and remaining work. No deployment or commit without a request.

### Workflow

1. Investigate first, produce the acceptance checklist, and ask the grouped
   business questions. Explain any required server/environment work in plain
   language. Reuse the completed setup without another general setup approval.
2. Build independent read-only navigation, lists, details, history and balances
   where the source data/rules are sufficient. Do not use fabricated data to
   suggest that blocked operations work.
3. After the necessary policy decisions and server approach are settled,
   implement and verify safe grants, leave issuance, conversion and cancellation
   one coherent operation at a time. Proceed within existing authorization;
   pause only the actions that actually depend on missing decisions/access.
4. Verify the checklist, failure/retry/concurrency cases and ordinary-user access;
   run the required checks and update the change log. Mark blocked criteria as
   incomplete rather than weakening them to claim the module is finished.
5. Report delivered behavior, test results and limitations. Do not deploy or
   commit unless separately requested.

### Documentation references

- [Connect a Code App to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse).
- [Alternate keys and their limits](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/define-alternate-keys-reference-records).
- [Transaction guidance for synchronous plug-ins](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/best-practices/business-logic/avoid-batch-requests-plugin).

These references informed the prompt. Recheck current documentation and installed
tools when implementing an API or deployment path.
