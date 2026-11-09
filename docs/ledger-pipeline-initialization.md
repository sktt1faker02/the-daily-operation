# Ledger configuration after pipeline deployment

2026-11-09. The owner requested fixing the existing Ledger so a new environment
does not require manually creating its coordination/configuration record.

## Scope and verification checklist

- [x] Fresh-environment list, preview and progress can run without a coordination
  row; reads/export do not create configuration or financial records.
- [x] Category values come from published `a365_ledgertransaction.a365_category`
  metadata in the target environment, using English solution labels (1033).
  Missing, extra, duplicate or incomplete categories are rejected.
- [x] The first authorized mutation initializes the existing singleton identity
  `25886558-8d32-45f8-8294-f13b220ba37a` inside the financial transaction.
- [x] Existing category configuration is preserved; retrying the same save does
  not duplicate a record. A concurrent initializer cannot replace the winning
  request's configuration. Conflicts remain atomic and retryable.
- [x] Export rejects a revision from before the first committed save; reads detect
  concurrent initialization before returning their result.
- [x] Payroll Admin authorization, native auditing, direct-write guards and
  financial rollback remain enforced. A failed first save rolls back setup too.
- [ ] Verify first-use creation, overlapping initial saves and ordinary-user
  security in a real target Dataverse environment after solution deployment.

## Implementation

`plugins/A365.Ledger.Plugins/LedgerCommand.cs` version **1.0.0.4** removes the
dependency on a separately seeded row. When absent, read-only commands use verified
published Choice metadata and a stable `uninitialized` revision. The first write
uses SDK Upsert for the singleton, populates categories only when newly created,
and takes the normal coordination lock before continuing. The subsequent financial
revision invalidates previews/exports made before that first commit.

No table/column, role, assignment, generated binding, client form, calculation or
existing financial record changes are required. No environment auditing setting
is changed automatically. Missing API/plug-in components, missing permissions or
disabled production auditing are separate deployment prerequisites; this change
does not establish the original production error's exact cause.

## Delivery

Build with `scripts/ledger/build.ps1`; verify with
`scripts/ledger/test-server.ps1`. Local verification passes **113 server contract
assertions**; transaction rollback and concurrent boundaries are simulated.

App lint/build and the existing Ledger browser checks at 1280px and 390px pass.
The browser uses a synthetic SDK boundary and verifies loading, forms, saving,
confirmations, pagination, export, errors/retry and employee route denial. Build
retains its existing large-chunk warnings. The initial parallel app test run had
timeouts; `npm test -- --maxWorkers=1` then passed **537 tests / 53 files**.
Documentation links/paths and `git diff --check` pass. Concurrent unrelated Leave
edits in the shared workspace were preserved.

Include the rebuilt signed `A365.Ledger.Plugins` assembly **1.0.0.4** in the Dev
solution before running the normal solution pipeline. Publishing only the Code
App's React bundle cannot update server behavior. Existing registration tooling
targets Dev; do not run schema seeding or unmanaged-registration scripts against
managed production. No production access or deployment was performed for this fix.

## Authorized Dev deployment - 2026-11-09

The owner explicitly requested applying the fix to Dev after local verification.
Updated the existing `A365.Ledger.Plugins` assembly in place from 1.0.0.3 to
**1.0.0.4**, retaining a local backup in ignored
`scripts/ledger/.work/pipeline-update/`. The installed assembly ID remains
`ccbe03b7-62d7-f111-84ea-70a8a5036aa3`; membership in the existing unmanaged
`A365_DailyOperations` solution was verified before upload.

Installed content matches the tested DLL SHA-256:
`1D20596B03511E2CEEA964E95D20BA2D9C7676E3006EB0ACD613EF835A791364`.
All **38 read-only live verification checks** pass; see
[runtime evidence](ledger-runtime-verification.json). Dev auditing was already
enabled. No roles, assignments, financial records, schema, app frontend or
production environment were changed, and no historical posting was started.

Exported and unpacked the updated Dev solution into ignored
`artifacts/ledger.local/pipeline-update/`. The native exported Ledger DLL is
version **1.0.0.4** and matches the installed/tested SHA-256 above. Start a new
pipeline deployment from Dev to capture this update; promoting an older staged
solution artifact does not incorporate newly updated Dev components. No frontend
push is required for this server-only fix.

Dev already has its coordination record; fresh-environment initialization and
overlapping first saves remain verified by local server tests, not a live fresh
environment. Zero ordinary employee identities could be verified for impersonation;
signed-in employee security UAT remains outstanding.

See [release prerequisites](ledger-release.md) and
[original Dev activation](ledger-activation.md).
