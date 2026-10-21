Below is a prompt following the structure of `PLANS.md`, specifically for **creating or correcting the Dataverse schema**. It does not authorize application feature development.

```markdown
# Active: Leave Management Dataverse Schema Creation and Code App Data Sources

## Requirements

- Read AGENTS.md, DESIGN.md and the full PLANS.md before starting.
- Use the relevant Microsoft Power Platform and Dataverse skills.
- This task covers the Leave Management data model only.
- For this task, I authorize you to create the missing Dataverse tables, columns, relationships and alternate keys. This overrides the “I create the tables myself” restriction in PLANS.md for this task only.
- Inspect the existing environment first. Some Leave tables may already exist with incomplete or incorrect columns.
- Verify the target environment, solution and publisher before changing metadata. Show me the environment URL and ask me to confirm it.
- Use the existing A365_DailyOperations solution and its existing publisher. The expected prefix is a365; verify it.
- Do not create duplicate tables.
- Do not delete records, tables, columns or choices, or migrate existing data without separate approval.
- Do not change any Dataverse security role. Give me the exact manual privileges required instead.
- Do not modify payroll calculations, employee records or existing payroll data.
- Do not implement Leave screens, business operations, notifications or Power Automate flows.
- Do not create sample records.
- Never edit generated Code App data-source files by hand.
- Work one stage at a time. Report results and limitations after each stage, then stop until I say “continue”.

## Feature: Establish the Leave Management Dataverse data model

### Context

“The Daily Operation” is a Microsoft Power Apps Code App with an existing Dataverse backend.

The Leave module will support:
- Admin-issued paid and unpaid leave.
- Auditable VL and SL credit transactions.
- VL cash conversion.
- Cancellation and credit restoration.
- Future unpaid-leave integration with payroll.

There is no approval workflow.

Existing AI-generated tables may contain incorrect fields:
- Employee ID stored as text.
- Credit Hours instead of credit days.
- Conversion statuses Pending, Approved and Rejected.
- Missing Employee and System User lookup relationships.

Screenshots are not authoritative schema evidence. Inspect actual metadata.

### Requirements from the owner

1. Reuse the existing Employee and System User tables.
2. Store employee references as lookups, never employee-name or employee-ID text substitutes.
3. Track leave credits using a signed transaction ledger.
4. Calculate balances by employee, credit pool and calendar year.
5. Do not store a mutable balance column.
6. Preserve historical cash-conversion rate and amount snapshots.
7. Use real Date Only behavior for leave calendar dates.
8. Preserve existing records and report incompatible legacy columns.
9. Enforce operation uniqueness using alternate keys.
10. Keep the new tables admin-only through Dataverse permissions configured manually by me.

### Data design

All names below are proposed logical names. Verify existing metadata before creating anything. Report the actual names after creation.

Common settings:
- Standard Dataverse tables.
- User or Team ownership.
- Primary name: a365_name, Text, maximum 200 characters.
- Reuse an existing suitable primary-name column rather than replacing it.
- Enable table and relevant column auditing; report if environment auditing is disabled.
- Keep standard Created By/On and Modified By/On fields.
- Business-record lookup relationships use Restrict Delete.
- Actor timestamps follow the existing payroll audit convention.
- Business statuses use custom choices, separate from standard state/status.
- Use the publisher’s option-value allocation and report exact numeric values.

#### Leave

Proposed table: a365_leave
Display name: Leave
Plural: Leaves

Required columns:
- Employee: a365_employee, Lookup to existing a365_employee.
- Leave Type: a365_leavetype, Choice: VL, SL, Emergency.
- Benefit: a365_benefit, Choice: Paid, Unpaid.
- Start Date: a365_startdate, Date Only behavior and format.
- End Date: a365_enddate, Date Only behavior and format.
- Days: a365_days, Decimal, precision 2, minimum 0.50.
- Leave Status: a365_leavestatus, Choice: Issued, Cancelled; default Issued.
- Issued By: a365_issuedby, Lookup to existing systemuser.
- Issued On: a365_issuedon, Date and Time.
- Notification Status: a365_notificationstatus, Choice: Not sent, Sent, Failed; default Not sent.

Optional columns:
- Note: a365_note, Multiline Text, maximum 2000.
- Cancelled By: a365_cancelledby, Lookup to systemuser.
- Cancelled On: a365_cancelledon, Date and Time.
- Cancellation Reason: a365_cancellationreason, Multiline Text, maximum 2000.
- Notified On: a365_notifiedon, Date and Time.

Notification status represents the latest required issue or cancellation notification. Do not implement notification sending in this task.

#### Leave Cash Conversion

Proposed table: a365_leavecashconversion
Display name: Leave Cash Conversion
Plural: Leave Cash Conversions

Required columns:
- Employee: a365_employee, Lookup to existing a365_employee.
- Year: a365_year, Whole Number.
- Days: a365_days, Decimal, precision 2, minimum 0.50, maximum 5.00.
- Daily Rate Used: a365_dailyrateused, Currency, precision 2.
- Amount: a365_amount, Currency, precision 2.
- Converted By: a365_convertedby, Lookup to systemuser.
- Converted On: a365_convertedon, Date and Time.
- Conversion Status: a365_conversionstatus, Choice: Recorded, Cancelled; default Recorded.

Optional columns:
- Cancelled By: a365_cancelledby, Lookup to systemuser.
- Cancelled On: a365_cancelledon, Date and Time.
- Cancellation Reason: a365_cancellationreason, Multiline Text, maximum 2000.

Use existing PHP currency configuration. Do not change the organization’s base currency.

The rate and amount are stored snapshots, not formulas tied to current salary.
Do not automatically add conversion amounts to payroll.

If an existing status choice contains Pending, Approved or Rejected, report its usage and propose a non-destructive correction. Do not silently remap records or remove options.

#### Leave Credit Transaction

Proposed table: a365_leavecredittransaction
Display name: Leave Credit Transaction
Plural: Leave Credit Transactions

Required columns:
- Employee: a365_employee, Lookup to existing a365_employee.
- Year: a365_year, Whole Number.
- Credit Pool: a365_creditpool, Choice: VL, SL.
- Transaction Type: a365_transactiontype, Choice: Accrual, Grant, Deduction, Restoration, Cash conversion.
- Days: a365_days, signed Decimal, precision 2; allow positive and negative values.
- Transaction Key: a365_transactionkey, Text, maximum 150.

Optional columns:
- Leave: a365_leave, Lookup to the verified Leave table.
- Cash Conversion: a365_cashconversion, Lookup to the verified Leave Cash Conversion table.
- Period Key: a365_periodkey, Text, maximum 100.
- Note: a365_note, Multiline Text, maximum 2000.

Ledger intent:
- Grants and accruals are positive.
- Leave and conversion deductions are negative.
- Restorations are positive.
- Unpaid leave creates no credit deduction.
- Balance = SUM(Days) for employee, credit pool and year.
- Corrections use compensating transactions.
- No annual reset records or mutable balance column.

Create two composite alternate keys:
1. Employee + Period Key.
2. Employee + Transaction Key.

Period Key examples:
- VL-2026-11
- SL-2026

Transaction Key examples:
- ACCRUAL-VL-2026-11
- GRANT-SL-2026
- LEAVE-<leave-guid>-DEDUCTION
- LEAVE-<leave-guid>-RESTORATION
- CONVERSION-<conversion-guid>-DEDUCTION
- CONVERSION-<conversion-guid>-RESTORATION

Each retry of the same operation must reuse its transaction key.
Do not make either text column globally unique by itself.
Verify both alternate keys reach Active status.

### Stage 0: Connection, investigation and change proposal

- Discover available Dataverse tools and inspect installed tooling.
- If connection setup is missing, report the supported setup path. Do not claim live access until verified.
- Confirm the target environment with me before metadata changes.
- Verify the solution and publisher.
- Inspect existing Leave tables, columns, choices, relationships, keys, ownership and auditing.
- Verify the existing Employee and systemuser lookup targets.
- Inspect schema and dependency information without exposing employee or payroll records.
- Identify potentially conflicting data using counts or minimal non-sensitive checks where necessary.
- Report each required item as:
  - Already correct.
  - Missing and safe to add.
  - Incompatible and requiring a decision.
- Explain any operation requiring data migration, destructive changes or modification of an existing choice.
- Convert the acceptance criteria into a verification checklist.

Stop and wait for “continue”.

### Stage 1: Create or correct the schema

- Reuse compatible existing tables and columns.
- Create missing tables, columns and lookup relationships.
- Do not replace text Employee IDs by silently converting them.
- Do not convert Credit Hours into Days.
- Do not overwrite populated fields or delete legacy columns.
- If proposed names conflict with incompatible columns, stop the affected change and propose alternative names.
- Configure ownership correctly at table creation.
- If an existing table has incompatible ownership, report it rather than recreating it.
- Add the components to the existing solution.
- Enable supported auditing settings.
- Read back metadata to verify every change.
- If an operation times out, check whether it succeeded before retrying.

Report completed changes, unresolved conflicts and the actual schema names.
Stop and wait for “continue”.

### Stage 2: Alternate keys, relationships and permissions report

- Create the two ledger alternate keys where compatible.
- Do not delete duplicates to force key activation.
- Verify both keys are Active; report Pending or Failed accurately.
- Verify all lookup targets and business relationship Delete behavior.
- Confirm that nullable Period Key does not replace the required Transaction Key retry safeguard.

Provide this manual role checklist without applying it:

A365 - Payroll Admin, Organization scope:
- Leave: Create, Read, Write, Append, Append To.
- Leave Credit Transaction: Create, Read, Append.
- Leave Cash Conversion: Create, Read, Write, Append, Append To.
- No Delete, Assign or Share on these tables.
- Verify required Read and Append To access on referenced Employee and System User records.

A365 - Payroll Employee:
- No privileges on these three tables.
- Check other assigned roles for unintended access.
- Do not share or assign these records to employees.

Do not claim admin-only access is enforced until effective privileges are verified.

Stop and wait for “continue”.

### Stage 3: Register Code App data sources

After I confirm the manual permissions are configured:

- Read the relevant Code Apps Dataverse skill.
- Verify the installed CLI syntax before using it.
- Add the three verified tables as Code App data sources.
- Use supported generation commands; never hand-edit generated files.
- Confirm typed models and services are generated.
- Verify generated logical names, choices and lookup bindings against actual metadata.
- Do not implement Leave screens, queries, mutations or payroll integration.
- Use feature/leave-module for repository changes. Do not commit to develop or main.
- Preserve unrelated working-tree changes.
- Run proportionate checks, including lint and build for generated code changes.
- Record the schema/data-source outcome and limitations in Payroll-Enhancements.md.
- Do not deploy the app or commit changes unless separately requested.

Stop and report results.

### Open questions

Report these without deciding them:
- How incompatible AI-generated columns and sample records should be retired.
- Whether an existing table’s ownership requires a different design.
- Whether business operations need server-side transactions and concurrency controls.
- Whether notifications use Outlook directly or Power Automate.
- Whether accruals will run automatically.

### Implementation requirements

- No invented schema names or choice numeric values.
- No raw fetch in application code.
- No manual edits to generated data-source files.
- No employee or payroll data in logs.
- No new database, approval workflow, holiday table or document storage.
- Unique keys do not guarantee atomic multi-record operations or prevent concurrent overspending.
- Column minimums and maximums do not enforce annual conversion totals or half-day increments.
- Document business rules that require later service/server implementation.

### Acceptance criteria

- The three required tables exist without duplicates.
- Required columns have verified types and required levels.
- Employee and actor references are actual lookups to existing tables.
- Ledger references point to the correct Leave and Cash Conversion tables.
- Leave calendar dates use Date Only behavior and format.
- Ledger days allow signed decimals with precision 2.
- Conversion money fields preserve rate and amount snapshots.
- Both composite alternate keys are Active.
- Business relationships use Restrict Delete.
- Ownership and auditing settings are verified.
- Existing records, payroll calculations and security roles are unchanged.
- Actual schema, entity-set, choice and navigation names are documented.
- Three Code App data sources and their generated services exist after Stage 3.
- Lint and build pass after generated-code changes.
- Every unverified or blocked criterion is explicitly reported.

### Workflow

Start with Stage 0 only.
Do not create schema until the target environment is confirmed and I say “continue”.
Complete one stage at a time, report findings and stop after each stage.
```