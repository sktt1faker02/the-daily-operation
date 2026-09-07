# Phase 6 — Payroll Administration UI (Design)

**Project:** The Daily Operation · Automations 365
**Milestone:** 1 — Payroll
**Phase:** 6 — Payroll Administration UI
**Date:** 2026-09-07
**Status:** Approved design; implementation plan to follow (writing-plans).

---

## 1. Goal & scope

Let a Payroll Admin create a payroll cutoff, populate it with active
employees, enter variable payroll inputs, and calculate payroll — all
inside the app, on top of the Phase 4 data model and the Phase 5
calculation engine.

This phase also **applies the DESIGN.md design system** for the first
time (the app currently still ships the default neutral shadcn tokens)
and **converts the app shell to a light left sidebar**.

**In scope (Phase 6):**

- Apply the Automations 365 design system (tokens, Inter, sidebar shell).
- Payroll Dashboard (current + recent periods, totals, status).
- Create Payroll Period.
- Payroll Period detail: load active employees, per-employee entry
  editing, calculate / recalculate, summary totals.
- Search/filter employees within a period; validation; Loading / Success
  / Empty / Error states everywhere.

**Explicitly out of scope (owned by later phases):**

- Status **transitions** Mark Ready / Mark Paid / Lock and their
  centralized transition rules → **Phase 7**. Phase 6 creates periods as
  **Draft** and reads/displays status only.
- Employee self-service payslip portal → Phase 8.
- Copy Previous Cutoff → Phase 10.
- PDF payslips / SharePoint → Phase 11.

**Non-negotiables carried in:** Dataverse is the system of record;
business logic stays out of JSX; no invented payroll formulas or
statutory rates; security is enforced in Dataverse, the UI is a UX layer
only; prefer existing shadcn/starter components.

---

## 2. Confirmed decisions

These were confirmed with the product owner before design sign-off:

1. **Basic Pay default when loading employees:** per-cutoff
   `a365_basicpay = round2(monthlyBasicSalary / 2)` (semi-monthly),
   editable afterward. Consistent with the engine, which already halves
   statutory contributions and uses a `monthly / 22` daily rate.
2. **App shell:** convert from the top-nav header to the DESIGN.md light
   left sidebar application shell.
3. **Entry editor fields:** include **Other Earnings** and **Other
   Deductions** in addition to Basic Pay, Allowances, and Unpaid Leave
   days (all inputs the engine consumes).
4. **Theme:** DESIGN.md is light-only. Light becomes the definitive
   theme and the `ModeToggle` is removed from the shell. (Reversible if
   dark mode is later wanted with derived dark values.)
5. **Entry editing UX:** **row-level edit via a Dialog** (not an
   inline-editable grid), reusing the existing `employee-form-dialog`
   pattern for clean per-row validation and save-state.

---

## 3. Design system application

DESIGN.md is the source of truth. The app maps its palette onto the
existing shadcn semantic tokens so all shadcn/ui components inherit the
brand without per-component rewrites.

### 3.1 `src/index.css` token rewrite (light)

Replace the current `oklch` neutral tokens under `:root` and
`@theme inline` with DESIGN.md hex values:

| shadcn token | DESIGN.md value | Role |
|---|---|---|
| `--background` | `#f6f7f9` | Canvas |
| `--foreground` | `#172033` | Ink / text |
| `--card`, `--popover` | `#ffffff` | Paper |
| `--card-foreground`, `--popover-foreground` | `#172033` | |
| `--primary` | `#1850a0` | Automations Blue |
| `--primary-foreground` | `#ffffff` | |
| `--secondary` | `#f9fafb` | Subtle surface |
| `--secondary-foreground` | `#172033` | |
| `--muted` | `#f9fafb` | |
| `--muted-foreground` | `#667085` | Slate |
| `--accent` | `#e8f0fb` | Selected (blue soft) |
| `--accent-foreground` | `#1850a0` | |
| `--destructive` | `#c9362b` | Danger |
| `--border` | `#e2e6ec` | Hairline |
| `--input` | `#d0d5dd` | Input border |
| `--ring` | `#1850a0` | Focus |
| `--sidebar` | `#ffffff` | |
| `--sidebar-accent` | `#e8f0fb` | Active item bg |
| `--sidebar-accent-foreground` | `#1850a0` | Active item text |
| `--sidebar-border` | `#e2e6ec` | |

Radius: `--radius` set so controls ≈ 8px, cards ≈ 12px, dialogs ≈ 16px
(DESIGN "Border Radius").

**Additional semantic tokens** (not in the base shadcn set) exposed via
`@theme inline` for status/state use:

- `--color-success: #16845b`, `--color-success-soft: #eaf7f1`
- `--color-warning: #b7791f`, `--color-warning-soft: #fff7e6`
- `--color-danger-soft: #fdf0ef`
- `--color-locked: #475467`
- `--color-primary-soft: #e8f0fb`, `--color-primary-subtle: #f2f6fc`

**Theme:** keep a single light palette. Remove the `.dark` overrides
tied to the old neutral system (or leave them inert) and remove the
`ModeToggle` from the shell. `prefers-reduced-motion` respected;
transitions 150–250ms for color/background/border/opacity.

### 3.2 Typography

- Add Inter via a `<link>` to Google Fonts in `index.html` (no new npm
  dependency), with the DESIGN.md fallback stack:
  `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif`. Set as `--font-sans` / base `font-family`.
- Weights 400 / 500 / 600.
- A small utility (e.g. a `tabular-nums` class or `font-variant-numeric:
  tabular-nums`) applied to all money / numeric payroll columns.

### 3.3 Status badge component

`src/features/payroll/payroll-status-badge.tsx` — wraps shadcn `Badge`,
mapping `PayrollStatus` to pale-fill + dark-text treatments (DESIGN
"Status Mapping"), never color alone (icon or text label always
present):

| Status | Treatment |
|---|---|
| Draft | neutral gray |
| Processing | warning amber (`warning` / `warning-soft`) |
| Ready | Automations Blue (`primary` / `primary-soft`) |
| Paid | success green (`success` / `success-soft`) |
| Locked | slate (`locked`) |

---

## 4. App shell (sidebar)

Rework `src/pages/_layout.tsx`:

- Light left sidebar, ~248px, white with a hairline right border.
- Brand lockup at top (Wallet icon + "The Daily Operation").
- Nav items: **Home**, **Employees**, **Payroll** (Lucide icons:
  `LayoutDashboard`/`Home`, `Users`, `Wallet`). Active item →
  `--sidebar-accent` bg + `--sidebar-accent-foreground` text; inactive →
  slate.
- Content area: canvas `#f6f7f9` background, page-level padding 24–32px,
  content max-width where a constrained width helps (payroll tables may
  use full width).
- Existing Home and Employees pages reflow into the shell; changes are
  limited to their outer padding wrapper (they already render page
  headers + primary action in the upper-right).
- Sidebar collapses/stacks acceptably on small screens (responsive; no
  horizontal body scroll).

---

## 5. Data & service layer

All new code lives under `src/features/payroll/`, following the
employees feature's `Component → hook (TanStack Query) → service →
dataClient` layering. No Dataverse calls in components.

### 5.1 `types.ts` (payroll)

- `PAYROLL_PERIOD_TABLE = "a365_payrollperiods"`,
  `PAYROLL_ENTRY_TABLE = "a365_payrollentries"`.
- `PayrollStatus` const-object + union (Draft `749910000`, Processing
  `749910001`, Ready `749910002`, Paid `749910003`, Locked `749910004`)
  with `payrollStatusLabel()` and a status→badge-variant map. Verified
  against `A365_payrollperiodsModel.ts`.
- `PayrollPeriod` read model: `a365_payrollperiodid`, `a365_name`,
  `a365_periodstart`, `a365_periodend`, `a365_paydate`,
  `a365_payrollstatus`, audit/`createdon`.
- `PayrollEntry` read model: `a365_payrollentryid`, `a365_name`,
  `a365_isincluded`, inputs (`a365_basicpay`, `a365_allowances`,
  `a365_otherearnings`, `a365_otherdeductions`, `a365_unpaidleavedays`),
  calculated (`a365_grosspay`, `a365_sss`, `a365_philhealth`,
  `a365_hdmf`, `a365_unpaidleave`, `a365_withholdingtax`,
  `a365_totaldeductions`, `a365_netpay`), `a365_calculatedon`,
  `_a365_employee_value`, `a365_employeename`.
- `PayrollEntryInputValues` — controlled string form model for the 5
  editable inputs (mirrors the employees form-values pattern).

### 5.2 `services/payroll-period-service.ts`

Business operations (each throws a typed error on `!result.success`;
never silent):

- `listPeriods()` → periods ordered by `a365_periodstart desc`.
- `getPeriod(id)`.
- `createPeriod(input)` → sets `a365_payrollstatus = Draft`, computed
  `a365_name`, `a365_periodstart/end`, optional `a365_paydate`.
- `listEntries(periodId)` → entries for the period
  (`filter: _a365_payrollperiod_value eq {periodId}`), including
  `a365_employeename`, ordered by employee name.
- `loadActiveEmployees(periodId, periodEndDate)`:
  1. `employeeService.list({ filter: active })` (reuse existing filter).
  2. `listEntries(periodId)` to find employees already present.
  3. For each active employee **not** already present, create one entry:
     - `a365_Employee@odata.bind` → `/a365_employees({id})`
     - `a365_PayrollPeriod@odata.bind` → `/a365_payrollperiods({periodId})`
     - `a365_isincluded = true`
     - `a365_name = "{employeeName} — {periodName}"`
     - `a365_basicpay = round2((employee.a365_basicmonthlysalary ?? 0) / 2)`
     - `a365_allowances = 0`, `a365_otherearnings = 0`,
       `a365_otherdeductions = 0`, `a365_unpaidleavedays = 0`
  4. Return a summary `{ created, skipped }` for toast messaging.
  - Idempotent: re-running never duplicates entries; the UI confirms
    before re-load.

### 5.3 `services/payroll-service.ts` (extend)

- Add `updateEntryInputs(entryId, inputs)` — writes only the 5 editable
  input columns (parsed numbers; blank → `0`). Does **not** touch
  calculated columns.
- Reuse existing `calculateAndPersistEntry(entryId, periodEndDate,
  calculatedByUserId)` for calculation.
- Add `calculatePeriod(periodId, periodEndDate, calculatedByUserId)` —
  loads entries and calls `calculateAndPersistEntry` per included entry;
  aggregates failures and surfaces them (no silent partial success).

### 5.4 Hooks

- `hooks/use-payroll-periods.ts` — `usePayrollPeriods()`,
  `usePayrollPeriod(id)`, `useCreatePayrollPeriod()` (invalidate lists).
- `hooks/use-payroll-entries.ts` — `usePayrollEntries(periodId)`,
  `useLoadActiveEmployees()`, `useUpdateEntryInputs()`,
  `useCalculateEntry()`, `useCalculatePeriod()` — each invalidates the
  smallest relevant scope (period entries + period detail).
- `hooks/use-current-system-user.ts` — resolves the acting user's
  `systemuser` id for the `CalculatedBy` audit stamp: query
  `systemusers` filtered by `azureactivedirectoryobjectid eq
  {context.user.objectId}`, `select systemuserid`, cached for the
  session (context is stable). If it cannot be resolved, calculation
  surfaces a clear error rather than writing a bad/empty stamp.

Query keys namespaced under `["payroll", ...]` with `periods`,
`period(id)`, and `entries(periodId)` scopes.

---

## 6. Screens & routing

### 6.1 Routing (`src/router.tsx`)

Add children under the layout route:

- `{ path: "payroll", element: <PayrollDashboardPage /> }`
- `{ path: "payroll/:periodId", element: <PayrollPeriodPage /> }`

### 6.2 Payroll Dashboard (`src/pages/payroll.tsx`, `/payroll`)

- Page header: title "Payroll", subtitle, **New payroll period** primary
  action upper-right (opens the create dialog).
- Metric cards (DESIGN "Metric Card": white, 1px border, 12px radius,
  tabular numerals): current/most-recent period **Net total**,
  **Employee count**, **Status** (badge).
- Recent-periods **TanStack Table**: Period name, dates, pay date,
  status badge, gross / deductions / net totals (right-aligned, tabular).
  Rows link to the period detail.
- States: Loading (skeletons), Empty ("Create your first payroll
  period"), Error (retry), Success.

### 6.3 Create Payroll Period (`create-period-dialog.tsx`)

- shadcn `Dialog`, mirroring `employee-form-dialog`.
- Semi-monthly default helper: on open, auto-suggest the current cutoff's
  `periodstart` / `periodend` (1–15 or 16–end-of-month) and a `paydate`,
  **all editable**. Derived during render (no `useEffect` for derivable
  state).
- Validation: start ≤ end; required dates; friendly messages. Submit
  disabled while saving; form not cleared until the mutation succeeds;
  success toast ("Payroll period created."); navigate to the new period
  detail on success.

### 6.4 Payroll Period detail (`src/pages/payroll-period.tsx`, `/payroll/:periodId`)

- Header: period name, dates, pay date, **status badge**; back to
  dashboard.
- **Summary totals** card row: Gross Pay, Total Deductions, **Net Pay**
  (Net given stronger typographic emphasis; tabular numerals). Derived
  from the entries query.
- **Actions:**
  - When no entries: primary **Load active employees** (with a short
    explanation). Confirm dialog before loading; toast summary
    (`{created} added, {skipped} already present`).
  - When entries exist: **Calculate all** action; **Load active
    employees** available secondarily (confirm; only adds missing
    employees).
- **Entry table** (`payroll-entry-table.tsx`, TanStack Table): one row
  per entry — employee, inputs (Basic Pay, Allowances, Unpaid Leave
  days, Other Earnings, Other Deductions) and calculated columns (SSS,
  PhilHealth, HDMF, Unpaid Leave ₱, WHT, Gross, Total Deductions, Net).
  Calculated columns rendered on the subtle `Auto` surface
  (`--color-surface-subtle` / `primary-subtle`) with an `Auto` marker,
  visually distinct from editable values (DESIGN "Editable vs
  Automatic"). Right-aligned currency, tabular numerals, subtle row
  hover. Row action: **Edit** and **Recalculate**.
- **Employee search/filter** within the period (client-side over the
  loaded entries — by employee name).
- States: Loading / Empty / Error / Success all handled; the engine's
  provisional-WHT warning surfaced once, non-intrusively (an inline note
  on the period, not a per-row toast storm).

### 6.5 Entry editor (`payroll-entry-dialog.tsx`)

- shadcn `Dialog` with the 5 editable inputs as controlled string
  fields; numeric validation (non-negative; unpaid-leave days a
  sensible bound); read-only display of the employee and current
  calculated values for context.
- Save via `useUpdateEntryInputs` (disabled while saving; toast on
  success/failure). Optional **Save & calculate** that chains the
  calculate mutation.

---

## 7. Calculation flow & status

- Editing inputs and calculating are allowed while the period is
  **Draft** (and **Processing** if a Phase 7 transition later sets it).
  Phase 6 itself does not change status beyond creating as Draft.
- `Calculate` / `Calculate all` call the Phase 5 service, which persists
  gross, statutory deductions, WHT, totals, net, `a365_calculatedon`,
  and the `CalculatedBy` stamp. Statutory rules are resolved as of
  `a365_periodend` (historical correctness).
- Money uses `round2` in the engine and `formatCurrency` for display;
  the two stay separate (CLAUDE.md "Money").
- Locked/finalized handling (read-only enforcement) is Phase 7; this
  phase should not present edit/calculate affordances for a `Locked`
  period (UX guard only — the real control is Phase 7 / Dataverse).

---

## 8. Error, loading, empty, accessibility

- Every data-dependent view renders Loading (skeleton) / Success / Empty
  (with a next-step) / Error (with retry). No blank screens.
- Errors surfaced via Sonner and inline; never swallowed; raw backend
  detail not exposed to ordinary users.
- Semantic HTML, labelled fields, keyboard-accessible controls via
  Radix/shadcn primitives; status never communicated by color alone.

---

## 9. Testing

- **Unit (Vitest):**
  - `loadActiveEmployees`: Basic Pay = `round2(monthly/2)` default;
    active-only; skips employees already in the period; `created/skipped`
    summary.
  - `PayrollStatus` label/badge-variant helpers.
  - Semi-monthly date-suggestion helper for the create dialog.
  - `updateEntryInputs` payload mapping (blank → 0; never writes
    calculated columns).
- **Existing** Phase 5 calculation tests remain green.
- `npm run lint` and `npm run build` must pass before completion.

---

## 10. File plan (new / changed)

**Design system / shell**
- `index.html` — Inter `<link>`. *(changed)*
- `src/index.css` — DESIGN.md tokens, light-only. *(changed)*
- `src/pages/_layout.tsx` — sidebar shell, ModeToggle removed. *(changed)*
- `src/components/mode-toggle.tsx` — removed from shell (file may remain
  unused or be deleted). *(changed)*
- `src/pages/employees.tsx`, `src/pages/home.tsx` — reflow into shell.
  *(minor changed)*

**Payroll feature**
- `src/features/payroll/types.ts` *(new)*
- `src/features/payroll/payroll-status-badge.tsx` *(new)*
- `src/features/payroll/services/payroll-period-service.ts` *(new)*
- `src/features/payroll/services/payroll-service.ts` — extend. *(changed)*
- `src/features/payroll/hooks/use-payroll-periods.ts` *(new)*
- `src/features/payroll/hooks/use-payroll-entries.ts` *(new)*
- `src/features/payroll/hooks/use-current-system-user.ts` *(new)*
- `src/features/payroll/create-period-dialog.tsx` *(new)*
- `src/features/payroll/payroll-entry-table.tsx` *(new)*
- `src/features/payroll/payroll-entry-dialog.tsx` *(new)*
- `src/features/payroll/payroll-summary-cards.tsx` *(new)*
- `src/pages/payroll.tsx` *(new)*
- `src/pages/payroll-period.tsx` *(new)*
- `src/router.tsx` — payroll routes. *(changed)*
- Tests alongside services. *(new)*

---

## 11. Open items / assumptions

- **Withholding tax** remains provisional (Phase 5 §7, accountant TBD);
  the UI surfaces the engine warning but treats WHT output as
  non-final. No change to the taxable-base rule in this phase.
- **Recurring allowances** are not stored on the employee record, so
  loaded entries default Allowances to 0 (admin enters per cutoff).
  Copying recurring values is Phase 10.
- `systemuser` resolution assumes each acting Payroll Admin has a
  Dataverse `systemuser` with a matching `azureactivedirectoryobjectid`
  (true for signed-in Power Platform users).
