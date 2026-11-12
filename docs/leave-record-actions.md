# Leave record actions — 2026-10-28

Requested: replace the Details text action with a View icon and add an admin
trash action that permanently deletes leave and restores credits used.

Implemented locally and deployed to Dev in signed Leave plugin 1.0.3.4. No
status or schema changes were made. Live read-only deletion preview passes;
actual deletion/restoration remains for owner manual testing.

## Verification checklist

Guard failure follow-up: reproduce rejection of Dataverse's merged
Create/CreateMultiple and Update/UpdateMultiple pipelines; permit those paired
events only for the existing validated deletion transaction's coordination and
ledger writes; retain direct-write/source-update/ledger-delete rejection;
verify a forced-rollback probe before/after and confirm no record/token changes;
run server regressions, app checks and relevant browser checks, then update Dev.

- [x] Leave rows open the same details dialog using an Eye icon, with an
  accessible record-specific label, tooltip/title and keyboard access.
- [x] Personal Leave History retains View only; no employee mutation controls.
- [x] Define cancellation versus permanent deletion before implementing the
  trash action. Current server guards prohibit direct deletion and linked credit
  movements restrict source deletion. Do not invent credit/payroll corrections.
- [x] The chosen destructive action has confirmation, saving/error states,
  server-side admin authorization, auditability and correct cache invalidation.
- [x] Verify its effect on paid, partially paid, unpaid and already-cancelled
  leave; retain finalized payroll snapshots.
- [x] Relevant automated tests, full tests, lint, build and browser checks pass.
- [ ] Owner verifies actual deletion/restoration in Dev; live concurrent deletion,
  transaction rollback and ordinary-account checks remain unexercised.

Checked destructive-operation behavior is covered by synthetic services, not
deletion of real financial records during implementation.

Owner decision: delete the Leave record, without adding/changing statuses.
Restore credits used; unpaid leave disappears from future payroll lookups.
Existing payroll entries and finalized payslips remain unchanged. Preserve the
original credit ledger and record a restoration/deletion receipt atomically;
remove ledger lookups to the deleted source after recording its financial
snapshot in the receipt. Retries must not restore credits twice. Restore to the
original debit's pool/year/balance period; reject inconsistent or unverifiable
history rather than inventing a credit amount. An already-restored record must
not restore its credits again. No actual business record is deleted during
implementation or automated validation.

## Transaction and audit behavior

- `deletePreview` uses caller-scoped reads and makes no changes. Confirmation
  shows verified credits to restore and their original balance period.
- `delete` requires Payroll Admin on the server, takes the existing employee
  coordination lock, and rechecks the source, debit/restoration history and
  reviewed restoration amount.
- The server retains original signed credit movements, writes one Restoration
  receipt (`LEAVE-<source GUID>-DELETE`), clears the optional source lookups and
  deletes the source in the same synchronous Dataverse transaction.
- The existing admin role intentionally lacks direct Leave Delete privilege.
  Only the final validated source deletion uses the system service after the
  admin gate and caller-scoped checks. Direct writes remain guarded; deletion
  cannot erase credit movements, conversions or other entities. No role change.
- Unpaid and already-restored records produce a zero-day receipt. Receipt
  existence makes uncertain retries idempotent; no duplicate credits are granted.
- The receipt note contains the original financial snapshot, source identity,
  supported Created/Modified/Issued/Cancelled actor/timestamps, and deletion
  actor/time. Version-1 `workdayGaps` stores day offsets cumulatively from the
  original start date; paid credits apply to the earliest listed days. Together
  with paid/unpaid totals this preserves exact allocation without reapplying a
  later holiday policy. Internal free-text notes/reasons are not copied into the
  financial receipt. Oversized or inconsistent history blocks deletion.
- Existing payroll entries are not rewritten. Future unpaid lookups exclude the
  deleted source; an editable payroll entry changes only through its existing
  explicit Save workflow. Finalized payslips retain their saved values.

## Verification

- 439 application tests in 43 files pass. Lint and production build pass, with
  the existing large-chunk warning.
- 249 local plugin checks pass: deletion (44), policy (48), split issuance (35),
  personal reads (24), guards (42), conversions (56). Financial rollback is simulated by
  the test service; actual Dataverse rollback was not exercised with real data.
- Edge checks pass: admin Leave (26), personal Leave History (12), payroll (7).
  New scenarios cover mobile confirmation, cancelling without writing,
  successful deletion/refetch and unavailable credit history.
- Live signed assembly/version and an existing unpaid record's read-only
  deletion impact are verified. Leave and credit counts remain unchanged.
  See [live evidence](leave-deletion-verification.json).
- Native solution export matches the deployed/local DLL hash; only Leave
  metadata/assembly version references were synced, and local solution packing
  passes. No hosted Code App push or real leave deletion was performed.

## Fix: merged single/bulk deletion pipeline guard

The owner's live delete failed with `Leave deletion cannot modify these
records.` The 1.0.3.3 guard permitted only Create/Update for coordination and
ledger writes. Dataverse also raises CreateMultiple/UpdateMultiple for those
single-record operations when their bulk pipelines are registered; see
[Microsoft's merged-pipeline documentation](https://learn.microsoft.com/power-apps/developer/data-platform/bulk-operations#message-pipelines-merged).
All four bulk registrations were confirmed in Dev. Existing trace logging was
disabled, so no organization tracing settings were changed.

Added regression cases that failed against 1.0.3.3 and updated the synthetic
service to execute both single/bulk guards for SDK writes. The 1.0.3.4 fix
permits the paired Create/CreateMultiple and Update/UpdateMultiple events only
for the validated delete command's ledger and coordination writes. Direct bulk
writes, source creates/updates, ledger deletes and preview mutations remain
blocked. Admin authorization and the financial deletion flow are unchanged.

`verify-deletion-guard.ps1` checks a random source ID and receipt key do not
exist, then submits a delete request that must fail before financial writes.
Before the fix it reproduced the owner's exact guard error. After the fix it
passes the native coordination pipeline and reaches the intentional missing-
record rejection. Both probes verify unchanged coordination token, leave count
and credit count, proving the temporary lock write rolled back. No existing
leave can be deleted by this probe. Evidence:
[before](leave-deletion-guard-before.json), [after](leave-deletion-guard-after.json).

Final verification: 439 app tests, lint, build, 249 local plugin checks and the
26 admin Leave browser checks pass. Read-only live deletion preview passes on
1.0.3.4. The original 12 personal-history and 7 payroll browser scenarios are
unchanged and passed in the preceding release. Actual financial source deletion,
restoration and rollback remain for owner manual UAT.
