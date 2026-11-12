# Ledger implementation and verification

> **Current status:** the owner subsequently authorized full activation and Dev
> deployment. See [activation results](ledger-activation.md), including live CRUD,
> permissions, audit and deployment evidence. The implementation-stage restrictions
> and pending checks below describe the earlier preparation snapshot.

2026-11-03. Owner authorized implementation and the documented schema/security
scope in this conversation, superseding the draft's documentation-only wording.
The existing changes to PLANS.md and the three ledger documents are preserved.
No commit, push, app/server deployment or historical financial import is authorized.

## Verification checklist before editing

- L1: explicit Payroll Admin membership gates navigation/route; server checks direct
  and team membership; ordinary users cannot query records or export.
- L2: seven source fields, leading receipt zeros, optional plain references, Manila dates.
- L3: required date/description/category/direction; exact two-decimal positive manual
  amounts; signed payroll including zero; failed submissions retain inputs/identity.
- L4/L7: nine immutable Dataverse choices; capital direction validation; no excluded
  categories, allocations, account maintenance, fees or automatic reclassification.
- L5: combined server filters/search, stable date/ID ordering, bounded paging.
- L6: complete filtered aggregates separate from all-record balance; zero when empty;
  signed payroll, capital counted once, edit/delete/resync invalidation.
- L8: confirmed audited deletion; source details show reopened payroll; unlock does
  not touch ledger; re-payment updates/recreates and removes deleted sources atomically.
- L9: no document/attachment/SharePoint feature.
- L10: loading, empty, filtered-empty, error/retry, saving, keyboard, 390px/desktop.
- L11: payroll/leave formulas, snapshots and existing notification boundaries unchanged.
- L12: targeted/full Vitest, lint, build, browser checks, server compilation and
  transaction tests; explicitly separate local evidence from unavailable live checks.
- L13: server transaction pays/locks and posts every existing employee entry using
  saved signed net pay and actual Paid On; nothing on Ready/cancel/failure.
- L14: rollback, operation receipts, uncertain-result lookup, concurrent source uniqueness,
  replay never overwrites later manual edits; new operation for re-payment.
- L15: preview, explicit manual-source linking, ambiguity block, missing-date exceptions,
  missing-only per-period history, durable work, progress/retry and completion wording.
- L16: complete filtered Excel with text receipts, dates/currency, filtered totals,
  separate company balance; concurrent-change/read failure rejects the entire export.

## Release boundary

The new server package and background runner must be registered before the app
change is released. Local source compilation does not establish live enforcement.
Do not grant ledger privileges or activate schema-only financial writes before
the guards are registered and direct-access tests pass. Deployment remains a
separate owner instruction; see the ledger release runbook for exact components.

## Verification results (2026-11-03)

| Criteria | Result and evidence | Remaining live verification |
| --- | --- | --- |
| L1 | Strict role-gated route/navigation tests and real desktop/mobile browser checks deny employees before data requests; server membership and native-write guards exercised in contract tests. | Role grants/registration not applied; no live Employee A/B direct-ID or export test. |
| L2/L3 | All source fields, receipt zeros, optional references, input precision, signed zero/negative payroll and Manila UTC date boundary pass tests. Forms retain values on failure; payment retry retains its operation identity. | Verify actual connector serialization after API generation. |
| L4/L7 | Live metadata has exactly nine confirmed local Choice values; source key Active; excluded choices absent. Capital direction/category rejection and generated Payroll category pass tests. | Direct invalid-choice/invariant calls after guards are installed. No combined-source amounts were supplied/imported. |
| L5/L6 | Combined filter transport, deterministic server ordering, page-independent scopes and complete Excel checks pass locally; desktop/mobile browser traverses 53 synthetic records over two pages. Server uses filtered FetchXML aggregates and independent company totals. | Real command/filter/aggregate and concurrent-read checks pending server activation; aggregate/load ceilings documented. |
| L8 | Contract tests cover edit/delete boundaries, immutable operation receipts, re-payment recreation/removal, retained optional references and locked-source lookup-move denial; UI deletion confirmation passes. | Native delete audit cannot be verified while organization auditing is disabled. Unlock and real direct-write security pending deployment. |
| L9 | No document tables, attachment/link controls, uploads or SharePoint setup introduced. | None for excluded feature scope. |
| L10 | RTL covers loading, populated, empty, filtered-empty, errors/retry, value retention and confirmation. Playwright passes at 1280px and 390px with keyboard dialog focus and contained table overflow; screenshots retained locally. | Power Apps-hosted accessibility/smoke testing pending deployment. |
| L11 | All existing Payroll/Leave regression tests pass. Calculation and notification implementations unchanged. Payment changes only through the Accounting command boundary; source guards protect finalized records. | Confirm existing notifications and payroll access with real users after registration. |
| L12 | Full suite **474 tests / 47 files passed**; targeted Ledger/payment checks **49 passed**; final corrected UI tests **8 passed**; lint/build passed; signed server compiles; **62 server contract assertions passed**. PowerShell syntax checks and read-only schema/registration/role preflights passed. | Native host/live security checks unavailable without deployment. Build retains large-bundle warnings. |
| L13/L14 | Actual server command exercised with 20,000 / 25,000 / 0 / -100, failure at each write/payment, receipt replay preserving manual edits, source identity, signed re-payment and optimistic locking. Client checks durable receipts after lost responses. | Rollback is simulated at the SDK boundary. Real Dataverse rollback/locking, concurrent requests, timeout-after-commit and transaction-duration limits are NOT proven locally. |
| L15 | Server tests verify original Paid On history dates, missing-only posting, unchanged source payroll, reviewed manual linking preserving amount/date, skipped linked matches, replay and ambiguity block. Durable per-period async worker and retry commands implemented. Completion button and exceptions are visible. | No historical writes or async worker deployment occurred. Actual queue delivery/redelivery, concurrent live/history and resume tests pending. Preview/progress limits are in the runbook. |
| L16 | Workbook tests and browser-generated XLSX confirm all 53 records across pages, leading-zero receipts, negative Debit, seven fields, proper formats, filtered totals and separate company balance. Concurrent-change/truncation/duplicate/read failures reject export locally. | Live unauthorized and concurrent connector export checks pending activation. |

The prior owner documents remain intact. Their draft/documentation-only statements
describe the earlier review, superseded by the implementation authorization in this
conversation; they are not claims that these live verification items passed.

Artifacts: [desktop screenshot](../artifacts/ledger.local/ledger-1280.png),
[mobile screenshot](../artifacts/ledger.local/ledger-390.png),
[desktop workbook](../artifacts/ledger.local/Ledger-1280.xlsx),
[metadata evidence](ledger-schema-verification.json), and
[release runbook](ledger-release.md). Synthetic data only in local artifacts.
The actual Dev solution was exported and natively unpacked into
`artifacts/ledger.local/native-solution`, preserving existing solution directories.
No generated source was edited and no server registration or import occurred.
