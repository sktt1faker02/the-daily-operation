# Proposed: Ledger Management and Chart of Accounts

> **Owner authorization update — 2026-11-03:** Implementation and the documented
> schema/security scope are authorized by the owner in the implementation session.
> This supersedes the documentation-only/approval-wait restrictions in the original
> review text below. The owner subsequently authorized activation and deployment
> to the existing Dev app; see [activation results](docs/ledger-activation.md).
> No commit, Git push or historical financial posting was instructed.
> See [implementation evidence](docs/ledger-implementation.md)
> and [release prerequisites](docs/ledger-release.md) for the current status.

Review draft dated 2026-11-03, updated with confirmed owner decisions below.
Documentation only; implementation is not approved.
Previous requirements are preserved in [archived plans](docs/plans-before-ledger-2026-11-03.md).
Outstanding Leave/Payroll UAT in that archive remains outstanding.

## Requirements

- Follow AGENTS.md, DESIGN.md and the existing architecture. Preserve Payroll,
  Leave, calculations and finalized financial records.
- Keep Ledger Management within the Accounting domain. Dataverse remains the
  business/configuration system of record. Any future document feature must use
  SharePoint; document functionality is excluded from the current module.
- No application code, generated files, schema, roles, connections, flows, records,
  import, migration or deployment changes during this documentation review.
- All behavior below is proposed unless identified as owner supplied. Resolve
  missing business decisions before dependent implementation.

## Feature: Record and categorize business receipts and payments

### Context

The Daily Operation is a React/Vite/TypeScript Power Apps code app with Dataverse.
The owner supplied a spreadsheet containing **Date, OR Number, Reference, Debit,
Credit, Chart of Account and Description**. Chart of Account is blank. The sample
covers capital, client receipts, payroll, software, internet, workspace, supplies,
statutory payments and bank fees.

Supporting review documents:

- [Proposed chart and description mappings](docs/ledger-chart-of-accounts.md).
- [Conceptual data model and financial semantics](docs/ledger-data-model.md).
- [Acceptance verification checklist](docs/ledger-verification.md).

### Current problem

Transactions lack consistent categories and an application workflow. The owner has
confirmed one category per record, a balance derived from recorded capital deposits
and other cash movements, payroll synchronization, historical posting and export.

### Required behavior

1. **Navigation and access - owner confirmed**
   - Add a new sidebar category **Ledger**, with **Ledger Management** beneath it.
   - Only **Payroll Admin** can access or view Ledger Management and its records.
     Hide this category from other application roles and enforce the same restriction
     on routes and direct data access. No separate accounting-user role is proposed.
   - Chart of Account is a choice field within Ledger Management; no separate
     Chart of Accounts sidebar page or account-maintenance module is required.

2. **Page layout**
   - Title: **Ledger Management**. Proposed subtitle: **Record and review business
     receipts and payments.**
   - Preserve all seven spreadsheet columns and add **Action**. Keep OR Number
     as text, including leading zeros. Reference is optional text; valid HTTPS URLs open in a new tab. Document
     attachments, managed document links and SharePoint integration remain out of scope.
   - Recommend **Debit (Money out)** and **Credit (Money in)** to preserve the
     source convention, subject to confirmation. This is a cashbook convention,
     not double-entry posting. Keep actions in consistent positions.

3. **Transaction entry and categorization**
   - Require Date, Description, a valid Chart of Account choice and a positive amount
     in exactly one direction for manual records. OR Number and Reference are optional.
     Generated payroll rows must also support zero and negative saved net pay.
   - Recommend a Money in / Money out entry control deriving the source columns;
     never infer cash direction from the selected category.
   - Exactly one Chart of Account category per record. No allocation lines or
     mixed-category transaction model. If a source payment covers Taxes and
     Government Contributions, enter separate records for the verified amounts;
     never also record the combined total. Keep Description separate from category.
   - Show validation/saving/errors, prevent duplicate submits and retain values
     until confirmed success. Payroll Admin can create, edit and delete ledger records,
     including generated payroll rows. Confirm deletion and retain supported audit
     history; this permission does not allow ordinary modification of locked payroll.

4. **Chart of Account choices - owner confirmed**
   - Use a single-select Dataverse Choice field with practical categories based on
     the screenshot: **Utilities**, **Payroll**, **Government Contributions**,
     **Taxes**, **Software and Licenses**, **Rent and Coworking**,
     **Capital Deposits**, **Capital Withdrawals** and **Client Payments**.
     These are the nine confirmed choices.
   - Example: an admin recording an internet payment selects **Utilities**.
     Automatically generated net-pay rows always select **Payroll**.
   - See the chart document for all mappings and separate-record examples.
     No numbered formal account catalog or editable account records are required.
   - Store choices in Dataverse metadata; discover actual logical names/values
     during approved schema design. Do not repurpose/remove used choices in a way
     that changes historical meaning. These categories are not a full general ledger.
   - Latest owner decision restores capital movements and removes Office Supplies.
     Use **Capital Deposits** for owner money put into the business (Credit) and
     **Capital Withdrawals** for owner money taken out (Debit). No separate Capital
     Distributions choice is needed; this is a cashbook label, not a legal/tax ruling.
     Starting/Additional Capital maps to Capital Deposits; these recorded Credits
     establish the opening funds without a separate opening-balance adjustment. The sample Office Supplies row is excluded.
   - Owner confirmed: Bank and Payment Fees is excluded from the category choices
     and current feature scope. Do not create automatic fee rows. Registration and
     Filing Fees is also excluded by owner decision; do not reclassify the sample
     government registration payment into another category. Embedded charges in source payments
     need an explicit handling decision; do not silently discard or reclassify them.

5. **Search, filters, paging and totals**
   - Propose date range, Chart of Account category and direction filters plus search over Description,
     OR Number and Reference; deterministic date/ID sorting and server paging with
     **10 records per page**.
   - Show money out, money in and net movement over the complete authorized
     filtered result, independent of the visible page; label the totals' scope.
   - One company account. Opening funds come from recorded Capital Deposits; no
     separate opening-balance field, amount or effective date is required. Company
     balance = all recorded Credit - all recorded Debit, including capital deposits
     exactly once and signed payroll Debits. An empty ledger has balance zero.
   - Show the company balance independently of list/category/date filters and
     pagination. Filtered totals are labelled separately. Excluded/unrecorded
     movements limit completeness; this is the balance of the recorded ledger.
   - Running balances, reconciliation, transfer entry, spreadsheet import and formal
     financial statements remain out of scope. Excel export is included below.

6. **References and module boundaries**
   - OR Number and Reference remain optional text fields. No document table,
     attachment control, upload or SharePoint setup now. Valid HTTPS references
     are clickable with a new-tab indicator; other references remain plain text.
     Any future document feature will follow the project document repository rules.
   - Automatic payroll posting below is in scope for future implementation. No
     additional Leave posting, email or unrelated background workflow is requested.
     Preserve existing payroll notifications and financial calculations.

7. **States and accessibility**
   - Provide loading, success, empty, filtered-empty, error and retry states.
   - Use labelled controls, keyboard-accessible dialogs, textual statuses, central
     PHP/en-PH formatting and scrollable readable tables on small screens.

8. **Automatic paid-payroll entries - owner confirmed**
   - When Payroll Admin successfully marks a payroll period **Paid** through the
     existing **Mark as Paid** action (which also locks it), automatically create
     individual ledger records per employee, not one combined period total.
   - Each row has that employee's saved **net pay in Debit**, no Credit amount,
     and Chart of Account **Payroll**. Do not substitute gross pay, recompute net
     pay or add separate statutory amounts to these rows.
   - Create rows for employees with existing entries in that payroll period, including zero and
     negative net pay. Keep the saved signed amount in Debit, with Credit unused;
     do not skip, clamp, take an absolute value or move negative net pay to Credit.
   - Use the actual Marked as Paid date, derived consistently from Paid On for the
     Asia/Manila business date. OR Number and Reference stay optional; do not invent
     receipt numbers. Retain source period/employee/entry and posting actor/time.
   - Payment/locking and every employee ledger write must commit in one server
     transaction. If any fails, roll back the entire operation: payroll stays Ready,
     payment metadata is unchanged and no new/updated ledger rows are committed.
     Show a useful error with retry. If the result is uncertain after a timeout,
     check committed server state before retrying; never assume nothing was saved.
   - Enforce stable source uniqueness and idempotency server-side. Repeating one
     operation must not duplicate rows or overwrite subsequent manual edits.
     Do not use a browser loop or nontransactional flow for the financial commit.
   - Ready/Processing alone, cancelled confirmation and failed payment create no rows.

9. **Unlock and re-payment - owner confirmed**
   - Unlock preserves the existing ledger amounts. Show the linked payroll as
     reopened in details; do not reverse or delete ledger rows merely on unlock.
   - When the period is marked paid again, update existing linked employee ledger
     rows from the current payroll entries' saved net pay; recreate missing rows
     if an admin deleted them. Use the new actual paid date and Payroll category.
   - No manual-change conflict prompt is required before replacing or recreating
     rows, even if the admin previously edited/deleted them. The normal Mark as Paid
     confirmation explains this resynchronization and its balance impact.
   - Keep supported audit history/actors/timestamps. Ledger changes never rewrite
     previous payroll snapshots outside the approved payroll unlock workflow.
   - If a source payroll entry was deleted after unlock, delete its linked ledger
     row during the next Mark as Paid resynchronization, in the same atomic
     transaction. Retain audit history. Do not delete unrelated manual rows.
     This does not authorize payroll deletion from a locked period. Owner confirmed
     there is no employee-exclusion workflow: remove the payroll entry or keep it
     with zero net pay. A retained zero-net-pay entry keeps a zero-Debit ledger row.

10. **Post previous paid payroll - owner confirmed**
    - Add a Payroll Admin-only **Post previous paid payroll** action in Ledger
      Management, intended for initial historical posting but safe to retry.
    - Preview eligible previously paid periods, source employee count,
      missing rows and signed total; require confirmation before creating records.
    - Before posting history, review existing unlinked manual Payroll ledger rows
      and link confirmed matches to their source period, employee and payroll entry.
      Do not guess matches from Description or amount alone. Matched rows become
      existing linked rows and are skipped without changing their amount or date.
      Resolve ambiguous matches before posting affected sources to avoid duplicates.
    - Create only missing linked employee Payroll rows, including zero/negative
      net pay, using each period's stored actual Paid On date. Do not change payroll
      status, payment dates, calculations, existing ledger rows or notifications.
    - Skip existing linked rows, including manually edited rows; report created,
      skipped and failed counts with per-period progress and useful errors. A deleted
      generated row is missing and can be recreated without a conflict prompt.
    - Use the same source uniqueness as live posting: atomic writes per
      period, paged background processing and durable progress so retries resume
      missing work without duplicating successful periods or depending on an open tab.
    - Detect actual paid/legacy status semantics from existing metadata/code. Periods
      without a valid Paid On date must be skipped and reported. Report unreliable
      employee/net-pay sources for review; never substitute today's date or invent amounts.
    - Disable the button when no eligible missing rows remain, with
      **All previous paid payroll has been posted**. Avoid a permanent one-use flag
      that would prevent recovery from a failed run. If missing-date exceptions remain,
      show them separately rather than claiming every period was posted.
    - This requests documentation/design only; no historical data writes now.

11. **Ledger export - owner requested**
    - Add **Export to Excel** for Payroll Admin. Export all records matching the
      current filters across all pages, not just the visible page.
    - Include Date, OR Number, Reference, Debit, Credit, Chart of Account and
      Description with appropriate text/date/currency formatting and preserved zeros.
    - Include filtered Debit/Credit totals and net movement. Show the company-wide
      balance separately and label its scope; it is not the filtered net movement.
    - Reuse the existing Excel export stack. Show exporting/error state, prevent
      duplicate clicks and never download an incomplete result as a successful export.

### Remaining technical design checks

Business decisions above are confirmed. Exact metadata/server design still needs
review and approval before implementation or environment changes.

| Area | Remaining check |
| --- | --- |
| Dataverse | Discover real names, choices, role privileges, source relationships and server transaction limits. |
| Synchronization | No employee-exclusion workflow. Deleted source entries lose their linked ledger row on re-payment; retained zero-net-pay entries keep zero-Debit rows. Verify exact keys for unexpected duplicate entries or changed source employees. |
| History | Detect actual paid/legacy statuses and reliable source amounts. Missing Paid On is skipped/reported. Review/link existing manual payroll rows before historical posting; resolve ambiguous matches before affected sources are posted. |
| Metadata/audit | Define exact operation keys, supported deletion audit, retention and any manual date/receipt validation. |
| Source descriptions | One category per record is confirmed. Verify amounts when separating combined statutory payments; embedded excluded charges still need a source-handling decision. |
| Export | Confirm consistent read/aggregate strategy for a complete filtered export and clearly labelled company balance under concurrent changes. |

### Security requirements

- Enforce Payroll Admin-only ledger privileges in Dataverse, including direct
  requests and export;
  UI hiding is supplementary. Do not grant broad System Administrator privileges.
- Mark as Paid, re-payment and historical posting require confirmation and
  supported actor/time audit metadata. Payroll Admin may edit/delete ledger rows;
  re-payment may replace/recreate them without a separate conflict prompt. Preserve
  locked payroll source protections and do not delete audit history with ledger rows.
- Avoid sensitive raw backend errors. Verify ordinary-user route/ID/direct access
  and report live checks that cannot be performed.

### Implementation requirements

- After approval, follow Component -> Hook -> Service -> Dataverse within the
  Accounting boundary. Reuse dataClient/generated services; no hand-edited sources.
- Discover actual schema, choices, relationships and privileges before changes;
  conceptual names in these documents do not assert existing tables.
- TanStack Query owns server state. Use server filtering/paging/aggregates and
  narrow invalidation; do not load all transactions or duplicate them in Zustand.
- Put amount/category/totals validation outside JSX; use decimal or integer
  minor-unit arithmetic and consistent PHP formatting.
- Enforce authorization, money invariants, atomic saves, lifecycle and duplicate
  protection server-side; choose the mechanism after approved schema design.
- Link Payroll to Ledger only through business service/command boundaries, not UI
  component imports. Payment-to-ledger posting must survive the agreed failure/retry
  scenarios and publish completion status; do not rely on an untracked browser loop.
- Do not alter schema/security or import financial data without explicit approval.

### Acceptance criteria

Future criteria; none is claimed complete by this draft. Concrete checks are in
[the verification document](docs/ledger-verification.md).

- [ ] L1: Only Payroll Admin sees Ledger > Ledger Management and can access ledger data; other roles fail through routes and direct requests.
- [ ] L2: All source fields are represented, receipt text is preserved and money directions match the confirmed convention.
- [ ] L3: Exactly one category per record; manual values validate, OR/reference can be blank and generated zero/negative payroll is supported. No allocation or document feature is introduced.
- [ ] L4: Chart of Account uses the 9 defined category choices; internet selects Utilities, generated net pay selects Payroll, and combined source payments use separate verified records without duplicating totals. Capital Deposits uses Credit and Capital Withdrawals uses Debit; Office Supplies is absent and its sample row is excluded. Bank/payment fee choices and automatic fee rows are absent; Registration and Filing Fees is also absent.
- [ ] L5: Combined search/filters, deterministic sorting and paging work correctly.
- [ ] L6: Company balance equals all recorded Credit minus Debit; Capital Deposits supplies opening funds once, with no separate opening adjustment. Filtered totals are page-independent and separate from company balance.
- [ ] L7: Choice metadata preserves historical categories; invalid/unapproved values are rejected and no separate account-maintenance page is introduced.
- [ ] L8: Payroll Admin can create/edit/delete ledger rows with audit/deletion confirmation; unlock preserves rows, re-payment updates/recreates without conflict prompts and deletes linked rows whose source payroll entries were deleted.
- [ ] L9: OR Number/Reference remain optional text; valid HTTPS references open in a new tab; no attachment, document-table or SharePoint setup is added.
- [ ] L10: Loading/empty/error states, keyboard access and desktop/mobile layouts pass.
- [ ] L11: Payroll/Leave calculations, historical values and existing notifications remain unchanged; only the requested paid-payroll ledger integration is added.
- [ ] L12: Targeted/full tests, lint, build and relevant Playwright pass; live security limits are reported.
- [ ] L13: Mark as Paid atomically locks/pays payroll and posts one row per employee with an existing payroll entry using signed saved net pay (including zero/negative), Payroll category and actual Paid On date; no rows on Ready/cancel/failure.
- [ ] L14: Failure rolls back payment metadata/status and all ledger writes; uncertain results are checked before retry and concurrency cannot duplicate or reapply an already completed operation.
- [ ] L15: Confirmed historical-posting preview/button creates missing linked rows, skips/reports missing Paid On and resumes safely; reviewed manual matches are linked first, existing financial values/source payroll remain unchanged and completion/errors are explicit.
- [ ] L16: Excel export includes the complete filtered result across pages, preserved values, filtered totals and separately labelled company balance; unauthorized export and partial-success downloads are prevented.

### Workflow

1. **Review:** Owner reviews plan, categories and unresolved decisions.
2. **Design:** After decisions, inspect implementation/actual metadata and propose
   exact schema, privileges, validation and manual release steps for approval.
3. **Implement:** Only after explicit authorization, extend existing architecture
   on the current branch and execute the L1-L16 checklist.
4. **Release:** Report verification/limits and obtain outstanding environment
   approvals before deployment/data changes. This draft authorizes none.
