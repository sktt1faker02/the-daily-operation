# Leave submission repair — 2026-10-22

## Outcome and root-cause evidence

The server fix is active in The Daily Operation - Dev,
`https://org9a7651f0.crm5.dynamics.com`, solution `A365_DailyOperations`.
No frontend edit or Code App publication was required.

The deployed 1.0.0.0 DLL was stale relative to the architecture in the owner's
attached request. Downloaded-DLL replay proves its guard rejects a transactional
API ancestor without `A365.ValidatedLeaveCommand` in the parent snapshot, and
accepts the identical contexts when that marker is present. The current guard
specified by the owner has no such dependency. See
`test-write-guard.ps1 -AssemblyPath .../live-before.dll -LegacyEvidence`.

The original live reproduction at 07:43:21Z failed in ProtectLeaveWrites on Create
at depth 2; LeaveCommand at depth 1 propagated the same error. The old DLL did
not trace its parent marker, so the marker's absence in that exact live context
was not directly captured. Its extra dependency was proved independently by replay.

**Correction to the initial hypothesis:** although all 20 guards were at the
wrong requested stage (10), a false transaction flag was not the reproduced
cause. After the assembly update, stage-10 child writes and their API ancestors
both traced `transaction=True` and passed before stage migration. Do not claim
moving the stage alone fixed the original failure.

## Client audit

Submit follows `EntryForm.submit` in `src/features/leave/add-leave-dialog.tsx`
-> `useIssueLeave` -> `postingService.submit` -> generated
`A365_LeaveCommandService.a365_LeaveCommand` -> `executeAsync` Custom API action.
It sends `command=issue`, Employee GUID, stable component-state `operationId`,
numeric leaveType/benefit, yyyy-MM-dd start/end dates, and note. Uncertain retries
retain that operation identity; automatic mutation retries are disabled.

| Direct-write definition outside API | Location | Runs on Submit? |
| --- | --- | --- |
| Leave create/update/delete | `src/generated/services/A365_leavesService.ts`, lines 19/27/36 | No application call sites |
| Credit create/update/delete | `src/generated/services/A365_leavecredittransactionsService.ts`, lines 19/27/36 | No application call sites |
| Explicit direct-Create rejection test | `scripts/leave-schema/test-submission-live.ps1`, under `-Apply` | No; standalone test, execution blocked |

Generated files were not edited. The Leave read service uses get/getAll only.
No direct-write retry/fallback was found. Email state changes route through
prepareEmail/completeEmail after source commit. `safeError` in posting-service.ts
extracts the text after `LEAVE:`; this accounts for the screenshot's missing prefix.

## Environment and assembly audit

- API casing: `a365_LeaveCommand`, unbound (`bindingtype=0`), action
  (`isfunction=false`), handler `A365.Leave.Plugins.LeaveCommand`.
- Required Request and Response are String (type 10). Custom processing steps
  are disabled. Only the platform implementation step at stage 30 exists on
  that message; no extra custom processing step was found.
- Diagnostics: policyVersion `2026-10-22.1`, isInTransaction true,
  serverValidation true. The signed-in account directly holds Payroll Admin.
- Before: assembly 1.0.0.0, modified `2026-10-22T07:01:19Z`, SHA-256
  `2CF25561061B1C00C8A3360BBD3BC7F6CD8BBFAB26222873C5463793CEA39074`.
- After: assembly 1.0.1.0, modified `2026-10-22T07:44:15Z`, SHA-256
  `C0672145F1EF336616E664392568CE2F01041A56B69726F74B2B850F990C5D8E`.
  Downloaded final DLL, local build and native export match. Same assembly ID
  and signing token; no older DLL is pinned in the pulled solution source.

## Exact registration changes

Every listed step is still **enabled (statecode 0), synchronous (mode 0)**,
rank 1, bound to ProtectLeaveWrites. Only stage changed from 10 to 20:

| Entity | Message | Before | After |
| --- | --- | --- | --- |
| a365_leave | Create | 10 | 20 |
| a365_leave | Update | 10 | 20 |
| a365_leave | Delete | 10 | 20 |
| a365_leave | CreateMultiple | 10 | 20 |
| a365_leave | UpdateMultiple | 10 | 20 |
| a365_leave | Assign | 10 | 20 |
| a365_leave | SetState | 10 | 20 |
| a365_leavecredittransaction | Create | 10 | 20 |
| a365_leavecredittransaction | Update | 10 | 20 |
| a365_leavecredittransaction | Delete | 10 | 20 |
| a365_leavecredittransaction | CreateMultiple | 10 | 20 |
| a365_leavecredittransaction | UpdateMultiple | 10 | 20 |
| a365_leavecredittransaction | Assign | 10 | 20 |
| a365_leavecredittransaction | SetState | 10 | 20 |
| a365_leavecoordination | Create | 10 | 20 |
| a365_leavecoordination | Update | 10 | 20 |
| a365_leavecoordination | Delete | 10 | 20 |
| a365_leavecoordination | CreateMultiple | 10 | 20 |
| a365_leavecoordination | UpdateMultiple | 10 | 20 |
| a365_leavecoordination | SetState | 10 | 20 |

The original set exposed no table-specific Upsert/UpsertMultiple/Merge filters.
No broad organization-wide unfiltered step was added. Direct Upsert coverage
remains unverified; Create regression tests are not proof of every write path.

## Trace and rollback evidence

Tracing was temporarily changed Off -> All -> Off in finally blocks. Trace rows
appeared after a delay; the immediate empty query was not the final result.
Added tracing includes context only, never payloads, notes or employee values.
The final 07:51:22Z trace shows:

```text
Create a365_leavecoordination stage=20 depth=2 transaction=True
  -> Create a365_leavecoordination stage=30 depth=2 transaction=True
    -> a365_LeaveCommand stage=30 depth=1 transaction=True
```

Ledger Create/CreateMultiple traces show the same transactional API ancestry.
A deliberately invalid date reached date validation after coordination and
automatic-credit writes; the transaction then rolled back. Leave, ledger and
coordination record counts were unchanged. No email was sent.

## Source changes

Release/registration diff:

```diff
-[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
+[assembly: System.Reflection.AssemblyVersion("1.0.1.0")]
- $leaveStepBody=@{name=$leaveStepName;stage=10;mode=0;rank=1;supporteddeployment=0}
+ $leaveStepBody=@{name=$leaveStepName;stage=20;mode=0;rank=1;supporteddeployment=0}
```

Final guard predicate (unchanged from the architecture supplied in the request):

```csharp
if (context.IsInTransaction)
    for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext)
        if (parent.MessageName == LeaveCommand.Api && parent.IsInTransaction) return;
Rules.Fail("Use the validated Leave command. Direct changes to Leave or credit history are not permitted.");
```

- `LeaveCommand.cs`: version 1.0.1.0 and context-only tracing. The deployed guard
  matches the owner's specified predicate: transactional child plus transactional
  API ancestor. No bypass flag, SharedVariables dependency or ExecuteTransaction.
- `register-posting.ps1` and `verify-posting.ps1`: use/check stage 20.
- `repair-guard-registration.ps1`: updates and reads back only the existing
  20 guards. No guard disabled; no business schema or roles changed.
- `update-posting-assembly.ps1`: supports an in-place non-downgrade build/revision
  update while verifying assembly name, token and same major/minor version.
- Audit, trace, local regression, rollback and optional live-test scripts added.
- Only native exported Leave assembly artifacts and the 20 guard XML files were
  copied back. Other exported components were preserved. Source repack passed.

## Verification and limitations

| Requested verification | Actual result |
| --- | --- |
| Client payload, stable identity, no fallback | Source audit passed; prior serial run passed all 240 app tests |
| Live API binding, role and diagnostics | Passed |
| Final assembly/version/hash/export | Passed |
| Guard direct/spoofed/nontransactional rejection | Six local checks passed, also against downloaded final DLL |
| Existing policy rules | 17 checks passed |
| Actual nested writes and rollback | Passed, record counts unchanged |
| Paid VL zero balance -> saved Unpaid | Preflight passed; persistent test blocked before execution |
| Paid SL -> one keyed deduction | Preflight passed; persistent test blocked before execution |
| Replay committed operation -> no duplicates | Mocked regression passed; live test not executed |
| Direct Create as signed-in user | Local guard replay passed; live direct business-record test not executed |
| prepareEmail -> completeEmail | Mocked regression passed; live source-dependent test not executed |
| Actual Outlook send | Not executed; no Sent outcome fabricated |
| Lint/build | Passed preceding run; no frontend code changed in this repair |

Automatic approval review blocked retaining two own-employee verification records
(October 22 Unpaid VL and October 23 Paid SL) and the one-day SL deduction. Explicit
approval of those lasting records is pending. No financial records were retained
or deleted to manufacture tests. No role changes, Payroll changes, application
publication, commit or Git push. Ordinary-account access remains unverified.
