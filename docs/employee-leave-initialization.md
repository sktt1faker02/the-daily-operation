# Employee leave initialization and conversion membership

Owner request, 2026-11-06: backdated Support User showed zero saved leave credits
and was missing from the existing 2026 conversion. Creating an employee previously
saved only master data. Accrual was projected in Add Leave and posted on issuance;
conversion membership was captured only when the year was created.

## Verification checklist

- [x] Creating an employee through the app calls an admin-only server sync after
  employee creation. Eligible current-year SL and completed monthly VL are posted.
- [x] The same operation adds a missing Active employee to the current year's
  existing unpaid conversion, using the existing salary/22 rate snapshot rules.
- [x] No conversion year is created implicitly; paid rosters/snapshots stay locked.
- [x] Repeated syncs preserve deductions and manual limits without duplicate grants
  or conversion rows. Existing unallocated/different-period history blocks sync.
- [x] Credit/conversion setup uses one server transaction and employee lock.
  Conversion-header row-version checks protect concurrent changes/payment.
- [x] A setup failure after employee creation reports partial success and offers
  safe recovery, rather than treating the employee create as failed.
- [x] Admins can select an existing employee in Leave Management and confirm
  **Sync leave credits** for the current year, including Support User.
- [x] Future hires, inactive/ended employment and historical-year requests do not
  receive grants. On Leave employees retain existing credit eligibility but are
  not newly added to the Active-only conversion roster.
- [x] Final checks: 521 Vitest tests, lint, app build, signed server compilation,
  23 new employee-sync server assertions, 80 write-guard assertions, 59 annual
  accrual assertions, 161 issuance checks, 69 conversion checks, 21 reset checks,
  and six Playwright sync-dialog scenarios. `git diff --check` passes.
- [x] Updated the existing Dev Leave assembly; downloaded DLL matches the tested
  SHA256. The local browser app uses the changed source; the hosted app was not
  separately published. [Deployment evidence](employee-leave-deployment.json).
- [x] Live Support 11 User sync: owner supplied PHP 30,000 monthly salary. Saved
  salary, posted ten VL accruals totaling 8.33 and one 5-day SL grant, and added
  exactly one row to the unpaid 2026 conversion. Effective conversion is 5 days
  at PHP 1,363.64/day, amount PHP 6,818.20. Retrying added no grants or rows.
- [ ] Ordinary-account security verification (synthetic admin/guard checks pass).

## Scope and recovery

Uses the existing `a365_LeaveCommand` API and verified employee, credit,
coordination and conversion tables. No schema, generated-service, role, reset,
payroll calculation, payment or email changes. No scheduled monthly job is added:
normal issuance and the explicit sync operation can materialize due credits.
Preview/read operations remain read-only.

Employee creation and leave setup are two transactions. The form waits for setup;
if setup fails, the employee remains created and an error explains the repair.
Do not recreate the employee. Select them in Leave Management, keep the current
year, and use Sync leave credits after correcting the reported setup issue.

The sync only appends missing automatic movements. It does not reconcile existing
April-tagged history, overwrite a reset, or reinterpret historical salary. Existing
April-tagged employees need a separately authorized reconciliation. A paid
conversion remains frozen even if the employee's eligible leave credits are synced.

Release requires compiling `EmployeeLeave.cs` into the existing Leave plugin.
No new plugin step or Custom API registration is needed. The browser action
detects an older server and explains that the updated plugin is required.

On 2026-11-06 the owner authorized applying this fix to Dev and routine updates
of this kind without separate permission prompts. Production, unrelated schema
and security changes are outside this release. No payment, reset or email was
sent. The original Dev assembly is backed up under the ignored release directory.
