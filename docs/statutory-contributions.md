# Statutory Contributions — SSS, PhilHealth, Pag-IBIG (HDMF)

How **The Daily Operation** computes the three mandatory Philippine employee
contributions in payroll, and the official rules they are based on.

> **Scope:** the *employee* share only — what is deducted from the payslip. The
> app also stores employer/EC amounts for reference but does not deduct them from
> net pay. Withholding tax is **not** covered here; it is a manual admin input,
> not computed (see `docs/superpowers/specs/2026-09-06-phase-5-payroll-calculation-engine-design.md` §7).

---

## 1. Where the logic lives

| Concern | File |
|---|---|
| Pure calculation (no Dataverse, no UI) | `src/features/payroll/services/payroll-calculation.ts` |
| Loading the rates from Dataverse, resolved by effective date | `src/features/payroll/services/statutory-config-service.ts` |
| Golden-fixture tests (real client payslip) | `src/features/payroll/services/payroll-calculation.test.ts` |

**Rates are configuration, not code.** Each contribution's brackets/parameters
live in effective-dated Dataverse tables (`a365_ssscontributions`,
`a365_philhealthcontributions`, `a365_hdmfcontributions`) and are resolved for the
**period end date**, so recalculating a historical payroll uses the rules in force
*then*. Nothing below is hardcoded in a React component (CLAUDE.md non-negotiable #7).

---

## 2. The common rule: monthly basis, halved per cutoff

All three contributions are defined **monthly** by the government. This company
pays **semi-monthly** (two cutoffs a month). So the engine:

1. Computes the **full monthly** employee contribution from the employee's
   **monthly basic salary**, then
2. Deducts **half (÷ 2)** on each cutoff.

Unpaid leave / absence is included in **total deductions** — it does **not** change the
statutory contributions, which stay tied to the monthly salary. Every amount is
rounded half-up to 2 decimals via `round2()`.

```ts
// payroll-calculation.ts — calculatePayroll()
const sss        = round2(sssEmployeeMonthly(monthlyBasicSalary, config.sss) / 2)
const philhealth = round2(philhealthEmployeeMonthly(monthlyBasicSalary, config.philhealth) / 2)
const hdmf       = round2(hdmfEmployeeMonthly(monthlyBasicSalary, config.hdmf) / 2)
```

Worked examples below use the client payslip fixture: **monthly basic ₱43,000**.

### Daily and hourly rate

The **daily rate** is derived from the monthly basic salary using a fixed **22
working-days** divisor, and drives the unpaid-leave / absence deduction:

```ts
// payroll-calculation.ts — calculatePayroll()
const dailyRate   = round2(input.monthlyBasicSalary / 22)
const unpaidLeave = round2(input.unpaidLeaveDays * dailyRate)
```

| Rate | Formula | Example (₱43,000) |
|---|---|---|
| Daily rate | monthly basic ÷ **22** | 43,000 ÷ 22 = **₱1,954.55** |
| Hourly rate | daily rate ÷ **8** | 1,954.55 ÷ 8 = **₱244.32** |

The **22-day** divisor is a confirmed client rule (it reconciles to the payslip to
the peso), not a legal statute — change it only with the client's sign-off, and
via config rather than a code edit if it ever varies by employee.

> The engine currently computes and returns **daily rate** only (used for unpaid
> leave). **Hourly rate** is the documented ÷ 8 rule for reference and payslip
> display; add it to `PayrollResult` if a feature needs it — don't recompute it
> inline in a component.

---

## 3. SSS (Social Security System)

**Method:** *bracket lookup.* SSS is not a plain percentage — you find the row
whose compensation range contains the monthly salary and take its **Monthly Salary
Credit (MSC)**. The employee pays a fixed peso **Employee Amount** for that
bracket (5% of the MSC, including the mandatory WISP portion where applicable).

```ts
// payroll-calculation.ts — sssEmployeeMonthly()
// find bracket where salary is in [compensationFrom, compensationTo];
// below the lowest floor -> lowest bracket; above the top -> open-ended top bracket.
return bracket.employeeAmount
```

**2025–2026 rules (unchanged):**

| Parameter | Value |
|---|---|
| Total contribution rate | 15% of MSC (final phase under RA 11199) |
| Employee share | **5%** of MSC |
| Employer share | 10% of MSC (+ EC) |
| MSC floor / ceiling | ₱5,000 / **₱35,000** |

**Worked example (₱43,000):** salary is above the ceiling → top bracket, MSC
₱35,000. Employee monthly = 5% × 35,000 = **₱1,750** → per cutoff **₱875.00**.

**Clamping:** salary below ₱5,000 uses the lowest bracket; salary above ₱35,000
uses the top (open-ended) bracket. There is no extrapolation beyond the ceiling.

---

## 4. PhilHealth

**Method:** *percentage with floor/ceiling clamp.*

```ts
// payroll-calculation.ts — philhealthEmployeeMonthly()
const base = Math.min(Math.max(monthlySalary, incomeFloor), incomeCeiling)
return round2(base * premiumRate * employeeShare)
```

**2025–2026 rules (rate held at 5%):**

| Parameter | Value |
|---|---|
| Premium rate | **5%** of monthly basic salary |
| Employee share | **half** (so effectively 2.5%) |
| Income floor / ceiling | ₱10,000 / ₱100,000 |

**Worked example (₱43,000):** within floor/ceiling, so base = 43,000.
Monthly premium = 5% × 43,000 = ₱2,150; employee half = **₱1,075** → per cutoff
**₱537.50**.

Salaries below ₱10,000 are charged on ₱10,000; above ₱100,000 are capped at
₱100,000 (employee monthly max ₱2,500).

---

## 5. Pag-IBIG (HDMF)

**Method:** *percentage with a compensation cap.*

```ts
// payroll-calculation.ts — hdmfEmployeeMonthly()
const base = Math.min(monthlySalary, compensationCap)
return round2(base * employeeRate)
```

**2025–2026 rules:**

| Parameter | Value |
|---|---|
| Employee rate | **2%** of Monthly Fund Salary |
| Employer rate | 2% |
| Maximum Fund Salary (cap) | ₱10,000 → employee max **₱200/mo** |

**Worked example (₱43,000):** capped at ₱10,000. Monthly = 2% × 10,000 =
**₱200** → per cutoff **₱100.00**.

> **Not modeled (V1):** the lower ₱1,500-and-below tier (1% employee rate). No
> employee earns that little, so the config omits it. Add a lower-rate/threshold
> pair only if such salaries appear. Documented in the Phase 5 design spec §3.3.

---

## 6. Summary table

For monthly basic salary **₱43,000** (client payslip fixture):

| Contribution | Basis | Monthly employee | Per semi-monthly cutoff |
|---|---|---|---|
| SSS | top MSC bracket (₱35,000) × 5% | ₱1,750.00 | **₱875.00** |
| PhilHealth | ₱43,000 × 5% × ½ | ₱1,075.00 | **₱537.50** |
| Pag-IBIG (HDMF) | ₱10,000 cap × 2% | ₱200.00 | **₱100.00** |

These exact values are asserted as a regression test in
`payroll-calculation.test.ts`.

---

## 7. Official references

Verify against the primary government source when rates change; the config tables
are effective-dated so new rates are added as new rows, never edited in place.

**SSS**
- 2025/2026 official contribution table (PDF): <https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf>
- SSS website: <https://www.sss.gov.ph/>
- Legal basis: Republic Act No. 11199 (Social Security Act of 2018) — the 15% rate is the final scheduled phase.
- 2025 increase summary (KPMG): <https://kpmg.com/xx/en/our-insights/gms-flash-alert/flash-alert-2025-026.html>

**PhilHealth**
- Advisory No. 2025-0002 — Premium Contribution for CY 2025 (PDF): <https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf>
- Contribution table (PDF): <https://www.philhealth.gov.ph/partners/employers/ContributionTable_v2.pdf>
- PhilHealth website: <https://www.philhealth.gov.ph/>
- Legal basis: Republic Act No. 11223 (Universal Health Care Act), Section 10.

**Pag-IBIG (HDMF)**
- Pag-IBIG website: <https://www.pagibigfund.gov.ph/>
- Maximum Fund Salary raised to ₱10,000: Pag-IBIG (HDMF) Circular No. 460, effective Feb 2024 — summary: <https://www.forvismazars.com/ph/en/insights/hr-payroll-alerts/pag-ibig-circular-460>
- Legal basis: Republic Act No. 9679 (Home Development Mutual Fund Law of 2009).

> Third-party summaries (Sprout, Triple i, KPMG, Forvis Mazars) are convenience
> references only. The government PDFs and the cited RAs are authoritative.

_Rates verified current for 2025–2026 as of 2026-09-23._
