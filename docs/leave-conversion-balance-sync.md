# Leave Management and Conversion balance connection

> Owner update, 2026-11-09: the manual reset is replaced locally by
> [Refresh balance](leave-refresh-balance.md): earned VL / 5 SL minus recorded
> paid usage and paid VL conversions. It preserves conversion limits and snapshots.
> Fixed 10/5 reset behavior below is release history. The backend is deployed to
> Dev for local client testing; hosted app publication was not performed.

Owner decisions, 2026-11-03: unpaid conversion years follow the recorded VL ledger
for the same employee/year, while retaining manual conversion overrides. The latest
clarification is a cap, not a deduction of one conversion day for every VL day:
with 9 VL available the default conversion remains 5; with 4 VL it becomes 4.

Stored Available VL and conversion days are the admin's chosen ceilings. Effective
Available VL is the lesser of the chosen ceiling and recorded nonnegative VL;
effective conversion days are the lesser of the chosen days, effective Available VL
and the existing 5-day limit. Example: manual days 3 stays 3 at VL 4, becomes 2 at
VL 2, and can return to the chosen 3 if VL is restored. Reading does not overwrite
the admin's chosen limits. UI must show the chosen limits while editing and the
effective payable days/amount, so limits above live VL are not misleading.

Reset restores unpaid current-year conversion ceilings to 10 VL / 5 days for the
Active employees it resets, in the same server transaction. Actual paid leave
deductions/restorations change effective values through the common ledger. SL-only
changes do not consume VL. No new deduction is created by saving/paying conversion.
Paid conversion years keep their frozen amounts/rates/balances; subsequent resets,
leave usage, restorations and salary changes cannot alter them.

## Verification checklist

- [x] Same-year unpaid reads use complete server-filtered recorded VL, not projected
  grants or a separately invented balance. Future/no-credit years show zero capacity.
- [x] Default ceilings 10/5 show 10/5 after reset; recorded VL 9 shows 9/5;
  recorded VL 4 shows 4/4; zero/negative VL provides zero convertible capacity.
- [x] Manual overrides remain editable and their ceilings persist; capacity cannot
  exceed live VL, 5 days or chosen limits. Rate snapshots remain unchanged.
- [x] Reset updates only matching unpaid rows, preserves paid/cancelled rows and
  retries remain idempotent. Guarded conversion updates participate in rollback.
- [x] Issuing/deleting leave and resetting invalidate the actual conversion row
  query keys. Cached rows update without discarding unsaved overrides.
- [x] Mark as Paid rechecks live balances under employee locks and freezes effective
  values atomically with the paid lock; stale concurrent changes fail safely.
- [x] Save and payment share employee/header locking order; stale edits cannot
  overwrite reset values or paid snapshots. No credits/payroll/email writes occur
  from conversion operations; read commands do not write snapshots.
- [x] Unit/component/server/browser checks, full tests, lint/build and documentation
  checks pass. No real financial fixtures or Reset/Mark Paid operations were run.
- [x] Deploy plugin 1.0.3.6 and publish the paired client update to the approved
  Dev app; verify read-only live rows, DLL hash and active guards.
- [ ] Verify ordinary-account effective permissions and real concurrent financial
  operations using separately authorized records. No live reset/payment was tested.

No schema/role/generated-source changes are planned. Reuse the existing conversion
fields as chosen limits for unpaid rows and frozen snapshots for paid rows. Existing
unpaid values remain the chosen limits; no historical data migration is required.

## Local outcome and release boundary

Implemented against existing fields; plugin 1.0.3.6 and the paired app were deployed
to the owner-confirmed Dev environment on 2026-11-03. No schema, role, generated
binding or business-data migration changes. Native Leave assembly/step references
were synchronized from the actual Dev solution export after deployment.

ConversionBalances.cs reads recorded VL with employee/year/pool filters and complete
paging, returning effective values plus chosen limits. Paid/cancelled rows do not
read live balances or change their saved values. Save/Mark Paid use the existing
employee coordination locks before the optimistic year-header gate; Mark Paid
freezes effective values in the same transaction as the paid lock. Reset calls the
unpaid conversion reset inside the existing reset transaction and preserves rates.
Original Converted By/On remains unchanged; normal Modified metadata is retained.

The app edits saved limits while showing recorded VL and effective payable days/
amount. Reset/issuance/deletion now invalidate the real conversion-row query key.
Unsaved drafts survive refresh; a changed year version requires reviewing those
drafts before saving. Paid snapshots take precedence over local unsaved display.

Verification: 487 app tests in 48 files, lint and production build pass (existing
large-bundle warning). Server checks: 56 conversion regressions + 13 balance-link,
15 reset + 6 reset/conversion atomicity, 55 guard, 35 partial-paid issuance and 44
leave-deletion checks (224 total). Browser checks passed desktop/mobile linked
balances, cap behavior, manual-limit retention, restoration and saved-rate amounts.
The initial stale-save UI test used the wrong query client; that fixture was fixed.
The server test fake was updated for technical coordination rows and the new paid
snapshot writes; its existing financial-write restrictions remain.

No real leave/reset/payment records or emails were created for verification.
No commit or Git push. The approved release and read-only verification are below.

## Dev deployment and requested employee check

Owner authorized deployment of both the server and app. Verified PAC points to
https://org9a7651f0.crm5.dynamics.com, then updated the existing signed Leave
assembly and published the tested build to the existing app/solution. DLL version
1.0.3.6 and SHA256 4C9EFF6590C56ED8BDFEBAD2A2DBE7BADDA9542652EEF30B01BF4BFF39F57487
match the local tested artifact. Existing 20 Leave and 14 Conversion guards remain
active and synchronous; schema, permissions and source financial records are unchanged.

The requested employee's 2026 read-only comparison now reports recorded VL 8 and
conversion Available VL 8, with conversion days 5 (the year is unpaid). Before
deployment, the old server returned 10 despite recorded VL 8. The new API includes
live balance and chosen-limit fields. No manual row correction or reset was needed.
Reset preview also succeeds with 7 Active employees and credit count unchanged.

[Release evidence](leave-conversion-balance-deployment.json). Native solution export
supplied only the updated Leave DLL/metadata, 34 step references and assembly root
reference for repository synchronization. Hosted signed-in UI/security and real
concurrency/rollback UAT remain unverified; API checks and publication are verified.
