# The Daily Operation — Application Architecture

**Company:** Automations 365
**Milestone 1:** Payroll (Leave Management and Accounting follow)
**Status:** Phase 1 — Foundation

This document describes the initial architecture established in Phase 1. It is
the reference for how the application is layered, how it integrates with the
Microsoft Power Platform, and where each kind of logic belongs. It will grow as
later phases add the payroll domain.

---

## 1. What this application is

The Daily Operation is a **Microsoft Power Platform Code App** — a single-page
React application that runs *inside* the Power Apps host rather than as a
standalone web app. At runtime three logical layers cooperate:

1. **Your code** — this React/TypeScript/Vite application.
2. **The Power Apps client library** (`@microsoft/power-apps`, the "SDK") —
   exposes app/user context and, once connectors are added, generated data
   services for Dataverse and other connectors.
3. **The Power Apps host** — handles Microsoft Entra authentication, app
   loading, and connection brokering.

Because the host owns authentication and connection brokering, **the app never
holds credentials and never talks to Dataverse over a hand-rolled HTTP client.**
Data access goes through the SDK's generated services.

### System of record

- **Dataverse** is authoritative for all business data (employees, payroll
  periods, entries, statutory configuration, audit records).
- **SharePoint** is the document repository (generated payslips, exports).
- **Power Automate** handles server-side/background workflow (document
  generation, notifications, finalization automation).

No other application database is introduced.

---

## 2. Repository structure

```
the-daily-operation/
├── src/                         # The React code app
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (vendored)
│   │   └── mode-toggle.tsx
│   ├── hooks/                   # Reusable React hooks (use-*)
│   ├── lib/
│   │   ├── power/               # Power Platform integration layer
│   │   └── utils.ts
│   ├── pages/                   # Routed pages + _layout
│   ├── providers/              # App-wide context providers
│   ├── router.tsx              # React Router configuration
│   └── main.tsx / App.tsx      # Entry point + provider composition
├── solution/
│   └── A365_DailyOperations/    # Source-controlled Dataverse solution project (ALM)
├── docs/                        # Architecture, conventions, task phases
├── power.config.json            # Power Apps code-app configuration
└── (vite / ts / eslint config)
```

Feature domains are added under `src/features/<domain>/` as they are built (see
§4). Payroll is the first.

---

## 3. Layering — where logic belongs

Business logic is kept out of presentation components. The dependency direction
is one-way:

```
Component  →  Hook  →  Service  →  Dataverse (via the SDK)
```

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Component** (`pages/`, `features/*/components/`) | Rendering, layout, local interaction. No Dataverse calls, no calculation formulas. | A payroll table, a form |
| **Hook** (`hooks/`, `features/*/hooks/`) | Adapts services to React using TanStack Query; owns loading/error/cache state. | `usePowerContext`, later `usePayrollPeriods` |
| **Service** (`features/*/services/`, `lib/power/`) | Business-oriented operations and the actual data calls. Names describe business intent, not UI. | `getPayrollPeriods()`, `getPowerContext()` |
| **Data source** | Dataverse (via SDK-generated services), SharePoint, Power Automate. | Generated `*Service.ts` |

Calculations (gross pay, statutory deductions, tax, net pay) live in a dedicated
**payroll calculation service**, never inside JSX.

---

## 4. Planned domain modules

Each milestone is a self-contained module under `src/features/`, kept
loosely coupled so future milestones integrate cleanly:

```
features/
├── payroll/        # Milestone 1
│   ├── components/
│   ├── hooks/
│   ├── services/   # payroll-service.ts, payroll-calculation.ts
│   └── types/
├── leave/          # Milestone 2 (future)
└── accounting/     # Milestone 3 (future)
```

Payroll must expose clean finalized financial data that Accounting can consume
later, and must accept unpaid-leave input that Leave Management can eventually
feed automatically. Module boundaries are not crossed by reaching into another
module's internals — only through its service interface.

---

## 5. Providers and composition

`App.tsx` composes app-wide providers in this order:

```
ThemeProvider → SonnerProvider → QueryProvider → RouterProvider
```

- **ThemeProvider** — light/dark theme (context lives with the provider;
  `useTheme` reads it).
- **SonnerProvider** — toast notifications for transient feedback.
- **QueryProvider** — the single TanStack Query client (retry off,
  `staleTime` 5 min). Server state lives here.
- **RouterProvider** — React Router; `router.tsx` normalizes the basename so
  routing works when hosted under the Power Apps path.

> **Note on the Power SDK:** client library v1.0+ **removed** the `initialize()`
> step. There is no blocking `PowerProvider`; the app renders immediately and
> reads host context on demand via `getContext()`. Do not reintroduce an
> initialization gate.

---

## 6. Power Platform integration layer (`src/lib/power/`)

- **`power-context.ts`** — `getPowerContext()` wraps the SDK `getContext()`
  handshake and returns app, host, and signed-in-user metadata.
- **`use-power-context.ts`** (hook) — loads that context once per session with
  TanStack Query and exposes standard loading/error/data states.

This is the seam the app uses to know *who the current user is*: for audit
attribution and for the client-side "show my own payroll" convenience check. It
is **never** the security boundary (see §8).

**Telemetry hook (future):** the SDK's `setConfig({ logger })` is the single
place to wire Azure Application Insights when Production monitoring is set up.
It is intentionally not configured yet (Dev-only, no App Insights resource).

---

## 7. State management

- **Server state → TanStack Query.** All Dataverse-backed data is fetched,
  cached, and invalidated through TanStack Query. After a mutation, invalidate
  the smallest relevant query scope. Dataverse collections are **not** copied
  into Zustand.
- **Client/UI state → Zustand.** Reserved for genuine global UI state
  (navigation, multi-step workflow state, UI preferences). Not a data cache.
- **Derived state** is computed during render, not stored via `useEffect`.

---

## 8. Security and authentication model

Authentication is handled by the Power Apps host via **Microsoft Entra** — the
signed-in Entra user flows through automatically; the app registers no separate
auth.

**Authorization is enforced at the data layer, not the UI.** The primary
boundary is:

- Microsoft Entra authentication (identity)
- Dataverse security roles and privileges (table + record access)
- Record ownership / access teams (an employee sees only their own payroll)
- SharePoint permissions (payslip documents)

Application-side checks (hiding a button, filtering a list to the current user)
are a **UX layer only**. They never protect a record — an employee must not be
able to reach another employee's payroll by changing an id or issuing a direct
request, and that guarantee comes from Dataverse. The Dataverse security roles
themselves are configured in **Phase 2**.

Application roles the design targets: **Payroll Employee**, **Payroll Admin**,
**System Administrator**. There is no separate Payroll Approver role in V1.

---

## 9. Environments and ALM

- **Development** — `The Daily Operation - Dev` (Dataverse sandbox). The active
  and only environment for now.
- **Production** — not yet provisioned; deferred until Phase 13.

The **`A365-DailyOperations`** solution (publisher **Automations 365**, prefix
**`a365`**) is the ALM container for all Dataverse components. A
source-controlled solution project is kept under `solution/` so schema changes
are versioned alongside the app. Cross-environment promotion (managed solution
export/import, environment variables, connection references) is designed in
Phase 13; per-environment settings are intentionally deferred until a
Production environment exists.

---

## 10. Configuration files

| File | Purpose |
|------|---------|
| `power.config.json` | Code-app metadata: environment binding, build path, entry point. `appId` is populated on the first `pac code push`. App logic never reads this file. |
| `solution/A365_DailyOperations/` | Dataverse solution project (publisher, solution manifest) for ALM. |
| `vite.config.ts` | Vite + React + Tailwind + `powerApps()` plugin. |
| `eslint.config.js` | Lint rules; fast-refresh rule relaxed for vendored `ui/` primitives and providers. |

---

## 11. Cross-cutting conventions (summary)

- Strict TypeScript; avoid `any` except at genuinely unrepresentable API edges.
- Functional components only; reusable behavior lives in hooks/services.
- Prefer existing shadcn/ui components; Lucide for icons; **no emoji as UI icons**.
- Every data-dependent view handles **Loading / Success / Empty / Error**.
- Money is formatted centrally (PHP, `en-PH`); calculation values are kept
  separate from display formatting; finalized payroll is immutable.

See **`docs/naming-conventions.md`** for table, column, flow, and code naming.
See **`docs/payroll-task-phases.md`** for the phase-by-phase plan.
