# Leave application implementation — 2026-10-22

## Employee Credit History — 2026-10-23

Subsequently cancelled by the owner on October 23: the module and its unused
personal-history API were removed before deployment. The implementation below
is historical; see [removal status](employee-credit-history.md).

Owner requested moving Credit History from the admin Leave tabs into a module
below My Payroll and allowing Payroll Employees to view their own records.
The [current acceptance and release checklist](employee-credit-history.md)
supersedes historical admin-only history UI statements below. Direct employee
table grants remain unchanged; the existing API gains server-scoped personal
reads. Deployment and ordinary-account security verification are pending.

## Submission guard repair — 2026-10-22

The signed Leave assembly 1.0.1.0 and all 20 synchronous PreOperation guards are
active in Dev. The stale marker-dependent DLL was the reproduced blocker;
stage-10 nested transaction flags were true, correcting the earlier hypothesis.
Live rollback, six guard regressions and 17 policy checks pass. Persistent
save/replay/direct-Create/email tests remain pending explicit approval of two
lasting own-employee test Leave records and an SL deduction. No email sent.
See [repair evidence and per-test status](leave-submission-fix.md).

## Current result: authorized blocker resolution

The owner's subsequent instruction to execute the recommended approaches
supersedes the policy/setup blockers recorded below. See the concrete policies,
new component purposes and verification in
[submission implementation](leave-posting-implementation.md). The following
older sections are retained as dated investigation history.

| Add Leave AC | Current verification |
|---|---|
| AC-01–02 | Admin-only modal, employee/type/benefit/date controls: application and browser tests pass. |
| AC-03 | Server April–March preview includes pending automatic credits separately; loading, errors and stale-response isolation tested. |
| AC-04 | Cancel writes nothing; pending issue blocks dismissal; fresh reopening tested. Preview is read-only. |
| AC-05 | Full inclusive weekdays, employment eligibility, overlap and known national holidays enforced server-side. 2027 remains blocked pending Eid declarations. 17 local server policy checks pass. |
| AC-06–07 | Transactional source/grants/debit command implemented. Live transaction context and active guards verified; live financial commit/rollback not exercised without an approved test employee. Form retention and commit-before-email tested with mocked boundaries. |
| AC-08 | Per-employee write lock, unique credit keys and source identity replay implemented. Stable retries and uncertain/malformed response handling tested. Live competing financial submissions not exercised. |
| AC-09 | Confirmed commit refreshes relevant queries and closes; mocked success/failure flows pass. |
| AC-10–11 | Connected Outlook binding, committed-source lookup, safe template, persistent attempt/outcome and notification-only retry implemented and tested with mocks. Unknown outcomes require review; no live email sent. |
| AC-12 | Server checks direct/team Payroll Admin membership and caller data privileges. 20 active direct-write guards verified. Ordinary-account effective access remains unverified. |
| AC-13 | Payroll formulas and historical business records untouched. Only scoped Leave metadata/API/Outlook bindings added under the latest authorization. |
| AC-14 | 240 application tests / 25 files, 17 local server policy checks, 22 Edge checks, lint, build and native solution repack pass. Live limits are explicit above. |

Automatic credits are materialized during Issue; previews calculate due credits
without writes. No unattended scheduler exists. No app publication, commit,
push, historical backfill, financial test record or test email was performed.

## Earlier phase: Add Leave modal and email confirmation

The current PLANS.md replaces the earlier broad implementation prompt for this
phase. Scope: Add Leave button/modal, balance preview, safe submission and
employee email. No unrelated conversion/Payroll/schema/security changes.

Investigation before editing: `/leave` already has LeaveAccess and read-only
lists; no entry modal exists. Reuse LeaveEmployeePicker, useLeaveBalances,
Dialog/Select/Input/Textarea/Button. Actual Leave choices/bindings remain those
verified below and were rechecked live. The current source has no posting
command, notification provider or generated email service.

Read-only installed CLI 1.0.1 discovery in the configured Dev environment:
Outlook connections matching office365: zero; invokable Leave flows: zero;
operations matching leave: only `LeaveGroup`, bound to `flowmachine` (machine
group administration, not an employee Leave command). Do not invoke or register
it for Leave posting. No suitable transactional operation is available.

Missing prerequisites: approved date/workday/partial-day/overlap/eligibility and
Philippine holiday coverage; April-period balance representation; treatment when
requested days exceed a positive balance; transactional server posting guards;
an Outlook/flow connection and confirmed sender. The latest plan now confirms
employee stored Work Email, subject and allowed email contents. Earlier questions
about channel/recipient/content are superseded. No production notification or
posting is to be simulated to claim completion.

| New plan ID | Verification before/after editing | Initial status |
|---|---|---|
| AC-01 | Admin opens labelled Add Leave; employee/role-error sees no action | Ready |
| AC-02 | Search actual employees, choose VL/SL/Emergency and Paid/Unpaid, enter separate dates/note | Ready |
| AC-03 | Complete ledger reads, two-decimal VL/SL, labelled period, loading/error; late employee response cannot replace current selection | Stored calendar history ready; current April spendable balance blocked |
| AC-04 | Cancel/Escape/close produce no writes/email; reopening clears all values | Ready |
| AC-05 | Invalid/missing/reversed dates/unknown choices/long note blocked; unavailable holiday/counting data explicitly block Submit | Ready for validation; approved rule calculation blocked |
| AC-06 | One Issued source plus required ledger via verified atomic server command | Server/policy blocked |
| AC-07 | Server rollback on save failure, form values retained and useful error | Server blocked; local validation preservation ready |
| AC-08 | Double-submit/timeout replay tested at server with stable source+ledger identity | Server blocked |
| AC-09 | Confirmed creation refreshes list/balances then closes; no false success | Server blocked |
| AC-10 | Email only after confirmed commit, lookup employee Work Email, exact subject, escaped safe content excluding notes | Pure composition ready; dispatch blocked |
| AC-11 | Missing email/send failure leaves source committed, persists Failed; notification-only retry and uncertain-send handling | Provider/server blocked |
| AC-12 | Submit handler rechecks successful admin role; direct ordinary-user requests tested | UI ready; ordinary-account/server tests unavailable |
| AC-13 | Diff Payroll, conversion, generated/schema/config; no historical writes | Ready |
| AC-14 | Targeted and full src tests, Edge UI checks, lint/build, diff/path checks; report all gaps | Pending |

This phase can deliver the concrete modal and safe email-composition logic, but
cannot enable posting, current-period spending or sending without these
prerequisites. Existing approved role setup must not be requested again.

### Add Leave phase delivery and verification

- Delivered `AddLeaveDialog` on `/leave` with labelled employee/type/benefit/
  date/note controls, required-value and date-order validation, explicit unknown
  day count, Emergency-to-VL/Unpaid treatment text, loading/error/retry credit
  states and a two-decimal **stored calendar-year** credit preview. It does not
  mislabel that history as a verified April–March spendable balance.
- The employee picker is extended, rather than duplicated: forms require one
  employee and omit All employees; existing list filters retain that option.
  Cancel/Escape/close unmount the form; reopen clears values. TanStack Query
  employee keys prevent a prior employee's late response from replacing the
  current selection. Submit rechecks access even on a native programmatic submit.
- The Submit button is disabled and explains each actual blocker. No mutation,
  successful-save toast, invalidation or email trigger is fabricated. In-flight
  posting cannot occur, so dismissal never implies cancelling a pending write.
- `notification-template.ts` composes only an Issued snapshot linked to the
  matching actual Employee. It accepts no recipient override, uses stored Work
  Email, rejects missing/multiple/header-injection addresses, escapes HTML,
  uses the exact subject, preserves date-only days/dates, and excludes internal
  notes and unverified remaining balances. This helper does **not** send, mark
  Sent/Failed or persist a notification. Provider acceptance/retry remain blocked.
- Tests: all 229 application tests in 24 files passed with
  `npm test -- src --maxWorkers=2 --testTimeout=60000`; targeted Leave suite has
  58 tests. Default unscoped test discovery still includes unrelated imported
  `.agents` tests and is not changed. Lint passed. TypeScript caught test-only
  `exact` options unsupported by RTL ByRole queries; removed them, retaining
  exact default string matching. Production build passes with the existing
  large-chunk warning. All 21 Edge checks pass with synthetic platform responses,
  including modal opening, two-decimal preview, date-order validation, fresh
  reopening, keyboard dismissal, disabled Submit, employee denial and mobile
  layout/scrolling. No live records or emails were created.

| Add Leave AC | Result |
|---|---|
| AC-01 | Passed UI: Add Leave opens for authorized admin; no action for denied/loading/failed-role users. |
| AC-02 | Passed controls, employee-specific search, choices and date selection. Calculated days remain explicitly unavailable, not guessed. |
| AC-03 | Partial: complete stored calendar-year credits, two-decimal formatting, loading/failure/retry and late-response isolation tested. Correct current April-period spending balance remains blocked by the period model. |
| AC-04 | Passed Cancel and fresh reopening; keyboard dismissal covered in browser checks. No posting/email path exists to write on cancellation. |
| AC-05 | Partial: required/unknown-choice/invalid/reversed dates and oversized note validation tested. All submission blocked while policy and verified holiday data are unavailable. |
| AC-06 | Incomplete: no safe atomic source/ledger command is registered. |
| AC-07 | Incomplete server rollback; local validation/credit failures keep entered values. No partial multi-record save introduced. |
| AC-08 | Incomplete server idempotency/concurrency. Disabled Submit is a UX safeguard, not proof of these guarantees. |
| AC-09 | Incomplete: successful-create refresh/close cannot be verified without a posting command; no fake success path. |
| AC-10 | Partial: safe pure email composition tested against synthetic committed-record snapshots and actual schema fields; no dispatch/commit-trigger integration. |
| AC-11 | Incomplete: no provider/Failed persistence/notification-only retry. Missing stored email yields an unavailable draft; source is never mutated by composition. |
| AC-12 | Partial: UI gates and submit-handler denial tested; ordinary-account direct request/server operation checks unavailable. Named-role evidence from prior phase is not ordinary-user proof. |
| AC-13 | Passed diff checks: no Payroll/calculation/conversion/generated/schema/config changes or historical-record writes for this phase. |
| AC-14 | Passed local checks: 229 application tests, 58 targeted Leave tests, 21 Edge checks, lint, production build and diff/path review. Power Apps host, ordinary-account security and live server/provider behavior remain unverified. |

### Concrete next prerequisites

1. Confirm workday/partial-day/eligibility/overlap and insufficient-positive-
   credit handling; provide approved Philippine holiday coverage. Retain the
   confirmed zero/negative-to-Unpaid rule, Emergency VL and April reset.
2. Finalize and separately authorize the minimal transactional server command,
   direct-write guards and coordination/operation identity metadata described
   in Leave-Follow-Up.md. No new schema/security change is covered by this UI task.
3. Create an Office 365 Outlook connection in the
   [configured Dev Connections page](https://make.powerapps.com/environments/b58b083e-d27d-eabd-a143-2a49dcb9d89a/connections)
   and confirm the sending account, or provide an approved equivalent flow.
   Re-list connections/flows and generate the supported binding; do not hand-edit
   generated files. An available connector alone does not solve durable retry,
   commit ordering or unknown-send outcomes.
4. Use the confirmed source ID to look up its actual Employee Work Email after
   commit. Persist Failed independently when missing/send failure; persist Sent/
   Notified On only after provider acceptance. Design a notification-only retry
   keyed to that existing source. No test Leave or email without target approval.

Scope: execute the active [PLANS.md](../PLANS.md) on `feature/leave-module`.
Existing working-tree edits to PLANS.md, Payroll-Enhancements.md and the separate
implementation prompt are preserved. No deployment, commit or business-data writes.

## Investigation before implementation

- Routing: `src/router.tsx`; preserve Power Apps basename. Navigation:
  `src/pages/_layout.tsx`; reuse its desktop/mobile groups and existing styles.
- Existing screens: no Leave route or feature module. Reuse Card, Table, Tabs,
  Input, Select, Dialog, Skeleton and Button; the searchable UserPicker supplies
  the Popover/Command pattern for an employee picker. Employee CRUD loads salary
  and identifiers, so Leave will request only employee ID/name/number instead.
- Existing access: `useAccessProfile` resolves direct/team roles via
  `getCurrentUserRoles`; `WhoAmIService` supplies authenticated user identity.
  `deriveAccess` has a legacy missing-Employee fallback. Leave must require a
  settled, successful role lookup and admin membership; never use that fallback.
  Existing Payroll gates and calculations remain outside this change.
- Generated registrations: `leaves`, `leavecashconversions`,
  `leavecredittransactions` already exist once each. Live MCP describe of all
  three tables matches generated primary IDs, employee/user/source lookups and
  numeric choices. Bindings are `a365_Employee`, `a365_IssuedBy`,
  `a365_ConvertedBy`, `a365_CancelledBy`, `a365_Leave`, `a365_CashConversion`;
  see [metadata register](leave-data-model.md). No generated files need editing.
- Read-only role inspection rerun: both named roles have zero differences from
  the approved matrix. Admin: Leave/Conversion Create, Read, Write, Append,
  Append To; ledger Create, Read, Append. No Delete/Assign/Share or ledger Write.
  Employee role: none. Other roles/teams/shares and ordinary-account direct
  requests remain unverified; named-role metadata is not effective-access proof.
- SDK installed contracts expose CRUD, executeAsync and skipToken paging, not a
  public transaction or alternate-key upsert method. Microsoft documents that
  alternate-key support is unavailable in Code Apps. Separate CRUD calls cannot
  enforce the required atomicity or concurrent balance policy.
- Live read-only Custom API discovery for names containing `leave` returned no
  matching operations. This is scoped discovery, not proof that all plug-in
  registrations or unrelated APIs are absent. No verified Leave posting command
  or generated operation binding is available for this implementation.
- Vercel React best-practices skill is absent from installed skill directories.
  Power Platform Code Apps, Dataverse overview/query/security guidance and
  Microsoft Learn were consulted. DESIGN.md contains earlier Payroll status
  requirements; implemented application components supply the visual patterns.

## Decisions

Owner confirmed on 2026-10-22:

- Admins issue/cancel directly, with no approval workflow; Paid consumes credits,
  Unpaid requires none. Emergency consumes VL.
- VL accrues monthly to 10 days annually; SL receives 5 days annually. Separate
  calendar-year transaction balances. VL conversion maximum: 5 days annually.
- Expanded scope: Issued Unpaid leave supplies **new** Payroll entries through
  Load Active Employees, Copy Previous Cutoff and Load Template. Payroll formulas
  and existing entries must not be automatically updated by Leave.
- Expanded scope: notifications can fail independently of a committed Leave
  operation and must be retryable.

Outstanding questions were presented together after that response: calendar/day
counting, partial days, eligibility/dates/overlaps, exact two-decimal monthly VL
allocation (10/12 cannot be represented exactly), timing/qualification/opening
credits/manual versus scheduling, insufficient credits, cross-year/expiry rules,
conversion rates/eligibility/cancelled-capacity policy, cancellation/corrections,
cutoff allocation and copied-input precedence, notification channel/recipients/
sender/content/events. No defaults are inferred from the confirmed high-level
entitlements. Policies do not authorize new schema, security or deployment.

Payroll investigation: all three creation routes converge on
`createPlannedEntries` in payroll-period-service.ts. Copy/template also have
separate existing-entry update loops; Leave must never insert recalculation into
those loops. Full containment can be read from dates/days, but partial-cutoff and
partial-day allocation cannot be inferred from only a total Days field.
No Payroll service changes are made until those counting/precedence rules exist.

Notification investigation: existing Leave notification status/timestamp columns
are available, but no generated messaging connector/Leave notification operation
is registered. Select an authorized connection/flow and message contract first.
Deliver only after the Leave transaction commits; retain failures for explicit
retry and use a stable event identity distinct for issue/cancel. Record Sent and
Notified On only after confirmed delivery. Duplicate-send/uncertain-delivery
handling and historical event storage need a concrete server design; current
columns represent only the latest required notification. No provider or flow
has been created, no email/Teams message has been sent.

Latest owner direction, also 2026-10-22: automatic processing; zero/negative
credits become Unpaid; Philippine holidays cannot be filed; VL/SL reset at the
start of April; conversions are fixed/non-cancellable, maximum five VL days
annually in the earlier days-limit context. This supersedes the earlier
calendar-year reset assumption and optional conversion-cancellation scope.
Existing calendar-year ledger history must remain intact. The owner requested
delivery of the current work plus a later follow-up; the concrete remaining
work and unanswered dependent details are in [Leave-Follow-Up.md](../Leave-Follow-Up.md).
No further business-policy questionnaire is pending for this delivery.

## Required server work — proposed, not applied

Use a solution-contained synchronous Dataverse command plug-in/Custom API for
each operation. Confirm transaction context, derive the actual actor on the
server, validate source/ledger consistency, and reject bypass writes using
synchronous table guards on all permitted Create/Update paths (including bulk
paths). Use one stable operation identity covering the source and ledger, verify
matching payloads on retry, and preserve immutable historical fields. Generated
Code App operation bindings must come from the supported CLI after registration.

Concurrent spending needs a dedicated coordination record per employee/pool/year
with a unique key and row-version check/serialization, shared by every posting
path. This is additional metadata requiring explicit authorization; it must not
store a mutable balance or use Employee/Payroll as a lock. A separate durable
operation receipt/key may also be needed for manual grants and payload matching.
Names and schemas are proposals until approved and read back. No new role grants
are assumed; prove authorization using the existing privileges. Determine and
document execution identity before enabling commands. Do not nest
ExecuteTransaction inside a synchronous transactional plug-in. A Power Automate
flow or client batch alone does not establish these guarantees.

Before any environment change, finalize the concrete policy-dependent command
contracts, guards, coordination/receipt metadata, ordinary-admin execution
identity and server tests, then obtain authorization for that exact scope.

References: [Code Apps Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse),
[generated action bindings](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/add-dataverse-action-function),
[synchronous transaction guidance](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/best-practices/business-logic/avoid-batch-requests-plugin),
[optimistic concurrency](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/optimistic-concurrency).

## Acceptance checklist before editing application code

| ID | Concrete verification | Initial status |
|---|---|---|
| AC-01 | Diff generated files/config/schema; reuse three sources; preserve Employee/User relationships and Payroll | Ready |
| AC-02 | Exercise admin navigation, search/filter/paging, details, accessible loading/empty/error/denied states; posting forms only after dependencies | Read-only ready; forms blocked |
| AC-03 | Test signed VL/SL sums across multiple pages, cancelled-source restorations, employee/year isolation, empty results and later-page errors; never show zero on errors | Ready |
| AC-04 | Test approved counting, eligibility and pool/year allocation; Unpaid produces no debit | Policy/server blocked |
| AC-05 | Test approved grants/accruals and stable scheduled keys; no invented scheduler/reset | Policy/server blocked |
| AC-06 | Test conversion eligibility/cap/rate/rounding and immutable PHP snapshot; no Payroll writes | Posting blocked; history ready |
| AC-07 | Test cancellation originals and exactly-once restoration including Unpaid; no ledger edits/deletes | Policy/server blocked |
| AC-08 | Server tests for double submit, timeout, matching retry and conflicting payload; one source and intended ledger rows | Server blocked |
| AC-09 | Server fault injection rolls back all writes; concurrent spend/cancellation tests enforce policy | Server blocked |
| AC-10 | Test loading/failed role lookup/missing Employee/employee denied without Leave reads; test direct requests as ordinary Admin/Employee and inspect additive roles/teams | UI ready; ordinary accounts unavailable |
| AC-11 | Compare numeric choices/bindings to live metadata; test Date Only across offsets and historical actor/time/rate displays | Reads ready; writes blocked |
| AC-12 | Diff Payroll/Employee logic and data; no financial, notification or integration writes | Ready |
| AC-13 | Run targeted tests, `npm test -- src`, lint, build, relevant browser checks; record gaps including inactive environment auditing | Pending |
| AC-14 | Update this checklist, data-model behavior and dated enhancement log; distinguish decisions/assumptions and limitations; no commit/deploy | Pending |

The schema-stage checklist in leave-data-model.md is historical and has different
AC numbering; this checklist tracks the active application's AC-01–AC-14.

## Delivery verification

| ID | Current result and evidence |
|---|---|
| AC-01 | Passed local diff/live metadata checks: three sources reused; generated files, configuration, Employee/User links and Payroll services unchanged. |
| AC-02 | Read-only portion passed RTL/browser checks: navigation, labels, search/year filtering, server paging, dialogs, loading/empty/retry/error and access-denied. Posting forms remain incomplete. |
| AC-03 | Passed unit/service tests for complete multi-page signed sums, restoration offsets, year/employee isolation, invalid/duplicate data, repeated cursors, empty results and later-page failures. UI never presents failed reads as zero. No transactional snapshot or live financial test data was claimed. |
| AC-04 | Incomplete: paid/unpaid/Emergency high-level policies confirmed; safe issuance, exact counting/eligibility and allocations pending follow-up. |
| AC-05 | Incomplete: automatic VL/SL entitlements and April reset confirmed but no scheduler, opening grants, rounding allocation or entitlement-period metadata implemented. |
| AC-06 | Historical rate/amount displayed as stored PHP snapshots; conversion posting/annual enforcement pending. Latest policy prohibits conversion cancellation. |
| AC-07 | Incomplete for Leave cancellation/restoration; historical cancellation fields displayed. No conversion cancellation or ledger edit/delete operation exists. |
| AC-08 | Incomplete: no mutation commands; server idempotency/retry tests cannot run against an unavailable command. Read retries tested separately. |
| AC-09 | Incomplete: no atomic server operation, coordination metadata or concurrent spending tests. No partial multi-record saves shipped. |
| AC-10 | Passed UI tests for denied, loading and failed role lookup without Leave reads; named-role live matrix matches. Effective additive-role/team/sharing access and ordinary-account direct requests not verified. |
| AC-11 | Read metadata/choices/source contracts verified and Date Only tested with UTC, +14/-12 offsets and invalid dates. Historical original actors/times and amounts read without mutation; server write validation remains pending. |
| AC-12 | Payroll calculations/entry services and Employee records unchanged. Latest scope expansion recorded; unpaid Payroll input and notifications remain incomplete, without side effects. |
| AC-13 | 36 new Leave tests passed. Full `npm test -- src` initially hit the known 5-second Excel export timeout (206 passed, 1 timeout). Rerun with `--maxWorkers=2 --testTimeout=60000`: all 207 tests in 22 files passed; no test configuration changed. Lint/build passed; existing large-chunk warning. 13 local Playwright/Edge checks passed using synthetic boundary responses. Real Power Apps host/account tests and server safeguards remain unverified. |
| AC-14 | Passed documentation scope: PLANS owner-decision addendum, this checklist, data-model application note, enhancement log and requested Leave-Follow-Up.md. No commit, push or deployment. |

Browser checks: `scripts/leave-ui-check.mjs`, using a temporary Playwright runner
and the installed Edge browser. It replaces only platform/Leave service responses
for local UI verification, uses synthetic records, blocks external network
requests and does not send any request to Dataverse. It covers navigation,
date-only details, dialog keyboard close, paging, employee selection, balances,
tabs, empty/error/balance-error states, employee denial and 390px overflow.
It is not a substitute for ordinary-account data-access testing. No application
dependency or lockfile was changed. A mobile screenshot is ignored locally under
`.playwright-cli/`.

Environment audit capture is still not verified active: last inspection showed
environment-wide auditing disabled; this task neither enables it nor claims
audit history. No sample/real financial records were created or modified.

The active requirements' notification and Payroll exclusion is superseded by
the owner's replies. Follow-up acceptance additions F-01–F-06 are recorded in
Leave-Follow-Up.md and are incomplete; delivered history/balances do not imply
automation, April reset, holiday validation or safe posting is running.
