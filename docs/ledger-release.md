# Ledger release runbook

Implementation dated 2026-11-03. The owner subsequently authorized the complete
activation sequence and Dev deployment. **Activation is complete**; see the
[current activation results](ledger-activation.md). The preparation details and
sequence below record the original release plan, not a new approval requirement.
No commit, Git push or historical financial import was run.

## Verified target and metadata

- Environment: **The Daily Operation - Dev**,
  `https://org9a7651f0.crm5.dynamics.com`, environment ID
  `b58b083e-d27d-eabd-a143-2a49dcb9d89a`.
- Existing unmanaged solution: `A365_DailyOperations`, ID
  `498e4ec8-94c6-4e16-82e8-33bb19e8e11d`.
- Existing publisher: Automations365 / `a365`, option prefix `74991`.
- Existing Payroll Admin role: `A365 - Payroll Admin`, ID
  `6217c17c-3ea8-f111-aaad-000d3a853079`.
- Four organization-owned tables created by the MetadataService and added to
  that solution; no document/account catalog tables or business imports.
- The ledger source alternate key is **Active**. Table auditing and optimistic
  concurrency are enabled. A direct count returned **zero ledger transactions**.
- **Organization auditing is enabled.** Activation preserved the unset retention
  setting and all other audit settings. Native deletion audit was verified using
  a temporary activation row; no audit history was purged.

Exact implemented table fields (all tables also have native IDs and Created/Modified
actor/time metadata; server validation enforces mandatory financial fields):

| Table / entity set | Custom fields |
| --- | --- |
| `a365_ledgertransaction` / `a365_ledgertransactions` | `a365_name` text; `a365_date` DateOnly; `a365_receipt` text(100); `a365_reference` text(500); `a365_direction` text(6), `debit`/`credit`; `a365_amount` decimal(2), signed PHP, ±1,000,000,000; `a365_category` local Choice; `a365_description` memo(2000); `a365_sourceperiod` period lookup; `a365_sourceemployee` employee lookup; `a365_sourceentry` GUID text(36); `a365_sourcekey` text(73); `a365_postedon`, `a365_paidsnapshot` UTC timestamps; `a365_postedby` user lookup; `a365_historyreviewed` boolean. |
| `a365_ledgeroperation` / `a365_ledgeroperations` | `a365_name`, `a365_fingerprint` text(64), `a365_result` memo(100000), `a365_completedon` timestamp, `a365_actor` user lookup. Operation GUID is the unique primary key. |
| `a365_ledgercoordination` / `a365_ledgercoordinations` | `a365_name`, `a365_locktoken` and `a365_revision` text(36), `a365_categories` memo(10000). One company coordination/configuration row, ID `25886558-8d32-45f8-8294-f13b220ba37a`; it contains verified choice metadata and no opening-balance amount. |
| `a365_ledgerhistory` / `a365_ledgerhistories` | `a365_name`, `a365_status` text(16), `a365_attempt` text(36), `a365_createdcount`, `a365_skippedcount`, `a365_failedcount` integers, `a365_error` text(500), `a365_period` period lookup, `a365_requestedby` user lookup. One durable job per period per confirmed run. |

All six new lookup relationships use Restrict deletion and no cascading financial
record deletion. Payroll entry identity is deliberately GUID text: deleting a
source entry after unlock must leave its linked ledger row intact until re-payment.
`a365_LedgerSourceKey` uniquely indexes `a365_sourcekey` (`periodGUID/employeeGUID`),
including manually matched historical records. Empty manual source keys stay null.
Generated row IDs are also deterministic per period/employee; operation IDs are
separate and their receipts cannot be edited/deleted by ordinary admins.

| Choice label | Verified local numeric value |
| --- | --- |
| Utilities | 749910000 |
| Payroll | 749910001 |
| Government Contributions | 749910002 |
| Taxes | 749910003 |
| Software and Licenses | 749910004 |
| Rent and Coworking | 749910005 |
| Capital Deposits | 749910006 |
| Capital Withdrawals | 749910007 |
| Client Payments | 749910008 |

There is no opening adjustment, Office Supplies, fee category, automatic fee row,
allocation table, document feature or statutory calculation change. No screenshot
data was imported. Embedded excluded charges still require a source-specific owner
decision before recording that source; the app does not infer a reclassification.

## Server and security package activated

`plugins/A365.Ledger.Plugins/LedgerCommand.cs` implements the unbound synchronous
action `a365_LedgerCommand`, String `Request` / String `Response`, custom processing
steps disabled. Every command verifies direct/team **Payroll Admin** membership.
Financial commands require `IsInTransaction` and active organization auditing.

The dedicated company row serializes ledger mutations. List/aggregate/preview reads
compare financial revisions before/after reading; export checks the same revision
across every page and at completion. Reads/export do not change records. Payment
additionally takes an optimistic-concurrency lock on the source
period. Payroll entry guards lock and inspect original/new parents to prevent a
concurrent entry change or lookup move from evading finalized protection.
Ledger CRUD, payment, receipts and historical writes use the parent transaction;
there is no client financial-write loop or nested ExecuteTransaction request.

Registration package:

- `LedgerCommand`: synchronous action handler.
- `ProtectLedgerWrites`: PreOperation synchronous guard on supported native write
  paths for all four new tables, including bulk/upsert paths.
- `ProtectPayrollPayment`: synchronous guards on period create/update/upsert paths;
  direct payment/lock metadata is rejected. Mark Ready and audited Unlock remain
  available through the existing payroll service.
- `ProtectPayrollEntries`: synchronous guards on entry create/update/delete and
  supported bulk/upsert paths. Ready/Paid/Locked/archived sources cannot be changed;
  original and replacement period lookups are both checked.
  Existing confirmed deletion of archived Processing periods/entries through the
  validated payroll deletion APIs remains supported; native direct deletion is
  still rejected and ledger source relationships retain Restrict protection.
- `HistoryWorker`: asynchronous PostOperation Create and Update(`a365_attempt`)
  on history jobs. It calls the synchronous command once per period. A failed
  financial transaction is followed by committed-state lookup before recording a
  safe failure. Durable async work and receipts support redelivery and explicit retry.

Role proposal applied at activation: **10 additive Organization-scope grants**.
Unrelated privileges were verified unchanged; no assignments or elevation applied:

| Table | Payroll Admin privileges |
| --- | --- |
| Ledger Transaction | Create, Read, Write, Delete, Append |
| Ledger Operation | Read only; receipts created through the validated server handler |
| Ledger History | Create, Read, Write, Append |
| Ledger Coordination | None; validated server handler only |
| Existing Payroll Period / Employee / System User | Existing Read/Write/AppendTo as applicable, checked by the proposal; no new missing privileges were found for these tables. |

Employees and other ordinary app roles receive no new grants. Native roles remain
the direct-read/export boundary; the command independently checks membership.
System Administrator inherently has platform access; no such role was assigned.
Role grants are gated on installed synchronous guards. Verify all supported bulk
paths and actual handler IDs before releasing; preflight is not live security proof.

## Authorized release sequence, when deployment is instructed

1. Review/enable organization auditing under the existing approved retention
   policy. Confirm delete auditing before allowing financial deletions. There is
   no scripted retention duration or automatic audit purge in this implementation.
2. Build and run local server tests:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ledger/build.ps1`
   then the same command with `scripts/ledger/test-server.ps1`.
3. Run `scripts/ledger/register.ps1` read-only, inspect the manifest/guards, then
   explicitly deploy using `-Apply`. Read-only preflight passed during implementation;
   **-Apply completed during the authorized activation**.
4. Run `scripts/ledger/permissions.ps1` read-only, then apply the reviewed grants
   only after verifying active guards, API handler, source key and native auditing.
   **-Apply completed**. Unrelated roles and assignments were preserved.
5. Generate the API binding using the installed CLI's verified command:
   `npx.cmd --no-install pa app add dataverse-api --api-name a365_LedgerCommand`.
   This creates the API metadata under `.power` and the generated service. Do not
   hand-edit either. **This binding is generated and deployed**. The service uses the existing `dataClient`
   Custom API transport with that operation/data-source identity.
6. Rebuild after generation, verify local host reads/aggregates and the complete
   L1-L16 live checklist using authorized test accounts/data. Test all server write
   failures, lost-success response, overlapping payments/history, async retries,
   deletion audit and payroll snapshot protection. Do not use production pay runs
   as throwaway tests; destructive/live financial test data needs its own scope.
7. Export/unpack the solution's native metadata/server registration into the repo
   and review the generated diff. Do not hand-author solution XML.
8. Only on instruction, deploy the app and perform Power Apps-hosted smoke tests.
   Never deploy the changed client before the registered server/binding is ready:
   Mark as Paid now intentionally requires atomic Ledger posting and has no unsafe
   fallback to the former direct period update.
9. Historical preview is read-only. Review
   and explicitly link confirmed manual matches or confirm unrelated manual rows;
   then obtain the normal posting confirmation. No historical run was started here.

## Technical limits requiring live release verification

- 50 ledger rows per server page; export follows every cursor and rejects changed
  revisions, duplicate rows, incomplete counts and read/aggregate failures before download.
- Money uses decimal server arithmetic and exact centavos for client validation.
  PHP is the single company currency, not an exchange-rate or multi-account feature.
- The configured atomic posting ceiling is 200 source employees per period. The
  history preview currently admits at most 200 paid periods, with bounded internal
  source reads and one durable async work item per period. Larger previews stop
  explicitly; they require server paging/staging before release to larger datasets.
  These ceilings need live load validation against Dataverse's execution limits;
  they are technical safeguards, not financial eligibility policies.
- FetchXML aggregates remain subject to Dataverse's aggregate record limit. Failures
  are explicit, never substituted with page totals or zero. Large ledgers need
  partitioned server aggregation before exceeding that limit.
- Historical progress displays the 50 most recent per-period jobs. Older jobs and
  receipts remain durable; a larger installation needs paged progress retrieval.
- Operation receipts and native audits are retained; no cleanup/retention policy
  is invented. Native audit retention/authorization and any application lifecycle
  policy must be reviewed before production use.

The transaction model follows Microsoft's
[Dataverse transaction guidance](https://learn.microsoft.com/power-apps/developer/data-platform/scalable-customization-design/database-transactions):
the async worker calls a synchronous server action for each financial transaction;
async plug-in execution itself does not provide a multi-write transaction.
