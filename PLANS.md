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
  - Dataverse MCP registered in `.mcp.json` (commit 7ce4dd3).
  - **Waiting on:** tenant admin consent + enabling the Dataverse CLI client on
    the Dev environment, then a Claude Code restart to activate the MCP tools.

## Next steps (after Claude Code restart)

1. Verify the `dataverse` MCP tools loaded.
2. Create `a365_employee` (User/Team owned) with columns + global choices per
   `docs/data-model.md` using the MCP `create_table` tool.
3. Add `a365_employee` as a code-app data source; build the Employee list +
   create/edit form (Payroll Admin), with loading/empty/error states.
4. Create `A365 - Payroll Employee` / `A365 - Payroll Admin` roles and apply
   `a365_employee` privileges (security-model §5); wire the Employee↔systemuser link.

## Requirements

- Dev environment only for now (`The Daily Operation - Dev`, sandbox). No Prod yet.
