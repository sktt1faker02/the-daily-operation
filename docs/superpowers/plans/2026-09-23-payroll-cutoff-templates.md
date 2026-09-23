# Payroll Cutoff Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Payroll Admin save a finalized cutoff's per-employee inputs as a named, reusable template and load it into an editable period, managed from a new Templates page.

**Architecture:** Two Organization-owned Dataverse tables (`a365_payrolltemplate` header + `a365_payrolltemplateline` lines) wired as code-app data sources. All Dataverse access sits behind a new `payroll-template-service.ts`; the overwrite/add/skip decision is a pure helper (`planApplyInputs`) shared with the existing copy-previous-cutoff flow. TanStack Query hooks feed shadcn/ui dialogs and a new TanStack Table page.

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query + Table, shadcn/ui + Radix, Lucide, Sonner, Vitest + React Testing Library, Power Apps Code Apps `dataClient`, Dataverse.

**Spec:** `docs/superpowers/specs/2026-09-23-payroll-cutoff-templates-design.md`

## Global Constraints

- **Dataverse is the system of record**; keep all Dataverse access behind a service layer (Component → Hook → Service → Dataverse).
- **Never guess Dataverse schema names** — verify every logical name in Dataverse after creation and record it in `docs/data-model.md` before binding code to it.
- **Both new tables are Organization-owned, Payroll Admin privileges only**; ordinary users get no access. UI gating (`AdminOnly`) is UX, not the security boundary.
- **Templates store INPUTS only**: `a365_basicpay`, `a365_allowances`, `a365_otherearnings`, `a365_otherdeductions`, `a365_unpaidleavedays`, `a365_withholdingtax`, `a365_comment`. Never store or copy calculated results (gross, SSS/PhilHealth/HDMF, total deductions, net) — always recalculate after load.
- **Save allowed only from Paid or Locked periods** (`PayrollStatus.Paid = 749910003`, `PayrollStatus.Locked = 749910004`); enforce in the service with a typed error, not just UI.
- **Load only into editable periods** (Draft/Processing; `isPeriodEditable`).
- **Money rounding**: reuse `round2` from `payroll-calculation.ts`; currency display via existing `formatCurrency`.
- **Errors surface to the user** (Sonner toasts); never silently swallow. `npm run lint` and `npm run build` must pass before completion.
- Follow existing patterns: hand-written services using `dataClient` (like `payroll-period-service.ts`), hand-written types in `features/payroll/types.ts`, pure helpers in `period-utils.ts`.

---

## File Structure

- `src/features/payroll/types.ts` — MODIFY: add `PayrollTemplate`, `PayrollTemplateLine` types + table-name constants.
- `src/features/payroll/period-utils.ts` — MODIFY: add `comment` to `CopiedInputs`; add pure `planApplyInputs`.
- `src/features/payroll/period-utils.test.ts` — MODIFY: tests for `planApplyInputs` and the comment field.
- `src/features/payroll/services/payroll-period-service.ts` — MODIFY: carry `comment`; refactor `copyFromPreviousCutoff` onto `planApplyInputs`.
- `src/features/payroll/services/payroll-template-service.ts` — CREATE: save/apply/list/get/rename/delete.
- `src/features/payroll/services/payroll-template-service.test.ts` — CREATE: save-guard + mapping tests.
- `src/features/payroll/hooks/use-payroll-templates.ts` — CREATE: query/mutation hooks.
- `src/features/payroll/hooks/use-payroll-entries.ts` — MODIFY: `useApplyTemplate` (or extend) recalcs after apply.
- `src/pages/payroll-templates.tsx` — CREATE: templates management page.
- `src/pages/payroll-period.tsx` — MODIFY: Save-as-template (Paid/Locked) + Load-template (editable) dialogs.
- `src/pages/_layout.tsx` — MODIFY: sidebar link to Templates.
- `src/router.tsx` — MODIFY: `/payroll/templates` route.
- `docs/data-model.md`, `docs/architecture.md` — MODIFY: record schema + services/page.

---

## Task 1: Create Dataverse tables, privileges, and wire as data sources

**Files:**
- Modify: `docs/data-model.md` (record confirmed schema)
- Generated (by tooling, do not hand-edit): `.power/schemas/appschemas/dataSourcesInfo.ts`, `src/generated/models/*`, `src/generated/services/*`

**Interfaces:**
- Produces: entity set names + logical names other tasks bind to. Expected: header entity set `a365_payrolltemplates` (primary id `a365_payrolltemplateid`, primary name `a365_name`, `a365_description`); line entity set `a365_payrolltemplatelines` (primary id `a365_payrolltemplatelineid`, lookups `a365_template` → header, `a365_employee` → `a365_employee`; input columns as in Global Constraints). **Verify actual names after creation and update this block + docs.**

- [ ] **Step 1: Create the header table** via the Dataverse MCP (`create_table`): display "Payroll Cutoff Template", schema `a365_payrolltemplate`, **OwnershipType = OrganizationOwned**, primary name `a365_name` (Text). Add `a365_description` (Multiline Text, optional).

- [ ] **Step 2: Create the line table** (`create_table`): display "Payroll Cutoff Template Line", schema `a365_payrolltemplateline`, **OrganizationOwned**, primary name `a365_name` (Text). Add columns: `a365_basicpay` (Currency), `a365_allowances` (Currency), `a365_otherearnings` (Currency), `a365_otherdeductions` (Currency), `a365_unpaidleavedays` (Decimal), `a365_withholdingtax` (Currency), `a365_comment` (Multiline Text).

- [ ] **Step 3: Create relationships.** Lookup `a365_template` on the line table → `a365_payrolltemplate` as a **parental** 1:N (so deleting a header cascades its lines). Lookup `a365_employee` on the line table → `a365_employee` (Referential, Restrict Delete is fine).

- [ ] **Step 4: Set security privileges.** Grant the Payroll Admin security role Create/Read/Write/Delete (Organization depth) on both tables; leave the ordinary user role with no privileges. (Follow `docs/security-model.md`; use the maker portal or dv-security skill.)

- [ ] **Step 5: Read back and record the schema.** Use the Dataverse MCP `describe` on both tables. Copy the **actual** logical names, entity set names, and lookup navigation property names into a new section of `docs/data-model.md`. Update the Task 1 Interfaces block above if anything differs from the expected names.

- [ ] **Step 6: Wire the tables into the code app as data sources.** Invoke the `code-apps-preview:add-dataverse` skill (or `pac code add-data-source`) for `a365_payrolltemplate` and `a365_payrolltemplateline`. This regenerates `.power/schemas/appschemas/dataSourcesInfo.ts` and the `src/generated` models/services so `dataClient` can reach the new tables.

- [ ] **Step 7: Verify build picks up the data sources.**

Run: `npm run build`
Expected: PASS (generated models compile; `dataSourcesInfo` includes both new entity sets).

- [ ] **Step 8: Commit**

```bash
git add docs/data-model.md .power src/generated
git commit -m "feat(payroll): add payroll template Dataverse tables + data sources"
```

---

## Task 2: Carry the Comment field in copy previous cutoff

**Files:**
- Modify: `src/features/payroll/period-utils.ts` (`CopiedInputs`)
- Modify: `src/features/payroll/period-utils.test.ts`
- Modify: `src/features/payroll/services/payroll-period-service.ts`

**Interfaces:**
- Produces: `CopiedInputs` gains `comment: string`; `NewEntryPlan` gains `comment: string`.

- [ ] **Step 1: Update the failing test** in `period-utils.test.ts`. In the `planCopyEntries` suite, add `comment` to the source map and assert it is carried:

```ts
// inside the existing source map for "A", add:
comment: "Recurring note",
// and in "carries ALL of the source cutoff's inputs..." add to the matchObject:
comment: "Recurring note",
// and in the "uses defaults for an employee hired since the source period" test add:
comment: "",
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: FAIL (type error / missing `comment`).

- [ ] **Step 3: Add `comment` to the types and default** in `period-utils.ts`:

```ts
export interface NewEntryPlan {
  // ...existing fields...
  withholdingTax: number
  comment: string
  systemUserId: string | null
}
```
In `planLoadEntries`'s mapped object add `comment: "",` (next to `withholdingTax: 0,`).
In `CopiedInputs` add `comment: string`.

- [ ] **Step 4: Carry `comment` in the service** (`payroll-period-service.ts`, `copyFromPreviousCutoff`): in the `sourceByEmployee` map add `comment: entry.a365_comment ?? "",`; in the existing-entry overwrite payload add `a365_comment: inputs.comment,`; in `createPlannedEntries` payload add `a365_comment: plan.comment,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/period-utils.ts src/features/payroll/period-utils.test.ts src/features/payroll/services/payroll-period-service.ts
git commit -m "feat(payroll): carry entry comment when copying previous cutoff"
```

---

## Task 3: Pure `planApplyInputs` helper (shared apply logic)

**Files:**
- Modify: `src/features/payroll/period-utils.ts`
- Modify: `src/features/payroll/period-utils.test.ts`

**Interfaces:**
- Consumes: `CopiedInputs`, `NewEntryPlan`, `planLoadEntries` (Task 2), `Employee`.
- Produces:
  ```ts
  export interface EntryInputUpdate { entryId: string; inputs: CopiedInputs }
  export interface ApplyInputsPlan { updates: EntryInputUpdate[]; creates: NewEntryPlan[]; skipped: number }
  export function planApplyInputs(
    sourceByEmployee: Map<string, CopiedInputs>,
    existingEntries: { a365_payrollentryid: string; _a365_employee_value: string | null }[],
    activeEmployees: Employee[],
    period: { id: string; name: string },
  ): ApplyInputsPlan
  ```
  Rules: employee in source **and** already in period → an `update`. Active employee not yet in period → a `create` (source values if in source, else defaults). Source employee neither present nor active → counted in `skipped`. Period employees not in source → untouched (absent from all three lists).

- [ ] **Step 1: Write the failing test** (append to `period-utils.test.ts`):

```ts
describe("planApplyInputs", () => {
  const period = { id: "P3", name: "Oct 1–15, 2026" }
  const inputs = (over: Partial<CopiedInputs> = {}): CopiedInputs => ({
    basicPay: 10000, allowances: 0, otherEarnings: 0, otherDeductions: 0,
    unpaidLeaveDays: 0, withholdingTax: 0, comment: "", ...over,
  })

  it("updates employees already present, adds active-and-missing, skips inactive-and-absent", () => {
    const source = new Map<string, CopiedInputs>([
      ["A", inputs({ basicPay: 21500, comment: "keep" })], // present -> update
      ["B", inputs({ basicPay: 15000 })],                   // active, absent -> create
      ["C", inputs({ basicPay: 9000 })],                    // inactive, absent -> skip
    ])
    const existing = [{ a365_payrollentryid: "e-A", _a365_employee_value: "A" }]
    const active = [emp("A", 43000), emp("B", 30000)] // C not active
    const plan = planApplyInputs(source, existing, active, period)

    expect(plan.updates).toEqual([{ entryId: "e-A", inputs: inputs({ basicPay: 21500, comment: "keep" }) }])
    expect(plan.creates.map((c) => c.employeeId)).toEqual(["B"])
    expect(plan.creates[0]).toMatchObject({ basicPay: 15000 })
    expect(plan.skipped).toBe(1) // C
  })

  it("leaves period employees not in the source untouched (no update, no create)", () => {
    const source = new Map<string, CopiedInputs>([["A", inputs()]])
    const existing = [
      { a365_payrollentryid: "e-A", _a365_employee_value: "A" },
      { a365_payrollentryid: "e-Z", _a365_employee_value: "Z" }, // not in source
    ]
    const active = [emp("A", 43000), emp("Z", 20000)]
    const plan = planApplyInputs(source, existing, active, period)
    expect(plan.updates.map((u) => u.entryId)).toEqual(["e-A"])
    expect(plan.creates).toEqual([]) // A present, Z untouched
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: FAIL ("planApplyInputs is not a function").

- [ ] **Step 3: Implement `planApplyInputs`** in `period-utils.ts`:

```ts
export interface EntryInputUpdate {
  entryId: string
  inputs: CopiedInputs
}
export interface ApplyInputsPlan {
  updates: EntryInputUpdate[]
  creates: NewEntryPlan[]
  skipped: number
}

/**
 * Decide how to apply a set of inputs (keyed by employee) to a period: overwrite
 * employees already present, add active employees not yet present, skip source
 * employees who are neither present nor active. Period employees absent from the
 * source are left untouched. Pure — the service performs the writes.
 */
export function planApplyInputs(
  sourceByEmployee: Map<string, CopiedInputs>,
  existingEntries: { a365_payrollentryid: string; _a365_employee_value: string | null }[],
  activeEmployees: Employee[],
  period: { id: string; name: string },
): ApplyInputsPlan {
  const entryIdByEmployee = new Map<string, string>()
  for (const e of existingEntries) {
    if (e._a365_employee_value) entryIdByEmployee.set(e._a365_employee_value, e.a365_payrollentryid)
  }

  const updates: EntryInputUpdate[] = []
  for (const [employeeId, inputs] of sourceByEmployee) {
    const entryId = entryIdByEmployee.get(employeeId)
    if (entryId) updates.push({ entryId, inputs })
  }

  const existingIds = new Set(entryIdByEmployee.keys())
  const creates = planLoadEntries(activeEmployees, existingIds, period).map((plan) => {
    const source = sourceByEmployee.get(plan.employeeId)
    return source ? { ...plan, ...source } : plan
  })

  const activeIds = new Set(activeEmployees.map((e) => e.a365_employeeid))
  let skipped = 0
  for (const employeeId of sourceByEmployee.keys()) {
    if (!entryIdByEmployee.has(employeeId) && !activeIds.has(employeeId)) skipped++
  }

  return { updates, creates, skipped }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/payroll/period-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/period-utils.ts src/features/payroll/period-utils.test.ts
git commit -m "feat(payroll): add pure planApplyInputs helper for period input application"
```

---

## Task 4: Refactor copyFromPreviousCutoff onto planApplyInputs

**Files:**
- Modify: `src/features/payroll/services/payroll-period-service.ts`

**Interfaces:**
- Consumes: `planApplyInputs`, `EntryInputUpdate` (Task 3).
- Produces: no signature change to `copyFromPreviousCutoff` (still returns `{ created, updated, copiedFrom, skipped }`); a private helper `applyInputsToPeriod(periodId, sourceByEmployee, active, existing)` reused by Task 5.

- [ ] **Step 1: Add a shared private executor** in `payroll-period-service.ts` (module scope, near `createPlannedEntries`):

```ts
/**
 * Apply a set of inputs keyed by employee to a period: overwrite present
 * employees, add active-and-missing ones. Returns counts. Shared by copy-previous
 * and template-load. Caller recalculates afterward.
 */
async function applyInputsToPeriod(
  periodId: string,
  periodName: string,
  sourceByEmployee: Map<string, CopiedInputs>,
  active: Employee[],
  existing: PayrollEntry[],
): Promise<{ created: number; updated: number; skipped: number }> {
  const plan = planApplyInputs(sourceByEmployee, existing, active, { id: periodId, name: periodName })
  for (const { entryId, inputs } of plan.updates) {
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollEntry>(
      PAYROLL_ENTRY_TABLE,
      entryId,
      {
        a365_basicpay: inputs.basicPay,
        a365_allowances: inputs.allowances,
        a365_otherearnings: inputs.otherEarnings,
        a365_otherdeductions: inputs.otherDeductions,
        a365_unpaidleavedays: inputs.unpaidLeaveDays,
        a365_withholdingtax: inputs.withholdingTax,
        a365_comment: inputs.comment || null,
      },
    )
    if (!result.success) throw result.error ?? new Error("Unable to update payroll entry.")
  }
  const created = await createPlannedEntries(periodId, plan.creates)
  return { created, updated: plan.updates.length, skipped: plan.skipped }
}
```

(Import `planApplyInputs` and type `Employee` if not already imported.)

- [ ] **Step 2: Rewrite `copyFromPreviousCutoff`'s tail** to delegate. Replace the inline update loop + `planCopyEntries` block with:

```ts
    const sourceByEmployee = new Map<string, CopiedInputs>()
    for (const entry of sourceEntries) {
      if (entry._a365_employee_value) {
        sourceByEmployee.set(entry._a365_employee_value, {
          basicPay: entry.a365_basicpay ?? 0,
          allowances: entry.a365_allowances ?? 0,
          otherEarnings: entry.a365_otherearnings ?? 0,
          otherDeductions: entry.a365_otherdeductions ?? 0,
          unpaidLeaveDays: entry.a365_unpaidleavedays ?? 0,
          withholdingTax: entry.a365_withholdingtax ?? 0,
          comment: entry.a365_comment ?? "",
        })
      }
    }
    const { created, updated } = await applyInputsToPeriod(periodId, periodName, sourceByEmployee, active, existing)
    return { created, updated, copiedFrom: source.a365_name, skipped: Math.max(0, active.length - created - updated) }
```

Remove the now-unused `planCopyEntries` import if nothing else uses it (leave `planLoadEntries`). Delete `planCopyEntries` from `period-utils.ts` and its test suite **only if** no other reference remains (grep first).

- [ ] **Step 3: Run the full payroll suite + lint + build**

Run: `npx vitest run src/features/payroll && npm run lint && npm run build`
Expected: PASS (copy behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll
git commit -m "refactor(payroll): share apply-inputs logic between copy and templates"
```

---

## Task 5: payroll-template-service

**Files:**
- Create: `src/features/payroll/services/payroll-template-service.ts`
- Create: `src/features/payroll/services/payroll-template-service.test.ts`
- Modify: `src/features/payroll/types.ts` (types + table constants)

**Interfaces:**
- Consumes: `dataClient`, `PAYROLL_ENTRY_TABLE`, `applyInputsToPeriod` pattern (Task 4), `payrollPeriodService.getPeriod/listEntries`, `employeeService.list`, `PayrollStatus`, `isPeriodEditable`, `CopiedInputs`.
- Produces:
  ```ts
  interface PayrollTemplateSummary { id: string; name: string; description: string | null; lineCount: number; createdOn: string }
  interface PayrollTemplateLine { employeeId: string; employeeName: string; inputs: CopiedInputs }
  payrollTemplateService.listTemplates(): Promise<PayrollTemplateSummary[]>
  payrollTemplateService.getTemplateLines(templateId): Promise<PayrollTemplateLine[]>
  payrollTemplateService.saveTemplateFromPeriod(periodId, name, description): Promise<{ templateId: string; lineCount: number }>
  payrollTemplateService.applyTemplateToPeriod(templateId, periodId): Promise<{ created: number; updated: number; skipped: number; templateName: string }>
  payrollTemplateService.renameTemplate(id, { name, description }): Promise<void>
  payrollTemplateService.deleteTemplate(id): Promise<void>
  ```

- [ ] **Step 1: Add types + constants** to `types.ts`:

```ts
export const PAYROLL_TEMPLATE_TABLE = "a365_payrolltemplates" // VERIFY entity set name from Task 1
export const PAYROLL_TEMPLATE_LINE_TABLE = "a365_payrolltemplatelines" // VERIFY

export interface PayrollTemplate {
  a365_payrolltemplateid: string
  a365_name: string
  a365_description: string | null
  createdon: string
}
export interface PayrollTemplateLineRow {
  a365_payrolltemplatelineid: string
  _a365_template_value: string | null
  _a365_employee_value: string | null
  a365_basicpay: number | null
  a365_allowances: number | null
  a365_otherearnings: number | null
  a365_otherdeductions: number | null
  a365_unpaidleavedays: number | null
  a365_withholdingtax: number | null
  a365_comment: string | null
}
```

- [ ] **Step 2: Write the failing test** `payroll-template-service.test.ts`. Mock `dataClient` and `payrollPeriodService`; assert the save guard and the entry→line mapping. Use `vi.mock`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/power/data-client", () => ({
  dataClient: {
    createRecordAsync: vi.fn(),
    retrieveMultipleRecordsAsync: vi.fn(),
    deleteRecordAsync: vi.fn(),
    updateRecordAsync: vi.fn(),
  },
}))
vi.mock("./payroll-period-service", () => ({
  payrollPeriodService: { getPeriod: vi.fn(), listEntries: vi.fn() },
}))

import { dataClient } from "@/lib/power/data-client"
import { payrollPeriodService } from "./payroll-period-service"
import { payrollTemplateService } from "./payroll-template-service"
import { PayrollStatus } from "../types"

beforeEach(() => vi.clearAllMocks())

describe("saveTemplateFromPeriod", () => {
  it("rejects a non-finalized period", async () => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({
      a365_payrollperiodid: "p1", a365_name: "Mar 1–15", a365_payrollstatus: PayrollStatus.Processing,
    } as never)
    await expect(payrollTemplateService.saveTemplateFromPeriod("p1", "T", null)).rejects.toThrow()
    expect(dataClient.createRecordAsync).not.toHaveBeenCalled()
  })

  it("creates a header then one line per entry, mapping inputs", async () => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({
      a365_payrollperiodid: "p1", a365_name: "Feb 1–15", a365_payrollstatus: PayrollStatus.Paid,
    } as never)
    vi.mocked(payrollPeriodService.listEntries).mockResolvedValue([
      { _a365_employee_value: "A", a365_name: "Camila — Feb 1–15", a365_basicpay: 9500, a365_allowances: 100,
        a365_otherearnings: 0, a365_otherdeductions: 0, a365_unpaidleavedays: 0, a365_withholdingtax: 0, a365_comment: "x" },
    ] as never)
    vi.mocked(dataClient.createRecordAsync)
      .mockResolvedValueOnce({ success: true, data: { a365_payrolltemplateid: "t1" } } as never) // header
      .mockResolvedValue({ success: true, data: { a365_payrolltemplatelineid: "l1" } } as never)   // line

    const res = await payrollTemplateService.saveTemplateFromPeriod("p1", "Standard", "note")
    expect(res).toEqual({ templateId: "t1", lineCount: 1 })
    expect(dataClient.createRecordAsync).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/features/payroll/services/payroll-template-service.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `payroll-template-service.ts`:**

```ts
/**
 * Payroll cutoff template data service. All Dataverse access for the template
 * tables stays behind this layer. Templates store INPUTS only; loading a template
 * overwrites/adds entries (shared logic with copy-previous) and the caller
 * recalculates. Save is restricted to Paid/Locked periods.
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { EmploymentStatus } from "@/features/employees/types"
import { planApplyInputs, type CopiedInputs } from "../period-utils"
import { payrollPeriodService } from "./payroll-period-service"
import {
  PAYROLL_TEMPLATE_TABLE,
  PAYROLL_TEMPLATE_LINE_TABLE,
  PAYROLL_ENTRY_TABLE,
  PayrollStatus,
  type PayrollTemplate,
  type PayrollTemplateLineRow,
  type PayrollEntry,
} from "../types"

const FINALIZED = new Set<PayrollStatus>([PayrollStatus.Paid, PayrollStatus.Locked])

export interface PayrollTemplateSummary {
  id: string
  name: string
  description: string | null
  lineCount: number
  createdOn: string
}
export interface PayrollTemplateLine {
  employeeId: string
  inputs: CopiedInputs
}

const LINE_SELECT = [
  "a365_payrolltemplatelineid", "_a365_template_value", "_a365_employee_value",
  "a365_basicpay", "a365_allowances", "a365_otherearnings", "a365_otherdeductions",
  "a365_unpaidleavedays", "a365_withholdingtax", "a365_comment",
]

function lineToInputs(r: PayrollTemplateLineRow): CopiedInputs {
  return {
    basicPay: r.a365_basicpay ?? 0,
    allowances: r.a365_allowances ?? 0,
    otherEarnings: r.a365_otherearnings ?? 0,
    otherDeductions: r.a365_otherdeductions ?? 0,
    unpaidLeaveDays: r.a365_unpaidleavedays ?? 0,
    withholdingTax: r.a365_withholdingtax ?? 0,
    comment: r.a365_comment ?? "",
  }
}

export const payrollTemplateService = {
  async listTemplates(): Promise<PayrollTemplateSummary[]> {
    const headers = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplate>(PAYROLL_TEMPLATE_TABLE, {
      select: ["a365_payrolltemplateid", "a365_name", "a365_description", "createdon"],
      orderBy: ["createdon desc"],
    })
    if (!headers.success) throw headers.error ?? new Error("Unable to load templates.")
    const lines = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplateLineRow>(PAYROLL_TEMPLATE_LINE_TABLE, {
      select: ["_a365_template_value"],
    })
    const counts = new Map<string, number>()
    for (const l of lines.data ?? []) {
      const id = l._a365_template_value
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return (headers.data ?? []).map((h) => ({
      id: h.a365_payrolltemplateid,
      name: h.a365_name,
      description: h.a365_description ?? null,
      lineCount: counts.get(h.a365_payrolltemplateid) ?? 0,
      createdOn: h.createdon,
    }))
  },

  async getTemplateLines(templateId: string): Promise<PayrollTemplateLine[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplateLineRow>(PAYROLL_TEMPLATE_LINE_TABLE, {
      select: LINE_SELECT,
      filter: `_a365_template_value eq ${templateId}`,
    })
    if (!result.success) throw result.error ?? new Error("Unable to load template lines.")
    return (result.data ?? [])
      .filter((r) => r._a365_employee_value)
      .map((r) => ({ employeeId: r._a365_employee_value as string, inputs: lineToInputs(r) }))
  },

  async saveTemplateFromPeriod(periodId: string, name: string, description: string | null) {
    const period = await payrollPeriodService.getPeriod(periodId)
    if (!FINALIZED.has(period.a365_payrollstatus)) {
      throw new Error("A template can only be saved from a Paid or Locked payroll period.")
    }
    const entries = await payrollPeriodService.listEntries(periodId)

    const header = await dataClient.createRecordAsync<Record<string, unknown>, PayrollTemplate>(
      PAYROLL_TEMPLATE_TABLE,
      { a365_name: name, a365_description: description || null },
    )
    if (!header.success) throw header.error ?? new Error("Unable to create the template.")
    const templateId = header.data.a365_payrolltemplateid

    let lineCount = 0
    for (const e of entries) {
      if (!e._a365_employee_value) continue
      const line = await dataClient.createRecordAsync<Record<string, unknown>, PayrollTemplateLineRow>(
        PAYROLL_TEMPLATE_LINE_TABLE,
        {
          a365_name: e.a365_name ?? name,
          "a365_Template@odata.bind": `/${PAYROLL_TEMPLATE_TABLE}(${templateId})`,
          "a365_Employee@odata.bind": `/a365_employees(${e._a365_employee_value})`,
          a365_basicpay: e.a365_basicpay ?? 0,
          a365_allowances: e.a365_allowances ?? 0,
          a365_otherearnings: e.a365_otherearnings ?? 0,
          a365_otherdeductions: e.a365_otherdeductions ?? 0,
          a365_unpaidleavedays: e.a365_unpaidleavedays ?? 0,
          a365_withholdingtax: e.a365_withholdingtax ?? 0,
          a365_comment: e.a365_comment ?? null,
        },
      )
      if (!line.success) throw line.error ?? new Error("Unable to save a template line.")
      lineCount++
    }
    return { templateId, lineCount }
  },

  async applyTemplateToPeriod(templateId: string, periodId: string) {
    const [lines, active, existing, template] = await Promise.all([
      payrollTemplateService.getTemplateLines(templateId),
      employeeService.list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` }),
      payrollPeriodService.listEntries(periodId),
      dataClient.retrieveRecordAsync<PayrollTemplate>(PAYROLL_TEMPLATE_TABLE, templateId, {
        select: ["a365_name"],
      }),
    ])
    const period = await payrollPeriodService.getPeriod(periodId)
    const sourceByEmployee = new Map<string, CopiedInputs>()
    for (const l of lines) sourceByEmployee.set(l.employeeId, l.inputs)

    const plan = planApplyInputs(sourceByEmployee, existing, active, {
      id: periodId,
      name: period.a365_name,
    })
    for (const { entryId, inputs } of plan.updates) {
      const res = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollEntry>(
        PAYROLL_ENTRY_TABLE,
        entryId,
        {
          a365_basicpay: inputs.basicPay,
          a365_allowances: inputs.allowances,
          a365_otherearnings: inputs.otherEarnings,
          a365_otherdeductions: inputs.otherDeductions,
          a365_unpaidleavedays: inputs.unpaidLeaveDays,
          a365_withholdingtax: inputs.withholdingTax,
          a365_comment: inputs.comment || null,
        },
      )
      if (!res.success) throw res.error ?? new Error("Unable to update payroll entry from template.")
    }
    const created = await payrollPeriodService.createEntriesFromPlans(periodId, plan.creates)
    return {
      created,
      updated: plan.updates.length,
      skipped: plan.skipped,
      templateName: template.success ? template.data.a365_name : "",
    }
  },

  async renameTemplate(id: string, values: { name: string; description: string | null }) {
    const res = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollTemplate>(
      PAYROLL_TEMPLATE_TABLE,
      id,
      { a365_name: values.name, a365_description: values.description || null },
    )
    if (!res.success) throw res.error ?? new Error("Unable to rename the template.")
  },

  async deleteTemplate(id: string) {
    const res = await dataClient.deleteRecordAsync(PAYROLL_TEMPLATE_TABLE, id)
    if (!res.success) throw res.error ?? new Error("Unable to delete the template.")
  },
}
```

- [ ] **Step 5: Expose `createEntriesFromPlans` from the period service.** In `payroll-period-service.ts`, the module-private `createPlannedEntries(periodId, plans)` must be reusable by the template service. Add a method on `payrollPeriodService` that delegates to it:

```ts
  // inside the payrollPeriodService object:
  async createEntriesFromPlans(periodId: string, plans: NewEntryPlan[]): Promise<number> {
    return createPlannedEntries(periodId, plans)
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/payroll/services/payroll-template-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/payroll/services/payroll-template-service.ts src/features/payroll/services/payroll-template-service.test.ts src/features/payroll/types.ts src/features/payroll/services/payroll-period-service.ts
git commit -m "feat(payroll): add payroll template service (save/apply/list/rename/delete)"
```

---

## Task 6: Query & mutation hooks

**Files:**
- Create: `src/features/payroll/hooks/use-payroll-templates.ts`

**Interfaces:**
- Consumes: `payrollTemplateService`, `payrollKeys`, `calculatePeriod`.
- Produces: `useTemplates()`, `useTemplateLines(id)`, `useSaveTemplate(periodId)`, `useRenameTemplate()`, `useDeleteTemplate()`, `useApplyTemplate(periodId)`.

- [ ] **Step 1: Inspect existing hook patterns.** Read `src/features/payroll/hooks/use-payroll-entries.ts` for `payrollKeys`, `calculatePeriod` import, and the invalidation style.

- [ ] **Step 2: Implement the hooks:**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollTemplateService } from "../services/payroll-template-service"
import { calculatePeriod } from "../services/payroll-service"
import { payrollKeys } from "./use-payroll-entries" // export payrollKeys there if not already

export const templateKeys = {
  all: ["payroll-templates"] as const,
  lines: (id: string) => ["payroll-templates", id, "lines"] as const,
}

export function useTemplates() {
  return useQuery({ queryKey: templateKeys.all, queryFn: () => payrollTemplateService.listTemplates() })
}

export function useTemplateLines(id: string) {
  return useQuery({ queryKey: templateKeys.lines(id), queryFn: () => payrollTemplateService.getTemplateLines(id), enabled: !!id })
}

export function useSaveTemplate(periodId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string | null }) =>
      payrollTemplateService.saveTemplateFromPeriod(periodId, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useRenameTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string | null }) =>
      payrollTemplateService.renameTemplate(id, { name, description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => payrollTemplateService.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useApplyTemplate(periodId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, periodEndDate, calculatedByUserId }: {
      templateId: string; periodEndDate: string; calculatedByUserId: string
    }) => {
      const result = await payrollTemplateService.applyTemplateToPeriod(templateId, periodId)
      if (result.created > 0 || result.updated > 0) {
        await calculatePeriod(periodId, periodEndDate, calculatedByUserId)
      }
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}
```

- [ ] **Step 3: Ensure `payrollKeys` is exported** from `use-payroll-entries.ts` (add `export` if it is currently local). Run: `npm run build`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/hooks/use-payroll-templates.ts src/features/payroll/hooks/use-payroll-entries.ts
git commit -m "feat(payroll): add template query and mutation hooks"
```

---

## Task 7: Templates management page + route + nav

**Files:**
- Create: `src/pages/payroll-templates.tsx`
- Modify: `src/router.tsx`
- Modify: `src/pages/_layout.tsx`

**Interfaces:**
- Consumes: `useTemplates`, `useRenameTemplate`, `useDeleteTemplate`, `useTemplateLines`, `AdminOnly`, `formatCurrency`.

- [ ] **Step 1: Add the route** in `router.tsx` (after the `payroll/:periodId` line):

```tsx
import PayrollTemplatesPage from "@/pages/payroll-templates"
// ...
{ path: "payroll/templates", element: <AdminOnly><PayrollTemplatesPage /></AdminOnly> },
```
**Note:** place `payroll/templates` **before** `payroll/:periodId` is not required (static beats param in React Router data router), but keep it adjacent for clarity.

- [ ] **Step 2: Add the sidebar link** in `_layout.tsx` under the PAYROLL group (mirror the existing "Payroll Periods" link; use a Lucide icon such as `LayoutTemplate`).

- [ ] **Step 3: Implement the page.** Read `src/pages/payroll.tsx` first for the page shell (header, loading/empty/error states, TanStack Table usage, toast). Build a list with columns Name, Description, Employees (`lineCount`), Created (`formatDate`), and row actions View / Rename / Delete. Use shadcn `Dialog` for View (render lines from `useTemplateLines`, amounts via `formatCurrency`), Rename (name + description inputs → `useRenameTemplate`), and an `AlertDialog`/confirm `Dialog` for Delete (→ `useDeleteTemplate`, toast on success). Cover Loading (skeleton), Empty ("No templates yet — save one from a Paid or Locked period."), and Error states. Keep business logic in the hooks; the page only renders and calls mutations.

- [ ] **Step 4: Manual + build check.**

Run: `npm run build && npm run lint`
Expected: PASS. Then `pa app run`, sign in as an admin, navigate to Payroll → Templates: the page loads with an empty state.

- [ ] **Step 5: Commit**

```bash
git add src/pages/payroll-templates.tsx src/router.tsx src/pages/_layout.tsx
git commit -m "feat(payroll): add payroll cutoff templates management page"
```

---

## Task 8: Save-as-template action on the period page

**Files:**
- Modify: `src/pages/payroll-period.tsx`

**Interfaces:**
- Consumes: `useSaveTemplate(periodId)`, `PayrollStatus`, existing dialog/toast patterns.

- [ ] **Step 1: Add state + handler.** In `payroll-period.tsx`, add `const [confirmSaveTemplateOpen, setConfirmSaveTemplateOpen] = useState(false)`, name/description input state, and `const saveTemplate = useSaveTemplate(periodId)`.

- [ ] **Step 2: Show the button only for Paid/Locked.** The page already computes whether the period is Paid/Locked (search for `PayrollStatus.Paid` around line 131). Add a **"Save as template"** `Button` (Lucide `Save` icon) in the finalized-period action row (near Lock/Unlock/Archive), opening the dialog.

- [ ] **Step 3: Add the dialog** (mirror the existing Copy dialog): title "Save as template", a required Name input and optional Description textarea, Cancel + Save. On submit:

```tsx
saveTemplate.mutate(
  { name: templateName.trim(), description: templateDesc.trim() || null },
  {
    onSuccess: ({ lineCount }) => {
      toast.success(`Template saved with ${lineCount} employee${lineCount === 1 ? "" : "s"}.`)
      setConfirmSaveTemplateOpen(false)
      setTemplateName(""); setTemplateDesc("")
    },
    onError: (err) => toast.error("Unable to save template.", { description: err.message }),
  },
)
```
Disable Save while `saveTemplate.isPending` or the name is empty.

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/payroll-period.tsx
git commit -m "feat(payroll): save a Paid/Locked period as a cutoff template"
```

---

## Task 9: Load-template action on editable periods

**Files:**
- Modify: `src/pages/payroll-period.tsx`

**Interfaces:**
- Consumes: `useTemplates`, `useApplyTemplate(periodId)`, `useCurrentSystemUser` (for `calculatedByUserId`), `isPeriodEditable`, shadcn `Select`.

- [ ] **Step 1: Add state + hooks.** `const [confirmLoadTemplateOpen, setConfirmLoadTemplateOpen] = useState(false)`, `const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")`, `const templates = useTemplates()`, `const applyTemplate = useApplyTemplate(periodId)`. Reuse the existing system-user resolution the copy flow uses (`requireSystemUser()` around line 160).

- [ ] **Step 2: Add the button** next to "Copy previous cutoff" (the editable-period action row, ~line 400), Lucide `LayoutTemplate` icon, label "Load template", opening the dialog. Only rendered when the period is editable (same condition guarding Copy).

- [ ] **Step 3: Add the dialog** with a shadcn `Select` populated from `templates.data` (show name + `lineCount`). Empty state when none. On confirm:

```tsx
const userId = requireSystemUser()
if (!userId || !period.data) return
applyTemplate.mutate(
  { templateId: selectedTemplateId, periodEndDate: period.data.a365_periodend, calculatedByUserId: userId },
  {
    onSuccess: ({ created, updated, skipped, templateName }) => {
      const parts = [`${created} added`, `${updated} updated`]
      if (skipped) parts.push(`${skipped} skipped`)
      toast.success(`Loaded "${templateName}": ${parts.join(", ")} and recalculated.`)
      setConfirmLoadTemplateOpen(false)
      setSelectedTemplateId("")
    },
    onError: (err) => toast.error("Unable to load template.", { description: err.message }),
  },
)
```
Disable Confirm while pending or when `selectedTemplateId` is empty.

- [ ] **Step 4: Build + lint + full test run**

Run: `npm run build && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/payroll-period.tsx
git commit -m "feat(payroll): load a cutoff template into an editable period"
```

---

## Task 10: Docs, solution export, and final verification

**Files:**
- Modify: `docs/architecture.md`, `docs/data-model.md` (if not fully done in Task 1)
- Modify: `solution/` (exported Dataverse solution)

- [ ] **Step 1: Update `docs/architecture.md`** — note `payroll-template-service.ts`, the template hooks, and the `payroll-templates` page under `features/payroll/`.

- [ ] **Step 2: Confirm `docs/data-model.md`** has both template tables with the **verified** logical/entity-set/lookup names from Task 1.

- [ ] **Step 3: Export + unpack the solution** so the new tables travel with source control (same process used for prior phases; see `docs/deployment.md`).

- [ ] **Step 4: Full verification.**

Run: `npm test && npm run lint && npm run build`
Expected: all PASS. Then `pa app run` and walk the flow end-to-end: save a template from a Paid period → it appears on the Templates page → create a Draft period → Load template → entries populate and recalc → rename and delete the template.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture.md docs/data-model.md solution
git commit -m "docs(payroll): record template tables + services; export solution"
```

---

## Self-Review Notes

- **Spec coverage:** §3 data model → Task 1 + Task 5 types; §4 services → Tasks 4–5; hooks → Task 6; §5 UI (page/save/load) → Tasks 7–9; §6 comment field → Task 2; §7 security → Task 1 (privileges) + AdminOnly in Task 7; §8 testing → Tasks 2,3,5 (+ manual walk in 9–10); §9 creation/docs → Tasks 1,10. All sections mapped.
- **Type consistency:** `CopiedInputs` (with `comment`) is defined in Task 2 and consumed in Tasks 3–5; `planApplyInputs`/`ApplyInputsPlan`/`EntryInputUpdate` defined in Task 3, used in Tasks 4–5; `createEntriesFromPlans` added in Task 5 Step 5 and called by the template service; `payrollKeys` exported in Task 6. Entity-set/logical names are flagged **VERIFY** pending Task 1.
- **Open verification:** the exact entity-set names (`a365_payrolltemplates`/`a365_payrolltemplatelines`), primary-id names, and lookup navigation properties (`a365_Template`, `a365_Employee`) must be confirmed in Task 1 and reconciled in `types.ts` before Task 5 compiles.
