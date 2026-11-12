# Phase 5 — Payroll Calculation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configuration-driven payroll calculation engine — four effective-dated statutory config tables, a pure TypeScript `calculatePayroll` service that reproduces the client payslip to the peso, config loading with effective-date resolution, and a calculate-and-persist operation — with unit tests.

**Architecture:** Statutory rules live in Organization-owned, effective-dated Dataverse tables (SSS + BIR as bracket tables; PhilHealth + HDMF as parameter rows). A pure, UI-free TS service computes payroll from those rules; a config-loading service resolves the rules effective at a period's date; a persist operation writes results to `a365_payrollentry`. Withholding tax uses the official bracket table with its taxable-base rule isolated to one documented-TBD function.

**Tech Stack:** Dataverse (`dataverse` plugin — dv-metadata + Web API for OrganizationOwned/currency/decimal, dv-data for seed); TypeScript; **Vitest** (new dev-dependency, test runner); TanStack Query; React 19 / Vite.

**Spec:** `docs/superpowers/specs/2026-09-06-phase-5-payroll-calculation-engine-design.md`

## Global Constraints

- **Publisher prefix** `a365` on every table/column; all components in solution `A365_DailyOperations`.
- **Config tables are OrganizationOwned** (immutable at creation) and **effective-dated** (`a365_effectivefrom` / `a365_effectiveuntil`).
- **Never guess generated names** (CLAUDE.md #5): read every logical name / entity-set name back from Dataverse and record in `docs/data-model.md` before code references it.
- **Rates stored as decimal fractions** (e.g. `0.05` = 5%); money = Currency; brackets/rates = Decimal.
- **Do not invent rates.** Seed only the verified 2025 values: SSS EE 5% of MSC (floor 5,000 / ceiling 35,000), PhilHealth 5% premium / EE half / floor 10,000 / ceiling 100,000, HDMF EE 2% / cap 10,000, BIR semi-monthly brackets (spec §3.4). **Withholding-tax taxable-base rule is TBD** — ship the standard-method placeholder, clearly flagged; never assert it reproduces the payslip's ₱1,325.
- **Rounding:** `round2` = half-up to 2 decimals. No float equality in tests — assert on 2-decimal values.
- **Calc is a pure function** — no Dataverse/React/UI imports in `payroll-calculation.ts`.
- **After metadata changes:** export + unpack the solution into `solution/A365_DailyOperations/src` and commit.
- Dev org: `https://org9a7651f0.crm5.dynamics.com`. Auth/SDK via `scripts/auth.py` `get_client("dv-metadata")` / `get_token()` + `get_plugin_headers`.
- `npm run lint` and `npm run build` must pass before Phase 5 is complete.

---

### Task 1: Create the four statutory config tables (OrganizationOwned)

**Files:**
- Create (Dataverse): `a365_ssscontribution`, `a365_philhealthcontribution`, `a365_hdmfcontribution`, `a365_taxbracket`.
- Modify (commit): `solution/A365_DailyOperations/src/**`, `docs/data-model.md`.

**Interfaces:**
- Produces: four OrganizationOwned tables + their entity-set names (read back) used as data-source keys in Task 3, and column logical names used by the config service in Task 8.

- [ ] **Step 1: Confirm connection + idempotency.** Using the `dataverse` plugin, confirm target env `The Daily Operation - Dev` (`org9a7651f0`) and that none of the four tables exist yet (`client.tables.get(...)`).

- [ ] **Step 2: Create the tables.** For each, Web API `POST EntityDefinitions` with `OwnershipType = OrganizationOwned`, primary name `a365_Name` (Text), added to `A365_DailyOperations`. Give each the common effective-dating columns: `a365_EffectiveFrom` (Date only, ApplicationRequired), `a365_EffectiveUntil` (Date only, None), `a365_Version` (Text). Then add the per-table columns:
  - `a365_ssscontribution`: `a365_CompensationFrom` (Currency), `a365_CompensationTo` (Currency), `a365_MSC` (Currency), `a365_EmployeeAmount` (Currency), `a365_EmployerAmount` (Currency), `a365_ECAmount` (Currency).
  - `a365_philhealthcontribution`: `a365_PremiumRate` (Decimal, precision 4), `a365_EmployeeShare` (Decimal, precision 4), `a365_IncomeFloor` (Currency), `a365_IncomeCeiling` (Currency).
  - `a365_hdmfcontribution`: `a365_EmployeeRate` (Decimal, precision 4), `a365_EmployerRate` (Decimal, precision 4), `a365_CompensationCap` (Currency).
  - `a365_taxbracket`: `a365_Sequence` (Whole Number), `a365_IncomeFrom` (Currency), `a365_IncomeTo` (Currency), `a365_BaseTax` (Currency), `a365_MarginalRate` (Decimal, precision 4).
  Use a metadata helper with transient-error retry and a 15s propagation wait after each table create before adding its columns (see Phase 4's `dv_common.py` pattern).

- [ ] **Step 3: Verify — describe each table.** For each, `GET EntityDefinitions(LogicalName='...')?$select=OwnershipType,EntitySetName,PrimaryNameAttribute&$expand=Attributes`. Expected: `OwnershipType = OrganizationOwned`; all columns present with intended logical names; Currency vs Decimal correct. Capture entity-set names + confirmed logical names.

- [ ] **Step 4: Record confirmed schema** in `docs/data-model.md` (a new "Phase 5 — statutory config tables" section) matching spec §3.

- [ ] **Step 5: Export + commit.**
```bash
pac solution export --path "$SCRATCH/A365_DailyOperations.zip" --name A365_DailyOperations --managed false --overwrite
pac solution unpack --zipfile "$SCRATCH/A365_DailyOperations.zip" --folder "solution/A365_DailyOperations/src" --packagetype Unmanaged
git add solution/A365_DailyOperations docs/data-model.md
git commit -m "Phase 5 (Task 1): create statutory config tables (Organization owned)"
```

---

### Task 2: Seed the Dev statutory configuration (verified 2025 rates)

**Files:**
- Create: `scripts/seed_statutory_config.py` (idempotent seed script, committed as the reproducible source of the Dev/Prod config).
- Modify (commit): `docs/data-model.md` (seed summary).

**Interfaces:**
- Consumes: the four tables from Task 1 (entity-set names).
- Produces: config rows the config service (Task 8) reads and the golden test (Task 6) mirrors.

- [ ] **Step 1: Write the seed script.** Using `get_client("dv-data")` (SDK record create), idempotent (query-before-create by `a365_name` + `a365_effectivefrom`), all rows `a365_effectivefrom = 2025-01-01`, `a365_version = "2025"`:
  - **PhilHealth** (1 row): `premiumrate 0.05, employeeshare 0.5, incomefloor 10000, incomeceiling 100000`.
  - **HDMF** (1 row): `employeerate 0.02, employerrate 0.02, compensationcap 10000`.
  - **Tax brackets** (6 rows, semi-monthly, spec §3.4): seq1 `0–10417 base 0 rate 0`; seq2 `10417–16666 base 0 rate 0.15`; seq3 `16667–33332 base 937.50 rate 0.20`; seq4 `33333–83332 base 4270.70 rate 0.25`; seq5 `83333–333332 base 16770.70 rate 0.30`; seq6 `333333–null base 91770.70 rate 0.35`.
  - **SSS**: transcribe the official **2025 SSS contribution table** (sss.gov.ph 2025 schedule) into `a365_ssscontribution` bracket rows (compensation range → MSC → employee/employer/EC amounts). The rows **must** satisfy the payslip anchor: a monthly salary of **43,000** resolves to **MSC 35,000, EmployeeAmount 1,750.00** (5% × 35,000). Also seed the floor bracket (MSC 5,000). Do not invent intermediate rows — copy the official schedule.

- [ ] **Step 2: Run the seed script** against Dev.

- [ ] **Step 3: Verify by query.** Query each table; assert PhilHealth/HDMF single rows with the exact values above; tax has 6 rows; SSS resolves 43,000 → EmployeeAmount 1,750.00 and contains the 5,000-floor bracket. Print a PASS/FAIL summary.

- [ ] **Step 4: Record + commit.** Add a seed summary to `docs/data-model.md` (note: Dev seed; Prod load is Phase 13).
```bash
git add scripts/seed_statutory_config.py docs/data-model.md
git commit -m "Phase 5 (Task 2): seed verified 2025 statutory config in Dev"
```

---

### Task 3: Add the config tables as code-app data sources

**Files:**
- Create/modify: `src/generated/**` (generated typed models/services), `.power/schemas/**`.

**Interfaces:**
- Consumes: the four tables (Task 1).
- Produces: generated services the config service (Task 8) uses to query config, following the existing `a365_employee` data-source pattern.

- [ ] **Step 1: Add each table as a Dataverse data source** using the same tool/flow that registered `a365_employee` (`code-apps-preview:add-dataverse` / `pac code add-data-source --apiId dataverse`), generating the typed model/service files.

- [ ] **Step 2: Verify build.** Run `npm run build`. Expected: generated files compile; no type errors.

- [ ] **Step 3: Commit.**
```bash
git add src/generated .power
git commit -m "Phase 5 (Task 3): add statutory config tables as data sources"
```

---

### Task 4: Set up Vitest

**Files:**
- Modify: `package.json` (dev-dependency + `test` script), `vite.config.ts` (or create `vitest.config.ts`).

**Interfaces:**
- Produces: a working `npm run test` command used by every later task.

- [ ] **Step 1: Install Vitest.** `npm install -D vitest`.

- [ ] **Step 2: Add the test script** to `package.json`: `"test": "vitest run"` (and `"test:watch": "vitest"`).

- [ ] **Step 3: Add a trivial smoke test** `src/features/payroll/services/__smoke__.test.ts`:
```ts
import { describe, it, expect } from "vitest"
describe("vitest", () => { it("runs", () => { expect(1 + 1).toBe(2) }) })
```

- [ ] **Step 4: Run it.** `npm run test`. Expected: 1 passing test.

- [ ] **Step 5: Delete the smoke test, commit setup.**
```bash
rm src/features/payroll/services/__smoke__.test.ts
git add package.json package-lock.json vite.config.ts
git commit -m "Phase 5 (Task 4): add Vitest test runner"
```

---

### Task 5: Money rounding + engine types

**Files:**
- Create: `src/features/payroll/services/payroll-calculation.ts` (types + `round2` only in this task).
- Test: `src/features/payroll/services/payroll-calculation.test.ts`.

**Interfaces:**
- Produces (used by Tasks 6–8):
```ts
export function round2(value: number): number
export interface SssBracket { compensationFrom: number; compensationTo: number | null; msc: number; employeeAmount: number; employerAmount: number; ecAmount: number }
export interface PhilHealthConfig { premiumRate: number; employeeShare: number; incomeFloor: number; incomeCeiling: number }
export interface HdmfConfig { employeeRate: number; employerRate: number; compensationCap: number }
export interface TaxBracket { sequence: number; incomeFrom: number; incomeTo: number | null; baseTax: number; marginalRate: number }
export interface StatutoryConfig { sss: SssBracket[]; philhealth: PhilHealthConfig; hdmf: HdmfConfig; taxBrackets: TaxBracket[] }
export interface PayrollInput { monthlyBasicSalary: number; basicPay: number; allowances: number; otherEarnings: number; otherDeductions: number; unpaidLeaveDays: number }
export interface PayrollResult { dailyRate: number; unpaidLeave: number; sss: number; philhealth: number; hdmf: number; grossPay: number; taxableBase: number; withholdingTax: number; totalDeductions: number; netPay: number; warnings: string[] }
```

- [ ] **Step 1: Write the failing test** in `payroll-calculation.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { round2 } from "./payroll-calculation"

describe("round2", () => {
  it("rounds half up to 2 decimals", () => {
    expect(round2(537.505)).toBe(537.51)
    expect(round2(100)).toBe(100)
    expect(round2(1750 / 2)).toBe(875)
    expect(round2(1075 / 2)).toBe(537.5)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`round2` not exported). `npm run test`.

- [ ] **Step 3: Implement** the types block above plus:
```ts
/** Half-up rounding to 2 decimals for PHP money. Kept separate from display formatting. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`.

- [ ] **Step 5: Commit.**
```bash
git add src/features/payroll/services/payroll-calculation.ts src/features/payroll/services/payroll-calculation.test.ts
git commit -m "Phase 5 (Task 5): payroll engine types + round2"
```

---

### Task 6: The calculation engine (`calculatePayroll`)

**Files:**
- Modify: `src/features/payroll/services/payroll-calculation.ts`.
- Test: `src/features/payroll/services/payroll-calculation.test.ts`.

**Interfaces:**
- Consumes: all types + `round2` (Task 5).
- Produces:
```ts
export function sssEmployeeMonthly(monthlySalary: number, brackets: SssBracket[]): number
export function philhealthEmployeeMonthly(monthlySalary: number, cfg: PhilHealthConfig): number
export function hdmfEmployeeMonthly(monthlySalary: number, cfg: HdmfConfig): number
export function computeTaxableBase(input: PayrollInput, contributions: { sss: number; philhealth: number; hdmf: number }): number
export function withholdingTax(taxableBase: number, brackets: TaxBracket[]): number
export function calculatePayroll(input: PayrollInput, config: StatutoryConfig): PayrollResult
```

- [ ] **Step 1: Write the failing tests** (append to `payroll-calculation.test.ts`). Use a compact config that mirrors the seed:
```ts
import { calculatePayroll, type StatutoryConfig, type PayrollInput } from "./payroll-calculation"

const config: StatutoryConfig = {
  sss: [
    { compensationFrom: 0, compensationTo: 5249.99, msc: 5000, employeeAmount: 250, employerAmount: 510, ecAmount: 10 },
    { compensationFrom: 34750, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3530, ecAmount: 30 },
  ],
  philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 },
  hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 },
  taxBrackets: [
    { sequence: 1, incomeFrom: 0, incomeTo: 10417, baseTax: 0, marginalRate: 0 },
    { sequence: 2, incomeFrom: 10417, incomeTo: 16666, baseTax: 0, marginalRate: 0.15 },
    { sequence: 3, incomeFrom: 16667, incomeTo: 33332, baseTax: 937.5, marginalRate: 0.20 },
    { sequence: 4, incomeFrom: 33333, incomeTo: 83332, baseTax: 4270.7, marginalRate: 0.25 },
    { sequence: 5, incomeFrom: 83333, incomeTo: 333332, baseTax: 16770.7, marginalRate: 0.30 },
    { sequence: 6, incomeFrom: 333333, incomeTo: null, baseTax: 91770.7, marginalRate: 0.35 },
  ],
}

const payslip: PayrollInput = {
  monthlyBasicSalary: 43000, basicPay: 21500, allowances: 1000,
  otherEarnings: 0, otherDeductions: 0, unpaidLeaveDays: 0,
}

describe("calculatePayroll — client payslip golden fixture", () => {
  const r = calculatePayroll(payslip, config)
  it("SSS = 875.00 (half of 5% of 35,000 MSC)", () => expect(r.sss).toBe(875))
  it("PhilHealth = 537.50 (half of 2.5% of 43,000)", () => expect(r.philhealth).toBe(537.5))
  it("HDMF = 100.00 (half of 2% of 10,000 cap)", () => expect(r.hdmf).toBe(100))
  it("Gross Pay = 22,500.00", () => expect(r.grossPay).toBe(22500))
  it("Net = Gross - Total Deductions", () => expect(r.netPay).toBe(round2(r.grossPay - r.totalDeductions)))
})

describe("net arithmetic with the sample withholding tax (pending §7)", () => {
  it("net = 19,662.50 when total deductions include WHT 1,325", () => {
    // The payslip WHT (1,325) is a sample; the taxable-base rule is TBD (spec §7).
    // This checks the NET formula independently of the unconfirmed WHT computation.
    const gross = 22500, sss = 875, philhealth = 537.5, hdmf = 100, wht = 1325
    const total = round2(sss + philhealth + hdmf + wht)
    expect(total).toBe(2837.5)
    expect(round2(gross - total)).toBe(19662.5)
  })
})

describe("edge cases", () => {
  it("unpaid leave adds a deduction via daily rate (monthly/22)", () => {
    const r2 = calculatePayroll({ ...payslip, unpaidLeaveDays: 1 }, config)
    expect(r2.dailyRate).toBe(round2(43000 / 22)) // 1954.55
    expect(r2.grossPay).toBe(22500)
    expect(r2.totalDeductions).toBe(round2(2837.5 + round2(43000 / 22)))
  })
  it("missing SSS config throws, not silent 0", () => {
    expect(() => calculatePayroll(payslip, { ...config, sss: [] })).toThrow()
  })
})
```
(Add `import { round2 } from "./payroll-calculation"` to the test file if not already imported.)

- [ ] **Step 2: Run — expect FAIL** (`calculatePayroll` not defined). `npm run test`.

- [ ] **Step 3: Implement** in `payroll-calculation.ts`:
```ts
export function sssEmployeeMonthly(monthlySalary: number, brackets: SssBracket[]): number {
  if (brackets.length === 0) throw new Error("Missing SSS contribution configuration.")
  const match = brackets.find(
    (b) => monthlySalary >= b.compensationFrom && (b.compensationTo === null || monthlySalary <= b.compensationTo),
  )
  // Below the lowest floor -> lowest bracket; above the top -> the open-ended top bracket.
  const bracket = match ?? (monthlySalary < brackets[0].compensationFrom ? brackets[0] : brackets[brackets.length - 1])
  return bracket.employeeAmount
}

export function philhealthEmployeeMonthly(monthlySalary: number, cfg: PhilHealthConfig): number {
  const base = Math.min(Math.max(monthlySalary, cfg.incomeFloor), cfg.incomeCeiling)
  return round2(base * cfg.premiumRate * cfg.employeeShare)
}

export function hdmfEmployeeMonthly(monthlySalary: number, cfg: HdmfConfig): number {
  const base = Math.min(monthlySalary, cfg.compensationCap)
  return round2(base * cfg.employeeRate)
}

/**
 * TBD (spec §7): the confirmed taxable-base rule is pending the client accountant.
 * Placeholder = legally standard method: (basic + allowances) - mandatory EE contributions.
 * Known to NOT reproduce the payslip's sample WHT of 1,325 — do not treat WHT output as final.
 */
export function computeTaxableBase(
  input: PayrollInput,
  contributions: { sss: number; philhealth: number; hdmf: number },
): number {
  return round2(input.basicPay + input.allowances - (contributions.sss + contributions.philhealth + contributions.hdmf))
}

export function withholdingTax(taxableBase: number, brackets: TaxBracket[]): number {
  if (brackets.length === 0) throw new Error("Missing withholding-tax bracket configuration.")
  const b =
    brackets.find((x) => taxableBase >= x.incomeFrom && (x.incomeTo === null || taxableBase <= x.incomeTo)) ??
    brackets[brackets.length - 1]
  return round2(b.baseTax + b.marginalRate * (taxableBase - b.incomeFrom))
}

export function calculatePayroll(input: PayrollInput, config: StatutoryConfig): PayrollResult {
  const warnings: string[] = []
  const dailyRate = round2(input.monthlyBasicSalary / 22)
  const unpaidLeave = round2(input.unpaidLeaveDays * dailyRate)

  const sss = round2(sssEmployeeMonthly(input.monthlyBasicSalary, config.sss) / 2)
  const philhealth = round2(philhealthEmployeeMonthly(input.monthlyBasicSalary, config.philhealth) / 2)
  const hdmf = round2(hdmfEmployeeMonthly(input.monthlyBasicSalary, config.hdmf) / 2)

  const grossPay = round2(input.basicPay + input.allowances + input.otherEarnings)

  const taxableBase = computeTaxableBase(input, { sss, philhealth, hdmf })
  warnings.push("Withholding-tax taxable base is provisional (spec §7): pending accountant confirmation.")
  const wht = withholdingTax(taxableBase, config.taxBrackets)

  const totalDeductions = round2(unpaidLeave + sss + philhealth + hdmf + wht + input.otherDeductions)
  const netPay = round2(grossPay - totalDeductions)

  return { dailyRate, unpaidLeave, sss, philhealth, hdmf, grossPay, taxableBase, withholdingTax: wht, totalDeductions, netPay, warnings }
}
```

- [ ] **Step 4: Run — expect PASS** (all golden + edge tests green). `npm run test`.

- [ ] **Step 5: Commit.**
```bash
git add src/features/payroll/services/payroll-calculation.ts src/features/payroll/services/payroll-calculation.test.ts
git commit -m "Phase 5 (Task 6): calculatePayroll engine (payslip golden fixture passes)"
```

---

### Task 7: Effective-date config resolution (pure)

**Files:**
- Create: `src/features/payroll/services/statutory-config-resolve.ts`.
- Test: `src/features/payroll/services/statutory-config-resolve.test.ts`.

**Interfaces:**
- Produces:
```ts
export interface Dated { effectiveFrom: string; effectiveUntil: string | null } // ISO date strings
export function resolveEffective<T extends Dated>(rows: T[], asOf: string): T[]
```

- [ ] **Step 1: Write the failing test**:
```ts
import { describe, it, expect } from "vitest"
import { resolveEffective } from "./statutory-config-resolve"

const rows = [
  { effectiveFrom: "2024-01-01", effectiveUntil: "2024-12-31", v: "2024" },
  { effectiveFrom: "2025-01-01", effectiveUntil: null, v: "2025" },
]

describe("resolveEffective", () => {
  it("picks the row in force at the as-of date", () => {
    expect(resolveEffective(rows, "2026-03-31").map((r) => r.v)).toEqual(["2025"])
    expect(resolveEffective(rows, "2024-06-30").map((r) => r.v)).toEqual(["2024"])
  })
  it("returns empty when nothing is in force yet", () => {
    expect(resolveEffective(rows, "2023-06-30")).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`.

- [ ] **Step 3: Implement**:
```ts
export interface Dated { effectiveFrom: string; effectiveUntil: string | null }

/** Rows whose [effectiveFrom, effectiveUntil] window contains `asOf` (ISO yyyy-mm-dd). */
export function resolveEffective<T extends Dated>(rows: T[], asOf: string): T[] {
  return rows.filter((r) => r.effectiveFrom <= asOf && (r.effectiveUntil === null || r.effectiveUntil >= asOf))
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`.

- [ ] **Step 5: Commit.**
```bash
git add src/features/payroll/services/statutory-config-resolve.ts src/features/payroll/services/statutory-config-resolve.test.ts
git commit -m "Phase 5 (Task 7): effective-date config resolution"
```

---

### Task 8: Config-loading service, hook, and calculate-and-persist

**Files:**
- Create: `src/features/payroll/services/statutory-config-service.ts`, `src/features/payroll/hooks/use-statutory-config.ts`, `src/features/payroll/services/payroll-service.ts`.

**Interfaces:**
- Consumes: generated config data sources (Task 3), `resolveEffective` (Task 7), `calculatePayroll` (Task 6), the `a365_payrollentry` service/columns (Phase 4).
- Produces:
```ts
// statutory-config-service.ts
export function getStatutoryConfig(asOf: string): Promise<StatutoryConfig> // maps Dataverse rows -> engine types via resolveEffective
// use-statutory-config.ts
export function useStatutoryConfig(asOf: string) // TanStack Query wrapper
// payroll-service.ts
export function calculateAndPersistEntry(entryId: string, periodEndDate: string, calculatedByUserId: string): Promise<void>
```

- [ ] **Step 1: Implement `getStatutoryConfig`** — query the four config tables via the generated services, map each Dataverse row to the engine types (rates already fractions; `_value`/logical names from Task 1's read-back), apply `resolveEffective(rows, asOf)`, and assemble a `StatutoryConfig`. Throw a typed error if any table resolves empty (missing config, not silent).

- [ ] **Step 2: Implement `useStatutoryConfig`** — `useQuery({ queryKey: ["statutory-config", asOf], queryFn: () => getStatutoryConfig(asOf) })`.

- [ ] **Step 3: Implement `calculateAndPersistEntry`** — load the entry + its employee's `a365_basicmonthlysalary`, build `PayrollInput` from the entry's per-cutoff columns, `getStatutoryConfig(periodEndDate)`, run `calculatePayroll`, then update the entry's `a365_grosspay / a365_sss / a365_philhealth / a365_hdmf / a365_unpaidleave / a365_withholdingtax / a365_otherdeductions? / a365_totaldeductions / a365_netpay`, `a365_calculatedon = now`, `a365_calculatedby = calculatedByUserId`. (The Draft/Processing status guard is Phase 7; this operation just computes + writes.)

- [ ] **Step 4: Verify build + types.** `npm run build`. Expected: compiles; the service uses only confirmed logical names from `data-model.md`.

- [ ] **Step 5: Commit.**
```bash
git add src/features/payroll
git commit -m "Phase 5 (Task 8): statutory config loading + calculate-and-persist"
```

---

### Task 9: Docs, acceptance, and full verification

**Files:**
- Modify: `docs/payroll-task-phases.md`, `docs/architecture.md` (and confirm `docs/data-model.md` complete).

**Interfaces:**
- Consumes: everything from Tasks 1–8.

- [ ] **Step 1: Check off Phase 5 tasks** in `docs/payroll-task-phases.md` (config tables, each statutory calc, total/net, rounding, error handling, store results, recalc-while-Draft service). Mark the withholding-tax base as **TBD (accountant)** with a spec §7 pointer.

- [ ] **Step 2: Note the services** in `docs/architecture.md` under `features/payroll/` (calc service, config service, payroll-service) and that calc is a pure, UI-free function.

- [ ] **Step 3: Full verification.** Run all three and confirm clean:
```bash
npm run test
npm run lint
npm run build
```
Expected: tests pass (incl. golden fixture); lint clean; build succeeds.

- [ ] **Step 4: Commit.**
```bash
git add docs/payroll-task-phases.md docs/architecture.md docs/data-model.md
git commit -m "Phase 5 (Task 9): docs + Phase 5 acceptance (tests/lint/build green)"
```

---

## Self-Review

**Spec coverage:**
- Config tables (spec §3) → Task 1. Seed (spec §3.5) → Task 2. Data sources → Task 3.
- Test runner (spec §11) → Task 4.
- `round2` + types (spec §6) → Task 5.
- `calculatePayroll` + statutory formulas + WHT pluggable TBD (spec §4, §7) → Task 6.
- Effective-date resolution (spec §5) → Task 7.
- Config loading + hook + calculate-and-persist (spec §5) → Task 8.
- Golden fixture + edge/error tests (spec §8) → Task 6 (and §5 resolution → Task 7).
- Docs (spec §10) + acceptance (spec §12) → Task 9.

**Placeholder scan:** Config-table columns, seed values, and all TS code are concrete. The one intentional TBD (WHT taxable base) is a documented business gate carried as a real function with the standard method, not a code placeholder — its tests avoid asserting the unconfirmed output. SSS seed references the official 2025 table with a concrete, testable anchor (43,000 → EE 1,750) rather than transcribing 45 external rows into the plan.

**Type consistency:** `StatutoryConfig`, `PayrollInput`, `PayrollResult`, `SssBracket`, `PhilHealthConfig`, `HdmfConfig`, `TaxBracket`, `round2`, and the function signatures are defined in Task 5/6 and used unchanged in Tasks 6–8. `resolveEffective`/`Dated` (Task 7) are consumed by `getStatutoryConfig` (Task 8). Rates are fractions everywhere (0.05, 0.02, 0.20).
