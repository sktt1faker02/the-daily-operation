# Ledger conceptual data model — review draft

2026-11-03. Supports [the plan](../PLANS.md) and [chart](ledger-chart-of-accounts.md).
No live schema was inspected for this proposal. Names below are conceptual display
labels, not confirmed Dataverse logical names, choice values or deployed tables.

## Source field definitions

| Field | Proposed meaning / validation |
| --- | --- |
| Date | Business date, date-only; backdating/closed periods need a policy. |
| OR Number | Text preserving prefixes/zeros; optional; any numbering/uniqueness validation remains to be designed. |
| Reference | Optional plain text; no document-link or upload feature in this scope. |
| Debit | Source-style money out. Manual amount positive; payroll Debit preserves signed net pay, including zero/negative, with explicit Debit direction. |
| Credit | Source-style money in; not automatically revenue. |
| Chart of Account | Single-select Dataverse Choice: Utilities, Payroll, Government Contributions and the other documented categories. Exactly one category per ledger record; no allocation lines. |
| Description | Required original narrative, separate from account name. |

Recommend Direction + Amount internally, deriving Debit/Credit display, subject to
owner approval. Proposed currency is PHP with two-decimal minor units; do not
store independently editable amounts that can contradict the direction/total.

Owner scope update: Chart of Account has the **9 choices** in the chart document.
**Capital Deposits** records owner money entering the business in Credit; **Capital
Withdrawals** records owner money taken out in Debit. There is no separate Capital
Distributions choice. Starting/Additional Capital maps to Deposits, and Withdraw
Capital maps to Withdrawals. Opening funds are recorded as Capital Deposits;
there is no separate opening-balance amount/date or adjustment. These cashbook labels do not settle legal/tax treatment.

**Office Supplies** is excluded by the latest owner decision. Bank/payment fee
categories, automatic fee records and Registration and Filing Fees remain excluded.
Do not reclassify excluded source rows into another category. Embedded charges
need a confirmed handling rule; do not silently subtract them from cash amounts.
Screenshot totals below describe the source image only; they are not expected
totals for the reduced scope. No source data import is authorized.

## Confirmed access and navigation

Only Payroll Admin can access/view the ledger in the application, including direct
record requests. Sidebar category: **Ledger**; child page: **Ledger Management**.
Employees and other app roles receive no ledger access. No separate Chart of
Accounts page or accounting-user role is proposed. Exact privileges/ownership must
be designed and verified; this document makes no security changes.

## Proposed entities

| Entity | Information | Relationships / constraints |
| --- | --- | --- |
| Chart of Account choice metadata | Single-select categories from the chart document | Not a business-record table or account lookup. Preserve used values/history; schema names and numeric options unconfirmed. |
| Company account scope | One company account; currency/display configuration if needed | No separately entered opening balance/date. Recorded Capital Deposits supplies opening funds. Exact need for a separate account table is a technical design choice, not an approved extra feature. |
| Cash transaction | ID, date, direction, amount, currency, narrative, OR/reference, Chart of Account choice, cash account, lifecycle, actor/time | Exactly one category and optional text references; supported Created/Modified and agreed finalization/correction metadata. Server duplicate-submission token proposed. |
| Payroll posting source | Transaction source type (manual/payroll), source period, employee and payroll entry references; net-pay snapshot; stable source identity and operation token; posted actor/time | Unique linked row per source period/employee; exact key requires schema design. Re-payment updates the same row or recreates it after deletion. Operation identity is separate so retries cannot reapply a completed operation. |
| Audit and posting operation history | Supported change/delete audit, actor/time, operation identity/results | Payroll Admin can edit/delete ledger rows. Retain audit/operation history independently; do not cascade-delete payroll sources or completed-operation evidence. |
| Historical posting run | Run identity, period progress, created/skipped/failed counts and errors | Proposed durable resumable work record; financial writes atomic per period, no duplicate sources. Exact schema/runner pending design. |

No separate category/account table is required for the choices. Do not guess a
publisher prefix, logical names, numeric choice values or ownership model. Payroll
Admin is the confirmed application role; inspect its actual Dataverse identity and
privileges before proposing the necessary permissions.

Each Cash transaction stores one required Chart of Account choice directly. No
allocation entity or document reference entity is proposed. A combined statutory
payment can be represented by separate records for its verified Taxes and Government
Contributions amounts; do not additionally save the combined total.

## Totals and financial semantics

- Money out = sum of source-style Debit over the complete authorized filter.
- Money in = sum of source-style Credit over the same scope.
- Net movement = money in minus money out; this is not profit.
- Company balance = sum of all recorded Credit - sum of all recorded Debit for
  the single company account. Opening funds are ordinary Capital Deposits Credits,
  counted exactly once. No additional opening adjustment or cutoff date is needed.
- An empty ledger has balance zero. Negative payroll Debit increases this arithmetic
  balance; preserve the signed amount as requested.
- Show company balance separately from filtered totals. Date/category filters and
  page changes do not change the all-record company balance. Edits/deletions and
  payroll resynchronization update it through server aggregates/cache invalidation.
- Balance completeness depends on recording all relevant movements, including any
  excluded source items; do not claim automatic bank reconciliation.
- If running balance is requested later, include earlier relevant movements and
  deterministic date/sequence ordering; it must not restart on each page.
- Multiple-account transfers require paired movements if later approved; internal
  principal must not inflate consolidated external receipts/payments. Bank/payment
  fee tracking is excluded from the current scope.

The screenshot footer reads Debit PHP 492,486.75, Credit PHP 654,846.59 and
difference PHP 162,359.84. Subtraction is consistent. These are visual reference
figures, not verified records, an approved opening, reconciled balance or proof of
complete source data. No OCR import is proposed.

## Paid-payroll posting - owner confirmed

- Successful Mark as Paid pays/locks the period and posts ledger rows in the same
  server transaction. Keep the existing confirmation; no posting on Mark Ready.
- One row per employee with an existing payroll entry; include zero and negative saved net pay. Debit
  equals signed net pay, Credit unused, category Payroll. Do not recalculate pay.
- Date is the actual Paid On business date (Asia/Manila), not scheduled pay date.
  OR Number and Reference are optional text; no supporting-document feature now. Retain source period,
  employee, payroll entry and paid snapshot plus actors/timestamps.
- Failure in any write rolls back status, payment/lock metadata and all ledger
  writes. Payroll remains Ready (or its pre-operation state for a correction).
  Show a useful retryable error; after uncertain network results, read operation
  status before retry. Never claim rollback merely because the client timed out.
- Stable source uniqueness prevents duplicate employee rows. A separate server
  operation identity makes retries return the prior result rather than overwrite
  later manual edits. A browser loop/nontransactional flow is not sufficient.
- Exact server mechanism, limits and keys must be verified before implementation;
  inability to guarantee atomicity needs owner agreement on an alternative.

## Admin edits, unlock and re-payment - owner confirmed

Payroll Admin may manually create, edit and delete ledger rows, including generated
payroll rows. Confirm deletion and preserve supported audit history. These rights
apply to ledger records; locked payroll source snapshots remain protected.

Unlock keeps existing ledger amounts and exposes reopened source context in details.
Edits to reopened payroll do not immediately change ledger rows. On the next Mark
as Paid, update existing linked employee rows or recreate deleted ones,
using current saved net pay, Payroll category and the new actual Paid On date.
Do not prompt about earlier manual edits/deletions before replacing/recreating:
the normal payment confirmation explains resynchronization and balance effects.
Do not clear optional admin references unnecessarily; source links/operation
identity must remain intact for synchronization. No separate approval queue.

Owner confirmed: when a source payroll entry was deleted after unlock, delete its
linked ledger row during the next Mark as Paid resynchronization, atomically with
the other posting changes. Retain audit history and do not delete unrelated manual
rows. Unlock alone still does not remove ledger rows or authorize locked-payroll
deletion. Owner confirmed there is no employee-exclusion workflow. Keep an entry
with zero net pay to retain a zero-Debit ledger row, or delete the source entry to
remove its linked row during re-payment. Duplicate entries or changed employee
identities still require exact source-key handling in technical design.

## Previous paid payroll - owner-confirmed interaction

Payroll Admin uses **Post previous paid payroll** in Ledger Management. Preview eligible periods, employees with source entries, missing rows and signed total, then
confirmation. It is intended for initial setup but should be retry-safe, not locked
by a permanent one-use flag. Disable when no missing rows remain.

Post only missing source-linked rows for previously paid periods, using original
Paid On dates and saved source-entry net pay, including zero/negative values.
Existing linked rows are skipped even if manually edited; deleted rows can be
recreated without a conflict prompt. Owner agreed to review existing unlinked
manual Payroll ledger rows before historical posting and link confirmed matches
to their source period, employee and payroll entry. Preserve their amounts/dates;
linked matches are skipped by history posting. Do not infer identity from text or
amount alone. Resolve ambiguous matches before posting the affected sources.

Use paged background processing with durable per-period results and one atomic
transaction per period. Report created/skipped/failed counts, resume missing work
and reuse the same source uniqueness as live posting. Do not change source payroll,
recalculate net pay, resend notifications or replace existing ledger records.
Discover actual paid/legacy status semantics. Skip and report periods missing
Paid On; never use today's date as a fallback. Report unreliable source amounts or
employees for review. No separate opening adjustment can duplicate historical funds.
If missing-date exceptions remain, show them even when no postable rows remain;
do not claim that every period was posted. Exact runner design still needs review.
No historical writes are performed by this documentation task.

## Save integrity and optional references

Enforce authorization, required fields, one category, amount precision and operation
integrity server-side. Manual records have a positive amount in one direction;
generated payroll supports signed zero/negative Debit. No allocation table, upload,
attachment, clickable document link or SharePoint connection is needed now.
OR Number and Reference are optional plain text and do not block saving/posting.

## Ledger export - owner requested

Add Export to Excel, Payroll Admin only. Export all records matching active filters
across every server page, with Date, OR Number, Reference, Debit, Credit, Chart of
Account and Description. Preserve receipt zeros and signed/zero payroll amounts;
use proper dates/currency formatting and reuse the existing Excel stack.

Include filtered Debit/Credit totals and net movement, plus a separately labelled
all-record company balance. Category-filtered totals must not masquerade as company
balance. Export is read-only: no financial records or metadata change. Handle errors
and incomplete reads explicitly; no partial workbook presented as a complete export.
Define a consistent read/aggregate strategy for concurrent edits in technical design.

## Remaining technical design checks

Confirm real schema/privileges, atomic-operation limits/keys, retention/audit,
unexpected duplicate/source employee identities, the source-link review mechanism
for manual payroll history and embedded excluded charges. Missing historical
Paid On is settled: skip/report. One category, capital-deposit-derived balance,
no document feature, export and historical button interaction are confirmed in
[PLANS.md](../PLANS.md). Do not reopen these as unresolved business requirements.
