# Phase 5 — Payroll Calculation Engine (Design Spec)

**Project:** The Daily Operation · **Company:** Automations 365
**Milestone:** 1 — Payroll · **Phase:** 5 — Payroll Calculation Engine
**Date:** 2026-09-06 · **Status:** Approved design, pending implementation plan
**Depends on:** Phase 4 data model (`a365_payrollentry`, `a365_payrollperiod`)

---

## 1. Goal & scope

A **reusable, configuration-driven payroll calculation engine** that computes
statutory deductions, withholding tax, and net pay independently of the UI, and
persists the results to `a365_payrollentry`.

**In scope (Phase 5):**

- Four **effective-dated, Organization-owned** statutory-configuration Dataverse
  tables: `a365_ssscontribution`, `a365_philhealthcontribution`,
  `a365_hdmfcontribution`, `a365_taxbracket`.
- **Seed the Dev config** with the verified 2025 official rates (SSS, PhilHealth,
  HDMF) and the BIR semi-monthly bracket table.
- A **pure TypeScript calculation service** (`features/payroll/services/payroll-calculation.ts`).
- A **config-loading service + TanStack Query hook** that resolves the rules
  effective at a period's date.
- A **calculate-and-persist** service operation that writes results to the entry
  (`a365_grosspay`, each deduction, `a365_totaldeductions`, `a365_netpay`,
  `a365_calculatedon/by`), runnable while the period is editable (Draft/Processing).
- **Unit tests**, including the supplied payslip as a golden regression fixture.

**Out of scope (later phases):**

- Payroll admin UI, the Calculate/Recalculate **button**, load-employees — **Phase 6**.
- Status-transition rules and finalized-payroll immutability enforcement — **Phase 7**.
- Setting security-role privileges on the config tables — the Phase 4/6 security step.
- The **exact withholding-tax taxable-base rule** — a documented **TBD** pending the
  client's accountant (see §7). Config structure and a placeholder method ship now.

---

## 2. Verified business rules (from the client payslip + official 2025 sources)

Ground truth: payslip for **Michael P. Tabilin, Mar 16–31 2026** (a semi-monthly
cutoff), monthly rate ₱43,000, monthly allowance ₱2,000. Every rule below either
reconciles to the payslip to the peso or is an explicit, confirmed decision.

| Rule | Value | Evidence |
|---|---|---|
| Basic pay per cutoff | monthly rate ÷ 2 | 43,000 ÷ 2 = 21,500 ✓ |
| Allowance per cutoff | monthly allowance ÷ 2 | 2,000 ÷ 2 = 1,000 ✓ |
| **Daily rate** | monthly rate ÷ **22** | payslip 43,000 ÷ 22 = 1,954.55 ✓ (confirmed) |
| Hourly rate | daily ÷ 8 | 244.32 ✓ |
| **Statutory timing** | compute on **monthly** salary, deduct **½** each cutoff | confirmed |
| **SSS** | 15% of MSC; **EE 5%**; MSC floor 5,000 / **ceiling 35,000** | 5% × 35,000 = 1,750/mo → 875 ✓ |
| **PhilHealth** | premium **5%**; **EE 2.5%** (half); floor 10,000 / ceiling 100,000 | 2.5% × 43,000 = 1,075/mo → 537.50 ✓ |
| **HDMF/Pag-IBIG** | EE **2%**; comp cap 10,000 → max **200** | 200/mo → 100 ✓ |
| Unpaid leave / absence | reduces **gross earnings**; does **not** change SSS/PhilHealth/HDMF | confirmed (payslip lists Absence on earnings side) |
| Rounding | half-up to 2 decimals, PHP | confirmed |
| Calc location | pure client-side TS service; results stored to Dataverse | confirmed (architecture.md) |
| **Withholding tax** | BIR semi-monthly table (2023→2026, stable); **taxable-base rule TBD** | standard method yields ~1,801 vs payslip 1,325 — see §7 |

Official sources: SSS 2025 (Grant Thornton / sss.gov.ph), PhilHealth 5% 2025
(Sprout), Pag-IBIG 2025 (Triple i), BIR semi-monthly table (RR 11-2018 Annex E).

---

## 3. Statutory configuration tables

All four are **Organization-owned** (global reference data; everyone reads, only
admins write — security-model §3), **effective-dated**, in `A365_DailyOperations`.
Names below are **intended**; verify logical names in Dataverse at creation
(CLAUDE.md #5) and record in `docs/data-model.md`. Currency columns for money;
Decimal for rates (stored as a fraction, e.g. `0.05` = 5%, documented on the column).

Common columns on every config table:

| Display | Logical | Type | Notes |
|---|---|---|---|
| Name | `a365_name` | Text (primary) | Human label for the row/version |
| Effective From | `a365_effectivefrom` | Date only | required |
| Effective Until | `a365_effectiveuntil` | Date only | null = still in force |
| Version | `a365_version` | Text | e.g. "2025" |

### 3.1 `a365_ssscontribution` — bracket table
One row per MSC bracket. Looked up by **monthly** salary.

| Display | Logical | Type |
|---|---|---|
| Compensation From | `a365_compensationfrom` | Currency |
| Compensation To | `a365_compensationto` | Currency (null = open top) |
| Monthly Salary Credit | `a365_msc` | Currency |
| Employee Amount | `a365_employeeamount` | Currency (total EE deduction, incl. WISP) |
| Employer Amount | `a365_employeramount` | Currency |
| EC Amount | `a365_ecamount` | Currency (employer) |

### 3.2 `a365_philhealthcontribution` — parameter row

| Display | Logical | Type |
|---|---|---|
| Premium Rate | `a365_premiumrate` | Decimal (0.05) |
| Employee Share | `a365_employeeshare` | Decimal (0.5) |
| Income Floor | `a365_incomefloor` | Currency (10,000) |
| Income Ceiling | `a365_incomeceiling` | Currency (100,000) |

### 3.3 `a365_hdmfcontribution` — parameter row

| Display | Logical | Type |
|---|---|---|
| Employee Rate | `a365_employeerate` | Decimal (0.02) |
| Employer Rate | `a365_employerrate` | Decimal (0.02) |
| Compensation Cap | `a365_compensationcap` | Currency (10,000) |

> V1 omits the ≤ ₱1,500 → 1% Pag-IBIG lower bracket: no employee earns that little.
> Documented here; add a lower-rate/threshold pair only if such salaries appear.

### 3.4 `a365_taxbracket` — BIR semi-monthly bracket table

| Display | Logical | Type |
|---|---|---|
| Sequence | `a365_sequence` | Whole Number (bracket order) |
| Income From | `a365_incomefrom` | Currency |
| Income To | `a365_incometo` | Currency (null = top) |
| Base Tax | `a365_basetax` | Currency |
| Marginal Rate | `a365_marginalrate` | Decimal (e.g. 0.20) |

> V1 loads the **semi-monthly** table only. Seeded rows (verified):
> ≤10,417 → 0; 10,417–16,666 → 0 + 15%; 16,667–33,332 → 937.50 + 20%;
> 33,333–83,332 → 4,270.70 + 25%; 83,333–333,332 → 16,770.70 + 30%;
> 333,333+ → 91,770.70 + 35%.

### 3.5 Seed data (Dev)
Phase 5 seeds the verified 2025 SSS schedule, the PhilHealth/HDMF parameter rows,
and the BIR bracket rows, all `effectivefrom = 2025-01-01`. Seeding uses the
`dataverse` plugin (dv-data). Production loading is Phase 13.

---

## 4. The calculation service (`payroll-calculation.ts`)

A **pure function** — no Dataverse, no React, no UI. Fully unit-testable.

```ts
calculatePayroll(input: PayrollInput, config: StatutoryConfig): PayrollResult
```

**PayrollInput** (per employee, per cutoff):
- `monthlyBasicSalary` — statutory basis (from the employee record)
- `basicPay`, `allowances`, `otherEarnings` — per-cutoff amounts (from the entry)
- `otherDeductions` — per-cutoff
- `unpaidLeaveDays` — per-cutoff input

**StatutoryConfig:** the resolved SSS brackets, PhilHealth row, HDMF row, tax
brackets (see §5).

**Order of operations:**
1. `dailyRate = round(monthlyBasicSalary / 22)`; `unpaidLeave = round(unpaidLeaveDays * dailyRate)`.
2. Monthly statutory on `monthlyBasicSalary`, then **÷ 2**:
   - `sss = round(sssLookup(monthlyBasicSalary).employeeAmount / 2)`
   - `philhealth = round((clamp(monthlyBasicSalary, floor, ceiling) * premiumRate * employeeShare) / 2)`
   - `hdmf = round((min(monthlyBasicSalary, cap) * employeeRate) / 2)`
3. `grossPay = round(basicPay + allowances + otherEarnings - unpaidLeave)`.
4. `taxableBase = computeTaxableBase(...)` **(TBD rule — §7)**; `withholdingTax = taxLookup(taxableBase)`.
5. `totalDeductions = round(sss + philhealth + hdmf + withholdingTax + otherDeductions)`.
   *(Unpaid leave already reduced gross; it is not double-counted here.)*
6. `netPay = round(grossPay - totalDeductions)`.

**PayrollResult:** `grossPay, sss, philhealth, hdmf, unpaidLeave, withholdingTax,
totalDeductions, netPay` — plus a `warnings[]` array (e.g. missing config).

Missing/incomplete config **throws a typed error** (never silently returns 0).

---

## 5. Config loading & effective-date resolution

`features/payroll/services/statutory-config-service.ts` + a TanStack Query hook
load the four tables and resolve the rows effective at the **period end date**:

```
effectivefrom <= periodEnd AND (effectiveuntil is null OR effectiveuntil >= periodEnd)
```

so recalculating a historical period uses the rules in force then (immutability of
the financial snapshot — CLAUDE.md). The resolved `StatutoryConfig` is passed into
the pure `calculatePayroll`. A `calculateAndPersistEntry(entryId)` operation runs
the calc and writes the results + `a365_calculatedon/by`, allowed only while the
period is editable (Draft/Processing) — the status guard itself is Phase 7.

---

## 6. Money & rounding

A centralized `round2(value)` (half-up, 2 decimals) is applied to each contribution
and to gross/total/net, kept separate from display formatting (`formatCurrency`,
PHP/en-PH). No float equality in tests — assert on rounded 2-decimal values.

---

## 7. Withholding tax — pluggable, taxable-base TBD

The bracket **table** and a `computeWithholdingTax(taxableBase, brackets)` lookup
ship now. The **taxable-base function** is a single documented seam:

```ts
// TBD: confirmed base rule pending client accountant.
// Placeholder (legally standard): taxable = (basicPay + allowances) - (sss + philhealth + hdmf)
function computeTaxableBase(input, contributions): number
```

Known: the standard method yields ~₱1,801.60 for the sample payslip, whereas the
payslip shows ₱1,325.00 — so the placeholder is **flagged as unconfirmed** in code
and spec. When the accountant confirms the base (e.g. allowance taxability,
per-cutoff vs monthly-then-halved, cumulative/annualized), only this one function
changes. No other part of the engine depends on the unresolved rule.

---

## 8. Testing

`payroll-calculation.test.ts` (Vitest — see §11 note):

**Golden fixture (the real payslip):** with monthly 43,000 / allowance-per-cutoff
1,000 / no unpaid leave, assert **SSS 875.00, PhilHealth 537.50, HDMF 100.00,
grossPay 22,500.00**, and — injecting the sample withholding ₱1,325.00 — **netPay
19,662.50**. (The injected WHT is labeled "sample, pending §7"; once the base rule
is confirmed, the test computes WHT from the table instead.)

**Rule/edge cases:** salary below MSC floor and above ceiling (SSS clamps);
PhilHealth floor/ceiling clamping; HDMF cap; unpaid-leave days reduce gross via
daily rate; rounding boundaries; missing config → typed error, not silent 0;
zero/negative guards.

**Effective-date resolution:** a period dated before a rule's `effectivefrom`
resolves the prior version (or errors if none), never the current one.

---

## 9. Creation mechanics & verification

Same as Phase 4: create tables/columns via the `dataverse` plugin (dv-metadata,
Web API for OwnershipType = **OrganizationOwned**, currency/decimal columns), seed
via dv-data, **read every logical name / choice value back** and record in
`docs/data-model.md`, then export + unpack the solution and commit. Ownership is
immutable — confirm **OrganizationOwned** at creation.

---

## 10. Documentation updates (part of this phase)

- `docs/data-model.md` — add the four confirmed config-table schemas + seed summary.
- `docs/payroll-task-phases.md` — check off Phase 5 tasks; note WHT base as TBD.
- `docs/architecture.md` — note the calc + config-loading services under
  `features/payroll/`.

---

## 11. Dependencies note

No new runtime dependency: the calc service is plain TS. Tests need a runner — the
starter has none yet; **Vitest** is the Vite-native choice and is the smallest
coherent add (dev-dependency only). If the team prefers otherwise, swap in the
plan. Flagged per CLAUDE.md dependency rules.

---

## 12. Acceptance criteria

- [ ] Four config tables exist (OrganizationOwned, effective-dated) with the §3 columns.
- [ ] Dev seeded with verified 2025 SSS/PhilHealth/HDMF + BIR semi-monthly brackets.
- [ ] `calculatePayroll` is a pure function reproducing the payslip's SSS/PhilHealth/HDMF/gross exactly.
- [ ] Config loading resolves rules by the period's effective date.
- [ ] `calculateAndPersistEntry` writes results + calc stamps to `a365_payrollentry`.
- [ ] WHT taxable-base is a single documented TBD seam; engine flags the unconfirmed sample gap.
- [ ] Unit tests pass, including the payslip golden fixture; `npm run lint` + `npm run build` clean.
- [ ] Confirmed schema recorded in `docs/data-model.md`; docs updated.
