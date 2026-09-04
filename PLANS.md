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
3. 🔄 **Next** — Add `a365_employee` as a code-app data source; build the
   Employee list + create/edit form (Payroll Admin), with loading/empty/error
   states.
4. Use the **`dv-security`** skill to create `A365 - Payroll Employee` /
   `A365 - Payroll Admin` roles and apply `a365_employee` privileges
   (security-model §5); wire the Employee↔systemuser link.

## Requirements

- Dev environment only for now (`The Daily Operation - Dev`, sandbox). No Prod yet.
