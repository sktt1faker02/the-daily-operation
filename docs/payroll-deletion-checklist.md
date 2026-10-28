# Confirmed deletion — 2026-10-22

The owner authorized setup of the deletion API/receipt, then expanded the request
to individual payroll entries and employee master records, with icon-only Edit.
Target: **The Daily Operation - Dev**, `https://org9a7651f0.crm5.dynamics.com`,
environment `b58b083e-d27d-eabd-a143-2a49dcb9d89a`, existing unmanaged solution
`A365_DailyOperations`, verified existing publisher prefix `a365`.

## Delivered behavior and verification checklist

- [x] Archive/Unarchive and Edit use icons, hover titles and accessible names.
- [x] Admins can select Delete for active or archived Processing periods.
- [x] Period confirmation names the cutoff and explains permanent removal of
      the period and every entry. Ready/Paid/Locked deletion is blocked.
- [x] In the payroll detail table, Delete removes only the selected employee's
      Processing entry. Confirmation names both employee and cutoff and explains
      that the master employee and other periods remain.
- [x] Employee master Delete names the employee and number. The server rejects
      deletion if payroll, Leave, credit ledger, conversion or template data
      references the employee; the message advises setting them to Inactive.
- [x] All five current employee business relationships use native Restrict.
      Existing payroll/Leave restrictions were retained; the existing
      `a365_employee_a365_payrolltemplateline` Delete setting was tightened from
      RemoveLink to Restrict to prevent concurrent template saves being orphaned.
- [x] Opening, Cancel and Escape perform no deletion. Pending submissions block
      Cancel, Escape, outside dismissal and duplicate clicks.
- [x] Errors keep the confirmation and operation identity for an explicit retry.
      There is no automatic mutation retry and no premature success message.
- [x] Confirmed success invalidates relevant module caches and clears stale
      selections/export state. Entry totals are recalculated from refreshed rows.
- [x] Three generated Code App bindings replace the missing-setup blocker.
- [x] The server independently checks the exact Payroll Admin role (direct or
      team membership), current Processing status, parent/employee identities
      and confirmed names, in a synchronous database transaction.
- [x] Row versions and a parent lock serialize deletion against status changes.
      Deletes and the durable receipt share the transaction; native Restrict
      blocks concurrent child creation from leaving financial rows orphaned.
- [x] A unique operation GUID keys the receipt; a completed request can be
      checked again without repeating deletion. Mismatched requests are rejected.
- [x] Native Delete requests cannot bypass the API, even with Delete privileges.
      Receipts accept creation only from transactional validated API children;
      ordinary receipt update/delete/upsert/bulk-write requests are blocked.
- [x] Live read-only checks verify employee-role API denials, finalized payroll
      rejection, history protection, active guard registration and assembly hash.
- [x] Native exported metadata, APIs, assembly and guard steps are pulled into
      the repository; existing template table definitions are included as
      dependencies of the protected reference. Roles and hosted app are preserved.
- [x] Application tests, server boundary tests, browser checks, lint and build pass.
- [ ] Live financial deletion, rollback and concurrent-call races are not
      exercised: no disposable business fixtures were authorized for deletion.
- [ ] Ordinary Payroll Admin successful deletion has not been tested with a
      separate account; the connected admin also has system administration access.
- [ ] Hosted Code App publication is not performed. The registered backend is
      live and the new UI/bindings are available in the local development app.

## Registered components

Signed assembly `A365.Payroll.Deletion`, version **1.0.1.0**:

- `A365.Payroll.Deletion.DeletePayrollPeriod` handles three synchronous, unbound
  Custom APIs: `a365_DeletePayrollPeriod`, `a365_DeletePayrollEntry`,
  `a365_DeleteEmployee`. Each has String `Request` and `Response`, no optional
  processing steps, and server-side exact-role authorization.
- `A365.Payroll.Deletion.ProtectDeletionWrites` has **eight active synchronous
  PreOperation guards**: payroll period/entry/employee Delete; receipt
  Create/Update/Delete/CreateMultiple/UpdateMultiple. Unsupported bulk messages are
  skipped only when no table/message filter exists.
- `preview:true` performs validation without locks, receipts or deletes. It is
  used only by verification; a preview result is never accepted as UI save success.

Organization-owned table `a365_payrolldeletionreceipt`, entity set
`a365_payrolldeletionreceipts`:

| Actual logical name | Type / purpose |
| --- | --- |
| `a365_payrolldeletionreceiptid` | Primary GUID; stable operation identity |
| `a365_name` | Text 200; confirmation name |
| `a365_targettype` | Text 32; period, entry or employee |
| `a365_targetid` | Text 36; deleted target GUID |
| `a365_targetname` | Text 200; confirmed target/employee name |
| `a365_periodid` | Text 36; containing period GUID where applicable |
| `a365_periodname` | Text 200; containing period name |
| `a365_deletedentries` | Whole number; entries removed |
| `a365_deletedbyid` | Text 36; authenticated initiating admin GUID |
| `createdon` | Standard timestamp; deletion time |

Receipts deliberately have no lookup to deleted records. No salary amounts,
addresses, internal notes or documents are copied. Existing role grants were
not changed; ordinary roles receive no new receipt privileges.

**Observed security drift:** the live export already has Organization Delete
for Payroll Admin on period/entry, unlike the original security design. No such
grants were added here. The deployed guards are mandatory regardless of role
privileges. See [security model](security-model.md#7-deletion--correction-controls).

## Verification evidence and limits

The final application suite passes **297 tests across 32 files**, covering identity validation,
confirmation, Cancel, retry, status restrictions, icon actions and error states.
The in-memory SDK harness runs **41 checks**, including team-admin membership,
unauthorized calls, finalized states, parent concurrency, idempotency and direct
write guards. It validates the actual compiled server logic, not a duplicate
implementation of the business rules. Database rollback remains Dataverse's
transaction behavior and is not claimed to have been exercised by that harness.

**13 synthetic Edge scenarios** verify period, entry and employee confirmation,
Cancel, failure/retry, history protection, finalized row actions and mobile
layout. All external browser requests are blocked. Parallel browser navigation
initially timed out; sequential reruns with DOM-ready navigation passed.

[Live verification](payroll-deletion-verification.json) records preview-only
checks. Employee, period, entry and receipt counts remain unchanged. The live
signed assembly SHA-256 matches the compiled/tested local file. The synchronous
period deletion budget is limited to 1,000 entries; larger requests fail before
writes and require a separately designed administrative process.

Reproducible tooling is in `scripts/payroll-deletion/`: setup (default read-only,
`-Apply` for previously authorized changes), protected template reference,
server tests, preview-only live verification, and native export pull. Use
`scripts/build-payroll-deletion.ps1` for the local signed build. Export/unpack
with PAC before running the source pull; generated app bindings use
`pa app add dataverse-api`, not the ordinary table data-source command.

References: [Custom APIs](https://learn.microsoft.com/power-apps/developer/data-platform/custom-api),
[optimistic concurrency](https://learn.microsoft.com/power-apps/developer/data-platform/optimistic-concurrency),
[relationship updates](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/create-update-entity-relationships-using-web-api).
