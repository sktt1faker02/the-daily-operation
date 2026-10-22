# AGENTS.md

## Project Overview

The Daily Operation is Automations 365's internal operational hub: Payroll first,
then Leave Management and Accounting. This is a **Microsoft Power Apps Code App**
based on Microsoft's `PowerAppsCodeApps/templates/starter`. Preserve Power
Platform integration and separate domain modules. Build future modules only when
requested or needed for a clean integration boundary.

## Requirement Review Workflow

Before application feature work, read in order:

1. This file.
2. [DESIGN.md](DESIGN.md).
3. The full [PLANS.md](PLANS.md) or task-specific requirements document.
4. For Payroll, financial calculations, payslips or related integrations, also
   read [Payroll domain guidance](docs/payroll-agent-guidance.md).

Convert every acceptance criterion into a concrete verification checklist before
editing. Check affected UI, business logic, data and related states; verify each
criterion afterwards and report anything incomplete or unverified. Explicit
requirements override conflicting existing controls. Latest confirmed owner
decisions supersede historical defaults; do not invent business rules.

Use [payroll task phases](docs/payroll-task-phases.md) for phase-based planning.
Record Payroll enhancements in [Payroll-Enhancements.md](Payroll-Enhancements.md)
with date, outcome, changed files/features, verification and remaining limits.

## Economical Workflow

- Keep scope narrow and make the smallest coherent change. Avoid optional
  refactors, unrelated fixes and speculative improvements.
- Inspect affected implementation, related components/types/services and routing.
  Use `rg` and bounded reads; avoid scanning or printing the entire repository.
- Read relevant skills/references once per task; revisit only for changes or a
  concrete uncertainty. Keep tool output, progress updates and final replies brief.
- Do not spawn subagents unless the user explicitly requests delegation.
- Prefer Low reasoning for routine edits and Medium for normal implementation;
  reserve higher effort for difficult debugging, financial rules or security.
  Written instructions alone do not change the selected reasoning setting.
- Run targeted tests during iteration and required final checks once after the
  last relevant change. Repeat only for failures, new edits or unresolved risk.
- Keep related follow-ups together. For a different task, prefer a fresh thread
  with a short handoff covering scope, changed files, checks and open issues.

## Architecture and Dependencies

- Use strict TypeScript and functional React. Avoid `any` except genuinely
  unrepresentable API boundaries. Derive render state directly; avoid unnecessary
  `useEffect`. Keep business logic outside presentation components.
- Use Component -> Hook -> Service -> Dataverse; expose business-oriented service
  operations and reuse existing generated services/data clients.
- **Dataverse is the business system of record**, including configuration. No
  other database without explicit authorization. Confirm actual table/column
  schema/logical names, relationships and choices; never guess names or equate
  display names with logical names. Do not hand-edit generated data-source files.
- **SharePoint is the document repository.** Confirm site/library identifiers and
  structure. Dataverse holds business references/metadata; storing document
  binaries there requires a specific justified requirement.
- Use Power Automate for appropriate background/server workflows: documents,
  notifications, scheduled work and cross-service operations. Handle failures.
  Keep simple interactions and ordinary CRUD in the app unless justified.
- TanStack Query owns Dataverse server state, queries, mutations, caching and
  retries. Invalidate the smallest affected query scope. Zustand is only for
  genuine client/UI state; never duplicate fetched collections there.
- Use server filtering/paging and caching; avoid duplicate requests, unnecessary
  renders/global state and loading every employee's complete payroll history.
- Preserve React 19, Vite, React Router, Tailwind, shadcn/Radix, Lucide, TanStack
  Table, date-fns and Sonner. Use Recharts when needed. Check existing stack and
  browser capabilities before adding dependencies; avoid overlap and explain
  significant additions. Do not replace the starter architecture unnecessarily.

## UI, Forms and Errors

- Follow DESIGN.md. Prefer starter and shadcn/Radix components, Tailwind layout
  and Lucide icons; no emoji UI icons. Prioritize clarity, readable tables,
  predictable navigation, clear statuses, responsive layout and minimal decoration.
- Use semantic HTML, labelled fields, keyboard access and accessible primitives.
  Status must use text as well as color.
- Data-dependent pages need loading, success, empty and error states. Loading
  cannot leave blank screens; empty states explain the next action.
- Forms validate required values, explain errors, show saving state, prevent
  duplicate submits and retain values until successful mutation.
- Surface useful errors/toasts; never silently swallow failures or expose
  sensitive raw backend details to ordinary users.
- Use TanStack Table where useful for complex grids, with appropriate sorting,
  filtering, paging, formatted values and row actions.

## Security and Financial Safeguards

- Treat payroll/financial information as sensitive. Enforce authorization through
  Entra authentication, Dataverse roles/privileges, ownership/access and SharePoint
  permissions. UI checks supplement these controls; UI hiding is never security.
- Employees can view only their own profile, history and payslips. They cannot
  edit calculations, finalize payroll, mark paid or access others' records.
- Payroll Admin manages employees, periods, editable inputs, calculations, review,
  finalization, payment, locking, reports and authorized documents. No separate
  approver or approval queue. Do not grant ordinary admins System Administrator
  functionality.
- Never invent formulas, statutory rates, cutoff/salary/tax treatment, leave
  deductions, correction, retention or access policies. Resolve missing business
  decisions before dependent work.
- Do not hardcode statutory rules into JSX. Centralize calculations, rounding and
  PHP/en-PH currency formatting; avoid unreliable floating-point money equality.
- Finalized payroll and payslips are immutable snapshots. Current salary or rule
  changes must never silently recalculate history. Corrections require an explicit
  auditable process; never delete financial records for ordinary mistakes.
- Financially important actions require confirmation. Destructive actions such as
  delete, void, unlock or removing an employee also require authorization, clear
  impact and required auditability.
- Preserve supported Created/Modified, Calculated, Finalized and Paid actor/time
  metadata and use Dataverse auditing where appropriate.
- Verify direct record/data access: Employee A cannot access Employee B, employees
  cannot edit/finalize/pay, admins have intended permissions and locked payroll
  cannot be modified normally. Report unavailable live security checks.

## Testing and Development Commands

- Use Vitest/React Testing Library with colocated independent tests and
  `userEvent`. Prefer accessible queries and `findBy*`/`waitFor` for async updates.
  Mock external boundaries only when needed, never the component or rule tested.
- For bug fixes, reproduce with a test when practical. Cover relevant flows, edge
  cases and loading/empty/error states; avoid tests mirroring trivial code.
- Application changes require targeted checks while iterating, then `npm test`,
  `npm run lint`, `npm run build` and relevant Playwright checks before handoff.
  Lint/build must pass or an existing unrelated issue must be explicitly reported.
- Documentation-only changes require link/path checks, contradiction scans and
  `git diff --check`; no runtime tests, lint or app build. Codex configuration
  changes also require validation with the installed CLI.
- Use starter scripts and platform tooling: `pa app run`, `npm run preview`,
  `npm run lint` and `npm run build`.

## Microsoft Power Platform Skills

Use Microsoft Learn MCP for current Microsoft documentation when needed. Before
Power Platform work, read the relevant entry in `.agents/skills/`; it points to
full instructions/references in `.agents/power-platform-skills-source/`. Prefer
Code Apps skills for this app, Dataverse skills for data/schema/security/query
work and Power Automate skills for flows. Use Vercel React best practices for
React work when available. Read referenced examples before unfamiliar APIs and
verify APIs/commands against installed tools and authoritative documentation.

Imports provide written workflows only; check tool availability. Never infer
environment-changing authorization from skills. Project/payroll security rules
take precedence. Project reasoning/app restrictions live in `.codex/config.toml`;
exact-path skill overrides live in the user's Codex config. Re-enable relevant
skills/integrations when explicitly needed.
