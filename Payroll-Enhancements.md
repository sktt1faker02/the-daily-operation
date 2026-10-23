# Payroll Enhancements

This file is the ongoing change log for Payroll enhancements. Use
`docs/payroll-task-phases.md` as the template and reference for phase-based
planning; keep dated implementation history here.

## Change Log

### 2026-10-23 - Style new Leave Conversion confirmation and align header action

Replaced new-transaction native confirm with the existing compact in-app Dialog.
It displays the automatic year and Cancel/Add new transaction buttons, blocks
dismissal and repeated submits while creating, keeps failures inline and preserves
the stable retry identity. Moved Add new transaction to the right of the landing
header, matching Payroll's header layout and wrapping responsively. Detail-page
layout and server operations are unchanged.

Changed `conversion-year-list.tsx`, `leave-conversion.tsx`, page tests and the
synthetic browser check. Acceptance checks cover no native creation prompt,
cancel without writes, automatic-year confirmation, failure/retry and header
button positioning. No backend/schema/role or financial records changed. This
UI follow-up is local and not deployed.
Verification passed: all 327 app tests, 12 synthetic Edge checks including right
header placement, lint/build (existing bundle-size warning), documentation links
and `git diff --check`. No real conversion was created during verification.

### 2026-10-23 - Use an in-app Leave Conversion payment confirmation

Replaced the Mark as paid browser confirmation with the existing Radix/shadcn
Dialog style used by Payroll: compact width, title/description, Cancel, close
control and primary Mark as Paid action. Payment starts only from confirmation.
The dialog blocks dismissal and duplicate submits while pending, keeps failures
visible for retry and closes after success. Existing server payment/locking
behavior, Save and new-transaction confirmations are unchanged.

Changed `conversion-employees.tsx`, its page tests and the synthetic browser
check. Verification covers no native payment prompt, cancel without writes,
success, failure/retry and pending dismissal protection. No backend, schema,
roles or live financial records changed; this UI follow-up is not deployed.
All 326 app tests, 12 synthetic Edge checks, lint and build passed (existing
bundle-size warning). Documentation links and `git diff --check` passed.

### 2026-10-23 - Add Mark as paid and lock conversion years

Owner declined extra fields/permissions and confirmed that paid years must lock.
Added only the year-detail payment button and its required client/server support.
The implementation uses the existing annual header Inactive state/status as the
paid lock. Confirmation records an already completed payment; it does not transfer
money or change employee conversion values, credits or payroll. Dirty/active edits
block payment. Success shows Paid (locked), disables editing and removes Save.
Server checks admin, identity and version, serializes payment against Save, rejects
all later saves and makes repeated payment requests no-ops. Guard authorization
for payment is restricted to Update/SetState of the annual header.

Changed conversion types/service/hook/employee section, existing Leave command
and ConversionCommands/guard, plus focused tests/browser check. Local Leave
assembly 1.0.3.0 was subsequently deployed with the Code App after separate explicit
approval. Live DLL hash, 14 active guards and payment-status read verified; native
solution source synchronized and repacked. No actual year marked paid. No schema, role,
generated-source or live financial-record changes. Dedicated Paid By/On tracking
was deliberately excluded; existing normal Modified metadata remains available.

Verification: 325 app tests, 56 conversion server checks, 19 guard checks,
20 policy checks and 12 synthetic Edge checks passed. Lint/build/server compilation
passed (existing bundle-size warning). A browser navigation timeout under parallel
check load cleared on an isolated rerun without code changes. Live paid writes,
concurrent financial operations and ordinary-account access remain unverified.

### 2026-10-23 - Inspect year-level Mark as paid prerequisites

Owner requested recording payment for a whole Leave Conversion year. Verified
live year metadata has no payment fields; existing conversion status only has
Recorded/Cancelled. Prepared a scoped status/actor/time proposal and verification
checklist in [conversion plan](docs/leave-conversion-editing-plan.md). Separate
schema/minimal Append authorization and the paid-year editing decision are
pending. No application, schema, role, deployment or financial-record changes.

### 2026-10-23 - Repair Leave Conversion loading and deploy to Dev

Reproduced `LEAVE: Unknown Leave command.` from live `conversionYears`: Dev's
Leave 1.0.1.0 did not support the new UI commands, so loading failed and creation
stayed disabled. Added a specific compatibility error and safe error details to
year/employee load views; regression tests cover retrying loads, restoring the
button and opening stored-year employees. Changed conversion service, YearList,
ConversionEmployees and related tests.

After separate explicit owner approval, updated only the signed Leave plugin to
1.0.2.0, registered 14 supported conversion guards and published the Code App to
Dev. Verified live DLL hash, enabled synchronous stage-20 guards and successful
year read (`years: []`, next year 2026). Both tables remain empty. Exported native
Leave assembly/guard metadata into solution source; packing passed. Added
read-only release verification and native source-pull scripts/evidence.

Verification: 320 app tests, 10 synthetic Edge checks, 43 conversion server,
14 write-guard and 20 policy checks passed; lint, build and server compilation
passed (existing bundle-size warning). No schema/role changes or financial test
records in this repair. Actual create/save, concurrent rollback, hosted navigation
and ordinary-account effective access still require approved live checks.
See [release details](docs/leave-conversion-editing-plan.md).

### 2026-10-23 - Implement annual Leave Conversion transactions

Implemented automatic next-year creation, paged saved employee rows, 10.00 VL /
5.00 conversion defaults, inline admin editing, live amounts, validation,
Done/Cancel, dirty navigation warnings and retry-safe Save. Removed Refresh
balances per the owner's correction. Saving records conversion snapshots without
deducting credits or making payments.

Changed the Leave Conversion page and conversion components/hook/service/types;
added server `ConversionCommands`, strengthened command-scoped write guards,
and added focused app/server/browser tests. Applied the separately approved Dev
year-parent table, Available VL field, parent lookup, uniqueness keys, zero-day
minimum and four parent-table Payroll Admin privileges. Regenerated data sources
with the CLI and pulled native solution schema/role source from export.
Both uniqueness indexes are Active; live parent/detail record counts remain zero.

Verification: 315 app tests, 10 synthetic Edge checks, 43 conversion server
checks, 14 write-guard checks and 20 policy checks passed. Lint, build, server
compilation and native solution packing passed (existing app bundle-size warning).
See [acceptance checklist](docs/leave-implementation-checklist.md) and
[schema evidence and release details](docs/leave-conversion-editing-plan.md).

Not deployed: local Leave assembly 1.0.2.0, new conversion guard registrations
and Code App. The schema export still contains deployed assembly 1.0.1.0;
re-export/repack after authorized deployment. Live persistence, rollback,
concurrency, ordinary-account effective access and embedded-host navigation
checks remain pending. No financial test records, notifications or payment writes.

### 2026-10-23 - Inspect editable Leave Conversion prerequisites

Inspected existing UI, generated conversion model/service, Leave command and
live Dataverse metadata. Confirmed the conversion table exists, has zero records,
no Available VL field and no uniqueness keys; Days currently has a 0.50 minimum.
Prepared [schema/save-boundary proposal and acceptance checklist](docs/leave-conversion-editing-plan.md).
Required year-parent storage, editable allowance storage, zero-day support and
refresh semantics await owner approval. Changed documentation only; path/link
checks and `git diff --check` passed. No runtime tests, application changes,
metadata/role writes, financial records or deployment for this inspection.

### 2026-10-23 - Remove Credit History module

Owner cancelled Credit History. Removed its page, route, navigation item,
dedicated client/server implementation and dedicated tests/browser script.
Restored shared Leave components/hooks and the original admin-only Leave
command implementation. Removed the obsolete link from Leave Management.
Kept the old Credit History tab removed, retained Leave Management balance
cards and preserved the earlier Leave Conversion UI removals. No records,
roles, schema, generated sources or deployed environment were changed.

Verification: no remaining module routes, navigation or personal-history command
references in application/server code. All 297 app tests, five synthetic Edge
removal checks, server compilation, six write-guard checks and 20 policy checks
passed. Lint and build passed with the existing bundle-size warning. Documentation links
and `git diff --check` passed. No deployment or live business-data writes.

### 2026-10-23 - Lock Credit History to personal records and add balance header

Added a locked employee-name field, year/search filters and matching VL/SL cards
above Credit History. This module now uses the personal API for every role,
including admins. Leave Management admin functionality remains available there.
Changed `credit-history.tsx`, shared balance cards and personal history service;
added `myHistorySummary` to the existing Leave command with full paged, signed
year-ledger totals scoped to the authenticated employee. Search/movement/pool
filters never change those totals. Loading/error/retry states do not show false
zeros. No grants are projected and no financial policy or records changed.

Verification and remaining release checks are in
[the current checklist](docs/employee-credit-history.md). Local server compilation,
54 history-isolation checks, 16 write-guard checks and 20 policy checks passed.
All 310 app tests, 13 synthetic Edge checks, lint and build passed (existing
bundle-size warning). Documentation links and `git diff --check` passed. Updated Leave
assembly and Code App remain undeployed; ordinary-account live access checks
remain pending. No schema, role, ownership or generated-source changes.

### 2026-10-23 - Employee Credit History module

Removed the Credit History tab from Leave Management and added `/credit-history`
below My Payroll, with personal credit movements and leave records for Payroll
Employees and existing employee filtering for admins. Changed Leave pages,
records/detail hooks, navigation/routing, and added a generated-action-backed
personal history service. The signed Leave assembly (`1.0.2.0`) adds read-only
commands with role and initiating-user employee checks, scoped paging/details
and explicit safe field projections. Its write guard permits only existing
admin mutation-command ancestry, rejecting personal-read ancestry.

Verification: all 307 app tests, lint/build and 12 synthetic Edge browser checks passed;
signed server compilation, 39 history-isolation checks, 15 write-guard checks
and 20 existing policy checks passed. The final full run includes UI tests
including navigation, own-record details, no admin collection reads, filter
updates, blocked role-table introspection and loading/error/denied states.
Existing bundle-size warning remains.
See [acceptance and release details](docs/employee-credit-history.md).

Limits: updated assembly and Code App are not deployed. Ordinary-account live
security checks remain pending. No schema, role grants, record ownership,
financial data, notifications, generated files or payroll formulas changed.

### 2026-10-22 - Separate annual Leave Conversion workspace

Removed the Cash Conversions tab from Leave Management. Added the admin-gated
Leave Conversion navigation and year list/detail routes, reusing existing
Dataverse conversion history, pagination and immutable saved rates/amounts.
Changed `leave.tsx`, `_layout.tsx`, `router.tsx`, `leave-service.ts` and added
`leave-conversion.tsx`. Lint and build passed (existing bundle-size warning);
functional testing remains with the owner. No deployment or business writes.

Verification checklist:
- [x] Cash Conversions tab removed; dedicated module and clickable years added.
- [x] Existing admin access gate, loading/error states and saved details reused.
- [x] Year validation, full pagination for year discovery, lint/build checks.
- [x] Employee preview: owner confirmed monthly basic salary / 22 and current
  available balance for the leave year. Round daily rate to cents, cap days by
  available VL and remaining annual allowance (5 minus Recorded conversion days),
  then round payout to cents. Current cycle uses the server Add Leave preview,
  including pending grants; past years use posted ledger balances. Future years
  are unavailable. Salary/balance failures display errors instead of zero.
  Existing saved conversion snapshots remain unchanged. New helpers/components:
  `conversion-rules.ts`, `conversion-employees.tsx`; Leave posting invalidates
  conversion previews. Employee requests are paged with refresh/retry controls.
- [ ] Functional UI/data checks by owner. No conversion posting/payment added.

### 2026-10-22 — Annual Leave reset on January 5 from 2027

Owner corrected the reset to January 5 annually, beginning January 5, 2027:
full 10 VL and 5 SL, replacing monthly accrual from that date. Updated Leave
server period boundaries, transitional period end, annual idempotent grants,
deduction cycle-year tagging and preview wording. Existing balances continue
under old rules until January 5; history and Payroll formulas are unchanged.
Compiled and updated the existing signed Dev Leave assembly; no schema/role
changes or financial transactions. Functional testing remains with the owner.
See [implementation and limits](docs/leave-january-reset.md).

### 2026-10-22 - Reduce Codex context and routine work overhead

**Outcome:** owner-authorized economical development defaults. Condensed root
`AGENTS.md` from 3,190 words to about 1,170 while preserving security,
immutability, architecture and required checks. Detailed Payroll instructions
moved to `docs/payroll-agent-guidance.md`, required for relevant tasks. Added
narrow scope, concise output, no unsolicited delegation, targeted iteration
checks and one final required verification pass.

**Configuration:** `.codex/config.toml` sets project reasoning to Medium instead
of inherited High and restricts Sites, Work Pets and Templates apps. This client
applies skill overrides only from the user config: added 108 exact-path overrides
there; confirmed 103 unrelated imported workflows disabled. Code Apps, Dataverse,
Power Automate and Microsoft Learn remain available. Original user config backup:
`C:/Users/Jomari/.codex/config.before-economy-20261022.toml`. No skill sources removed.

**Verification:** strict-config app-server startup and read-only configuration/
skill-list requests confirmed Medium, three app restrictions, 103 disabled
imports and no skill-loading errors. Documentation links, guidance consistency
and whitespace checked. No application/runtime behavior, business data, schema,
permissions or unrelated work changed. Runtime tests/build not required.

**Limits:** restart Codex and start a new chat for clean context/settings;
explicit thread/model overrides can take precedence. Account plugins remain
installed/enabled; local restrictions do not change account installation. Five
optional cached plugin-skill overrides were absent from the skill listing and
their effect is unverified. Paths are machine-specific and need updating after
moving the repo/plugin cache. No measured credit-saving percentage is claimed.

### 2026-10-22 — Fix shared deletion receipt guard

All three deletion operations were blocked because receipt `CreateMultiple`
was rejected, including Dataverse's merged pipeline for a single `Create`.
`ProtectDeletionWrites.cs` now permits both creation events only under the
matching transactional deletion API ancestor, without requiring a snapshot
stage number. Direct deletion and receipt updates/deletes remain blocked.
Compiled and updated only the existing signed Dev deletion assembly and its
source binary. At the owner's request, no test suite, test deletions or unrelated
checks were run; functional verification is left to the owner.

### 2026-10-22 — Enable confirmed payroll, entry and employee deletion

**Outcome:** completed the owner-authorized Dev setup and expanded deletion to
individual employees' entries in Processing payrolls and unreferenced employee
master records. Confirmations name the employee and/or cutoff, explain impact,
perform no write on Cancel, prevent duplicate/in-flight dismissal, retain errors
and a stable retry identity, and refresh rows/totals after confirmed success.
Edit is icon-only with hover/accessibility labels in both affected tables.

**Changed:** payroll/employee pages and tables; shared confirmation component;
domain deletion dialogs/services; common validated transport; generated Custom
API bindings; signed `A365.Payroll.Deletion` 1.0.1.0; three transactional APIs;
organization-owned deletion receipt; eight synchronous direct-write guards;
existing employee/template Delete reference tightened to Restrict; native source
pulled for the affected metadata and its existing template-table dependencies,
which were absent from the repository snapshot. Provisioning, server tests, preview-only
verification and source-pull scripts are under `scripts/payroll-deletion/`.

**Security:** live export revealed pre-existing Organization Delete grants on
Payroll Admin's period/entry tables, contrary to the documented baseline.
Roles were not changed. Server guards now reject direct deletes irrespective of
existing privileges; finalized periods and entries remain protected. Employees
with payroll, leave, credit, conversion or template references cannot be deleted.
Validated operations record authenticated actor, target, period and count in an
immutable receipt, without copying financial amounts or internal notes.

**Verification:** 297 application tests across 32 files (including targeted
transport checks), 41 server boundary checks, 13 synthetic Edge browser scenarios,
live preview-only authorization/status/history/guard/hash checks, lint and build
pass. The live binary matches the tested assembly; business/receipt counts are
unchanged. Existing large-bundle warning remains. See
[checklist and limits](docs/payroll-deletion-checklist.md) and
[live verification](docs/payroll-deletion-verification.json).

**Limits:** no live deletion/rollback/concurrent-race fixture test; a separate
ordinary admin successful-delete test remains outstanding. No existing employee,
payroll or leave record was deleted during verification. Backend registration is
live in Dev; new UI is ready locally and the hosted Code App was not republished.
No commit or Git push. This supersedes the setup blocker in the earlier
preparation entry below.

### 2026-10-22 — Payroll action icons and Processing deletion preparation

**Request:** use icon-only Archive/Unarchive actions with hover labels and add
Delete with a mandatory confirmation naming the period. Owner clarified that
Processing periods and their entries are the deletion scope.

**Changes:** `src/pages/payroll.tsx` and page tests; new `DeletePeriodDialog`,
deletion transport service and their tests. Both lists offer Delete only for
Processing periods to admins. Cancel performs no write. Confirmation explains
permanent removal of entries, blocks duplicate submits/dismissal while pending,
retains errors and the operation identity for retry, and invalidates payroll
queries on confirmed success. New signed server draft and local build script
prepare transactional deletion with exact-role authorization, current status
validation, row-version checks and a durable receipt. See
[scope, proposed metadata and verification](docs/payroll-deletion-checklist.md).

**Verification:** 282 application tests in 29 files; five synthetic Edge browser
scenarios; lint, build and signed server compilation pass. Existing bundle-size
warning remains. No live deletion, schema/role change, registration, publication,
commit or push performed.

**Remaining:** Delete explicitly stays disabled until separately authorized
Dataverse setup adds the Custom API, receipt table and generated API binding.
Server rollback/concurrency and ordinary-admin direct-access checks remain
pending an isolated approved environment test. Existing role Delete privileges
remain withheld; the server draft is not represented as a deployed feature.

### 2026-10-22 — Reflect issued unpaid Leave in Payroll

**Outcome:** matching Issued Unpaid Leave fills the target cutoff's unpaid days
for Load employees, Copy previous cutoff and Load template. Existing Processing
entry editors load the derived days into the unsaved preview; Save explicitly
persists and recalculates. Admin manual adjustment remains available.

**Files:** `src/features/leave/payroll-unpaid-leave.ts` and tests;
`src/features/payroll/hooks/use-payroll-unpaid-leave.ts`; Payroll entry dialog,
period/template services, page props and regression tests;
`scripts/payroll-unpaid-ui-check.mjs`. The shared allocation service handles
employee/date overlap, approved holidays/weekends, complete paging and failures.
Copied previous/template unpaid days are replaced by the new cutoff's result.

**Verification:** 266 application tests across 27 files, five synthetic Edge
browser scenarios, lint and build passed. Existing large-bundle warning remains.
Source formulas, locked snapshots, generated services, schema and roles unchanged.
No live payroll writes, test email, publication, commit or push.

**Limits:** no background existing-entry sync; the editor persists only on Save.
Incomplete holiday coverage or inconsistent stored Leave days block allocation
for review. See [verification checklist](docs/unpaid-leave-payroll-checklist.md).

### 2026-10-22 — Deploy verified Leave assembly and PreOperation guards

- Owner supplied a detailed audit/reproduction/repair request. Live audit found
  a stale 1.0.0.0 marker-dependent DLL and 20 enabled PreValidation guards.
  Downloaded-DLL replay confirms the stale marker dependency. Runtime traces
  disproved the earlier false-transaction hypothesis for nested stage-10 writes.
- Deployed signed Leave assembly 1.0.1.0 with the requested transaction/API
  ancestry guard and context-only tracing; moved all 20 guards to synchronous
  PreOperation. No bypass flags, role/schema or Payroll changes.
- Readback verifies matching local/live/export hashes, correct API binding and
  diagnostics. Six guard checks, 17 policy checks and live rollback verification
  pass. Native Leave assembly/step source was pulled and successfully repacked.
- Tracing restored to Off. No retained Leave test records or actual email.
  Automatic approval review blocked two lasting own-employee test records and
  an SL debit pending explicit approval. Read-only preflight passed.
- Full evidence and per-test status: [Leave submission fix](docs/leave-submission-fix.md).
  This supersedes the pending deployment status in the preparation entry below.
  No frontend publication, commit or Git push.

### 2026-10-22 — Prepare Leave submission guard fix (deployment pending)

- Request: resolve the Add Leave error rejecting the validated command's writes.
- Changed `plugins/A365.Leave.Plugins/LeaveCommand.cs`: recognize transactional
  Custom API ancestry without depending on a later SharedVariables mutation
  being included in a parent-context snapshot. Direct writes remain rejected.
- Added six executable guard regression cases in `ProtectLeaveWrites.Tests.cs`
  and `scripts/leave-schema/test-write-guard.ps1`. The valid API context without
  the shared marker fails against the old assembly and passes after rebuilding.
- Added `verify-write-guard.ps1` for an intentional rollback probe; it is not
  executed yet. It exercises coordination/credit writes then rejects invalid
  dates before creating Leave or sending email, checking record counts afterward.
- Verification: signed assembly builds; six guard and 17 policy checks pass;
  lint and production build pass (existing chunk-size warning). Initial parallel
  application checks had timeout/UI failures under parallel load. Serial rerun
  with one worker and a 60-second timeout passed all 240 tests in 25 files.
- Limitation: the Dev assembly has NOT been updated. Automatic approval review
  rejected deployment because this changes a write-protection boundary and
  requires explicit approval of the exact guard change. No environment, schema,
  security-role, financial-record or email changes were made. Live parent-context
  behavior and rollback probe remain unverified; source fix is locally tested.

### 2026-10-22 — Resolve Add Leave submission and notification blockers

**Request / outcome**

Execute the owner's recommended policy/setup resolutions and find the 2026
Inquirer holiday list. Admins can preview April-period credits/workdays and issue
Leave with atomic due-credit/debit posting, automatic Unpaid fallback and
post-commit email retry. No approval workflow introduced.

**Files / behavior**

- `src/features/leave`: server preview, stable operation retries, pending-form
  protection, committed-source email and notification-only retry. Pending earned
  credits are labelled; cancelling the form creates no records.
- `plugins/A365.Leave.Plugins`, `scripts/leave-schema/*posting*.ps1`: signed
  synchronous command, direct/team admin checks, caller business privileges,
  per-employee coordination and direct-write guards. Scoped new metadata was
  read back, exported and merged into native solution source.
- CLI-generated Custom API and Outlook sources/configuration; connected sender
  `jomari@automations365.com`. No test email or financial fixture created.
- Versioned 2026 national holiday calendar plus provisional 2027 proclamations;
  2027 filing remains blocked pending the separately declared Eid dates.
- Updated implementation checklist, schema register and requested follow-up.
  Payroll calculations, existing business rows and role grants unchanged.

**Verification**

- 240 application tests in 25 files; 17 local C# policy checks; 22 synthetic Edge
  browser checks; lint and production build passed (existing chunk-size warning).
- Live transaction context and 20 active synchronous write guards verified.
- Live existing-employee preview passed with unchanged ledger count; no employee
  identity or balance is stored in verification evidence.
- Native unmanaged solution source repacks successfully.

**Remaining limits**

- Live concurrent financial posting/rollback, ordinary-account direct access,
  actual email sending and published-host behavior were not exercised.
- Credits catch up automatically on Issue; no unattended monthly scheduler.
- Cancellation, cash conversion and three-path new-entry Payroll filling remain
  documented follow-up work. No historical backfill or app publication performed;
  no commit/push.

### 2026-10-22 — Add the Leave entry modal and safe email composition

**Request / outcome**

Execute the updated Add Leave/modal/email PLANS.md within existing authorization.
Admins can open a concrete entry form and review recorded credits; unavailable
posting and notification prerequisites are visible and remain blocked.

**Files / behavior**

- `src/pages/leave.tsx`, `src/features/leave/add-leave-dialog.tsx`: Add Leave
  action and accessible modal with Employee, VL/SL/Emergency, Paid/Unpaid, separate
  date fields, unavailable-count explanation, optional internal note, Cancel and
  disabled Submit. Reopening resets values; the handler rechecks admin access.
- `employee-picker.tsx`: reusable required-employee mode preserves list-filter
  All employees behavior. `entry-rules.ts`: strict date/choice/note validation,
  approved pool mapping and centralized two-decimal credit formatting.
- `notification-template.ts`: safe composition from the Issued snapshot and
  linked Employee Work Email; exact subject, escaped contents, no internal notes,
  arbitrary recipient, unverified balances or notification status mutation.
- Colocated rules/template tests, expanded page tests and Edge harness cover the
  modal, validation, retained values, reset, credit read errors and late responses.
- Existing checklist/data-model/follow-up documentation records current scope,
  live prerequisite discovery, incomplete criteria and manual setup steps.

**Verification / limitations**

All 229 application tests pass with two workers and the existing export-friendly
timeout; 58 are Leave tests. Lint and production build pass (existing large-chunk
warning); 21 Edge UI checks pass with synthetic responses, including the new
modal and mobile layout. Live read-only discovery found no Outlook connection
or invokable Leave flow; the only matching action was unrelated `LeaveGroup`
bound to `flowmachine`. Leave/Employee field contracts were rechecked live.

Calculated days, current April-period spendable balances, atomic posting,
notification sending/Failed persistence/retry and ordinary-account direct-data
tests remain incomplete. No schema/security/config/generated-source edits,
Payroll/cash-conversion changes, financial test records, emails, deployment,
commit or push were performed. Existing working-tree changes were preserved.

### 2026-10-22 — Add Leave browsing, balances and the follow-up backlog

**Request / business outcome**

Execute the Leave application plan, then incorporate the owner's entitlement,
April-reset, holiday, Unpaid-fallback, conversion, Payroll-input and notification
directions. The owner requested a later follow-up for remaining work.

**Files / behavior**

- `src/features/leave/` and `src/pages/leave.tsx`: distinct Leave types/rules,
  generated-service read layer, TanStack Query hooks, searchable employee picker,
  employee/year balances, cursor-paged filtered history/record tables, and
  historical Leave/Conversion detail dialogs. Complete balance reads reject
  partial/failed/repeated pages and inconsistent scope/precision.
- `src/router.tsx`, `src/pages/_layout.tsx`: admin Leave navigation with successful
  role resolution required; existing Payroll access/formulas remain unchanged.
  Mobile navigation wraps to accommodate the new link.
- Colocated Leave rules/service/page tests and `scripts/leave-ui-check.mjs`:
  automated behavior and synthetic-boundary Edge browser checks. Temporary
  Playwright runner only; no new app dependency or lockfile changes.
- `PLANS.md`, `docs/leave-data-model.md`,
  `docs/leave-implementation-checklist.md`, `Leave-Follow-Up.md`: recorded owner
  decisions, delivered read-only scope, exact verification and pending work.
  Read-only role evidence timestamp refreshed; both named roles still match.

**Verification**

- All 36 new Leave tests pass. Required `npm test -- src` initially encountered
  the known Excel export 5-second timeout under concurrent load (206 passed).
  Rerun with `--maxWorkers=2 --testTimeout=60000`: all 207 tests in 22 files pass.
  No global test configuration change or unrelated skill-source tests collected.
- Lint and production build pass; existing Vite large-chunk warning remains.
- 13 Playwright checks pass in installed Edge with synthetic service/role
  responses: desktop/mobile, navigation, paging, historical date-only details,
  keyboard close, balances, tabs, empty/error/retry controls and employee denial.
- Live three-table metadata agrees with generated contracts; both named role
  matrices have zero differences. Scoped Leave Custom API discovery returned no
  matching operations. No Dataverse business-record writes or role changes.
- Documentation paths reviewed and `git diff --check` passes.

**Remaining limitations**

Posting forms, atomic server commands/concurrency guards, ordinary-account
direct-data tests, automatic accrual/April resets/holiday validation,
new-entry-only unpaid Payroll filling and retryable notifications remain
incomplete. Existing calendar-year ledger history was preserved rather than
reinterpreted as an April entitlement period. Conversion cancellation is
excluded by the latest owner decision; historical cancelled records stay
readable. Follow-up includes rate/counting/allocation/calendar dependencies and
additional metadata authorization. Environment auditing remains unchanged
(last inspected disabled). No deployment, commit, push, sample records,
notifications or payments.

### 2026-10-22 — Prepare the Leave application implementation prompt

Created `docs/leave-implementation-prompt.md` using the structure of `PLANS.md`
and the verified Leave data-model/setup evidence. The prompt reuses the three
existing tables and generated services, defines the admin screens and business
operations, lists unresolved credit/date/conversion policies, and includes
acceptance checks for retries, concurrent changes and direct-data permissions.
Its workflow advances independent read-only work while keeping policy-dependent
financial actions incomplete until their prerequisites are settled.

Verification: relative paths and generated artifact references checked;
requirement/acceptance coverage and scope reviewed; `git diff --check` passed.
Documentation only: no feature, Dataverse, security-role or generated-source
changes; runtime tests were not rerun. This prompt does not start implementation.

### 2026-10-22 — Grant Payroll Admin Leave access and complete Stage 3

**Request / business outcome**

The owner explicitly authorized granting Payroll Admin access to the three
Leave tables, superseding the earlier manual-only role instruction, and
continuing Stage 3 without further scope confirmations.

**Changes**

- Added the 13 planned Organization-scope privileges across Leave, Leave Cash
  Conversion and Leave Credit Transaction, plus the missing System User Append
  To privilege, to the verified existing `A365 - Payroll Admin` role in Dev.
  No Delete, Assign, Share, ledger Write, user-role assignment or administrator
  elevation was added. Preserved unrelated existing privileges and the Employee
  role. Saved exact grant and final role-matrix evidence under `docs/`.
- Used the installed Microsoft Power Apps CLI 1.0.1 to register `leaves`,
  `leavecashconversions` and `leavecredittransactions` in `power.config.json`.
  Generated three `.power/schemas/dataverse/` schemas, three typed models and
  three services; the CLI updated its shared index and registry. No generated
  files were edited by hand, and no Leave feature calls were implemented.
- Added scoped grant, export, role-source pull and artifact verification
  commands under `scripts/leave-schema/`; updated the README and
  `docs/leave-data-model.md` with actual artifacts, authorization and results.
- Exported/unpacked the actual unmanaged solution after the grants. Merged
  only the 14 approved native privilege nodes into the existing Payroll Admin
  source definition, preserving unrelated source differences and concurrent
  Payroll work. No solution import, app deployment, commit or push occurred.

**Verification**

- Role read-back: zero differences for both named Payroll roles against the
  planned Leave matrix; required Employee/User Read and Append To verified.
- Artifact checks passed: three unique source registrations, all 39 specified
  columns, seven numeric choice mappings and nine business lookup bindings.
  All three entity definitions match the fresh native export; 43 pre-existing
  generated files and all existing source registrations were preserved.
- `npm.cmd run lint`: passed. `npm.cmd run build`: passed; existing Vite
  large-chunk warning remains. Local `pac solution pack`: passed.
- Unscoped `npm.cmd test` discovered imported skill tests under `.agents`, with
  unrelated failures and one Payroll export timeout under that broad run; it
  was stopped. `npm.cmd test -- src`: passed all 171 application tests across
  19 files, including all 24 Payroll export tests.
- PowerShell/JSON/XML parsing, generated-source preservation checks,
  documentation links/status scan and `git diff --check`: passed.
- No employee/payroll business records or sample Leave records were written;
  application feature source and unrelated working changes were preserved.

**Remaining limitations**

- Effective access through other user/team roles, ownership and sharing was not
  tested using ordinary accounts; verified named-role configuration alone is
  not a claim that all employee access paths are excluded.
- Environment-wide auditing remains disabled as previously inspected. Leave
  operations, server-side validation/concurrency, screens and notifications are
  future work. The generated CRUD methods do not implement those business rules.
- The existing Dev role contains unrelated privileges absent from the old
  repository definition. Only the approved grant nodes were pulled; full
  solution synchronization/promotion readiness is outside this task.
- Test-discovery configuration was left unchanged. No Playwright run is needed
  for this registration-only change, which adds no screen or user flow.

### 2026-10-21 — Prepare Leave Code App source registration (Stage 3 preflight)

**Request / business outcome**

Resume Stage 3 to register the three verified Leave tables with supported Code
App generation while preserving the existing Payroll work and manual security
configuration policy.

**Changes and verification**

- Switched to `feature/leave-module`, which shared the current base commit;
  retained all existing working-tree changes.
- Read the Code Apps Dataverse skill, current Microsoft Learn instructions and
  installed CLI help. Confirmed local grouped CLI version 1.0.1 and the existing
  cached sign-in for the confirmed Dev environment.
- Added read-only `inspect-stage3-permissions.ps1` and its result at
  `docs/leave-permissions-verification.json`. All 13 required Admin privileges
  on the three new tables are missing, together with System User Append To.
  The named Employee role correctly has no privileges on the new tables;
  effective access through other roles/teams/sharing remains unverified.
- Prepared `register-stage3.ps1` using the supported local CLI. Its inspect-only
  preflight passed. The normal command checks existing registrations before
  retries and saves an ignored local snapshot before generation.
- Added the concrete Stage 3 verification checklist and permission findings to
  `docs/leave-data-model.md` and the command instructions to the scripts README.
- PowerShell parsing, document links and `git diff --check` passed. No generated
  files, application features, records, roles or schema were changed in this
  preflight; lint/build await generation.

**Remaining limitation**

PLANS.md explicitly requires manual permission configuration before Stage 3
registration. Source generation is pending that owner action or an explicit
change to the order. No claim of completed registration or enforced admin-only
access is made, and no deployment, import, commit or push was performed.

### 2026-10-21 — Activate Leave ledger duplicate prevention (Stage 2)

**Request / business outcome**

Complete Stage 2 of the approved Leave schema plan in the existing Dev
environment, preventing duplicate employee credit operations while preserving
the existing data and manually managed permissions.

**Changes**

- Created `a365_EmployeePeriodKey` on Employee + Period Key and
  `a365_EmployeeTransactionKey` on Employee + Transaction Key in
  `a365_leavecredittransaction`, within `A365_DailyOperations`.
- Added scoped CLI key payloads and creation/read-only verification commands
  under `scripts/leave-schema/`. Creation checks first, reuses compatible keys,
  waits for metadata propagation and index activation, and stops without
  deleting or changing records if a conflict or failure occurs.
- Updated `docs/leave-data-model.md` with actual key names, Active statuses,
  null-key limitations and the exact manual role checklist. Saved a separate
  Stage 2 read-back in `docs/leave-schema-stage2-verification.json`, preserving
  the historical Stage 1 evidence.
- Exported/unpacked the official unmanaged solution. Pulled only the generated
  ledger `Entity.xml` after verifying its only changes were the two key
  definitions; preserved unrelated solution files and concurrent Payroll work.

**Verification**

- Initial live preflight: zero ledger records and zero existing alternate keys;
  key column types, lengths, required levels and disabled column security passed.
- Both composite keys read back as Active together in the final snapshot;
  neither text column is globally unique on its own.
- Reverified all nine business lookup targets, their five parent/table GUID
  primary IDs, navigation properties and Restrict Delete behavior.
- All three Leave tables remain empty. No employee/payroll data, business
  records, roles, environment settings or application features were written.
- `complete-stage2.ps1 -VerifyOnly`: passed with no Dataverse writes.
- Official solution export/unpack and local `pac solution pack`: passed.
- PowerShell/JSON/XML parsing, documentation links and contradiction scans,
  and `git diff --check`: passed. No runtime or generated Code App source changed;
  lint/build are required again for Stage 3 generated-code changes.

**Remaining limitations**

- Period Key is optional; null participating values bypass key uniqueness.
  Later operations must validate Employee and Transaction Key and reuse the
  original Transaction Key for retries. ApplicationRequired metadata alone
  does not replace server/service validation.
- Keys do not make multi-record operations atomic or prevent concurrent credit
  overspending; business operations remain future work.
- The owner must configure the documented permissions manually; effective
  Admin/Employee access remains unverified. Environment-wide auditing remains
  disabled as previously inspected and was not changed.
- Stage 2 is complete. Per `PLANS.md`, Stage 3 data-source registration awaits
  confirmation that manual permissions have been configured. No app deployment,
  solution import, commit or push was performed.

### 2026-10-21 — Create Leave Management schema (Stage 1)

**Request / business outcome**

Create the three documented Leave tables directly in the confirmed Daily
Operation Dev environment and verify their links to existing Employee and User
records, including parent primary keys.

**Changes**

- Created `a365_leave`, `a365_leavecashconversion` and
  `a365_leavecredittransaction` in the existing `A365_DailyOperations` unmanaged
  solution under publisher `Automations365` / prefix `a365`.
- Created 39 specified columns and nine business relationships, using the
  existing Employee/User keys and the new Dataverse-generated Leave/Conversion
  keys. All business relationships use Restrict Delete and NoCascade for the
  other checked cascade actions.
- Enabled and verified auditing on the new tables and specified columns;
  preserved the disabled environment-wide auditing setting.
- Let Dataverse allocate local choice integers, then configured and verified
  the Issued, Recorded and Not sent defaults using the returned values.
- Added reviewable schema payloads and CLI completion/verification/pull commands
  under `scripts/leave-schema/`, and updated `docs/leave-data-model.md` with the
  actual schema, keys, relationships, choices and stage limitations.
- Saved live read-back evidence in `docs/leave-schema-verification.json`.
- Exported/unpacked the actual unmanaged solution and pulled only the new
  entity definitions and their generated relationships/manifest entries into
  `solution/A365_DailyOperations/src`. Preserved unrelated working-tree changes,
  Payroll entity definitions and security-role source files.

**Verification**

- Full custom-table inventory: 549 definitions inspected before creation;
  no conflicting Leave candidates or additional metadata page.
- Live verification passed for all three tables, their generated GUID primary
  keys, UserOwned ownership, primary names, all 39 specified column types and
  required levels, lengths/bounds/precision, Date Only behavior/format, local
  choices/defaults and audit flags.
- All nine business lookup targets, parent primary keys, case-sensitive
  navigation properties and cascade settings passed read-back verification.
- All three tables belong to the intended solution and contain zero records.
- `complete-stage1.ps1 -VerifyOnly`: passed without Dataverse writes.
- Official unmanaged export/unpack: passed. Local `pac solution pack` of the
  updated solution source: passed.
- `npm.cmd run lint`: passed. `npm.cmd run build`: passed with the existing
  Vite large-chunk warning. No application source was changed by this schema
  task; unrelated concurrent Payroll work was preserved.
- Documentation field coverage, all 15 acceptance rows, relative links and
  `git diff --check`: passed.
- No employee/payroll record writes, sample records, role changes, app feature
  code changes, generated Code App source edits, commits or deployments.

**Remaining limitations**

- Per `PLANS.md`, stopped after Stage 1. The two composite alternate keys await
  Stage 2; primary GUID keys already exist. No duplicate-prevention claim is
  made before those alternate keys are Active.
- Payroll Admin/Employee privileges require the owner's manual configuration
  and effective-access checks. Admin-only access is not claimed as verified.
- Environment auditing remains disabled; enabled table/column flags alone do
  not capture audit history.
- Code App data-source registration and generated models/services await Stage
  3 after the owner confirms permissions. No Leave screens or operations exist.
- Accrual/conversion policy, atomic multi-record operations, concurrent balance
  protection, immutable snapshot controls, notifications and Payroll integration
  remain future implementation work.

### 2026-10-21 — Show the payslip comment only for positive other deductions

**Request / business outcome**

Show the Comment field in the employee payroll entry editor only when the
current Other Deductions value is greater than zero.

**Changes**

- Updated `src/features/payroll/payroll-entry-dialog.tsx` to conditionally render
  the label and text area from the current form value.
- Preserved the comment value when the field is hidden and retained existing
  save, calculation, and validation behavior.

**Verification checklist**

- [x] Code review: positive amounts, including decimal amounts, show Comment.
- [x] Code review: zero, blank, and negative amounts hide the label and text area.
- [x] Code review: visibility derives directly from editable form state and updates
  on each amount change; hiding the field does not clear its value.
- [x] `npm.cmd run lint`: passed.
- [ ] `npm.cmd test -- src`: 143 passed, one unrelated Excel export test timed
  out. Retried that file with `--testTimeout=60000`: 18 passed, one failed at
  `payroll-export.test.ts:279` because cell B2 returned an Excel serial number
  (`46314.66666666667`) rather than a `Date`. Export code was not changed.
  Tests required execution outside the sandbox because esbuild could not load
  the Vite configuration with sandbox permissions.
- [x] `npm.cmd run build`: passed with existing large-chunk warnings.
- [x] `git diff --check`: passed.

**Remaining limitations**

- Interactive browser verification has not been performed; no Playwright tests
  are configured in this project. The Vercel React best practices skill requested
  by project guidance was not found in the available skill locations.
- Unfiltered `npm.cmd test` discovers 537 test files in the imported `.agents`
  skill sources and encounters unrelated failures (including `render-alm-plan`
  cases). Stopped that run and scoped the application check to `src`.

### 2026-10-19 — Separate payroll period date fields

**Request / business outcome**

Replace the combined payroll period range picker with separate Start date and
End date fields, keep Pay date linked to End date until manually edited, and
prevent selecting an End date earlier than Start.

**Changes**

- Added separate single-date pickers and live period-name preview to the New
  Payroll Period dialog.
- Added pure date-linking and validation helpers, plus unit coverage for date
  changes, disabled dates, and one-day periods.
- Disabled earlier dates in the End calendar and exposed their disabled state
  accessibly.
- Preserved the existing semi-monthly Start and End defaults per the user's
  clarification. Pay date starts equal to End date.
- Kept the existing date-only ISO values and create payload shape.

**Files**

- `src/features/payroll/create-period-dialog.tsx`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/components/ui/date-picker.tsx`
- `src/components/ui/calendar.tsx`

**Verification**

- Unit tests: 120 passed across 15 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- No `pac code push` was run; deployed behavior remains unverified.

---

### 2026-10-19 - Simplify payroll period status flow

**Request / business outcome**

Use Processing -> Ready -> Locked. Keep Unlock. Defer the one-time data
migration as requested.

**Changes**

- Added one payroll period status module for transitions, labels, badge tones,
  editability, finalization, and employee visibility.
- New periods start explicitly in Processing. Old stored pre-flow values are
  normalized to Processing or Locked in the app until the deferred migration;
  no Dataverse rows or choice metadata were changed.
- Ready makes payslips visible in My Payroll, after checking included entries
  have calculation timestamps and all entries are owned by their linked users.
  These checks run before the status update and make no writes on failure.
- Mark as Paid now sends one update setting Locked and both Paid/Locked audit
  stamps. Removed the separate Lock action; Unlock remains available from
  Ready and Locked and hides the payslip from the app list when it returns to
  Processing.
- Updated dashboard cutoff selection, previous-cutoff selection, template
  eligibility, employee visibility, status badges, and empty-state wording.
- Kept Archive behavior and payroll calculations unchanged.

**Files**

- `src/features/payroll/period-status.ts`
- `src/features/payroll/period-status.test.ts`
- `src/features/payroll/types.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/services/payroll-service.ts`
- `src/features/payroll/services/my-payroll.ts`
- `src/features/payroll/services/my-payroll.test.ts`
- `src/features/payroll/services/overview-service.ts`
- `src/features/payroll/services/overview-service.test.ts`
- `src/features/payroll/services/payroll-template-service.ts`
- `src/features/payroll/services/payroll-template-service.test.ts`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/features/payroll/period-audit.test.ts`
- `src/features/payroll/payroll-status-badge.tsx`
- `src/features/payroll/hooks/use-my-payroll.ts`
- `src/features/payroll/hooks/use-payroll-status.ts`
- `src/pages/my-payroll.tsx`
- `src/pages/overview.tsx`
- `src/pages/payroll-period.tsx`
- `src/pages/payroll-templates.tsx`
- `src/pages/payslip.tsx`

**Verification**

- Unit tests: 123 passed across 16 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- The migration was deferred and no Dataverse changes were made. Keep old
  choice values available while existing rows still use them; remove unused
  choices and refresh the generated data source after deciding how to handle
  those rows.
- No `pac code push` was run; deployed behavior remains unverified.

---

### 2026-10-19 - Remove Employee link precondition from Mark Ready

**Request / business outcome**

Remove the new validation that blocked Mark Ready when Employee-to-user links
were missing or payroll entry ownership differed.

**Changes**

- Mark Ready still requires all included entries to have calculated results.
- Removed Employee system-user link and Payroll Entry owner matching checks.
- No Dataverse security settings or record ownership were changed.

**Files**

- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/types.ts`

**Verification**

- Targeted service tests: 5 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- Dataverse record ownership and permissions remain responsible for employee
  payslip access.

---

### 2026-10-19 - Display the finalized status as Paid

**Request / business outcome**

Show Paid instead of Locked as the final payroll status.

**Changes**

- Status labels now display Paid for the internally locked/finalized state,
  including existing legacy finalized values.
- Kept the Dataverse status value, lock behavior, and Unlock transition intact;
  no schema change or migration was performed.

**Files**

- `src/features/payroll/period-status.ts`
- `src/features/payroll/period-status.test.ts`
- `src/features/payroll/period-utils.test.ts`
- `src/features/payroll/payroll-status-badge.tsx`

**Verification**

- Targeted status tests: 30 passed across 2 files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported large-chunk size warnings.
- `git diff --check`: passed.

**Remaining**

- None.

---

## Future entries

Append one dated section per completed Payroll enhancement using this outline:

```markdown
### YYYY-MM-DD — Short enhancement title

**Request / business outcome**

**Changes**

**Files**

**Verification**

**Remaining**
```

### 2026-10-20 — Export a payroll period to Excel

**Request / business outcome**

Let Payroll Admins download one payroll period's loaded details as a formatted
Excel workbook.

**Changes**

- Added an admin-route-only Export button beside Archive with progress and
  success/error feedback.
- Added a `Details` workbook with the requested 22 columns, real date cells,
  peso-formatted numeric values, filtering, frozen headers, and formula totals.
- Enriched loaded entry rows with employee number and department name; workbook
  totals use included entries to match the page summary cards.
- Pinned ExcelJS to 4.4.0 and kept it in a separately loaded Vite chunk.

**Files**

- `package.json`
- `package-lock.json`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/types.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/employees/reference-service.ts`

**Verification**

- Export and payroll-service tests: 12 passed.
- App `src` tests: 131 passed across 17 files.
- `npm run lint`: passed.
- `npm run build`: passed; ExcelJS emitted as its own async chunk. Vite still
  reports large chunks for ExcelJS and the existing PDF assets.
- `git diff --check`: passed.

**Remaining**

- The published Power Apps player download path has not been exercised. Verify
  the download and workbook in the published app before relying on it.
- Deployment was not run; the Code Apps CLI requires separate confirmation.
- npm's post-install audit still reports five advisories, including critical
  findings in the existing Vitest/tinypool toolchain and a moderate finding in
  ExcelJS's uuid dependency. No breaking audit fix was applied.
- A workspace-wide Vitest run discovered unrelated skill-source tests with
  failures. The app's complete `src` test suite passes independently.

### 2026-10-20 — Put requested fields first in Excel export

**Request / business outcome**

Show Period, Start, End, Pay date, Status, and Department as the first six
columns in the payroll workbook, in the requested order.

**Changes**

- Moved Department into the sixth position; remaining payroll columns follow.
- Updated the export test's expected header order.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`

**Verification**

- Focused export tests: 6 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- The workbook download path in the published Power Apps player remains
  unverified.

### 2026-10-20 — Fix export status filtering and use full detail by default

**Request / business outcome**

Include payroll periods with legacy status values in date-range exports and
remove the detail-level choice so every export uses the established Full
detail column set.

**Changes**

- Normalize period status values before comparing them with the selected
  Processing, Ready, and Paid filters. This includes older Dataverse choice
  values that already display as their current status labels.
- Removed Summary and Custom detail-level controls. The export now always uses
  the existing Full detail columns; optional bank details remain excluded by
  that preset.
- Added regression coverage for a September 30 period with a legacy Processing
  status and for the full-detail-only dialog.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/payroll-export-dialog.test.tsx`

**Verification**

- `npm run lint`: passed.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vitest and Vite build could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config.

**Remaining**

- A period with no payroll rows matching the selected department remains
  excluded by the existing department filter.

### 2026-10-20 — Simplify payroll export details and add quarter browsing

**Request / business outcome**

Remove duplicate Status and Department detail columns, allow Payroll to be
browsed by quarter, and limit each page to six periods.

**Changes**

- Removed the repeated Status and Department columns from the single-period
  and per-period Details sheets. The report header still shows both values.
- Added a Quarter 1–4 filter based on payroll period start date, with an
  All quarters option. It filters both active and archived period lists.
- Set active and archived period tables to six rows per page and reset their
  page position when the quarter changes.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/period-utils.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll.tsx`

**Verification**

- `npm run lint`: passed with one existing React hook dependency warning,
  addressed in this change. The final lint run passed without warnings.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vite build could not complete because the sandbox denies access to the
  workspace parent directory while Vite resolves its config. Runtime export
  tests were not run.

**Remaining**

- Quarter filtering applies across all years and uses the period start date.

### 2026-10-20 — Configure payroll Excel exports (Phase 2)

**Request / business outcome**

Let payroll admins choose a detail level and column groups, then download a
two-sheet workbook with a period summary and selected payroll details.

**Changes**

- Replaced immediate export with an accessible dialog using the existing
  Radix-backed dialog, button, label, and checkbox components.
- Added Summary, Full detail, and Custom presets, a single column/group
  configuration, a live employee/period/column count, and the filename preview.
- Added the sensitive-data warning when Bank details is selected. Bank name
  and account number are mapped from the employee records already loaded for
  the period.
- Added Summary and Details sheets. The Summary sheet contains period dates,
  status, employee count, included-entry totals, and export actor/time; Details
  reflects the selected columns and retains its totals row and filters.
- Used the signed-in Power Apps host name for “Exported by”.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export-dialog.test.tsx`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/services/payroll-period-service.test.ts`
- `src/features/payroll/types.ts`
- `src/pages/payroll-period.tsx`

**Verification**

- App `src` tests: 136 passed across 18 files, including export selection,
  workbook content, dialog interaction, and employee bank-field mapping.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports large chunks for ExcelJS and PDF assets.
- `git diff --check`: passed.

**Remaining**

- The app has not been pushed to the Power Apps environment. The published
  Power Apps download path remains unverified.

### 2026-10-20 — Extend Excel export to multiple periods and filters

**Request / business outcome**

Continue the staged payroll export with list-page multi-period exports and
filtering while preserving the existing workbook and column-group behavior.

**Changes**

- Added period-batched export entry loading with Dataverse continuation-token
  paging and employee/department enrichment through existing services.
- Added row export buttons for active and archived periods, active-period
  selection, selection export, and an all-period export entry point.
- Added combined and per-period workbook layouts, period sheet-name cleanup,
  multi-period summary rows, and multi-period filename generation.
- Added pay-date, status, archived, department, and currently-visible employee
  filters to the existing dialog. The filters operate on the periods loaded for
  that export and do not mutate saved payroll data.
- Added pure helpers and tests for filtering, sheet names, and period row sets.
- Removed an existing payroll-entry diagnostic log that included comment text.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/features/payroll/services/payroll-period-service.ts`
- `src/features/payroll/types.ts`

**Verification**

- `npm run lint`: passed after the latest changes.
- `npx tsc -b --pretty false`: passed.
- Vite build and Vitest could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config. No test
  results are available for this change.

**Remaining**

- The existing audit is period lifecycle stamps (Ready/Paid/Locked actor and
  date fields), not an append-only event record. Export event auditing remains
  omitted as requested because there is no suitable data source.
- The list-page export is available through row actions, selected periods, or
  the all-periods action. The dialog's date range filters the periods already
  loaded for that action.
- Power Apps deployment and in-player downloads have not been verified.

### 2026-10-20 — Complete available Stage 5 Excel export safeguards

**Request / business outcome**

Finish Stage 5 where the app has a suitable data source, leaving export audit
records out because no appendable audit source exists.

**Changes**

- Added a Payroll Admin check in the export page handlers and workbook dialog.
- Warned in the dialog and Summary sheet when exported periods are not in the
  final Locked/Paid status; retained a Status column in each Details layout.
- Added a Continue/Cancel warning above 5,000 detail rows and progress feedback.
- Yielded to the browser while writing large detail sets to keep the interface
  responsive and prevented duplicate workbook generation.
- Set workbook title and creator, restored focus after dialog close, and gave
  the notification region an explicit accessible label.
- Added unit coverage for final, mixed, non-final, archived, and 5,000-row
  boundary behavior.
- Left export audit persistence out: the existing period lifecycle stamps
  cannot store repeated export events or employee counts.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export-dialog.tsx`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/providers/sonner-provider.tsx`

**Verification**

- `npm run lint`: passed.
- `npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- Vitest and Vite build could not start because the sandbox denies access to
  the workspace parent directory while Vite resolves its config.

**Remaining**

- Export auditing requires a confirmed Dataverse event data source and schema.
- Power Apps deployment and in-player download behavior remain unverified.

### 2026-10-20 — Match the payroll workbook report layout

**Request / business outcome**

Adjust the Excel sheet to match the supplied example, with period details above
the employee table.

**Changes**

- Added Period and Status on the first row, then Pay date and Department on the
  second row, followed by a spacer and the employee payroll headers.
- Moved Department out of each detail row and summarized the distinct
  departments represented in the exported entries in the report header.
- Kept filters on the employee table, froze the four header rows, and moved
  totals to the bottom of the new layout.

**Files**

- `src/features/payroll/payroll-export.ts`
- `src/features/payroll/payroll-export.test.ts`
- `src/pages/payroll-period.tsx`

**Verification**

- Focused export tests: 6 passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reports large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- The workbook download path in the published Power Apps player remains
  unverified.

### 2026-10-20 — Limit payroll period select-all to the current page

**Request / business outcome**

Make the active-period table's header checkbox select only the periods visible
on the current page, so the selection count matches the user's action.

**Changes**

- Updated the header checkbox to select or clear only the visible active
  periods. Periods selected on other pages remain selected when changing the
  current page.
- Updated the accessible label to describe the current-page behavior.

**Files**

- `src/pages/payroll.tsx`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-20 — Add year filtering and remove the all-period export action

**Request / business outcome**

Remove the global Export all periods button and let admins filter payroll
periods by year and quarter together.

**Changes**

- Removed the global all-period export button. Per-row and selected-period
  exports remain available.
- Added a year selector whose options come from the loaded active and archived
  payroll periods. Year and quarter filters work together on both lists.
- Changing either filter clears period selections and returns both tables to
  their first page.

**Files**

- `src/pages/payroll.tsx`
- `src/features/payroll/period-utils.ts`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Year options reflect periods currently loaded in the app.

### 2026-10-20 — Export selected periods without a configuration modal

**Request / business outcome**

Remove the export configuration modal because periods are already chosen in
the table, while retaining both requested workbook layouts.

**Changes**

- Replaced the modal with direct export actions for one combined Details sheet
  or one Details sheet per selected period.
- Exports use exactly the checked periods and the existing full-detail column
  set. Single-row export actions continue to export that period directly.
- Removed the same configuration modal from the payroll period detail page;
  its Export action now downloads that period's full-detail workbook directly.
- Kept non-final warnings visible beside selected periods and in the workbook
  summary. Single-row exports also show a warning toast before download.
- Kept the 5,000-row safeguard as an inline Continue/Cancel prompt, and kept
  progress, admin, filename, and workbook property behavior in the page handler.
- Removed the unused export dialog component and its tests.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll-period.tsx`
- `src/features/payroll/payroll-export-dialog.tsx` (removed)
- `src/features/payroll/payroll-export-dialog.test.tsx` (removed)

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Export audit entries remain unavailable because there is no confirmed audit
  data source, as documented in the Stage 5 completion entry.

### 2026-10-20 — Include both detail layouts in one Excel export

**Request / business outcome**

Keep one Export to Excel action and include both requested detail layouts in
the downloaded workbook.

**Changes**

- Replaced the two layout-specific export buttons with one Export to Excel
  button for selected periods.
- Every workbook now contains a combined Details sheet and separate
  period-named detail sheets, alongside the Summary sheet. A single-period
  workbook keeps its existing Summary and Details sheets because both layouts
  are equivalent for one period.

**Files**

- `src/pages/payroll.tsx`
- `src/features/payroll/payroll-export.ts`

**Verification**

- `npm.cmd run lint`: passed.
- `npx.cmd tsc -b --pretty false`: passed.
- `npm.cmd run build`: passed; Vite reports existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-20 — Align export and clear actions

**Request / business outcome**

Place Export to Excel beside Clear in the selected-period action bar.

**Changes**

- Moved Export to Excel into the right-aligned action row beside Clear.
- Kept the non-final period warning below the action row.

**Files**

- `src/pages/payroll.tsx`

**Verification**

- `npm.cmd run lint`: passed.
- `git diff --check`: passed.

**Remaining**

- None known.

### 2026-10-21 — Preview payroll totals while editing

**Request / business outcome**

Show the effect of unsaved payroll input changes immediately in the entry
editor's earnings, deductions and net pay breakdown.

**Changes**

- Added a live, explicitly unsaved preview driven by the existing calculation
  engine and the current form inputs, including the other-deduction reason.
- Load the linked employee and the statutory configuration effective at the
  cutoff end date through TanStack Query. Typing recalculates locally without
  further requests or writes.
- Share numeric input conversion between the preview and Save. Existing salary
  basis, statutory rules, unpaid-leave calculation and rounding remain intact.
- Show loading, missing-employee, invalid-input and configuration-error states
  instead of stale saved totals; offer retry for failed dependency reads.
- Disable saving until a valid preview is available and prevent input changes
  during a save. Cancel discards edits; failed saves retain them.
- Preserved the existing working-tree change that shows Comment only when
  Other Deductions is greater than zero.

**Files**

- `src/features/payroll/payroll-entry-dialog.tsx`
- `src/features/payroll/payroll-entry-dialog.test.tsx`
- `src/features/payroll/hooks/use-entry-preview.ts`
- `src/features/payroll/hooks/use-statutory-config.ts`
- `src/features/payroll/services/payroll-entry-preview.ts`
- `src/features/payroll/services/payroll-service.ts`

**Verification checklist and results**

- [x] Reproduced the stale deduction/net-pay bug with a failing regression test
  before implementation.
- [x] All six numeric inputs update the breakdown before saving, including
  fractional unpaid-leave days and the existing money-rounding sequence.
- [x] Changing Other Deductions from 5,000 to 2,000 changes net pay from 34,400
  to 37,400 in the screenshot-equivalent test fixture.
- [x] Comments follow the unsaved values and disappear with the zero-deduction
  row; empty numeric inputs follow the existing zero-on-save behavior.
- [x] Typing performs no saves or repeated dependency fetches; closed editors
  do not fetch preview dependencies.
- [x] Save receives the edited inputs; Cancel/reopen restores saved values;
  a failed save retains the draft. Previewing does not mutate the saved entry.
- [x] Loading, retry, missing employee, invalid negative input and entries
  without saved calculations are covered by regression tests.
- [x] All 16 new dialog regression tests pass in the application test run.
- [x] `npm.cmd run lint` and `npm.cmd run build` pass. Vite reports its existing
  large-chunk warnings.
- [x] `git diff --check` passes.
- [ ] Entire test suite green: `npm.cmd test -- src` reports 159 passing tests
  and one unrelated failure in `payroll-export.test.ts:279` (Excel date read
  back as a numeric serial instead of a Date). Unfiltered `npm.cmd test` also
  discovers unrelated failing tests inside imported `.agents` skill sources;
  that unfiltered run was stopped after these failures were established.
- [ ] Browser/Power Apps runtime verification: no application Playwright suite,
  Playwright package or Playwright CLI is installed; the live app was not
  deployed or tested in this task.

**Remaining**

- Resolve the unrelated export/imported-skill test failures separately.
- Verify the editor in the Power Apps host after deployment. Save reloads
  employee/configuration data, so external changes between preview and Save
  can affect the final calculation.

### 2026-10-21 — Select and export archived payroll periods

**Request / business outcome**

Align archived payroll export actions with the active table and allow batch
export of selected archived payrolls.

**Changes**

- Moved each archived period's Export button into the rightmost cell beside
  Unarchive and displayed the requested `Action` header on both tables.
- Added archived row checkboxes and a select-all checkbox for the current page,
  including a mixed state when only some visible periods are selected.
- Added an archived selection count and right-aligned Export to Excel / Clear
  actions matching the active table. Active and archived selections are independent.
- Reused the existing export handler, workbook layouts, progress indicator,
  access checks, non-final warnings and large-export confirmation.
- Preserve selections across pagination; clear them when year/quarter filters
  change, and remove a period from its selection after archive/unarchive succeeds.
- Added accessible table names and an archived-selection region label.

**Files**

- `src/pages/payroll.tsx`
- `src/pages/payroll.test.tsx`

**Verification checklist and results**

- [x] Visible `Action` headers and Export beside Unarchive verified by UI tests.
- [x] Batch export receives exactly the checked archived periods, independently
  of active selections, and uses their stored payroll values.
- [x] Select-all affects only the current page; other-page selections persist.
- [x] Partial selection, independent Clear, individual row export and selection
  cleanup after restoration pass regression tests (6 new tests total).
- [x] Year/quarter handlers inspected: both selection sets and pending export
  confirmation are cleared, and both tables return to their first page.
- [x] `npm.cmd test -- src`: 165 passed, 1 existing unrelated export test failed
  at `src/features/payroll/payroll-export.test.ts:279` (numeric Excel date serial
  read back instead of a Date). All new archived-export tests pass.
- [x] `npm.cmd run lint` and `npm.cmd run build` pass; existing Vite large-chunk
  warnings remain.
- [x] `git diff --check` passes.
- [ ] Browser/Power Apps host verification remains outstanding: no application
  Playwright suite or installed Playwright tooling; no deployment performed.

**Remaining**

- Existing Excel date round-trip test failure remains outside this UI change.
- Verify the layout in the Power Apps host after deployment.

### 2026-10-21 — Align Action headers with their buttons

**Request / business outcome**

Center the Action column headers over the row actions in both payroll tables.

**Files / changes**

- `src/pages/payroll.tsx`: gave both Action columns the same width and centered
  their headers and row buttons on the same axis.

**Verification**

- Confirmed matching header/cell alignment in both active and archived tables.
- Existing payroll page regression tests: all 6 passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed with existing large-chunk warnings.
- `git diff --check`: passed.

**Remaining**

- Visual verification in the Power Apps host after deployment; not deployed.

### 2026-10-21 — Correct exported departments, dates and worksheet names

**Request / business outcome**

Put Department in the employee detail table, show the saved Pay Date as a date
matching the app, and include Payroll in worksheet names.

**Files / changes**

- `src/features/payroll/payroll-export.ts`: removed the Department label/value
  from the metadata area and retained Department as a per-employee table column
  in single-period and batch period sheets.
- Named sheets `Payroll Summary`, `Payroll Details`, and `Payroll <period>`;
  retained sheet-name sanitization, the 31-character limit and deduplication.
- Normalize exported calendar dates to UTC midnight so Excel preserves the
  date shown in the app instead of shifting local midnight to the previous day.
- Apply the merged Pay Date cell's date format after amount-column formatting,
  including reduced/custom exports with money columns occupying B/C.
- `src/features/payroll/payroll-export.test.ts`: updated layout expectations and
  added date, batch export, custom column and missing-pay-date regressions.

**Verification checklist and results**

- [x] Reproduced the worksheet/layout mismatch and calendar-date shift before
  implementation.
- [x] Department is absent from the metadata area and correctly populated for
  each employee, including different departments within the same period.
- [x] Exported Pay Date uses `a365_paydate`, including fixtures where it differs
  from the period end, and has the `mmm d, yyyy` date format after XLSX reload.
- [x] Missing Pay Date stays blank; no cutoff-end fallback is invented.
- [x] Summary, combined details and individual period sheets use Payroll names.
- [x] Detail totals, included-row behavior, filters and optional bank columns
  remain covered by workbook tests.
- [x] All 24 workbook tests and all 171 application tests (`npm.cmd test -- src`)
  pass. This also resolves the Excel date round-trip failure reported in earlier
  entries.
- [x] `npm.cmd run lint`: passed.
- [x] `npm.cmd run build`: passed with existing large-chunk warnings.
- [x] `git diff --check`: passed.

**Remaining**

- Visual verification in Excel and the Power Apps host after deployment;
  workbook checks reload actual generated XLSX files through ExcelJS.
- No deployment performed. Unfiltered test discovery of imported skill-source
  tests remains a separate existing limitation; application tests are green.
