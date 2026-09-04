# Active: Payroll Milestone — phase-by-phase (docs\payroll-task-phases.md)

## Progress

- **Phase 1 — Foundation:** ✅ Complete (commit c8b8bbb). Publisher `Automations 365`
  (prefix `a365`) + solution `A365-DailyOperations` in Dev; code app wired to the
  Power SDK; `docs/architecture.md`, `docs/naming-conventions.md`.
- **Phase 2 — Security Model:** ✅ Design complete (commit 065ed75).
  `docs/security-model.md`. Enforcement deferred into Phases 3–4. Confirmed:
  owner-based access, single business unit, plug-in-based immutability, no Delete.
- **Phase 3 — Employee Master Data:** 🔄 In progress.
  - Confirmed `a365_employee` schema in `docs/data-model.md` (choices as-is).
  - Installed the Microsoft **`dataverse` plugin** (claude-plugins-official) for
    Dataverse work.
  - ✅ **`dv-connect` complete** (commit 969da79): DV CLI + PAC + Python SDK all
    authenticated against `The Daily Operation - Dev` (org9a7651f0) as
    michael@automations365.com; tenant admin consent granted for the Dataverse
    CLI app; MCP server registered in `.mcp.json` (project scope) and the MCP
    client allowlisted; data plane verified reachable.
  - **Waiting on:** a Claude Code restart so the `dataverse-org9a7651f0` MCP
    tools load into the session.

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
4. 🔄 **Next** — Use the **`dv-security`** skill to create `A365 - Payroll
   Employee` / `A365 - Payroll Admin` roles and apply `a365_employee` privileges
   (security-model §5); wire the Employee↔systemuser link.

## Validation still open

- **Runtime test against live Dataverse:** run the app (`npm run dev` /
  `npx power-apps run`) and exercise list + create/edit. The build compiles and
  types match the Power SDK, but the CRUD calls have not yet been run against the
  live table.

## Requirements

- Dev environment only for now (`The Daily Operation - Dev`, sandbox). No Prod yet.
