# Half-day Leave deletion fix - 2026-11-09

The owner reported that Prod shows **The saved leave allocation needs review.**
when confirming deletion of a 0.5-day leave. The read-only impact correctly shows
0.5 credits to restore, but the subsequent server allocation validation requires
each saved day to total 1.0. That rejects the valid half-day snapshot written by
the existing issuance workflow. This is a code defect, not evidence that direct
Delete privileges or production setup should be changed.

## Verification checklist

- [x] Reproduce the exact exception with a synthetic half-day issue/delete flow
  before changing production logic.
- [x] Accept a saved 0.5-day allocation only for a 0.5-day source on one date with
  exactly one allocation entry; other allocations retain the 1.0-day check.
- [x] Test VL, SL and General Leave, fully paid, partially paid, zero-credit paid
  requests and explicit Unpaid half days.
- [x] Restore only the verified deduction to its original pool; preserve audit
  totals/dates/actor, detach historical movement lookups and remove the source.
- [x] Retrying a completed deletion does not duplicate restoration or audit.
- [x] Reject a half day spread across dates and an unsupported 0.25-day source;
  simulated deletion failure retains the source/debit/link with no new receipt.
- [x] Existing full-day, partially paid, unpaid, legacy, cancelled, stale-impact,
  inconsistent-history and authorization deletion regressions pass.
- [x] Signed compilation and **137 synthetic deletion checks** pass for both the
  combined workspace build and the isolated release.
- [x] Record final app tests, lint, build and Leave browser checks: **537 tests /
  53 files**, lint/build and **74 Edge browser checks** pass. Existing large-chunk
  build notices remain. Additional server policy/issuance/guard regressions pass.
- [x] Apply the owner-authorized isolated fix to Dev, verify its exact content
  and native solution inclusion, and record deployment evidence.
- [ ] Owner verifies actual deletion/restoration after production deployment;
  real financial records are not deleted as implementation test data.

## Source and isolated release

Changed `plugins/A365.Leave.Plugins/DeleteLeave.cs` and regression scenarios in
`PartialPaidLeave.Tests.cs`. No schema, roles, generated services, client deletion
flow, payroll calculations or stored leave snapshots need changing.

The workspace also contains unpublished Refresh balance work. The owner explicitly
approved deploying only an isolated deletion fix to Dev. Release **1.0.3.11** is
built in ignored `scripts/leave-schema/.work/half-day-deletion/` from the committed
**1.0.3.9** Dev baseline at `b4f21b684dc74dd14ab65285aa62c5e59fda637a`, with only
the `DeleteLeave.cs` fix and assembly-version change. Its SHA-256 is
`F2F3B6F80EB12DB84657D39500E86DB6DCFF0A49B043AD59D2A35666B353ECB9`.

The existing Dev DLL was backed up and matches the prior verified release hash
`EB451A73C6CEA414831C1E68463B319D06E7D7588BFA7D9F9AC50255BBB74AD4`.
The combined workspace source is version **1.0.3.12** so a later release stays above
the isolated deletion artifact. The normal local build includes the pending shared
workspace work and is not the isolated artifact.

## Dev deployment and concurrent release

The isolated **1.0.3.11** update was applied in place to assembly
`1d8034c7-e2cd-f111-a05a-000d3a8014e4` in The Daily Operation - Dev, with an ETag
condition and a backup. Its installed content initially matched the tested hash.
During verification, a separate concurrent deployment replaced it with
**1.0.3.10**, hash
`F01D6CE69B0816A7B42F3D2CC747C00158DA84FE7122011C00D1E7BE96534BC6`.

That concurrent build already includes this deletion fix from the shared source.
Every method body matches the tested combined **1.0.3.12** build, and the actual
downloaded **1.0.3.10** DLL passes all **137 synthetic deletion checks**. No further
upload was made to replace the concurrent release. This task did not deploy the
Refresh feature or the frontend; the separate release controls its own scope.

The exported/unpacked native solution under ignored
`artifacts/leave-deletion.local/` contains that exact current Leave DLL and the
previously verified Ledger **1.0.0.4** DLL. Start a new pipeline deployment from
Dev to capture the current solution; no frontend push is needed for this deletion
fix. Production remains unchanged by this task.

Final read-only verification confirms solution membership, **20 active synchronous
Leave guards**, transactional API context, and an existing half-day record's
deletion preview. Half-day source and credit counts are unchanged. See
[deployment evidence](leave-half-day-deletion-deployment.json). Actual deletion,
credit restoration and rollback remain synthetic checks; no live leave was deleted.

The financial checks are server-side. Synthetic transaction rollback does not
prove live Dataverse rollback or ordinary-user security. Production access and
actual destructive testing remain outside this implementation.

See [existing deletion design](leave-record-actions.md),
[half-day rules](leave-half-day.md) and [pending Refresh work](leave-refresh-balance.md).
