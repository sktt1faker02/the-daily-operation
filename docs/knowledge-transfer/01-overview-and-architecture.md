# 01 — Overview and architecture

**Evidence rule.** Every behavior claim below is marked **[Code]** and points to
the source that shows it. **[Verify in environment]** means the repository
cannot establish the live Power Platform setting. Environment-specific values
are intentionally not copied into this handover.

## 1. What this application is

**[Code]** The Daily Operation is a React and TypeScript single-page Power Apps
Code App. `src/main.tsx` mounts `App`; `src/App.tsx` composes the toast
provider, TanStack Query provider, access gate, and router. The Vite build uses
the Power Apps Vite plugin (`vite.config.ts`). The app is designed to run in a
Power Apps host and also has local development commands (`AGENTS.md`;
`package.json` › `scripts`).

**[Code]** The code uses the Microsoft Power Apps SDK for app context and
Dataverse access. `src/lib/power/power-context.ts` › `getPowerContext` reads
host-provided context; `src/lib/power/data-client.ts` › `dataClient` binds the
SDK data client to generated data-source metadata. Feature services call that
client. No hand-written fetch or Axios data layer was found in `src`.

**[Code]** Dataverse-backed business data is accessed through app services.
The repo includes a solution project under `solution/A365_DailyOperations`,
generated connector metadata under `.power/schemas`, and generated models and
services under `src/generated`. The source tree also contains a Dataverse
plug-in project under `plugins/A365.Payroll.Plugins` and helper scripts under
`scripts`.

**[Verify in environment]** The actual environment, deployed app version,
solution membership, connections, server-side plug-ins, and role assignments
must be checked in Power Platform. `power.config.json` contains an environment
binding; its identifier is omitted here because it is environment-sensitive.

## 2. Repository map

| Location | What is there | Evidence |
| --- | --- | --- |
| `src/pages/` | Routed screens for payroll, employees, overview, and payslips. | **[Code]** `src/router.tsx` › `router` |
| `src/features/payroll/` | Payroll types, status/date rules, UI components, hooks, services, and tests. | **[Code]** `src/features/payroll/` |
| `src/features/employees/` | Employee UI, user lookup, reference data, hooks, and services. | **[Code]** `src/features/employees/` |
| `src/components/` | Shared access components and UI primitives. | **[Code]** `src/components/` |
| `src/providers/` | App-wide TanStack Query and Sonner providers. | **[Code]** `src/App.tsx` › `App` |
| `src/lib/power/` | Power Apps SDK context and Dataverse data-client seam. | **[Code]** `src/lib/power/` |
| `src/generated/` | Generated TypeScript table models and connector services. | **[Code]** `src/generated/index.ts` |
| `.power/schemas/` | Generated app data-source schemas and registration metadata. | **[Code]** `.power/schemas/appschemas/dataSourcesInfo.ts` |
| `solution/` | Source project for the Dataverse solution. | **[Code]** `solution/A365_DailyOperations/` |
| `plugins/` | Source project for the payroll protection plug-in. | **[Code]** `plugins/A365.Payroll.Plugins/` |
| `scripts/` | Local verification and configuration-seeding scripts. | **[Code]** `scripts/` |
| `docs/` | Architecture, deployment, payroll, and task documentation. | **[Code]** `docs/` |
| `public/` | Static logos and app assets. | **[Code]** `public/` |

**[Code]** The browser entry is `index.html` → `src/main.tsx` → `src/App.tsx`.
`App` wraps the router with `RoleGate`, `QueryProvider`, and
`SonnerProvider`. `src/router.tsx` defines a basename from the current hosted
URL and normalizes a hosted `index.html` route for Power Apps.

## 3. Screens and route access

All routes sit under the global `RoleGate` in `src/App.tsx` › `App`. The gate
allows the two configured app roles or the documented fallback when role
lookup is denied. Admin pages also use the `AdminOnly` route wrapper. These are
application navigation checks; Dataverse privileges remain the data security
boundary (`src/components/RoleGate.tsx` › `RoleGate`,
`src/features/payroll/role-gate.tsx` › `AdminOnly`, `src/features/payroll/access.ts`
› `ALLOWED_ROLES` and `deriveGate`).

| Route | Screen | App-level access | Evidence |
| --- | --- | --- | --- |
| `/` | Welcome / role-aware home | Any user admitted by the global gate; page chooses its next action based on access profile. | **[Code]** `src/router.tsx` › index route; `src/pages/home.tsx` › `HomePage` |
| `/overview` | Payroll overview | Admin-only route. | **[Code]** `src/router.tsx` › `AdminOnly`; `src/pages/overview.tsx` |
| `/employees` | Employee directory | Admin-only route. | **[Code]** `src/router.tsx` › `AdminOnly`; `src/pages/employees.tsx` |
| `/payroll` | Payroll periods and dashboard | Admin-only route. | **[Code]** `src/router.tsx` › `AdminOnly`; `src/pages/payroll.tsx` |
| `/payroll/templates` | Payroll cutoff templates | Admin-only route. | **[Code]** `src/router.tsx` › `AdminOnly`; `src/pages/payroll-templates.tsx` |
| `/payroll/:periodId` | Payroll period detail and entries | Admin-only route. | **[Code]** `src/router.tsx` › `AdminOnly`; `src/pages/payroll-period.tsx` |
| `/my-payroll` | Current user’s payroll list | Any admitted app role; the query resolves the current user’s linked employee and own entries. | **[Code]** `src/router.tsx`; `src/features/payroll/services/my-payroll.ts` |
| `/my-payroll/:entryId` | Payslip detail | Any admitted app role; service access and Dataverse privileges determine which entry can be read. | **[Code]** `src/router.tsx`; `src/pages/payslip.tsx`; `src/features/payroll/services/my-payroll.ts` |

**[Code]** The navigation shows payroll administration pages to admins and
shows My Payroll when the access profile has a linked employee. An admin who
also has an employee record can see both sets of links
(`src/pages/_layout.tsx` › `useNav`).

**[Verify in environment]** The role memberships, app sharing, Dataverse
privileges, and whether each user has a linked Employee row cannot be confirmed
from the route table. Complete the checks in Part 4’s eventual verification
checklist.

## 4. UI, state, and data-fetching patterns

**[Code]** App-wide server state uses TanStack Query. `QueryProvider` sets
queries to no retry, no refetch on window focus, five-minute stale time, and
ten-minute garbage collection (`src/providers/query-provider.tsx` ›
`QueryProvider`). Payroll and employee hooks wrap the corresponding service
calls and invalidate query keys after mutations (`src/features/payroll/hooks/`,
`src/features/employees/use-employees.ts`).

**[Code]** `zustand` is listed in `package.json`, but no Zustand store or hook
usage was found under `src`. Current data hooks use TanStack Query.

**[Code]** The UI uses React, React Router, Tailwind CSS, locally provided
shadcn-style primitives built on Radix UI, Lucide icons, and Sonner toasts.
TanStack Table is used for employee and payroll tables. `date-fns` supports
date formatting. `pdfmake` builds downloadable payslip PDFs and is dynamically
imported in `src/features/payroll/payslip-document.ts` › `openPayslip`.
Recharts is a declared dependency and has a shared chart wrapper in
`src/components/ui/chart.tsx`; no business chart usage was found in the page
components inspected for this phase.

**[Code]** The root `README.md` is still the generic starter-template readme;
the application-specific orientation is in `docs/`. No app-specific setup
section was found in `README.md`.

**[Code]** Styling starts in `src/index.css` and is processed by the Tailwind
Vite plugin configured in `vite.config.ts`. The route shell and visual
navigation live in `src/pages/_layout.tsx`.

## 5. Tests and known documentation gaps

**[Code]** Vitest runs the test suite (`package.json` › `scripts.test`), with
JSDOM and `@testing-library/jest-dom` loaded from `vitest.setup.ts`. The source
contains 16 colocated test files: 14 under payroll, one under employees, and
one under shared UI. `package.json` has no Playwright script or browser
end-to-end test command.

**[Code]** Not found in code: a SharePoint data source or upload flow for
payslips. The payslip code creates a PDF in the client. Do not infer that the
PDF is saved to SharePoint (`.power/schemas/appschemas/dataSourcesInfo.ts`,
`src/features/payroll/payslip-document.ts`).

**[Verify in environment]** Not found in code: a confirmed current deployment
target, production URL, active connection owner, actual role configuration, or
published app release status. The repository contains a deployment runbook,
but its live-environment statements must be rechecked before use
(`docs/deployment.md`).

