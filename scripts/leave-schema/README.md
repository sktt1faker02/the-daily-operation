# Leave schema — Stages 1–3

These JSON files are reviewed inputs to the installed Microsoft Dataverse CLI.
They create metadata in the existing `A365_DailyOperations` solution; they are
not hand-authored solution-export files or Code App generated services.

The approved target is `The Daily Operation - Dev` at
`https://org9a7651f0.crm5.dynamics.com`. The completion script verifies the
environment ID, existing solution/publisher and referenced primary keys before
making changes. It reuses tables and relationships already created during this
task. It stops on incompatible settings or a failed request; inspect actual
metadata before retrying an uncertain write.

Python is not installed on this workstation. `complete-stage1.ps1` therefore
orchestrates the installed first-party CLI rather than implementing HTTP,
authentication or an alternative client. The CLI reuses the cached sign-in.
Its executable path is workstation-specific and must be reviewed before use
elsewhere.

The script creates only the three planned tables and nine business lookups,
sets three choice defaults using integers returned by Dataverse, publishes only
those table definitions, and verifies the live metadata. It never creates
business records, alters security roles/environment auditing, or creates the
Stage 2 alternate keys. Local choice values in the initial JSON are null so
Dataverse allocates them under the solution publisher; they are not guessed.

Run only with the approved environment and Stage 1 scope:

```powershell
& ./scripts/leave-schema/complete-stage1.ps1
```

For read-only verification of the Stage 1 schema:

```powershell
& ./scripts/leave-schema/complete-stage1.ps1 -VerifyOnly
```

The read-only mode refreshes the **Stage 1 snapshot** but performs no
Dataverse writes. Its key-status text describes the end of Stage 1, not the
current Stage 2 result. Stage 1 evidence is saved in
[leave-schema-verification.json](../../docs/leave-schema-verification.json);
the explanation and remaining stages are in
[leave-data-model.md](../../docs/leave-data-model.md). Transient default-update
payloads are held in the ignored `.work/` directory.

`pull-source.ps1` exports the full existing solution as unmanaged, unpacks it,
and copies only the new Leave entity definitions and their related generated
XML nodes into the existing solution source. It preserves unrelated Payroll
and security-role definitions. Run it after successful live verification:

```powershell
& ./scripts/leave-schema/pull-source.ps1
```

It refuses to replace existing new-table source folders; inspect an existing
pull before refreshing it. The current full Dev export and unpacked snapshot
are retained under ignored `.work/`. The local source can be checked without
importing anything:

```powershell
& 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd' solution pack --zipfile scripts/leave-schema/.work/leave-stage1-source-check.zip --folder solution/A365_DailyOperations/src --packagetype Unmanaged
```

## Stage 2 — composite keys and relationship verification

`complete-stage2.ps1` verifies the same environment, solution, publisher, key
column types/lengths/required levels/security settings, all five referenced
primary IDs, and all nine business lookup targets and Restrict Delete settings.
It counts records without logging business values and checks for existing keys
before creating either reviewed key payload (`04-` and `05-`). An unexpected
populated ledger stops creation for separate duplicate investigation; the
script never deletes or changes records to make a key work.

```powershell
& ./scripts/leave-schema/complete-stage2.ps1 -InspectOnly
& ./scripts/leave-schema/complete-stage2.ps1
& ./scripts/leave-schema/complete-stage2.ps1 -VerifyOnly
```

`-InspectOnly`, `-VerifyOnly` and `-KeyStatusOnly` perform no Dataverse writes.
The last mode reads just the target and current key statuses. Normal creation
reuses compatible keys, then polls for Active; it reports failure or a timeout
without automatically reactivating, deleting or recreating a key. A short delay
before newly created metadata is visible is handled without another POST.

The separate [Stage 2 evidence](../../docs/leave-schema-stage2-verification.json)
retains exact key names, columns, index statuses, record counts and relationships.
The Stage 1 evidence remains a historical snapshot. Null Period Key values do
not enforce uniqueness; later operations must supply and validate Employee and
Transaction Key and reuse the same Transaction Key on retries.

`export-stage2.ps1` performs a read-only unmanaged export of the existing
solution after successful Stage 2 verification. Run export and unpack as
separate commands to avoid a Windows ZIP file-lock race:

```powershell
& ./scripts/leave-schema/export-stage2.ps1
& ./scripts/leave-schema/export-stage2.ps1 -UnpackOnly
& ./scripts/leave-schema/pull-stage2-source.ps1
```

It refuses to overwrite an existing Stage 2 export or unpack directory. The
full solution snapshot is ignored under `.work/`. `pull-stage2-source.ps1`
verifies that both exported keys match the Active live evidence and that no
other table settings differ, then copies only the exported ledger `Entity.xml`
into the existing source. No solution import is performed. Check the local
source without importing it:

```powershell
& 'C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/pac.cmd' solution pack --zipfile scripts/leave-schema/.work/leave-stage2-source-check.zip --folder solution/A365_DailyOperations/src --packagetype Unmanaged
```

The originally manual checklist is in
[leave-data-model.md](../../docs/leave-data-model.md#permissions--applied-and-verified).
The owner later explicitly authorized applying these planned grants directly.
The dedicated grant script below is the only script that changes a role;
schema, export, inspection and registration scripts do not change roles.

## Stage 3 — Code App source registration

`inspect-stage3-permissions.ps1` reads the two existing Payroll roles and table
privilege metadata using the Microsoft Dataverse CLI. It cannot change roles,
assign users, elevate access or write records. Its
[permission report](../../docs/leave-permissions-verification.json) distinguishes
role configuration from effective user access.

`register-stage3.ps1 -InspectOnly` verifies the existing environment, completed
Stage 2 evidence, feature branch and installed grouped CLI, then prints the
three reviewed generation commands without executing them. This preflight
passed. Registration also requires a successful saved permission inspection.
The owner explicitly superseded PLANS.md's manual-only instruction, the grants
were applied, and the final role inspection has zero differences from the plan.

Commands used for the authorized grant, verification and generation:

```powershell
& ./scripts/leave-schema/grant-stage3-permissions.ps1
& ./scripts/leave-schema/inspect-stage3-permissions.ps1
& ./scripts/leave-schema/register-stage3.ps1 -InspectOnly
& ./scripts/leave-schema/register-stage3.ps1
```

Generation uses `npx --no-install pa app add data-source --connector dataverse`
for each verified logical table. It saves a local ignored snapshot first and
checks existing registration before retrying an interrupted operation. It
does not deploy, change roles/schema, create sample records or implement Leave
features. Verify generated schemas/models/services against actual metadata and
run lint/build before claiming Stage 3 complete. Never edit generated files by
hand to make those checks pass.

`grant-stage3-permissions.ps1` is scoped to the already verified existing
`A365 - Payroll Admin` role in Dev. It resolves actual privilege IDs from table
metadata, checks existing privileges before writing, and calls the additive
`AddPrivilegesRole` action using the installed Microsoft Dataverse CLI. The
MCP Custom API tool does not provide this bound security operation. The script
adds only the 13 planned Leave-table privileges and System User Append To at
Organization scope; it verifies all 14 grants and preservation of unrelated
privileges. No Delete, Assign, Share, ledger Write, role assignment or System
Administrator elevation is performed. Exact grant evidence is in
[leave-permission-grant.json](../../docs/leave-permission-grant.json).

All three schemas, models and services were generated successfully using the
installed Power Apps CLI 1.0.1. `verify-stage3.ps1` independently checks all
39 specified columns, seven local choices and nine business binding properties
against the earlier live read-back and a fresh native export. It checks that
43 existing generated files and all existing source registrations were
preserved. Binding values remain strings and require later business validation;
no Leave operations were implemented.

```powershell
& ./scripts/leave-schema/export-stage3.ps1
& ./scripts/leave-schema/export-stage3.ps1 -UnpackOnly
& ./scripts/leave-schema/pull-stage3-role.ps1
& ./scripts/leave-schema/verify-stage3.ps1
```

The role pull merges only the 14 approved nodes from the native exported role
into its existing source definition, preserving unrelated pre-existing source
differences. It does not claim a full solution synchronization. The fresh full
unmanaged snapshot is ignored in `.work/`. Local solution packing passed after
the role-source update; no solution was imported. Lint and build passed after
generation, with the existing large-chunk warning.

The unscoped `npm test` command also discovers imported third-party skill tests
under `.agents`; that run encountered unrelated failures and an export-test
timeout under the broad run and was stopped. Application checks should use
`npm test -- src`; that run passed all 171 application tests in 19 files,
including all 24 Payroll export tests. No test discovery configuration was
changed as part of source registration.

The signed Days bounds use Dataverse's technical decimal range; they do not
define an entitlement or accrual policy. Half-day rules, annual conversion caps,
concurrent spending, atomic operations, notifications and Payroll integration
require later implementation. Audit flags on the new tables/columns do not
enable environment-wide auditing.
