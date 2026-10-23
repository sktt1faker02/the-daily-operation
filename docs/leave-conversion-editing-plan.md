# Leave Conversion transactions and editing — 2026-10-23

Status: approved schema and implementation are deployed to Dev. On 2026-10-23,
the owner separately authorized the tested Leave plugin 1.0.2.0, conversion
guards and Code App deployment to repair loading. Refresh balances is removed.
The deployed DLL matches the tested hash, all 14 supported conversion write
guards are active and the live year-list command succeeds. No business records
were created. See [release verification](leave-conversion-release-verification.json).

## Current implementation and release status

### New-transaction dialog and header action (2026-10-23)

New-year creation now uses the same compact in-app Dialog as the payment UI,
with the automatic year, Cancel and Add new transaction actions. Pending creation
blocks dismissal/repeated submits; failures stay in the dialog for a stable retry.
The landing title and button share a responsive header, with the button aligned
right like Payroll. Existing detail layout and business operations are preserved.
Acceptance checks cover native-prompt removal, cancellation, successful navigation,
retry identity and desktop button positioning. This UI follow-up is not deployed.
All 327 app tests, 12 synthetic Edge checks, lint/build and documentation checks
passed; no real financial writes.

### Payment confirmation UI follow-up (2026-10-23)

Owner requested replacing the browser prompt with the Payroll-style in-app
dialog. Implemented locally using the same Dialog primitive and `sm:max-w-md`
width, Cancel/Mark as Paid footer, close control and contextual year text.
Acceptance checks: opening never invokes native confirm or writes; Cancel closes
without writes; confirmation retains payment locking; failures stay retryable;
pending state blocks repeated submits and dismissal. No backend/schema changes.
This UI follow-up has not been deployed.
Verification passed: 326 app tests, 12 synthetic Edge checks, lint/build and
documentation checks. Actual financial operations were not exercised.

### Requested: Mark as paid for the whole year (2026-10-23)

Owner declined new fields/permissions and confirmed paid years must lock.
Implemented locally using the existing year `statecode` (Active 0 -> Inactive 1)
and `statuscode` (Inactive 2) as the paid lock; no schema or role changes.
The button records payment for the entire year after confirmation and changes
to Paid (locked). Existing conversion values and employee Recorded/Cancelled
status are preserved. Save rejects paid headers before any write; payment and
Save share optimistic header concurrency. Payment retries do not change data.
Normal Modified By/On metadata remains available; no dedicated payment audit
fields were added. No unlock/reversal is introduced.

After separate explicit approval, Leave assembly 1.0.3.0 and the updated Code App
are deployed to Dev. The deployed hash matches the tested DLL, all 14 guards are
active and the live read reports payment status for both existing years. No year
was marked paid during deployment. The client still accepts an older server
response for existing conversion functions, disabling Mark as paid until the
new paid flag is available. Native solution source includes the deployed release.

The following schema proposal was declined and is retained as decision history.
Live metadata confirms `a365_leaveconversionyear` has only Name, Year and normal
system fields; its Active/Inactive state does not represent payment. Existing
employee conversion status supports Recorded/Cancelled only. Reuse both tables.

Proposed additions to the existing year table in The Daily Operation - Dev /
`A365_DailyOperations` (these are proposed names, not existing columns):

- `a365_PaymentStatus` / `a365_paymentstatus`: choice, Not marked paid / Paid.
  Existing null values mean Not marked paid; no historical data migration.
- `a365_PaidBy` / `a365_paidby`: System User lookup, set to the initiating admin.
- `a365_PaidOn` / `a365_paidon`: date/time, set by the server at confirmation.
- Payroll Admin needs Append on the year table for the new Paid By lookup.
  Existing exported role already has global Append To User. Add only the missing
  year-table Append privilege; retain existing Employee permissions unchanged.

Acceptance/verification checklist (superseded field additions excluded):

- [x] Admin-only Mark as paid on year detail, replaced by Paid (locked) on success.
      Year-list columns remain unchanged per the owner's narrow scope.
- [x] Confirmation explicitly records an already completed external payment;
      no money transfer, payroll integration or credit deduction.
- [x] Unsaved edits must be saved or cancelled first; disable while loading,
      editing, dirty or marking paid. Preserve drafts on any failure.
- [x] Server rechecks actual admin authorization, transaction identity/version
      and atomically changes the existing header state for the whole year.
      No dedicated payment actor/time fields are added.
- [x] Retry/double click on an already paid year performs no further update.
- [x] Owner confirmed paid years become read-only. Enforced
      in Save on the server and in the UI, with a shared header concurrency
      gate so concurrent Save/Mark as paid cannot change paid snapshots.
- [x] Conversion write guard permits the new command only on the year header;
      no direct writes, unlock, paid reversal or employee conversion changes.
- [x] Reuse existing state/status columns. No generated-source, schema, role or
      migration changes are needed for this follow-up.
- [x] Cover success, authorization, stale version, retry, dirty state and failures.
      325 app tests, 56 conversion server checks, 19 guard checks, 20 policy checks,
      12 synthetic Edge checks, lint and build pass. Browser navigation initially
      timed out during concurrent checks; isolated rerun passed without code changes.
- [x] Separately approved plugin/app release deployed to Dev and verified through
      hash, guard registrations and live read-only API. No actual paid write or
      financial test record; live ordinary-account/concurrency checks remain open.

### Existing annual conversion implementation

- Actual parent: `a365_leaveconversionyear` / `a365_LeaveConversionYear`, entity
  set `a365_leaveconversionyears`, primary key `a365_leaveconversionyearid`.
  `a365_year` uniquely identifies the annual transaction.
- Existing `a365_leavecashconversion` reused. Added actual fields
  `a365_availablevl` / `a365_AvailableVL` and `a365_conversionyear` /
  `a365_ConversionYear`; generated lookup binding is `a365_ConversionYear`.
  Existing Days minimum is now 0.00, maximum 5.00, precision 2.
- Both unique indexes are Active; optimistic concurrency is enabled. Only
  Payroll Admin Create/Read/Write/Append To on the parent was added. Employee
  roles have no conversion table privileges. See
  [live schema evidence](leave-conversion-schema-verification.json).
- Models/services were generated/refreshed using the installed `pa` CLI; native
  solution export supplied schema/relationship/role source, which repacks.
- The app uses the existing generated Leave command binding. New business
  commands are `conversionYears`, `conversionCreate`, `conversionRows`, and
  `conversionSave`; server checks the actual admin before dispatch.
- New-year creation atomically records all Active employee defaults. Save
  validates all submitted changes before writes, uses an optimistic header
  version, preserves saved daily rates and original Converted By/On, and treats
  a matching uncertain-response retry as a no-op. Existing rows are updated;
  missing rows are created once using stable IDs and employee/year keys.
- The year list is actual stored transactions; future years work. One inline
  row editor supports Done/Cancel, live amounts and accessible validation.
  Confirmed drafts survive pagination; Save failures retain them. Confirmation
  is required for creating/saving financial records, internal navigation prompts
  on dirty state, and beforeunload is registered. No Refresh balances control.
- Zero credit-ledger/Leave/Payroll/payment writes are performed by conversion
  operations. No old transaction/rate is recalculated from current salary.

### Release completed and remaining verification

1. Updated the existing signed Leave assembly to 1.0.2.0, preserving identity.
2. Registered 14 supported synchronous stage-20 conversion guards on both tables.
3. Published the Code App after passing tests/lint/build; exported native Leave
   assembly/guard metadata and synchronized solution source, which repacks.
4. Still verify in Power Apps with ordinary Admin/Employee accounts, persistence,
   rollback and concurrent requests using explicitly approved test records.
   Local synthetic tests are not proof of live transaction rollback, effective
   additive-role/team access or embedded-host navigation prompts.

No commit, remote Git push or real financial test record was performed.
Environment audit settings are unchanged;
normal Created/Modified metadata and original actor/time snapshots are preserved.

The following inspection/proposal records the rationale. Statements that ask
for schema approval or retain Refresh balances are superseded above.

### Loading failure repaired

Dev previously ran 1.0.1.0 and returned `LEAVE: Unknown Leave command.` for
`conversionYears` (correlation `2b8c2a28-4caf-4740-aadb-158672bd3d16`). The failed
year query correctly blocked creation because no next year was confirmed, but
the UI hid the useful cause. The client now explains an undeployed-server error
and displays safe load errors in both year and employee views. Regression tests
cover Retry restoring creation and reopening a stored year's employee rows.
After deployment the live request returned `years: []`, `nextYear: 2026`; the
empty list is expected until an admin creates a transaction.

## Verified existing implementation

- Page: `src/pages/leave-conversion.tsx`; employee table:
  `src/features/leave/conversion-employees.tsx`; calculation helper:
  `src/features/leave/conversion-rules.ts`; current reads: `leave-service.ts`.
- Live table: `a365_leavecashconversion`; schema `a365_LeaveCashConversion`;
  entity set `a365_leavecashconversions`; primary key
  `a365_leavecashconversionid`. Reuse generated
  `A365_leavecashconversionsService` and its model; do not replace this table.
- Existing fields cover Employee (`a365_employee`), Year (`a365_year`), Days
  (`a365_days`), Daily Rate Used (`a365_dailyrateused`), Amount (`a365_amount`),
  Converted By/On and Recorded/Cancelled status. Lookup bindings are already
  generated as `a365_Employee` and `a365_ConvertedBy`.
- Live metadata contains no Available VL field, year-parent lookup or alternate
  keys. Schema discovery found no separate conversion-year transaction table.
- `a365_days` has precision 2, minimum 0.50 and maximum 5.00. Zero cannot
  currently be saved. Metadata precision/minimum do not establish a quarter-day
  rule; use 0.50 input spinner steps without silently imposing a new entitlement
  rule or changing historical values.
- Live read-only record-count check returned zero conversion records. Recheck
  before applying metadata; no historical backfill is authorized.
- Existing UI is admin-gated by `LeaveAccess` and `useAccessProfile`. Reuse
  those checks and the server's `RequireAdmin`; no new employee access.
- Existing feature only previews; its reads do not deduct credits or pay money.
  The current Leave command has no conversion-create/save handler.
- Current preview uses actual balances and remaining capacity, includes
  non-active employees, and rejects future leave years. Those preview behaviors
  must be replaced for the new transaction workflow, not reused as new defaults.

## Proposed metadata changes requiring approval

Target: existing **The Daily Operation - Dev**, solution **A365_DailyOperations**,
publisher **Automations365** (existing `a365` prefix).

New display names below are proposals, not existing logical names. Obtain actual
logical/schema names, relationship bindings and privilege IDs from Dataverse
after approved creation, then regenerate through the supported Code Apps CLI.

| Change | Purpose / constraint |
|---|---|
| New **Leave Conversion Year** parent table | One durable year transaction, including an empty employee roster; Year whole number, primary Name, ordinary Created/Modified metadata and a unique key on Year. |
| **Conversion Year** lookup on existing conversion rows | Relates employee rows to the parent transaction. Unique composite key on parent + existing Employee prevents duplicate employees within that transaction. Require the relationship in the server operation; preserve existing Year field for compatible reads. |
| **Available VL** decimal column on existing conversion rows | Stores the editable two-decimal snapshot independently of the leave ledger; minimum 0.00. Do not hide the value in Note or a JSON field. |
| Change `a365_days` minimum from 0.50 to **0.00** | Required by the owner's nonnegative validation and zero-day saves; retain precision 2 and maximum 5.00. |
| Minimal access on new parent | Payroll Admin Create/Read/Write/Append To; no Employee grants, Delete, Assign, Share or System Administrator access. Existing detail privileges are reused. Verify the exact privilege requirements before applying any grant. |

Year uniqueness cannot be imposed on the existing employee-detail Year column:
all employees must share the same year. A parent with a unique Year key provides
the required one-transaction-per-year constraint without abusing required
Employee fields or creating a dummy employee.

## Server save boundary

Extend the existing generated `a365_LeaveCommand` binding and signed Leave
plug-in with business operations for transaction creation and saving. No raw
HTTP from the app. Keep caller privileges for business writes and check actual
admin membership server-side. Generated CRUD methods remain useful for reads;
independent client CRUD calls cannot guarantee an all-or-nothing year save.

Creation computes the candidate from stored conversion years and created year
transactions, never from the current synthetic UI year list. Empty data uses the
Manila calendar year. The client may send its automatically observed candidate
to detect races, never a user-selected year. Use the unique Year key and a stable
operation identity to distinguish a safe retry from another admin's duplicate
creation. A duplicate shows a friendly message and does not create another year.

Create the parent and default employee snapshots in one synchronous operation,
paging all Active employees (`a365_employmentstatus = 749910000`). Defaults are
Available VL 10.00 and conversion Days 5.00, independent of current leave credits.
Read salary from Employee, compute rate = salary / 22 rounded to cents and
amount = rounded rate × days rounded to cents on the server. Missing/invalid
salary blocks creation with an actionable error; never fabricate a zero rate.
No leave ledger writes, notifications, Payroll updates or payments.

Saving validates every submitted change, prevents duplicates and stale
concurrent overwrites, and creates/updates rows consistently in a transaction.
Retain original Converted By/On on edits and normal Modified By/On/audit
metadata. Preserve saved daily-rate snapshots; do not silently update historical
rates from current Employee salary. Extend direct-write protection to the parent
and conversion table so server validation cannot be bypassed by ordinary CRUD.
Do not nest ExecuteTransaction inside the synchronous plug-in transaction.

## Superseded refresh proposal

Recommended: **Refresh balances reloads the saved conversion transaction values**
and retains the transaction's rate/allowance snapshots. Confirm before discarding
dirty edits. This is consistent with fixed initial 10.00/5.00 defaults, future
year transactions and saving without ledger effects.

Alternative: replace Available VL with actual leave-ledger balances. That differs
from the owner's fixed defaults and needs explicit behavior for future years
before implementation. Do not silently choose this interpretation.

## Implementation structure and acceptance checklist

Keep existing page shell, typography, spacing, table and button primitives.
Extend existing files where practical; use `YearList`, `YearDetail`,
`EmployeeRow`, `useLeaveConversion` and a business-oriented conversion service.
TanStack Query owns server state; local row drafts hold only unsaved input.

| ID | Concrete verification |
|---|---|
| C-01 | No year input/Open year button; primary Add new transaction appears in their place. |
| C-02 | Empty data creates current calendar year; existing highest year creates +1; duplicate/concurrent click creates no extra year; errors and loading are visible. |
| C-03 | Year/Action table lists only actual transactions; View employees opens the correct year, including future years. |
| C-04 | New transaction includes all and only Active employees across pages, with 10.00/5.00 defaults and saved salary-derived rates/amounts. |
| C-05 | Back link/title/banner/Employees retain visual style; six requested columns appear in order; Refresh balances removed by the latest owner decision. |
| C-06 | Edit is admin-only in UI and server; Employee identity and Daily rate stay plain text. One inline row editor supports labelled inputs, Done and Cancel, with keyboard/focus support. |
| C-07 | Inputs use two decimals and 0.50 spinner steps; nonnumeric/negative values and conversion greater than Available VL or 5 show field errors and block Done. Amount recalculates live. |
| C-08 | Cancel restores last row values; confirmed drafts survive paging; dirty indicator tracks drafts; no unsaved values are placed in server-state cache as saved. |
| C-09 | Save disabled when clean, invalid, editing incomplete or pending; all changes across pages persist without duplicates; successful save clears dirty state and shows the exact year success toast. |
| C-10 | Save failure retains all drafts, displays a safe error, and rolls back writes; retries and concurrent saves do not duplicate or silently overwrite another admin's changes. |
| C-11 | Internal navigation and browser leave/reload warn when dirty; no Refresh balances control remains. |
| C-12 | Banner says saving records conversions without deducting credits or making payments; verify zero ledger/Payroll/payment writes. |
| C-13 | Peso values have symbol, grouping and two decimals; day values have two decimals; empty/loading/error/retry states and responsive layout remain usable. |
| C-14 | Verify keys are Active; read back actual metadata/bindings; refresh generated files through tooling; ordinary Employee cannot create/update conversion records directly. |
| C-15 | Unit/RTL/server fault-concurrency tests, relevant Playwright checks, full app tests, lint/build, documentation links and git diff checks; report unavailable live checks. |

Local verification: pure calculation/validation tests, RTL workflow tests,
synthetic Edge checks, signed server compilation and synthetic server/guard
regressions. Full check totals are recorded in Payroll-Enhancements.md. Live
schema verification is complete; business-operation release checks remain as
listed above. Do not create real financial test records or send test messages
without explicit authorization.

References: [Dataverse alternate keys](https://learn.microsoft.com/power-apps/maker/data-platform/define-alternate-keys-reference-records),
[synchronous database transactions](https://learn.microsoft.com/power-apps/developer/data-platform/scalable-customization-design/database-transactions).
