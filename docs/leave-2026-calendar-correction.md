# 2026 leave calendar correction

Owner instruction, November 6, 2026: the April start was an error; correct the
whole 2026 cycle to January 1-December 31, including existing records. This
supersedes the earlier instruction to replace the plugin without reconciliation.
The confirmed environment is Dev, `https://org9a7651f0.crm5.dynamics.com`.
Production is outside this authorization.

## Correction behavior

`CalendarCorrection.cs` adds admin-only `correct2026Preview` / `correct2026`
commands to the existing transactional Leave API. Apply serializes against other
employee operations, checks the reviewed credit-history hash, reclassifies only
April-tagged 2026 rows and appends a zero-day audit receipt per source row. Receipts
record source ID, old/new period and grant keys, unchanged amount, actor and UTC
time. Original amounts, years, employee/source links, notes and leave/payroll
snapshots are preserved. No source rows are deleted or recalculated.

Both periods already contain reset adjustments. Automatically removing repeated
grants would break their signed totals. If a matching January automatic-grant key
already exists, preserve both original amounts and retry identities, but correct
the April row's period tag. If it is missing, move the original automatic grant
to its January canonical key (including the period key). Conflicting automatic
amounts/types/pools block the correction. Later credit synchronization uses that
canonical January identity, preventing another grant for the same month/pool.
Historical reset keys and receipt payloads retain their original identities as
audit history; they no longer determine the corrected balance period.

Apply is atomic per employee. An exception rolls back that employee's period/key
changes and receipts. Successfully completed employees are journalled locally;
retry discovers only remaining April rows. A completed retry adds no credits or
receipts. No guard bypass, role changes, raw ledger update script, schema changes
or balance reset is used. Cross-year leave and cash-conversion-linked corrections
fail for separate review rather than guessing.

The app's `currentLeaveYear` helper now uses the Philippine calendar year from
2026; before 2026 it retains the legacy April boundary. The owner's separate
0 VL / 5 SL opening allocation and monthly accrual behavior are preserved.

## Verification checklist

- [x] Thirteen focused correction assertions: read-only preview, stale review,
  receipt-failure rollback, amount/source preservation, grant-key collisions,
  linked negative deductions, audit, idempotent retry, year scope and admin gate.
- [x] All 551 server assertions pass, including posting, reset, conversion,
  employee sync, deletion, personal-read security and direct-write guards.
- [x] All 528 Vitest tests in 52 files, lint and build pass. Existing large-chunk
  build warnings remain. Seven date-boundary tests include Philippine midnight.
- [x] Live correction: 82 entries for seven employees, with 82 zero-day audit
  receipts. All 2026 entries now use January 1; original amounts, links and exact
  per-employee signed totals are unchanged. Immediate retries add no rows.
- [x] Dev client published with the corrected leave-year helper.
- [x] Native Dev solution exported; deployed DLL, assembly metadata, 34 existing
  registrations and assembly root synchronized. Local solution repack passes.
- [x] All six eligible employees' live read-only credit previews return
  January 1-December 31, 2026.
- [ ] Real-user hosted-app UAT and ordinary-account effective security checks.

No configured Playwright suite exists. Layout and controls are unchanged; no
browser workflow success is claimed by the unit or server tests.

Live data checks are in [correction evidence](leave-2026-correction-verification.json).
Plugin 1.0.3.9 was deployed and downloaded SHA256 verified against the tested
build: `68169CAFCDA9DD8FC03320F35D54E649751FB2FF603350A8BD6494E79D2978CA`.
The app remains the existing Dev app; no production deployment or data write.

## Reproducible Dev operation

The environment-scoped script defaults to read-only preview. It uses the
first-party Dataverse CLI and supported Leave API, saves private before/after
snapshots and per-employee review/results under ignored `.work/calendar-correction`,
checks original amounts/links and exact decimal employee totals, verifies retry
behavior and writes non-personal aggregate evidence on success:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/leave-schema/correct-2026-period.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/leave-schema/correct-2026-period.ps1 -Apply
```

Run Apply only for an authorized correction. Do not repoint this Dev script to
production; inspect that environment's data and obtain its authorization first.
