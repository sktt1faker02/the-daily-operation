# Leave submission implementation — 2026-10-22

The owner authorized executing the recommended resolutions to the listed blockers
and supplied an Inquirer 2027 holiday link, requesting its 2026 counterpart.
This supersedes the earlier unresolved-policy/setup-only gates for this scoped
implementation. Target remains The Daily Operation - Dev,
`https://org9a7651f0.crm5.dynamics.com`, solution `A365_DailyOperations`, prefix a365.
No app deployment, commit, Payroll formula changes, migration or test email.

## Recommended policies adopted under that authorization

- Inclusive Monday–Friday full workdays; no half-day requests in this version.
  Exclude intervening national holidays/weekends. Reject holiday/weekend endpoints.
  Reject overlaps with Issued Leave for the employee. Active and On Leave statuses
  qualify; dates must fall during employment and within one April–March period.
- Paid Emergency uses VL; SL uses SL. If an entire request cannot be covered,
  record the entire request as Unpaid. No split or negative deduction.
- VL earns 10 annually, monthly in arrears, using differences of rounded
  cumulative twelfths (0.83/0.84, totaling exactly 10). Full employment months only.
  SL gets 5 at the April start or on joining. No carryover. April reset isolates
  periods and retains old records; no destructive zero/reset transactions.
- Server source GUID is the stable client operation identity. Matching retries
  return the existing result only after checking employee/type/requested benefit/
  dates/note. An uncertain response retains the operation identity and values.
- Per-employee coordination row serializes overlap and credit checks for every
  pool/period. Source, automatic credits and deduction share a synchronous
  Dataverse transaction. Direct/bulk source/ledger writes are rejected outside
  the validated command. Do not nest ExecuteTransaction in the plug-in.
- Existing calendar-year ledger history remains unchanged. New movements carry
  an explicit April-period tag. Untagged legacy employee ledger history blocks
  posting until its allocation is resolved; no silent backfill.
- Email goes to the recorded employee Work Email through the created Outlook
  connection, after commit. No notes. Failure never rolls back Leave. Provider
  acceptance is not inbox delivery; unknown send outcomes require review before
  resending. Notification-only retry must not repeat Leave/credit writes.

## Holiday evidence

2026: [Inquirer annual list](https://newsinfo.inquirer.net/2104754/list-2026-regular-holidays-special-non-working-days/amp),
[March 20 Eid'l Fitr](https://newsinfo.inquirer.net/2194783/palace-declares-march-20-2026-a-regular-holiday-for-eidl-fitr),
[May 27 Eid'l Adha](https://newsinfo.inquirer.net/2232380/palace-on-eidl-adha).
February 25 is a special **working** day and is not blocked as a holiday.

2027: the supplied [Inquirer link](https://newsinfo.inquirer.net/2303491/list-holidays-special-non-working-days-for-2027)
and AMP form returned 403. Cross-check:
[Proclamation 1427](https://lawphil.net/executive/proc/proc2026/proc_1427_2026.html),
[PCO announcement](https://pco.gov.ph/news_releases/pbbm-declares-2027-regular-and-special-holidays/).
The 2027 Eid dates are explicitly awaiting separate declarations; do not invent
them. National coverage only; no employee location exists for local declarations.
2027 remains provisional until the two Eid dates are verified and added.

## Scoped server/configuration changes

These scoped definitions were created in Dev, read back, and exported with the
native solution tooling. Existing business schema and role grants were reused:

- `a365_LeavePolicy`: organization-owned, Name + Policy JSON; server-only access.
- `a365_LeaveCoordination`: organization-owned, primary GUID equal to the employee
  GUID, technical Name + Token. No mutable balance. Server-only access.
- Ledger `a365_CreditPeriod`: optional text, YYYY-04-01 identifier; no migration.
- Leave `a365_RequestedBenefit`: original requested choice numeric value for
  matching retries when a Paid request becomes Unpaid, stored as an Integer;
  `a365_EmailAttempt`, `a365_EmailOutcome`, `a365_EmailStartedOn` track the
  notification lease. No historical record backfill.
- One solution-contained synchronous Custom API `a365_LeaveCommand`, JSON request
  and JSON response, backed by a separate signed Leave plug-in assembly. Guards
  on Leave/ledger writes. Caller role resolved directly and through teams; data
  writes retain caller permissions. Internal coordination/config uses server
  service only. No changes to existing Payroll role privileges required.
- Generated operation and Outlook bindings via installed pa CLI, never hand edits.
- Connected Outlook connection `cd0d5228-eb14-427a-8f37-f17f2964f85f`, named
  The Daily Operation Leave Email, uses the authenticated account
  `jomari@automations365.com`. No arbitrary From override or test send.

## Concrete acceptance checks before code changes

| Plan AC | Check |
|---|---|
| 01–02 | Existing admin button/modal selections retained; no employee navigation. |
| 03 | Read-only server preview includes uniquely identified grants due, separately labelled as pending; employee switching cannot show stale response. Issue alone materializes credits atomically. |
| 04 | Cancel produces no Leave/email; in-flight issue prevents dismissal; fresh reopen. |
| 05 | Holiday/weekend/end-order/year coverage/employment/overlap checks on server and useful preview errors. |
| 06 | One source GUID + intended ledger rows in one transaction, actual actor/time. |
| 07 | Failure throws and rolls back all writes; entered values retained. |
| 08 | Matching timeout replay returns prior result; mismatched payload rejected; concurrent spending serialized. |
| 09 | Only confirmed commit invalidates Leave list/period balances and closes. |
| 10 | Read linked Work Email after commit; sanitized template; sending only after committed source. |
| 11 | Failed/missing email preserves Leave and supports notification-only retry; no blind unknown-outcome resend. |
| 12 | Named-role check in server and direct/bulk guards; ordinary-account testing reported separately. |
| 13 | Payroll/conversion/history diff unchanged; no migrations or financial sample entries. |
| 14 | Meaningful policy/server/client tests, lint/build/browser checks; live-test limitations explicit. |

## Delivered verification and limits

- The current frontend enables Submit after successful server preview and local
  validation. A stable source GUID survives uncertain responses; matching retries
  reuse it. Pending submission prevents dismissal. Confirmed commit refreshes
  the relevant list/balance queries and closes even when notification fails.
- Signed `A365.Leave.Plugins` assembly, `a365_LeaveCommand` and 20 synchronous
  write guards are registered. Live diagnostics verified the transaction context
  and active guards; see [runtime evidence](leave-posting-verification.json).
- Live read-only preview of an eligible existing employee passed the current
  period/numeric credit contract; ledger count stayed unchanged. Evidence stores
  no employee identity or balance.
- 240 application tests in 25 files, 17 local C# policy checks, 22 Edge browser
  checks, lint and production build passed. The existing large-chunk warning
  remains. The scoped native solution export was unpacked, merged into source
  and successfully repacked. Generated services came from supported CLI tooling.
- No financial fixture or actual email was created. Ordinary employee/admin
  account direct access, live rollback/concurrent spending, actual provider send
  and the published Power Apps host remain unverified. Tests mock those external
  boundaries; metadata checks are not a substitute for those live checks.
- Accrual is automatic on Issue, with a read-only projection in the preview.
  There is no unattended monthly scheduler. A cancelled form writes nothing.
- 2027 filing remains blocked until separately proclaimed Eid dates complete the
  calendar. Cash conversion, cancellation and new-entry Payroll integration
  remain follow-up work; the current Add Leave plan does not implement them.
- Dev server components are configured; the updated Code App is not published.
  No commit or push was performed.
