# Active: Payroll Milestone — phase-by-phase (docs\payroll-task-phases.md)

## Progress

- **Phase 1 — Foundation:** ✅ Complete (commit c8b8bbb). Publisher `Automations 365`
  (prefix `a365`) + solution `A365-DailyOperations` in Dev; code app wired to the
  Power SDK; `docs/architecture.md`, `docs/naming-conventions.md`.
- **Phase 2 — Security Model:** ✅ Design complete (commit 065ed75).
  `docs/security-model.md`. Enforcement deferred into Phases 3–4. Confirmed:
  owner-based access, single business unit, plug-in-based immutability, no Delete.
- **Phase 3 — Employee Master Data:** ✅ Complete.
  - Dataverse connected via the **`dataverse` plugin** (`dv-connect`): DV CLI +
    PAC + Python + MCP authenticated to `The Daily Operation - Dev`.
  - `a365_employee` table created (**UserOwned**) with all columns, 4 global
    choices, autonumber, and the `a365_systemuser` lookup; exported into
    `solution/A365_DailyOperations`.
  - Added as a code-app data source; built the typed employee domain layer and
    the Employee admin UI (list + create/edit) with all four data states.
  - Created + verified the `A365 - Payroll Employee` / `A365 - Payroll Admin`
    security roles (security-model §13).
  - **Open validation:** runtime test of CRUD against live Dataverse (see below).

## Next steps (after Claude Code restart)

1. ✅ Done — **`dv-connect`** (see above). On restart, verify with
   `claude mcp list` (server ✓ Connected) and a "list my tables" MCP call.
2. ✅ **Done** — `a365_employee` created (**UserOwned**) with all columns + 4
   global choices per `docs/data-model.md`; exported into
   `solution/A365_DailyOperations` (commit adds the schema).
3. ✅ **Done** — `a365_employee` added as a code-app data source
   (`shared_commondataserviceforapps`, connection created in the maker portal).
   Built the typed employee domain layer (data-client seam → types → service →
   TanStack Query hooks) and the Employee admin UI: sortable TanStack Table with
   Loading/Success/Empty/Error states + active/inactive/all filter, and a
   create/edit form dialog with validation, saving state, and toast errors.
   `npm run lint` + `npm run build` pass.
4. ✅ **Done** — Created `A365 - Payroll Employee` (Read/User) and `A365 -
   Payroll Admin` (Create/Read/Write/Append/AppendTo/Assign/Share Org, no
   Delete) roles via the Dataverse Web API, verified the granted depths, and
   exported them into `solution/A365_DailyOperations` (see security-model §13).
   Employee↔`systemuser` owner assignment is deferred to Phase 4/6 (needs
   employee records + user accounts; the lookup column already exists).

## Validation still open

- **Runtime test against live Dataverse:** run the app (`npm run dev` /
  `npx power-apps run`) and exercise list + create/edit. The build compiles and
  types match the Power SDK, but the CRUD calls have not yet been run against the
  live table.

## Requirements

- Dev environment only for now (`The Daily Operation - Dev`, sandbox). No Prod yet.
