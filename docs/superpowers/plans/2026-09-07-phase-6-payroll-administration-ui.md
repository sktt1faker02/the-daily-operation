# Phase 6 — Payroll Administration UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Payroll Admin apply the Automations 365 design system, then create a payroll cutoff, load active employees, edit variable inputs, and calculate payroll — built on the Phase 4 data model and Phase 5 calculation engine.

**Architecture:** Extend `src/features/payroll/` following the employees feature's `Component → hook (TanStack Query) → service → dataClient` layering. Pure, testable helpers (period suggestion, basic-pay default, load-employees planning, input-payload mapping) sit beside thin Dataverse-bound services. Presentation is shadcn/ui + TanStack Table, styled by DESIGN.md tokens mapped onto the existing shadcn semantic CSS variables so components inherit the brand without rewrites.

**Tech Stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`), Vite, React Router, Tailwind v4, shadcn/ui + Radix, Lucide, TanStack Query, TanStack Table, Sonner, date-fns, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-6-payroll-administration-ui-design.md`

## Global Constraints

- **Dataverse is the system of record.** All Dataverse access stays behind a service; components use hooks only. Never call `dataClient` from a component or page.
- **No invented payroll formulas or statutory rates.** Confirmed default: per-cutoff Basic Pay = `round2(monthlyBasicSalary / 2)`. Statutory rules come from the Phase 5 engine/config only.
- **Do not guess Dataverse schema names.** Use exactly: table `a365_payrollperiods`, `a365_payrollentries`; entry input columns `a365_basicpay`, `a365_allowances`, `a365_otherearnings`, `a365_otherdeductions`, `a365_unpaidleavedays`; status choice values Draft `749910000`, Processing `749910001`, Ready `749910002`, Paid `749910003`, Locked `749910004`.
- **Security is enforced in Dataverse, not the UI.** No `if (!isAdmin) return null` as a security boundary.
- **TypeScript strict; no `any`.** Const-object + union type instead of `enum` (project uses `erasableSyntaxOnly`).
- **Money:** compute with `round2` (from `payroll-calculation.ts`), display with `formatCurrency` (from `@/lib/format`); keep the two separate. Right-align currency, `tabular-nums`.
- **Status transitions (Mark Ready/Paid/Lock) are OUT of scope** — Phase 7. This phase creates periods as Draft and reads/displays status only.
- **Every data view handles Loading / Success / Empty / Error.** Errors surface via Sonner + inline; never swallowed; no raw backend detail to ordinary users.
- **Design system is light-only**; `ModeToggle` is removed from the shell.
- Verification gate before "done": `npm run test`, `npm run lint`, `npm run build` all pass.

---

## File Structure

**Design system / shell**
- `index.html` *(modify)* — add Inter `<link>`.
- `src/index.css` *(modify)* — DESIGN.md tokens (light), Inter, extra semantic tokens.
- `src/pages/_layout.tsx` *(modify)* — light sidebar shell; remove `ModeToggle`.
- `src/pages/home.tsx`, `src/pages/employees.tsx` *(modify)* — reflow into the shell (padding wrapper only).

**Payroll feature (`src/features/payroll/`)**
- `types.ts` *(create)* — `PayrollStatus`, labels/variants, `PayrollPeriod`, `PayrollEntry`, `PayrollEntryInputValues`, table constants.
- `period-utils.ts` *(create)* — `suggestSemiMonthlyPeriod`, `basicPayForCutoff`, `planLoadEntries`, `toEntryInputPayload`, `sumEntryTotals`.
- `period-utils.test.ts` *(create)* — unit tests for the above.
- `payroll-status-badge.tsx` *(create)* — status → pale badge.
- `services/payroll-period-service.ts` *(create)* — period + entry list/create + load employees.
- `services/payroll-service.ts` *(modify)* — add `updateEntryInputs`, `calculatePeriod`.
- `hooks/use-current-system-user.ts` *(create)* — resolve acting user's `systemuser` id.
- `hooks/use-payroll-periods.ts` *(create)* — periods queries/mutations.
- `hooks/use-payroll-entries.ts` *(create)* — entries queries/mutations.
- `payroll-summary-cards.tsx` *(create)* — gross/deductions/net metric cards.
- `create-period-dialog.tsx` *(create)* — create period form.
- `payroll-entry-dialog.tsx` *(create)* — per-entry input editor.
- `payroll-entry-table.tsx` *(create)* — entry grid.

**Pages / routing**
- `src/pages/payroll.tsx` *(create)* — dashboard.
- `src/pages/payroll-period.tsx` *(create)* — period detail.
- `src/router.tsx` *(modify)* — add `payroll` and `payroll/:periodId` routes.

---

## Task 1: Apply the design system tokens & Inter typography

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: DESIGN.md CSS custom properties on `:root` (light), extra semantic tokens `--color-success`, `--color-success-soft`, `--color-warning`, `--color-warning-soft`, `--color-danger-soft`, `--color-locked`, `--color-primary-soft`, `--color-primary-subtle` exposed via `@theme inline` for use as Tailwind color utilities (`bg-success-soft`, `text-success`, etc.).

- [ ] **Step 1: Add Inter to `index.html`**

In `<head>` (before the existing `<title>` or module script), add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Rewrite the light token block in `src/index.css`**

Replace the `:root { ... }` block's color/radius variables (keep the font-smoothing lines) with DESIGN.md values, and set the base font to Inter. Replace the existing `:root` body (lines ~6-47) so it reads:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
  font-weight: 400;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  --radius: 0.5rem; /* controls 8px; cards/panels scale up via radius-* below */

  --background: #f6f7f9;
  --foreground: #172033;
  --card: #ffffff;
  --card-foreground: #172033;
  --popover: #ffffff;
  --popover-foreground: #172033;
  --primary: #1850a0;
  --primary-foreground: #ffffff;
  --secondary: #f9fafb;
  --secondary-foreground: #172033;
  --muted: #f9fafb;
  --muted-foreground: #667085;
  --accent: #e8f0fb;
  --accent-foreground: #1850a0;
  --destructive: #c9362b;
  --border: #e2e6ec;
  --input: #d0d5dd;
  --ring: #1850a0;

  --chart-1: #1850a0;
  --chart-2: #16845b;
  --chart-3: #b7791f;
  --chart-4: #475467;
  --chart-5: #98a2b3;

  --sidebar: #ffffff;
  --sidebar-foreground: #172033;
  --sidebar-primary: #1850a0;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e8f0fb;
  --sidebar-accent-foreground: #1850a0;
  --sidebar-border: #e2e6ec;
  --sidebar-ring: #1850a0;

  /* Extra semantic tokens (payroll status + editable/auto surfaces) */
  --success: #16845b;
  --success-soft: #eaf7f1;
  --warning: #b7791f;
  --warning-soft: #fff7e6;
  --danger: #c9362b;
  --danger-soft: #fdf0ef;
  --locked: #475467;
  --primary-soft: #e8f0fb;
  --primary-subtle: #f2f6fc;
  --surface-subtle: #f9fafb;
}
```

- [ ] **Step 3: Expose the extra semantic tokens as Tailwind colors**

In the `@theme inline { ... }` block in `src/index.css`, add these lines alongside the existing `--color-*` mappings:

```css
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-locked: var(--locked);
  --color-primary-soft: var(--primary-soft);
  --color-primary-subtle: var(--primary-subtle);
  --color-surface-subtle: var(--surface-subtle);
  --radius-card: 0.75rem;
  --radius-panel: 1rem;
```

- [ ] **Step 4: Neutralize dark mode (light-only)**

The design system is light-only. Leave the `.dark { ... }` block in place but it is no longer targeted (the `ModeToggle` is removed in Task 2 and the app never adds the `dark` class). No change required to the `.dark` block itself; do NOT wire any toggle to it.

- [ ] **Step 5: Verify the build compiles the CSS**

Run: `npm run build`
Expected: PASS (TypeScript + Vite build succeeds; no CSS/token errors).

- [ ] **Step 6: Commit**

```bash
git add index.html src/index.css
git commit -m "feat(ui): apply Automations 365 design system tokens and Inter"
```

---

## Task 2: Convert the app shell to a light sidebar

**Files:**
- Modify: `src/pages/_layout.tsx`
- Modify: `src/pages/home.tsx`
- Modify: `src/pages/employees.tsx`

**Interfaces:**
- Consumes: the design tokens from Task 1.
- Produces: `Layout` renders a persistent left sidebar with nav items Home (`/`), Employees (`/employees`), Payroll (`/payroll`) and an `<Outlet />` content region on the `--background` canvas. No `ModeToggle`.

- [ ] **Step 1: Replace `src/pages/_layout.tsx` with the sidebar shell**

```tsx
import { Outlet, NavLink } from "react-router-dom"
import { Wallet, Home, Users } from "lucide-react"

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/employees", label: "Employees", icon: Users, end: false },
  { to: "/payroll", label: "Payroll", icon: Wallet, end: false },
]

const itemClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  ].join(" ")

export default function Layout() {
  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2 px-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Wallet className="size-4" aria-hidden />
          </span>
          The Daily Operation
        </NavLink>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={itemClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with the same nav (sidebar hidden < md) */}
        <header className="flex items-center gap-4 border-b border-border px-4 py-3 md:hidden">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Wallet className="size-4" aria-hidden />
            </span>
            The Daily Operation
          </NavLink>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reflow `src/pages/home.tsx` into the shell**

The home page currently centers within a `max-w-7xl`. Keep its content; just ensure its root wrapper does not assume the old header. Change its outer wrapper (line ~13) from `className="h-full grid place-items-center p-6"` to `className="grid min-h-[calc(100dvh-0px)] place-items-center p-6"` — content stays centered inside the new content region. (No other change; remove nothing.)

- [ ] **Step 3: Confirm `src/pages/employees.tsx` still fits**

It already wraps content in `mx-auto w-full max-w-7xl space-y-6 p-6` (line ~53). No change needed — verify it renders under the sidebar with no leftover header reference. Leave as-is.

- [ ] **Step 4: Verify build + no dangling `ModeToggle` import**

Run: `npm run build`
Expected: PASS. `_layout.tsx` no longer imports `ModeToggle`. The `src/components/mode-toggle.tsx` file may remain in the repo unused (its removal is not required; do not delete `theme-provider`/`use-theme` — they may be referenced by providers). If the build reports `mode-toggle` as an unused-but-valid module, that is fine; if `npm run lint` later flags an unused import, ensure none remains in `_layout.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/_layout.tsx src/pages/home.tsx
git commit -m "feat(ui): light sidebar application shell"
```

---

## Task 3: Payroll types & status helpers

**Files:**
- Create: `src/features/payroll/types.ts`
- Create: `src/features/payroll/period-utils.test.ts` (status-helper tests here; utils added in Task 4)

**Interfaces:**
- Produces:
  - `PAYROLL_PERIOD_TABLE = "a365_payrollperiods"`, `PAYROLL_ENTRY_TABLE = "a365_payrollentries"`.
  - `PayrollStatus` const-object + type: `Draft`, `Processing`, `Ready`, `Paid`, `Locked`.
  - `payrollStatusLabel(value: PayrollStatus | null | undefined): string`.
  - `payrollStatusBadgeTone(value): "draft" | "processing" | "ready" | "paid" | "locked" | "unknown"`.
  - `PayrollPeriod`, `PayrollEntry`, `PayrollEntryInputValues` interfaces.
  - `toEntryInputValues(entry: PayrollEntry): PayrollEntryInputValues`, `emptyEntryInputValues`.

- [ ] **Step 1: Write the failing test** (`src/features/payroll/period-utils.test.ts`)

```ts
import { describe, it, expect } from "vitest"
import { PayrollStatus, payrollStatusLabel, payrollStatusBadgeTone } from "./types"

describe("payrollStatusLabel", () => {
  it("maps each status value to its label", () => {
    expect(payrollStatusLabel(PayrollStatus.Draft)).toBe("Draft")
    expect(payrollStatusLabel(PayrollStatus.Processing)).toBe("Processing")
    expect(payrollStatusLabel(PayrollStatus.Ready)).toBe("Ready")
    expect(payrollStatusLabel(PayrollStatus.Paid)).toBe("Paid")
    expect(payrollStatusLabel(PayrollStatus.Locked)).toBe("Locked")
  })
  it("returns an em dash for null/undefined", () => {
    expect(payrollStatusLabel(null)).toBe("—")
    expect(payrollStatusLabel(undefined)).toBe("—")
  })
})

describe("payrollStatusBadgeTone", () => {
  it("maps status to a semantic tone", () => {
    expect(payrollStatusBadgeTone(PayrollStatus.Draft)).toBe("draft")
    expect(payrollStatusBadgeTone(PayrollStatus.Processing)).toBe("processing")
    expect(payrollStatusBadgeTone(PayrollStatus.Ready)).toBe("ready")
    expect(payrollStatusBadgeTone(PayrollStatus.Paid)).toBe("paid")
    expect(payrollStatusBadgeTone(PayrollStatus.Locked)).toBe("locked")
    expect(payrollStatusBadgeTone(null)).toBe("unknown")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: FAIL — cannot import from `./types` (module/exports do not exist yet).

- [ ] **Step 3: Create `src/features/payroll/types.ts`**

```ts
/**
 * Payroll period & entry domain models. Logical names and choice values are
 * verified against Dataverse (`The Daily Operation - Dev`) and the generated
 * models (A365_payrollperiodsModel.ts, A365_payrollentriesModel.ts). Do not
 * guess Dataverse schema names (CLAUDE.md #5).
 */

/** Entity set names registered as data sources under `.power/schemas`. */
export const PAYROLL_PERIOD_TABLE = "a365_payrollperiods"
export const PAYROLL_ENTRY_TABLE = "a365_payrollentries"

/** `a365_payrollstatus` global choice (see A365_payrollperiodsModel.ts). */
export const PayrollStatus = {
  Draft: 749910000,
  Processing: 749910001,
  Ready: 749910002,
  Paid: 749910003,
  Locked: 749910004,
} as const
export type PayrollStatus = (typeof PayrollStatus)[keyof typeof PayrollStatus]

const STATUS_LABELS: Record<PayrollStatus, string> = {
  [PayrollStatus.Draft]: "Draft",
  [PayrollStatus.Processing]: "Processing",
  [PayrollStatus.Ready]: "Ready",
  [PayrollStatus.Paid]: "Paid",
  [PayrollStatus.Locked]: "Locked",
}

export function payrollStatusLabel(value: PayrollStatus | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return STATUS_LABELS[value] ?? "—"
}

export type PayrollStatusTone =
  | "draft"
  | "processing"
  | "ready"
  | "paid"
  | "locked"
  | "unknown"

export function payrollStatusBadgeTone(
  value: PayrollStatus | null | undefined,
): PayrollStatusTone {
  switch (value) {
    case PayrollStatus.Draft:
      return "draft"
    case PayrollStatus.Processing:
      return "processing"
    case PayrollStatus.Ready:
      return "ready"
    case PayrollStatus.Paid:
      return "paid"
    case PayrollStatus.Locked:
      return "locked"
    default:
      return "unknown"
  }
}

/** A period is editable in Phase 6 while Draft or Processing. */
export function isPeriodEditable(value: PayrollStatus | null | undefined): boolean {
  return value === PayrollStatus.Draft || value === PayrollStatus.Processing
}

// --- Read models (shape returned by the Dataverse Web API) -------------------

export interface PayrollPeriod {
  a365_payrollperiodid: string
  a365_name: string
  a365_periodstart: string
  a365_periodend: string
  a365_paydate: string | null
  a365_payrollstatus: PayrollStatus
  createdon?: string
}

export interface PayrollEntry {
  a365_payrollentryid: string
  a365_name: string
  a365_isincluded: boolean
  // Inputs (editable)
  a365_basicpay: number | null
  a365_allowances: number | null
  a365_otherearnings: number | null
  a365_otherdeductions: number | null
  a365_unpaidleavedays: number | null
  // Calculated (read-only in the UI)
  a365_grosspay: number | null
  a365_sss: number | null
  a365_philhealth: number | null
  a365_hdmf: number | null
  a365_unpaidleave: number | null
  a365_withholdingtax: number | null
  a365_totaldeductions: number | null
  a365_netpay: number | null
  a365_calculatedon: string | null
  /** Lookup → a365_employee (read as `_value`). */
  _a365_employee_value: string | null
  /** Formatted lookup name of the linked employee. */
  a365_employeename?: string
}

// --- Entry input form model (controlled string state) ------------------------

export interface PayrollEntryInputValues {
  a365_basicpay: string
  a365_allowances: string
  a365_otherearnings: string
  a365_otherdeductions: string
  a365_unpaidleavedays: string
}

export const emptyEntryInputValues: PayrollEntryInputValues = {
  a365_basicpay: "",
  a365_allowances: "",
  a365_otherearnings: "",
  a365_otherdeductions: "",
  a365_unpaidleavedays: "",
}

function numToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value)
}

export function toEntryInputValues(entry: PayrollEntry): PayrollEntryInputValues {
  return {
    a365_basicpay: numToInput(entry.a365_basicpay),
    a365_allowances: numToInput(entry.a365_allowances),
    a365_otherearnings: numToInput(entry.a365_otherearnings),
    a365_otherdeductions: numToInput(entry.a365_otherdeductions),
    a365_unpaidleavedays: numToInput(entry.a365_unpaidleavedays),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/types.ts src/features/payroll/period-utils.test.ts
git commit -m "feat(payroll): payroll period/entry types and status helpers"
```

---

## Task 4: Pure payroll utilities (period suggestion, basic-pay default, load planning, totals)

**Files:**
- Create: `src/features/payroll/period-utils.ts`
- Modify: `src/features/payroll/period-utils.test.ts` (append cases)

**Interfaces:**
- Consumes: `round2` from `@/features/payroll/services/payroll-calculation`; `Employee`, `EmploymentStatus` from `@/features/employees/types`; `PayrollEntry` from `./types`.
- Produces:
  - `basicPayForCutoff(monthlySalary: number | null | undefined): number` → `round2(monthly / 2)`, `0` for null/≤0.
  - `suggestSemiMonthlyPeriod(refISO: string): { start: string; end: string; payDate: string; name: string }` — first half (day ≤ 15) → 1–15; else 16–end-of-month.
  - `formatPeriodName(startISO: string, endISO: string): string` → e.g. `"Sep 1–15, 2026"`.
  - `planLoadEntries(activeEmployees, existingEmployeeIds, period): NewEntryPlan[]` and `NewEntryPlan` (shape a service maps to a create payload).
  - `sumEntryTotals(entries: PayrollEntry[]): { gross: number; deductions: number; net: number }`.

- [ ] **Step 1: Append failing tests to `src/features/payroll/period-utils.test.ts`**

```ts
import {
  basicPayForCutoff,
  suggestSemiMonthlyPeriod,
  formatPeriodName,
  planLoadEntries,
  sumEntryTotals,
} from "./period-utils"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import type { PayrollEntry } from "./types"

function emp(id: string, salary: number | null, status = EmploymentStatus.Active): Employee {
  return {
    a365_employeeid: id,
    a365_employeenumber: null,
    a365_name: `Emp ${id}`,
    a365_firstname: null, a365_lastname: null, a365_middlename: null,
    a365_workemail: null,
    _a365_department_value: null, _a365_position_value: null,
    a365_employmentstatus: status,
    a365_employmenttype: null,
    a365_datehired: null, a365_enddate: null,
    a365_basicmonthlysalary: salary,
    a365_payrollfrequency: null,
    a365_sssnumber: null, a365_philhealthnumber: null, a365_hdmfnumber: null,
    a365_tin: null, a365_paymentmethod: null, a365_bankname: null,
    a365_bankaccountnumber: null, _a365_systemuser_value: null,
  }
}

describe("basicPayForCutoff", () => {
  it("halves the monthly salary, rounded to 2dp", () => {
    expect(basicPayForCutoff(25000)).toBe(12500)
    expect(basicPayForCutoff(25001)).toBe(12500.5)
  })
  it("returns 0 for null, undefined, or non-positive", () => {
    expect(basicPayForCutoff(null)).toBe(0)
    expect(basicPayForCutoff(undefined)).toBe(0)
    expect(basicPayForCutoff(0)).toBe(0)
    expect(basicPayForCutoff(-100)).toBe(0)
  })
})

describe("suggestSemiMonthlyPeriod", () => {
  it("suggests the 1–15 cutoff for an early-month date", () => {
    const s = suggestSemiMonthlyPeriod("2026-09-07")
    expect(s.start).toBe("2026-09-01")
    expect(s.end).toBe("2026-09-15")
  })
  it("suggests the 16–end cutoff for a late-month date", () => {
    const s = suggestSemiMonthlyPeriod("2026-09-20")
    expect(s.start).toBe("2026-09-16")
    expect(s.end).toBe("2026-09-30")
  })
  it("handles February end-of-month", () => {
    const s = suggestSemiMonthlyPeriod("2026-02-18")
    expect(s.start).toBe("2026-02-16")
    expect(s.end).toBe("2026-02-28")
  })
})

describe("formatPeriodName", () => {
  it("formats a same-month range compactly", () => {
    expect(formatPeriodName("2026-09-01", "2026-09-15")).toBe("Sep 1–15, 2026")
  })
})

describe("planLoadEntries", () => {
  const period = { id: "P1", name: "Sep 1–15, 2026" }
  it("creates one plan per active employee not already present, basic pay = salary/2", () => {
    const active = [emp("A", 25000), emp("B", 30000)]
    const plans = planLoadEntries(active, new Set<string>(), period)
    expect(plans).toHaveLength(2)
    expect(plans[0]).toMatchObject({
      employeeId: "A",
      name: "Emp A — Sep 1–15, 2026",
      basicPay: 12500,
      allowances: 0, otherEarnings: 0, otherDeductions: 0, unpaidLeaveDays: 0,
    })
  })
  it("skips employees already present in the period", () => {
    const active = [emp("A", 25000), emp("B", 30000)]
    const plans = planLoadEntries(active, new Set(["A"]), period)
    expect(plans.map((p) => p.employeeId)).toEqual(["B"])
  })
  it("returns an empty plan when all active employees are already present", () => {
    const active = [emp("A", 25000)]
    expect(planLoadEntries(active, new Set(["A"]), period)).toEqual([])
  })
})

describe("sumEntryTotals", () => {
  it("sums gross, deductions, and net over entries, treating nulls as 0", () => {
    const entries = [
      { a365_grosspay: 12500, a365_totaldeductions: 1500, a365_netpay: 11000 },
      { a365_grosspay: 15000, a365_totaldeductions: null, a365_netpay: 15000 },
    ] as unknown as PayrollEntry[]
    expect(sumEntryTotals(entries)).toEqual({ gross: 27500, deductions: 1500, net: 26000 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: FAIL — `./period-utils` module not found.

- [ ] **Step 3: Create `src/features/payroll/period-utils.ts`**

```ts
/**
 * Pure payroll helpers — UI-free, Dataverse-free. These carry the business
 * decisions (semi-monthly cutoff suggestion, confirmed basic-pay default,
 * load-employees planning, and roll-up totals) so services and components stay
 * thin and the logic is unit-testable.
 */
import { round2 } from "./services/payroll-calculation"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import type { PayrollEntry } from "./types"

/** Confirmed rule (spec §2): per-cutoff basic pay = round2(monthly / 2). */
export function basicPayForCutoff(monthlySalary: number | null | undefined): number {
  if (monthlySalary === null || monthlySalary === undefined || monthlySalary <= 0) return 0
  return round2(monthlySalary / 2)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Last calendar day of the month for the given year (1-based month). */
function endOfMonthDay(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate() // day 0 of next month = last day of this month
}

/**
 * Suggest a semi-monthly cutoff based on a reference date. Day ≤ 15 → the 1–15
 * cutoff; otherwise the 16–end-of-month cutoff. Pay date defaults to the period
 * end. All values are ISO `yyyy-MM-dd` strings; the caller may override them.
 */
export function suggestSemiMonthlyPeriod(refISO: string): {
  start: string
  end: string
  payDate: string
  name: string
} {
  const [y, m, d] = refISO.split("-").map(Number)
  const firstHalf = d <= 15
  const start = firstHalf ? `${y}-${pad2(m)}-01` : `${y}-${pad2(m)}-16`
  const endDay = firstHalf ? 15 : endOfMonthDay(y, m)
  const end = `${y}-${pad2(m)}-${pad2(endDay)}`
  return { start, end, payDate: end, name: formatPeriodName(start, end) }
}

/** e.g. "Sep 1–15, 2026". Assumes start and end share a month (semi-monthly). */
export function formatPeriodName(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split("-").map(Number)
  const [, , ed] = endISO.split("-").map(Number)
  return `${MONTHS[sm - 1]} ${sd}–${ed}, ${sy}`
}

export interface NewEntryPlan {
  employeeId: string
  name: string
  basicPay: number
  allowances: number
  otherEarnings: number
  otherDeductions: number
  unpaidLeaveDays: number
}

/**
 * Plan the entries to create when loading active employees into a period.
 * Only active employees not already present get a plan; basic pay defaults to
 * round2(monthly/2); variable inputs default to 0. Pure — the service performs
 * the actual creates.
 */
export function planLoadEntries(
  activeEmployees: Employee[],
  existingEmployeeIds: Set<string>,
  period: { id: string; name: string },
): NewEntryPlan[] {
  return activeEmployees
    .filter((e) => e.a365_employmentstatus === EmploymentStatus.Active)
    .filter((e) => !existingEmployeeIds.has(e.a365_employeeid))
    .map((e) => ({
      employeeId: e.a365_employeeid,
      name: `${e.a365_name} — ${period.name}`,
      basicPay: basicPayForCutoff(e.a365_basicmonthlysalary),
      allowances: 0,
      otherEarnings: 0,
      otherDeductions: 0,
      unpaidLeaveDays: 0,
    }))
}

/** Roll up period totals from entries, treating nulls as 0. */
export function sumEntryTotals(entries: PayrollEntry[]): {
  gross: number
  deductions: number
  net: number
} {
  return entries.reduce(
    (acc, e) => ({
      gross: round2(acc.gross + (e.a365_grosspay ?? 0)),
      deductions: round2(acc.deductions + (e.a365_totaldeductions ?? 0)),
      net: round2(acc.net + (e.a365_netpay ?? 0)),
    }),
    { gross: 0, deductions: 0, net: 0 },
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/period-utils.ts src/features/payroll/period-utils.test.ts
git commit -m "feat(payroll): pure period/entry utilities with tests"
```

---

## Task 5: Payroll period service (periods, entries, load employees)

**Files:**
- Create: `src/features/payroll/services/payroll-period-service.ts`

**Interfaces:**
- Consumes: `dataClient` from `@/lib/power/data-client`; `employeeService` from `@/features/employees/employee-service`; `EmploymentStatus` from `@/features/employees/types`; `planLoadEntries` from `../period-utils`; types + table constants from `../types`.
- Produces `payrollPeriodService` with:
  - `listPeriods(): Promise<PayrollPeriod[]>`
  - `getPeriod(id: string): Promise<PayrollPeriod>`
  - `createPeriod(input: { start: string; end: string; payDate: string; name: string }): Promise<PayrollPeriod>`
  - `listEntries(periodId: string): Promise<PayrollEntry[]>`
  - `loadActiveEmployees(periodId: string, periodName: string): Promise<{ created: number; skipped: number }>`

- [ ] **Step 1: Create `src/features/payroll/services/payroll-period-service.ts`**

```ts
/**
 * Payroll period & entry data service. All Dataverse access stays behind this
 * layer (CLAUDE.md "Dataverse Rules"); presentation depends on the hooks, not
 * this module. Business decisions live in the pure helpers (period-utils).
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { EmploymentStatus } from "@/features/employees/types"
import { planLoadEntries } from "../period-utils"
import {
  PAYROLL_PERIOD_TABLE,
  PAYROLL_ENTRY_TABLE,
  PayrollStatus,
  type PayrollPeriod,
  type PayrollEntry,
} from "../types"

const PERIOD_SELECT: (keyof PayrollPeriod)[] = [
  "a365_payrollperiodid",
  "a365_name",
  "a365_periodstart",
  "a365_periodend",
  "a365_paydate",
  "a365_payrollstatus",
  "createdon",
]

const ENTRY_SELECT = [
  "a365_payrollentryid",
  "a365_name",
  "a365_isincluded",
  "a365_basicpay",
  "a365_allowances",
  "a365_otherearnings",
  "a365_otherdeductions",
  "a365_unpaidleavedays",
  "a365_grosspay",
  "a365_sss",
  "a365_philhealth",
  "a365_hdmf",
  "a365_unpaidleave",
  "a365_withholdingtax",
  "a365_totaldeductions",
  "a365_netpay",
  "a365_calculatedon",
  "_a365_employee_value",
  "a365_employeename",
]

export const payrollPeriodService = {
  async listPeriods(): Promise<PayrollPeriod[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      { select: PERIOD_SELECT as string[], orderBy: ["a365_periodstart desc"] },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load payroll periods.")
    return result.data ?? []
  },

  async getPeriod(id: string): Promise<PayrollPeriod> {
    const result = await dataClient.retrieveRecordAsync<PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      id,
      { select: PERIOD_SELECT as string[] },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load the payroll period.")
    return result.data
  },

  async createPeriod(input: {
    start: string
    end: string
    payDate: string
    name: string
  }): Promise<PayrollPeriod> {
    const payload: Record<string, unknown> = {
      a365_name: input.name,
      a365_periodstart: input.start,
      a365_periodend: input.end,
      a365_paydate: input.payDate || null,
      a365_payrollstatus: PayrollStatus.Draft,
    }
    const result = await dataClient.createRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      payload,
    )
    if (!result.success) throw result.error ?? new Error("Unable to create the payroll period.")
    return result.data
  },

  async listEntries(periodId: string): Promise<PayrollEntry[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollEntry>(
      PAYROLL_ENTRY_TABLE,
      {
        select: ENTRY_SELECT,
        filter: `_a365_payrollperiod_value eq ${periodId}`,
        orderBy: ["a365_employeename asc"],
      },
    )
    if (!result.success) throw result.error ?? new Error("Unable to load payroll entries.")
    return result.data ?? []
  },

  /**
   * Create one payroll entry per active employee not already in the period.
   * Idempotent: employees already present are skipped. Returns a summary for
   * toast messaging. Business decisions (basic-pay default, naming) come from
   * `planLoadEntries`.
   */
  async loadActiveEmployees(
    periodId: string,
    periodName: string,
  ): Promise<{ created: number; skipped: number }> {
    const [active, existing] = await Promise.all([
      employeeService.list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` }),
      this.listEntries(periodId),
    ])
    const existingIds = new Set(
      existing.map((e) => e._a365_employee_value).filter((v): v is string => Boolean(v)),
    )
    const plans = planLoadEntries(active, existingIds, { id: periodId, name: periodName })

    let created = 0
    for (const plan of plans) {
      const payload: Record<string, unknown> = {
        "a365_Employee@odata.bind": `/a365_employees(${plan.employeeId})`,
        "a365_PayrollPeriod@odata.bind": `/a365_payrollperiods(${periodId})`,
        a365_isincluded: true,
        a365_name: plan.name,
        a365_basicpay: plan.basicPay,
        a365_allowances: plan.allowances,
        a365_otherearnings: plan.otherEarnings,
        a365_otherdeductions: plan.otherDeductions,
        a365_unpaidleavedays: plan.unpaidLeaveDays,
      }
      const result = await dataClient.createRecordAsync<Record<string, unknown>, PayrollEntry>(
        PAYROLL_ENTRY_TABLE,
        payload,
      )
      if (!result.success) {
        throw result.error ??
          new Error(`Unable to add ${plan.name}. ${created} of ${plans.length} added before this error.`)
      }
      created += 1
    }
    return { created, skipped: active.length - plans.length }
  },
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: PASS (no type errors). If `retrieveMultipleRecordsAsync` complains about the `ENTRY_SELECT` string array, it is typed `string[]` already — no cast needed.

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/services/payroll-period-service.ts
git commit -m "feat(payroll): period/entry service with load-active-employees"
```

---

## Task 6: Extend the entry service (update inputs, calculate period)

**Files:**
- Modify: `src/features/payroll/services/payroll-service.ts`

**Interfaces:**
- Consumes: existing `calculateAndPersistEntry`; `dataClient`; `PayrollEntryInputValues` from `../types`; `payrollPeriodService` from `./payroll-period-service`.
- Produces (added exports):
  - `updateEntryInputs(entryId: string, values: PayrollEntryInputValues): Promise<void>`
  - `calculatePeriod(periodId: string, periodEndDate: string, calculatedByUserId: string): Promise<{ calculated: number }>`

- [ ] **Step 1: Add `updateEntryInputs` and `calculatePeriod` to `payroll-service.ts`**

Append to the existing file (keep `calculateAndPersistEntry` unchanged). Add imports at the top for `PayrollEntryInputValues` and `payrollPeriodService`:

```ts
import type { PayrollEntryInputValues } from "../types"
import { payrollPeriodService } from "./payroll-period-service"

/** Parse a controlled numeric input to a number; blank → 0. */
function toAmount(value: string): number {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : 0
}

/**
 * Persist the editable input columns of a payroll entry. Does NOT touch
 * calculated columns — those change only through calculation.
 */
export async function updateEntryInputs(
  entryId: string,
  values: PayrollEntryInputValues,
): Promise<void> {
  const payload: Record<string, unknown> = {
    a365_basicpay: toAmount(values.a365_basicpay),
    a365_allowances: toAmount(values.a365_allowances),
    a365_otherearnings: toAmount(values.a365_otherearnings),
    a365_otherdeductions: toAmount(values.a365_otherdeductions),
    a365_unpaidleavedays: toAmount(values.a365_unpaidleavedays),
  }
  const result = await dataClient.updateRecordAsync<Record<string, unknown>, EntryReadModel>(
    ENTRY_TABLE,
    entryId,
    payload,
  )
  if (!result.success) throw result.error ?? new Error("Unable to save the payroll entry.")
}

/**
 * Calculate every included entry in a period. Aggregates failures rather than
 * failing silently: the first entry error stops the run and is surfaced.
 */
export async function calculatePeriod(
  periodId: string,
  periodEndDate: string,
  calculatedByUserId: string,
): Promise<{ calculated: number }> {
  const entries = await payrollPeriodService.listEntries(periodId)
  const included = entries.filter((e) => e.a365_isincluded)
  let calculated = 0
  for (const entry of included) {
    await calculateAndPersistEntry(entry.a365_payrollentryid, periodEndDate, calculatedByUserId)
    calculated += 1
  }
  return { calculated }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/services/payroll-service.ts
git commit -m "feat(payroll): update entry inputs and calculate whole period"
```

---

## Task 7: Hooks (current system user, periods, entries)

**Files:**
- Create: `src/features/payroll/hooks/use-current-system-user.ts`
- Create: `src/features/payroll/hooks/use-payroll-periods.ts`
- Create: `src/features/payroll/hooks/use-payroll-entries.ts`

**Interfaces:**
- Consumes: `usePowerContext`; `dataClient`; `payrollPeriodService`; `updateEntryInputs`, `calculatePeriod`, `calculateAndPersistEntry`; `useQuery`/`useMutation`/`useQueryClient`.
- Produces:
  - `useCurrentSystemUserId()` → `{ data?: string, ... }` (the acting user's `systemuserid`).
  - `payrollKeys` query-key factory.
  - `usePayrollPeriods()`, `usePayrollPeriod(id)`, `useCreatePayrollPeriod()`.
  - `usePayrollEntries(periodId)`, `useLoadActiveEmployees()`, `useUpdateEntryInputs(periodId)`, `useCalculateEntry(periodId)`, `useCalculatePeriod(periodId)`.

**Prerequisite note (systemuser data source):** resolving the acting user's `systemuser` id requires the `systemusers` table to be queryable by the data client. If `npx tsc -b`/runtime shows `systemusers` is not a registered data source, register it once with `pac code add-data-source -a dataverse -t systemuser` (or the `code-apps-preview:add-dataverse` skill) and re-run. The `CalculatedBy` stamp cannot be written without it, and the calculate action surfaces a clear error if the id cannot be resolved.

- [ ] **Step 1: Create `hooks/use-current-system-user.ts`**

```ts
/**
 * Resolves the signed-in user's Dataverse `systemuser` id from the Power host
 * context's Entra object id. Used only for audit attribution (the CalculatedBy
 * stamp) — never as a security boundary (record access is enforced by
 * Dataverse). Cached for the session; the context is stable.
 */
import { useQuery } from "@tanstack/react-query"
import { dataClient } from "@/lib/power/data-client"
import { usePowerContext } from "@/hooks/use-power-context"

interface SystemUserRow {
  systemuserid: string
}

async function resolveSystemUserId(objectId: string): Promise<string> {
  const result = await dataClient.retrieveMultipleRecordsAsync<SystemUserRow>("systemusers", {
    select: ["systemuserid"],
    filter: `azureactivedirectoryobjectid eq ${objectId}`,
    top: 1,
  })
  if (!result.success) throw result.error ?? new Error("Unable to resolve the current user.")
  const id = result.data?.[0]?.systemuserid
  if (!id) throw new Error("No Dataverse user matches the signed-in account.")
  return id
}

export function useCurrentSystemUserId() {
  const { data: context } = usePowerContext()
  const objectId = context?.user.objectId
  return useQuery({
    queryKey: ["payroll", "systemuser", objectId] as const,
    queryFn: () => resolveSystemUserId(objectId as string),
    enabled: Boolean(objectId),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
```

> If `top` is not accepted by `retrieveMultipleRecordsAsync`, drop it — the filter already narrows to one user and the code reads `[0]`.

- [ ] **Step 2: Create `hooks/use-payroll-periods.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"

export const payrollKeys = {
  all: ["payroll"] as const,
  periods: () => [...payrollKeys.all, "periods"] as const,
  period: (id: string) => [...payrollKeys.all, "period", id] as const,
  entries: (periodId: string) => [...payrollKeys.all, "entries", periodId] as const,
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: payrollKeys.periods(),
    queryFn: () => payrollPeriodService.listPeriods(),
  })
}

export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: payrollKeys.period(id),
    queryFn: () => payrollPeriodService.getPeriod(id),
    enabled: Boolean(id),
  })
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { start: string; end: string; payDate: string; name: string }) =>
      payrollPeriodService.createPeriod(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.periods() })
    },
  })
}
```

- [ ] **Step 3: Create `hooks/use-payroll-entries.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import {
  updateEntryInputs,
  calculatePeriod,
  calculateAndPersistEntry,
} from "../services/payroll-service"
import type { PayrollEntryInputValues } from "../types"
import { payrollKeys } from "./use-payroll-periods"

export function usePayrollEntries(periodId: string) {
  return useQuery({
    queryKey: payrollKeys.entries(periodId),
    queryFn: () => payrollPeriodService.listEntries(periodId),
    enabled: Boolean(periodId),
  })
}

export function useLoadActiveEmployees(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodName: string) =>
      payrollPeriodService.loadActiveEmployees(periodId, periodName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}

export function useUpdateEntryInputs(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: PayrollEntryInputValues }) =>
      updateEntryInputs(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}

export function useCalculateEntry(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      periodEndDate,
      calculatedByUserId,
    }: {
      id: string
      periodEndDate: string
      calculatedByUserId: string
    }) => calculateAndPersistEntry(id, periodEndDate, calculatedByUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}

export function useCalculatePeriod(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      periodEndDate,
      calculatedByUserId,
    }: {
      periodEndDate: string
      calculatedByUserId: string
    }) => calculatePeriod(periodId, periodEndDate, calculatedByUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/hooks
git commit -m "feat(payroll): query/mutation hooks and system-user resolver"
```

---

## Task 8: Status badge & summary cards components

**Files:**
- Create: `src/features/payroll/payroll-status-badge.tsx`
- Create: `src/features/payroll/payroll-summary-cards.tsx`

**Interfaces:**
- Consumes: `Badge`, `Card` components; `payrollStatusLabel`, `payrollStatusBadgeTone`, `PayrollStatus` from `./types`; `formatCurrency`.
- Produces: `<PayrollStatusBadge status={...} />`; `<PayrollSummaryCards gross={} deductions={} net={} />`.

- [ ] **Step 1: Create `payroll-status-badge.tsx`**

```tsx
/**
 * Payroll status badge. Uses semantic color + text (never color alone) per
 * DESIGN.md "Status Mapping": Draft gray, Processing amber, Ready blue,
 * Paid green, Locked slate.
 */
import { payrollStatusBadgeTone, payrollStatusLabel, type PayrollStatus } from "./types"

const TONE_CLASS: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground border border-border",
  processing: "bg-warning-soft text-warning border border-warning/20",
  ready: "bg-primary-soft text-primary border border-primary/20",
  paid: "bg-success-soft text-success border border-success/20",
  locked: "bg-secondary text-locked border border-border",
  unknown: "bg-secondary text-muted-foreground border border-border",
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus | null | undefined }) {
  const tone = payrollStatusBadgeTone(status)
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {payrollStatusLabel(status)}
    </span>
  )
}
```

- [ ] **Step 2: Create `payroll-summary-cards.tsx`**

```tsx
/**
 * Period roll-up metric cards (Gross, Total Deductions, Net Pay). Net gets
 * stronger emphasis. Tabular numerals per DESIGN.md.
 */
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

function Metric({
  label,
  amount,
  emphasis,
}: {
  label: string
  amount: number
  emphasis?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 tabular-nums ${
            emphasis ? "text-2xl font-semibold text-foreground" : "text-xl font-medium text-foreground"
          }`}
        >
          {formatCurrency(amount)}
        </p>
      </CardContent>
    </Card>
  )
}

export function PayrollSummaryCards({
  gross,
  deductions,
  net,
}: {
  gross: number
  deductions: number
  net: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Gross Pay" amount={gross} />
      <Metric label="Total Deductions" amount={deductions} />
      <Metric label="Net Pay" amount={net} emphasis />
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/payroll-status-badge.tsx src/features/payroll/payroll-summary-cards.tsx
git commit -m "feat(payroll): status badge and summary metric cards"
```

---

## Task 9: Create Payroll Period dialog

**Files:**
- Create: `src/features/payroll/create-period-dialog.tsx`

**Interfaces:**
- Consumes: `Dialog*`, `Button`, `Input`, `Label` components; `suggestSemiMonthlyPeriod`, `formatPeriodName` from `./period-utils`; `useCreatePayrollPeriod` from `./hooks/use-payroll-periods`; `toast`.
- Produces: `<CreatePeriodDialog open onOpenChange onCreated />` where `onCreated(periodId: string)` fires after a successful create (page navigates to the new period).

- [ ] **Step 1: Create `create-period-dialog.tsx`**

```tsx
/**
 * Create a payroll period. Semi-monthly defaults are suggested from today and
 * fully editable. Validates dates; submit disabled while saving; the form is
 * not cleared until the mutation succeeds (CLAUDE.md "Forms").
 */
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { suggestSemiMonthlyPeriod, formatPeriodName } from "./period-utils"
import { useCreatePayrollPeriod } from "./hooks/use-payroll-periods"

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

export function CreatePeriodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (periodId: string) => void
}) {
  const suggestion = useMemo(() => suggestSemiMonthlyPeriod(todayISO()), [])
  const [start, setStart] = useState(suggestion.start)
  const [end, setEnd] = useState(suggestion.end)
  const [payDate, setPayDate] = useState(suggestion.payDate)
  const [error, setError] = useState<string | null>(null)

  const createPeriod = useCreatePayrollPeriod()

  // Derive the display name during render (no useEffect for derivable state).
  const name = start && end ? formatPeriodName(start, end) : ""

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!start || !end) {
      setError("Start and end dates are required.")
      return
    }
    if (start > end) {
      setError("Start date must be on or before the end date.")
      return
    }
    setError(null)
    createPeriod.mutate(
      { start, end, payDate, name },
      {
        onSuccess: (period) => {
          toast.success("Payroll period created.")
          onOpenChange(false)
          onCreated(period.a365_payrollperiodid)
        },
        onError: (err) =>
          toast.error("Unable to create payroll period.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New payroll period</DialogTitle>
          <DialogDescription>
            Semi-monthly defaults are suggested from today. Adjust the dates if needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">
                Period start<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="period-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">
                Period end<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="period-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Pay date</Label>
            <Input
              id="pay-date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>
          {name && (
            <p className="text-sm text-muted-foreground">
              This period will be named <span className="font-medium text-foreground">{name}</span>.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPeriod.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPeriod.isPending}>
              {createPeriod.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/create-period-dialog.tsx
git commit -m "feat(payroll): create payroll period dialog"
```

---

## Task 10: Payroll dashboard page + route

**Files:**
- Create: `src/pages/payroll.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `usePayrollPeriods`; `CreatePeriodDialog`; `PayrollStatusBadge`; `formatCurrency`, `formatDate`; router `useNavigate`, `Link`.
- Produces: default-exported `PayrollDashboardPage`; route `payroll`.

- [ ] **Step 1: Create `src/pages/payroll.tsx`**

```tsx
/**
 * Payroll dashboard (Payroll Admin). Lists payroll periods with status and
 * links into each period's detail. Loading / Empty / Error / Success states.
 * Authorization is enforced in Dataverse, not this UI (CLAUDE.md "Security").
 */
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircle, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { usePayrollPeriods } from "@/features/payroll/hooks/use-payroll-periods"
import { CreatePeriodDialog } from "@/features/payroll/create-period-dialog"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"

export default function PayrollDashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()
  const { data: periods, isPending, isError, error, refetch } = usePayrollPeriods()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Create and process payroll cutoffs.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New payroll period
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2 rounded-md border p-4" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Unable to load payroll periods</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <Wallet className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No payroll periods yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first payroll period to begin processing a cutoff.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New payroll period
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Pay date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow
                  key={p.a365_payrollperiodid}
                  className="cursor-pointer"
                  onClick={() => navigate(`/payroll/${p.a365_payrollperiodid}`)}
                >
                  <TableCell className="font-medium">
                    <Link
                      to={`/payroll/${p.a365_payrollperiodid}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.a365_name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(p.a365_periodstart)}</TableCell>
                  <TableCell>{formatDate(p.a365_periodend)}</TableCell>
                  <TableCell>{formatDate(p.a365_paydate)}</TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={p.a365_payrollstatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/payroll/${id}`)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Register the route in `src/router.tsx`**

Add the import and the child route (do not touch the `BASENAME` block):

```tsx
import PayrollDashboardPage from "@/pages/payroll"
```

In the `children` array, after the `employees` route, add:

```tsx
      { path: "payroll", element: <PayrollDashboardPage /> },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/payroll.tsx src/router.tsx
git commit -m "feat(payroll): payroll dashboard page and route"
```

---

## Task 11: Entry table & per-entry editor dialog

**Files:**
- Create: `src/features/payroll/payroll-entry-dialog.tsx`
- Create: `src/features/payroll/payroll-entry-table.tsx`

**Interfaces:**
- Consumes: `Dialog*`, `Button`, `Input`, `Label`; TanStack Table; `formatCurrency`; `PayrollEntry`, `PayrollEntryInputValues`, `toEntryInputValues`, `emptyEntryInputValues` from `./types`; `useUpdateEntryInputs` from `./hooks/use-payroll-entries`.
- Produces:
  - `<PayrollEntryDialog open onOpenChange entry periodId />`.
  - `<PayrollEntryTable entries periodId onEdit onRecalculate calculatingId />`.

- [ ] **Step 1: Create `payroll-entry-dialog.tsx`**

```tsx
/**
 * Editor for a single payroll entry's variable inputs (Basic Pay, Allowances,
 * Unpaid Leave days, Other Earnings, Other Deductions). Calculated values are
 * shown read-only for context. Save disabled while pending; form not cleared
 * until success (CLAUDE.md "Forms").
 */
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/format"
import {
  toEntryInputValues,
  emptyEntryInputValues,
  type PayrollEntry,
  type PayrollEntryInputValues,
} from "./types"
import { useUpdateEntryInputs } from "./hooks/use-payroll-entries"

const FIELDS: { id: keyof PayrollEntryInputValues; label: string }[] = [
  { id: "a365_basicpay", label: "Basic Pay" },
  { id: "a365_allowances", label: "Allowances" },
  { id: "a365_otherearnings", label: "Other Earnings" },
  { id: "a365_otherdeductions", label: "Other Deductions" },
  { id: "a365_unpaidleavedays", label: "Unpaid Leave (days)" },
]

function validate(values: PayrollEntryInputValues): string | null {
  for (const { id, label } of FIELDS) {
    const raw = values[id].trim()
    if (raw === "") continue
    const n = Number(raw)
    if (Number.isNaN(n) || n < 0) return `${label} must be a non-negative number.`
  }
  return null
}

export function PayrollEntryDialog({
  open,
  onOpenChange,
  entry,
  periodId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PayrollEntry | null
  periodId: string
}) {
  const initial = useMemo(
    () => (entry ? toEntryInputValues(entry) : emptyEntryInputValues),
    [entry],
  )
  const [values, setValues] = useState<PayrollEntryInputValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const updateInputs = useUpdateEntryInputs(periodId)

  useEffect(() => {
    if (open) {
      setValues(initial)
      setError(null)
    }
  }, [open, initial])

  if (!entry) return null

  const set = (key: keyof PayrollEntryInputValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const msg = validate(values)
    setError(msg)
    if (msg) return
    updateInputs.mutate(
      { id: entry.a365_payrollentryid, values },
      {
        onSuccess: () => {
          toast.success("Payroll entry saved.")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error("Unable to save payroll entry.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry.a365_employeename ?? "Payroll entry"}</DialogTitle>
          <DialogDescription>
            Edit the variable inputs, then calculate to update the deductions and net pay.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ id, label }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[id]}
                  onChange={(e) => set(id, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-surface-subtle p-3 text-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calculated (Auto)
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
              <dt className="text-muted-foreground">Gross Pay</dt>
              <dd className="text-right">{formatCurrency(entry.a365_grosspay)}</dd>
              <dt className="text-muted-foreground">Total Deductions</dt>
              <dd className="text-right">{formatCurrency(entry.a365_totaldeductions)}</dd>
              <dt className="text-muted-foreground">Net Pay</dt>
              <dd className="text-right font-medium text-foreground">
                {formatCurrency(entry.a365_netpay)}
              </dd>
            </dl>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateInputs.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateInputs.isPending}>
              {updateInputs.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `payroll-entry-table.tsx`**

```tsx
/**
 * Payroll entry grid. Editable inputs and calculated columns share a row;
 * calculated columns render on the subtle "Auto" surface to distinguish them
 * from editable values (DESIGN.md "Editable vs Automatic"). Presentation only —
 * actions arrive via props.
 */
import { useMemo, useState } from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Calculator, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import type { PayrollEntry } from "./types"

function money(value: number | null) {
  return <span className="tabular-nums">{formatCurrency(value)}</span>
}

export function PayrollEntryTable({
  entries,
  onEdit,
  onRecalculate,
  calculatingId,
}: {
  entries: PayrollEntry[]
  onEdit: (entry: PayrollEntry) => void
  onRecalculate: (entry: PayrollEntry) => void
  calculatingId: string | null
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<PayrollEntry>[]>(
    () => [
      {
        accessorKey: "a365_employeename",
        header: "Employee",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.a365_employeename ?? "—"}</span>
        ),
      },
      {
        accessorKey: "a365_basicpay",
        header: () => <div className="text-right">Basic Pay</div>,
        cell: ({ row }) => <div className="text-right">{money(row.original.a365_basicpay)}</div>,
      },
      {
        accessorKey: "a365_allowances",
        header: () => <div className="text-right">Allowances</div>,
        cell: ({ row }) => <div className="text-right">{money(row.original.a365_allowances)}</div>,
      },
      {
        accessorKey: "a365_grosspay",
        header: () => <div className="text-right">Gross</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right">{money(row.original.a365_grosspay)}</div>
        ),
      },
      {
        accessorKey: "a365_totaldeductions",
        header: () => <div className="text-right">Deductions</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right">
            {money(row.original.a365_totaldeductions)}
          </div>
        ),
      },
      {
        accessorKey: "a365_netpay",
        header: () => <div className="text-right">Net Pay</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right font-medium">
            {money(row.original.a365_netpay)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const entry = row.original
          const isCalculating = calculatingId === entry.a365_payrollentryid
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                aria-label={`Edit ${entry.a365_employeename ?? "entry"}`}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRecalculate(entry)}
                disabled={isCalculating}
                aria-label={`Recalculate ${entry.a365_employeename ?? "entry"}`}
              >
                {isCalculating ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Calculator className="size-3.5" aria-hidden />
                )}
                Recalculate
              </Button>
            </div>
          )
        },
      },
    ],
    [onEdit, onRecalculate, calculatingId],
  )

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/payroll-entry-dialog.tsx src/features/payroll/payroll-entry-table.tsx
git commit -m "feat(payroll): entry editor dialog and entry grid"
```

---

## Task 12: Payroll period detail page + route

**Files:**
- Create: `src/pages/payroll-period.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `usePayrollPeriod`, `usePayrollEntries`, `useLoadActiveEmployees`, `useCalculateEntry`, `useCalculatePeriod`, `useCurrentSystemUserId`; `PayrollSummaryCards`, `PayrollStatusBadge`, `PayrollEntryTable`, `PayrollEntryDialog`; `sumEntryTotals`; `isPeriodEditable`; `Dialog` for the load-confirm; router `useParams`, `Link`.
- Produces: default-exported `PayrollPeriodPage`; route `payroll/:periodId`.

- [ ] **Step 1: Create `src/pages/payroll-period.tsx`**

```tsx
/**
 * Payroll period detail (Payroll Admin). Load active employees, edit variable
 * inputs, and calculate. Status transitions (Ready/Paid/Lock) are Phase 7 and
 * are not performed here. Loading / Empty / Error / Success states throughout.
 */
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Calculator, Loader2, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { usePayrollPeriod } from "@/features/payroll/hooks/use-payroll-periods"
import {
  usePayrollEntries,
  useLoadActiveEmployees,
  useCalculateEntry,
  useCalculatePeriod,
} from "@/features/payroll/hooks/use-payroll-entries"
import { useCurrentSystemUserId } from "@/features/payroll/hooks/use-current-system-user"
import { PayrollSummaryCards } from "@/features/payroll/payroll-summary-cards"
import { PayrollStatusBadge } from "@/features/payroll/payroll-status-badge"
import { PayrollEntryTable } from "@/features/payroll/payroll-entry-table"
import { PayrollEntryDialog } from "@/features/payroll/payroll-entry-dialog"
import { sumEntryTotals } from "@/features/payroll/period-utils"
import { isPeriodEditable, type PayrollEntry } from "@/features/payroll/types"

export default function PayrollPeriodPage() {
  const { periodId = "" } = useParams()
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PayrollEntry | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false)
  const [calculatingId, setCalculatingId] = useState<string | null>(null)

  const period = usePayrollPeriod(periodId)
  const entries = usePayrollEntries(periodId)
  const systemUser = useCurrentSystemUserId()
  const loadEmployees = useLoadActiveEmployees(periodId)
  const calcEntry = useCalculateEntry(periodId)
  const calcPeriod = useCalculatePeriod(periodId)

  const totals = useMemo(
    () => sumEntryTotals(entries.data ?? []),
    [entries.data],
  )
  const filtered = useMemo(() => {
    const list = entries.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((e) => (e.a365_employeename ?? "").toLowerCase().includes(q))
  }, [entries.data, search])

  const editable = isPeriodEditable(period.data?.a365_payrollstatus)

  const requireSystemUser = (): string | null => {
    if (!systemUser.data) {
      toast.error("Cannot calculate yet.", {
        description: "Your Dataverse user could not be resolved for the audit stamp.",
      })
      return null
    }
    return systemUser.data
  }

  const handleLoadEmployees = () => {
    const name = period.data?.a365_name ?? ""
    loadEmployees.mutate(name, {
      onSuccess: ({ created, skipped }) => {
        toast.success(
          `Loaded employees: ${created} added${skipped ? `, ${skipped} already present` : ""}.`,
        )
        setConfirmLoadOpen(false)
      },
      onError: (err) => toast.error("Unable to load employees.", { description: err.message }),
    })
  }

  const handleRecalculateEntry = (entry: PayrollEntry) => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    setCalculatingId(entry.a365_payrollentryid)
    calcEntry.mutate(
      {
        id: entry.a365_payrollentryid,
        periodEndDate: period.data.a365_periodend,
        calculatedByUserId: userId,
      },
      {
        onSuccess: () => toast.success("Entry recalculated."),
        onError: (err) => toast.error("Unable to recalculate.", { description: err.message }),
        onSettled: () => setCalculatingId(null),
      },
    )
  }

  const handleCalculateAll = () => {
    const userId = requireSystemUser()
    if (!userId || !period.data) return
    calcPeriod.mutate(
      { periodEndDate: period.data.a365_periodend, calculatedByUserId: userId },
      {
        onSuccess: ({ calculated }) => toast.success(`Calculated ${calculated} entries.`),
        onError: (err) => toast.error("Unable to calculate payroll.", { description: err.message }),
      },
    )
  }

  const openEditor = (entry: PayrollEntry) => {
    setEditing(entry)
    setEditorOpen(true)
  }

  if (period.isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (period.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load this payroll period</p>
          <p className="text-sm text-muted-foreground">
            {period.error instanceof Error ? period.error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => period.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const hasEntries = (entries.data?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="space-y-3">
        <Link
          to="/payroll"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Payroll
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{period.data.a365_name}</h1>
            <PayrollStatusBadge status={period.data.a365_payrollstatus} />
          </div>
          <div className="flex items-center gap-2">
            {hasEntries && editable && (
              <Button
                variant="outline"
                onClick={() => setConfirmLoadOpen(true)}
                disabled={loadEmployees.isPending}
              >
                <UserPlus className="size-4" aria-hidden />
                Load employees
              </Button>
            )}
            {hasEntries && editable && (
              <Button onClick={handleCalculateAll} disabled={calcPeriod.isPending}>
                {calcPeriod.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Calculator className="size-4" aria-hidden />
                )}
                Calculate all
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(period.data.a365_periodstart)} – {formatDate(period.data.a365_periodend)} ·
          Pay date {formatDate(period.data.a365_paydate)}
        </p>
      </div>

      <PayrollSummaryCards gross={totals.gross} deductions={totals.deductions} net={totals.net} />

      {!editable && (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
          This period is {period.data.a365_payrollstatus === undefined ? "not editable" : "no longer editable"} in payroll administration.
        </p>
      )}

      {entries.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <p className="font-medium">Unable to load payroll entries</p>
          <p className="text-sm text-muted-foreground">
            {entries.error instanceof Error ? entries.error.message : "Please try again."}
          </p>
          <Button variant="outline" onClick={() => entries.refetch()}>
            Try again
          </Button>
        </div>
      ) : !hasEntries ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <UserPlus className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No employees loaded</p>
            <p className="text-sm text-muted-foreground">
              Load active employees to populate this cutoff, then enter inputs and calculate.
            </p>
          </div>
          <Button onClick={() => setConfirmLoadOpen(true)} disabled={!editable || loadEmployees.isPending}>
            {loadEmployees.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            Load active employees
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="pl-8"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <PayrollEntryTable
            entries={filtered}
            onEdit={openEditor}
            onRecalculate={handleRecalculateEntry}
            calculatingId={calculatingId}
          />
          <p className="text-xs text-muted-foreground">
            Withholding tax is provisional pending accountant confirmation of the taxable-base rule.
          </p>
        </div>
      )}

      <PayrollEntryDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editing}
        periodId={periodId}
      />

      <Dialog open={confirmLoadOpen} onOpenChange={setConfirmLoadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load active employees?</DialogTitle>
            <DialogDescription>
              This adds a payroll entry for every active employee not already in this period. Basic
              Pay defaults to half of each employee's monthly salary and can be edited afterward.
              Employees already present are skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmLoadOpen(false)}
              disabled={loadEmployees.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleLoadEmployees} disabled={loadEmployees.isPending}>
              {loadEmployees.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Load employees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Register the route in `src/router.tsx`**

Add the import and route (after the `payroll` route):

```tsx
import PayrollPeriodPage from "@/pages/payroll-period"
```

```tsx
      { path: "payroll/:periodId", element: <PayrollPeriodPage /> },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/payroll-period.tsx src/router.tsx
git commit -m "feat(payroll): payroll period detail page with load + calculate"
```

---

## Task 13: Full verification & phase checkbox update

**Files:**
- Modify: `docs/payroll-task-phases.md` (check off Phase 6 tasks)

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — including `period-utils.test.ts` and the existing Phase 5 calculation tests.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (no errors). Fix any unused imports (e.g. a leftover `ModeToggle` import) reported.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke check (if a Power Apps host / `pac code run` is available)**

Confirm: sidebar renders in Automations Blue; `/payroll` lists periods; create a period; open it; load active employees (basic pay = salary/2); edit an entry; Calculate all updates deductions/net; summary totals reflect entries. Note the WHT-provisional caveat is visible.

- [ ] **Step 5: Check off Phase 6 in `docs/payroll-task-phases.md`**

Mark the Phase 6 task list items `[x]` (Build Payroll Dashboard through Add payroll summary totals), matching what shipped.

- [ ] **Step 6: Commit**

```bash
git add docs/payroll-task-phases.md
git commit -m "docs: mark Phase 6 payroll administration UI complete"
```

---

## Self-Review

**1. Spec coverage**

- §3 design system → Task 1. §4 sidebar → Task 2. §3.3 status badge → Tasks 3 + 8. §5.1 types → Task 3. §5.2 period service + load employees → Tasks 4 + 5. §5.3 update inputs / calculate period → Task 6. §5.4 hooks (incl. system-user resolver) → Task 7. §6.2 dashboard → Task 10. §6.3 create dialog → Task 9. §6.4 period detail (load, calculate all, summary, search, WHT note) → Tasks 11 + 12. §6.5 entry editor → Task 11. §7 calc flow / status-Draft-only → Tasks 6 + 12 (`isPeriodEditable`). §8 states → dashboard/detail tasks. §9 testing → Tasks 3, 4, 13. §10 file plan → File Structure. All spec sections map to at least one task.
- Editable-vs-calculated visual distinction (§6.4) → Task 11 (`bg-surface-subtle` on calculated columns + the "Auto" panel in the editor).
- Money right-align + tabular-nums (Global Constraints) → Tasks 8, 11.

**2. Placeholder scan:** No "TBD"/"TODO"/"add error handling"/"similar to Task N" placeholders. The only "provisional" is the intentional WHT caveat surfaced to the user (spec §11), not a plan gap. Every code step contains full code.

**3. Type consistency:** `PayrollStatus`, `PayrollEntry`, `PayrollEntryInputValues`, `toEntryInputValues`, `emptyEntryInputValues` defined in Task 3 and consumed with the same names/signatures in Tasks 4–12. `payrollKeys` defined in Task 7 (`use-payroll-periods`) and imported by `use-payroll-entries`. `planLoadEntries(active, existingIds:Set, {id,name})` signature matches between Task 4 (def/test) and Task 5 (call). `updateEntryInputs`, `calculatePeriod`, `calculateAndPersistEntry` signatures match between Task 6 (def) and Task 7 (hooks). `loadActiveEmployees(periodId, periodName)` matches between Task 5 and the `useLoadActiveEmployees` mutation in Task 7 and its call in Task 12. `useCurrentSystemUserId` returns `{ data?: string }`, consumed in Task 12.

**Known environment dependency (not a plan gap):** `systemusers` must be a registered data source for the `CalculatedBy` stamp (Task 7 prerequisite note). If unavailable, calculation surfaces a clear error rather than failing silently.
