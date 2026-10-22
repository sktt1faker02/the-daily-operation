# Leave Management follow-up

Recorded 2026-10-22 at the owner's request. Continue on `feature/leave-module`.
See [implementation checklist](docs/leave-implementation-checklist.md),
[active requirements](PLANS.md) and [verified schema](docs/leave-data-model.md).

## Latest delivery: submission enabled in source and Dev backend

The owner's later instruction authorized the recommended blocker resolutions.
The form now uses a read-only April–March credit/workday preview and a signed
transactional server command for issuing Leave, automatic due credits and a
paid-leave debit. Insufficient credits make the entire request Unpaid. Connected
Outlook email runs after confirmed commit; failed/unknown email preserves Leave
and supports notification-only retry. See
[implementation and verification](docs/leave-posting-implementation.md).

The historical blockers below no longer describe the current implementation.
Remaining work is specific:

- Complete 2027 national coverage when Eid dates are separately proclaimed;
  until then 2027 filing is blocked. Local holidays require an employee location
  policy and calendar source. 2026 national dates are configured.
- Add an unattended monthly credit scheduler if credits must be materialized
  before any Leave is issued. Current Issue catches up automatically; preview
  projects credits without persisting them.
- Implement admin cancellation and immutable VL cash conversion separately,
  including the annual five-day limit and approved valuation rules.
- Issued Unpaid Leave now supplies all three Payroll population paths and the
  existing Processing editor's unsaved input/preview. The latest owner request
  authorizes explicit Save to apply this input to existing entries. No formulas
  changed and no background existing-entry sync was added. See
  [Payroll integration verification](docs/unpaid-leave-payroll-checklist.md).
- Verify live concurrent posting/rollback and direct ordinary-account security
  using explicitly approved test identities/records. Verify a real email only
  with an approved recipient. No such records or messages were created here.
- Publish the updated Code App when requested and verify the Power Apps host.

## Confirmed policies

- Payroll Admin issues/cancels directly; no approval workflow. Employees have
  no Leave table access or filing/self-service screen in this version.
- Paid leave consumes credits; Unpaid requires none. Paid Emergency uses VL.
- VL accrues monthly to 10 days annually; SL receives 5 days annually.
- Automate credit processing. VL and SL reset at the start of April. This later
  direction supersedes the earlier assumption of a calendar-year entitlement
  reset; it does not authorize deleting/resetting historical ledger rows.
- Zero/negative available credits lead to Unpaid leave. Do not allow a new
  deduction to create a negative balance and pretend it remains Paid.
- Leave cannot be filed on Philippine holidays. Obtain an official, versioned
  holiday calendar; do not invent dates or assume weekends are holidays.
- Maximum 5 VL **days** converted to cash annually, following the earlier
  explicit days limit. Conversions are fixed and cannot be cancelled. The latest
  phrase "5 VL conversions" is recorded in that context, not reinterpreted as
  five separate five-day conversion records.
- Issued Unpaid leave populates Payroll through Load Active Employees, Copy
  Previous Cutoff and Load Template. The owner's later request extends this to
  the existing Processing entry editor: show derived days before Save, permit
  manual adjustment, and persist/recalculate only on explicit Save. Preserve
  formulas and do not background-update existing entries when Leave changes.
- Notifications occur after the committed Leave operation. Failure does not
  roll Leave back; support explicit retry. Never claim delivery on form save.

## Delivered now

The subsequent Add Leave phase adds an admin Add Leave button and modal with
employee/type/benefit/date/note controls, complete stored calendar-year credit
preview to two decimals, validation and clear submission blockers. A pure email
template composes the confirmed subject/content from an Issued snapshot and its
linked employee's stored Work Email; it excludes internal notes and does not
send or change notification fields. See the active phase in the checklist.
Current April-period credits, calculated days, posting and sending are still
unavailable pending the explicit prerequisites. The latest PLANS.md settles
email (not Teams), recipient (employee Work Email), subject and safe contents;
these details no longer require another policy question. Sender/connection and
server delivery/retry behavior remain unresolved.

Admin `/leave` navigation, employee search, filters and cursor-paged lists,
Leave/Conversion detail dialogs, signed credit history, and complete employee/
ledger-year VL/SL balances with loading/empty/error/denied states. Failed role
lookups do not grant access. No source/ledger/money/notification mutations exist.
The history view deliberately shows stored calendar-year ledger values; it does
not claim the new April reset or automatic accruals are running.

## Next coherent implementation steps

1. **Entitlement periods and automatic credits.** Existing `a365_year` records
   calendar years; select a compatible April–March period representation and
   effective date, preserving all history. Decide how to allocate 10/12 days
   exactly with Decimal(2), posting dates, new-hire eligibility/proration and
   opening balances. Schedule VL/SL with stable employee/pool/period keys and
   catch-up retry support. No unapproved reset transaction type or destructive
   annual deletion; the reset should restrict which period's credits can be
   spent while leaving history intact. Confirm SL timing at the April boundary.
2. **Holiday/day rules.** Version the official Philippine holiday source,
   including movable dates and relevant national/local coverage. Decide whether
   an interval containing holidays is rejected or counts only permitted dates,
   weekends/work schedules, inclusive endpoints and partial-day increments.
   Define employee eligibility, backdated/future dates and overlap rules.
3. **Paid/Unpaid allocation.** Apply the confirmed fallback when available
   credits are zero/negative. Resolve a request larger than a positive balance:
   wholly Unpaid or split Paid/Unpaid? Current Leave has one Benefit value and
   no daily allocations. Do not silently split or change that schema. Allocate
   leave spanning an April/year boundary to the correct entitlement periods.
4. **Transactional posting and direct-write guards.** Register synchronous
   Dataverse command plug-ins/Custom APIs in `A365_DailyOperations`; validate the
   initiating admin and actual actor, sign/source/pool/period consistency,
   eligibility/calendar rules and immutable source snapshots. Commands must
   atomically create/update the source plus ledger, use stable operation
   identities covering both, validate matching retries and preserve cancellations.
   Deny bypass writes through all permitted normal/bulk paths. No raw HTTP app
   calls or nested ExecuteTransaction in a transactional plug-in.
5. **Concurrency/idempotency metadata.** Prepare a dedicated employee/pool/
   period coordination record with a unique key and row-version/serialization
   contract, plus a durable operation receipt/payload identity where required.
   Never lock Employee/Payroll records or store a mutable authoritative balance.
   Finalize exact columns, keys, command parameters, execution identity and
   solution registration before requesting authorization for additional schema/
   security. Existing three-table role grants remain approved; do not re-ask.
   No new environment changes or deployment are authorized by this follow-up.
6. **Cash conversion.** Enforce the five-day annual VL total server-side under
   the same coordination mechanism. No cancellation command or UI. Decide
   eligibility/date restrictions and whether "annual" follows April–March.
   Obtain the daily-rate source/formula and rounding; preserve immutable rate,
   amount, original actor/time and Recorded status. Do not execute payments or
   write amounts into Payroll. Historic Cancelled records remain readable.
7. **Leave cancellation/corrections.** Confirm required reason/date limits and
   correction policy. Keep original source/actor values and append exact original
   employee/pool/period restorations once; Unpaid has no restoration. Do not
   offer conversion cancellation. No ledger edits/deletes.
8. **Payroll boundary.** Integrate at `createPlannedEntries` in
   `src/features/payroll/services/payroll-period-service.ts`, shared by all three
   paths. Read fully paged Issued Unpaid leave scoped to missing employees and
   cutoff dates, finish all reads/validation before new-entry writes, and fail
   visibly if unreadable. Decide partial-cutoff/partial-day allocation and whether
   the Leave result replaces or adds to copied/template unpaid-day inputs.
   Keep Leave out of existing-entry update loops; clarify preservation of unpaid
   days when a user explicitly copies a template/previous cutoff onto existing
   entries. Test each path, skipped existing employees, cancelled/paid leave,
   boundaries and read failures. Do not modify calculation formulas.
9. **Notifications.** Choose email/Teams, recipients, sender/connection, content
   and issue/cancellation events. Use an after-commit flow/server dispatcher with
   separate event identity/outbox and safe retry/uncertain-delivery handling.
   Current latest-status fields alone cannot represent durable issue/cancel
   event history. Design exact storage/binding before requesting new metadata.
   Only a successful provider result sets Sent/Notified On. No sending has been
   authorized yet; finish reviewable messages/workflow before requesting it.
10. **Verification and release.** Server fault/rollback, concurrent spend,
    exactly-once cancellation/retry and immutable conversion tests. Inspect
    additive user/team roles and direct data access using ordinary Admin/Employee
    accounts; System Administrator is insufficient evidence. Verify automation
    recurrence/time zone and holiday policy. Environment auditing was disabled
    at the last check and remains unchanged. No real test financial entries,
    deployment, commit or push without a separate request.

## Acceptance additions from the owner's replies

- F-01: Monthly VL and annual SL run automatically, total the approved amounts,
  retry without duplicates and respect the agreed April boundary/qualification.
- F-02: Zero/negative credits yield Unpaid, and holidays are blocked according
  to the approved official calendar/counting rule.
- F-03: April reset preserves history and cannot reuse expired-period credits.
- F-04: Conversions enforce the annual five-day total and cannot be cancelled.
- F-05: All three Payroll new-entry paths use correct issued unpaid days, with
  formulas and existing entries unaffected by Leave changes.
- F-06: Failed notifications leave the committed Leave intact, show failure,
  and can retry without falsely claiming or duplicating confirmed delivery.

These are pending; a read-only UI is not completion of posting or automation.
