# Phase 12 — Testing & QA Plan

**Milestone:** Payroll V1  ·  **Scope:** verify calculations, workflow, security, and UX before production.

Each case says **how** it is verified:

- **AUTO** — a Vitest unit/integration test in the repo. Run `npm test`.
- **E2E** — a UI flow driven in the real app. Needs the app running and a signed-in
  user; can be walked with the Playwright Agent CLI (see §3). The maker logs in;
  assertions can then be driven step by step.
- **MANUAL/SECURITY** — a data-layer check that must be done as *real users with real
  Dataverse roles*. Cannot be simulated from the app UI or from unit tests, because the
  boundary is Dataverse security, not the React app (see `docs/security-model.md`).

> Why the split: per CLAUDE.md and the security model, authorization is enforced by
> Dataverse security roles / record ownership, **not** by the UI. So "Employee A cannot
> see Employee B" can only be proven by signing in as those users (or calling the Web API
> as them) — a green unit test or a hidden button proves nothing about the real boundary.

---

## 1. Automated (Vitest) — run `npm test`

| Phase 12 item | Covered by |
|---|---|
| Unit-test payroll calculations | `services/payroll-calculation.test.ts` (golden fixture + edges) |
| SSS scenarios | `payroll-calculation.test.ts` — SSS = 875.00 (top MSC), missing-config throws |
| PhilHealth scenarios | `payroll-calculation.test.ts` — 537.50 |
| HDMF scenarios | `payroll-calculation.test.ts` — 100.00 (cap) |
| Withholding tax scenarios | `payroll-calculation.test.ts` — manual WHT passthrough, zero honored |
| Unpaid leave scenarios | `payroll-calculation.test.ts` — daily rate = monthly/22 reduces gross |
| Allowances | `period-utils.test.ts` (load/copy) + gross in calc |
| Payroll copying | `period-utils.test.ts` — `planCopyEntries` (recurring copied, one-time reset) |
| Payroll locking / transitions | `payroll-status-machine.test.ts` — forward flow, unlock, **illegal jumps rejected** |
| Employee-only access (visibility) | `services/my-payroll.test.ts` — only Paid/Locked; foreign/unlinked dropped |
| Payroll Admin vs Employee nav | `access.test.ts` — `deriveAccess` (role, fallback) |
| Empty / missing payroll data | `period-utils.test.ts` (empty plans) + calc missing-config throw |
| Terminated / inactive employees | `period-utils.test.ts` — inactive excluded from copy/load |
| Payslip document | `payslip-document.test.ts` — amounts, derived rates, filename, signatory |

**Payroll Approver** items in the phase list are **N/A** — V1 has no approver role.
**SharePoint document permissions** are **N/A for now** — document storage is deferred
(Phase 11 generates the PDF on demand; no SharePoint library provisioned).

---

## 2. Security / record-level tests (MANUAL — must be run as real users)

Prerequisites: two Dataverse users — one in **A365 - Payroll Admin**, one in
**A365 - Payroll Employee** linked to an Employee record (Employee A). A second
employee record (Employee B) must exist.

| # | Case | Steps | Expected |
|---|---|---|---|
| S1 | Employee A cannot read Employee B's payroll | Sign in as Employee A. In the browser devtools console (or the Web API), request Employee B's payroll entry: `GET /api/data/v9.2/a365_payrollentries(<B-entry-id>)`. | **403 / no record** — Dataverse denies the read (owner/role scoped). |
| S2 | Employee cannot open another's payslip by URL | As Employee A, open `/my-payroll/<B-entry-id>` directly. | "Payslip not available" — the id isn't in A's visible set, and the record read is denied underneath. |
| S3 | Employee cannot finalize payroll | As Employee A, attempt `PATCH a365_payrollperiods(<id>)` setting `a365_payrollstatus` to Ready/Paid. | **403** — employee lacks write privilege on payroll periods. |
| S4 | Employee cannot mark payroll paid | Same as S3 with Paid. | **403**. |
| S5 | Employee cannot alter payroll via direct request | As Employee A, `PATCH a365_payrollentries(<own or other>)` changing `a365_basicpay`. | **403 / denied** — entries are admin-writable only. |
| S6 | Locked payroll cannot be modified normally | As Admin, on a **Locked** period, attempt to edit an entry via the Web API `PATCH`. | Denied by the `ProtectFinalizedPayroll` plug-in (server-side), not just the UI. |
| S7 | Payroll Admin has intended permissions | As Admin, create period → load employees → edit → calculate → Mark Ready → Paid → Lock. | All succeed. |

> S1–S6 are the **"security testing must include direct record/data access, not only
> hidden buttons"** requirement. A passing result requires the *denial* to come from
> Dataverse, observed while signed in as the low-privilege user.

---

## 3. End-to-end UI flows (E2E — app running + signed in)

Run the app (`pa app run`, or `npm run dev` + the Power Apps host) and sign in. Drive with
the Playwright Agent CLI:

```bash
# start / attach a browser session (maker completes the Entra login)
playwright-cli open <app-url>
# then drive assertions, e.g.
playwright-cli snapshot
playwright-cli find "View Payslip"
playwright-cli click "View Payslip"
```

| # | Flow | Check |
|---|---|---|
| E1 | Admin: create cutoff → load employees → edit inputs → Calculate all | Gross / deductions / net populate; toasts on success. |
| E2 | Admin: Mark Ready → Mark Paid → Lock | Status badge advances; audit trail records who/when; edit controls disappear once finalized. |
| E3 | Admin: **View Payslip** appears only when Ready/Paid/Locked | In Draft/Processing the row shows Edit/Recalculate; after Mark Ready the row shows **View Payslip**, which opens the PDF. |
| E4 | Copy previous cutoff | New period copies Basic Pay + Allowances, resets one-time inputs, recalculates. |
| E5 | Employee portal: My Payroll | Employee sees only their own Paid/Locked payslips and history; opens their payslip PDF. |
| E6 | Payslip PDF content | PDF matches the reference: header/logo, info grid, earnings/deductions, net pay, signatory. |
| E7 | Loading / empty / error states | Empty period shows the empty state; list pagination (10/page) appears past 10 rows. |

---

## 4. UAT sign-off (MANUAL)

Walk a full cutoff end to end with the Payroll Admin, confirm calculated figures against a
known-good payslip, generate payslips, and record findings. Resolve findings, then check the
**Definition of Done — Payroll V1** list at the bottom of `payroll-task-phases.md`.

---

## Run log

### 2026-09-22 — Employee-session E2E (driven via Playwright, signed in as Test User / testuser@automations365.com, an Employee)

| Case | Result | Notes |
|---|---|---|
| Nav gating (employee) | ✅ PASS | Lands on "My Payroll" only; no admin sections rendered. |
| E5 — My Payroll list | ✅ PASS | Shows only this employee's own history; every row Locked/Paid (finalized-only visibility holds). |
| E6 — payslip detail page | ✅ PASS | Basic 30,000 → Gross 30,000; SSS 875 + PhilHealth 750 + HDMF 100 = Total Deductions 1,725; Net 28,275. |
| E6 — real PDF | ✅ PASS | Genuine PDF in the browser viewer; filename `Payslip_2026-11-15_A365-EMP-1002_User-Test`; dark logo, no header overlap; "Adrian Celis" centered on the signature line; derived rates correct (60,000/22 = 2,727.27; ÷8 = 340.91). |
| S2 — direct URL to a foreign id | ✅ PASS (UI guard) | `/my-payroll/00000000-…` → "Payslip not available." Employee cannot open another's payslip by URL. |
| Console | ✅ clean | The 3 console errors are Power Apps host noise (webplayer host React warning, host `permissions` 403 probe, Graph `/me/photo` 404) — none from the app bundle. |

### 2026-09-22 — Admin-session E2E (driven via Playwright, signed in as Michael Tabilin / michael@automations365.com, Payroll Admin + Employee)

| Case | Result | Notes |
|---|---|---|
| Admin nav gating | ✅ PASS | Dashboard shows Overview / Payroll Periods / Employees **and** My Payroll (admin who is also an employee — by design; My Payroll stays own-scoped). |
| E3 — View Payslip on finalized period | ✅ PASS | Locked period's entry rows show **View Payslip**, which opens the real PDF (new blob tab). |
| E3 — Draft period | ✅ PASS | Draft period rows show **Edit / Recalculate** and **0** View Payslip buttons (4 Edit for 4 employees). |
| E7 — pagination (partial) | ✅ PASS | Active periods list (7 rows ≤ 10) correctly shows **no** pagination controls. |

### 2026-09-22 — Data-layer security (run in the Employee's own browser console against the Dataverse Web API, `org9a7651f0.crm5.dynamics.com/api/data/v9.2`)

Confirmed the app calls Dataverse **directly with the signed-in user's token** (no local proxy), so record-level security is genuinely enforced for the browser user. Tests run as Test User (Employee) by borrowing the app's own auth header from a Network request (token never left the tester's browser).

| Case | Request | Result |
|---|---|---|
| **S1** — cross-employee read scoping | `GET a365_payrollentries` (no filter) | ✅ **PASS** — HTTP 200, 11 rows, **1 distinct employee** (only Test User's own). RLS scopes the read. |
| **S3** — employee finalizes a period | `PATCH a365_payrollperiods(id)` `a365_payrollstatus=Ready` | ✅ **PASS** — **403 Forbidden**. |
| **S5** — employee edits an entry (privilege) | `PATCH a365_payrollentries(id)` on a **Draft** period | ✅ **PASS** — **403 Forbidden** (platform privilege denial, isolated from the lock). |
| **S6** — locked entry is write-protected | `PATCH a365_payrollentries(id)` on a **Locked** period | ✅ **PASS** — **400** from the `ProtectFinalizedPayroll` plug-in, which fires in pre-validation *before* the privilege check. |

> Testing note: PATCHing a **Locked**-period entry returns **400** (plug-in short-circuit), while a **Draft**-period entry returns **403** (privilege). To test the *privilege* boundary (S5), target a non-locked entry so the lock plug-in doesn't mask the result. The S5 write auto-reverts if it ever succeeds; here it was denied, so nothing changed.

**Still open (optional):**

- **E1 / E2 / E4** admin mutating flows (create cutoff → load → edit → calculate; Mark Ready → Paid → Lock with audit + controls hiding; copy previous cutoff) — pre-existing Phase 6/7/10 features, unit-tested; **skipped** to avoid creating throwaway data in Dev.
- **S6 admin-side** — the employee test already shows the lock plug-in blocks the write (400) before any privilege check; re-running the same PATCH as an Admin (who *has* write privilege) would confirm the plug-in blocks an otherwise-authorized writer too. Nice-to-have, not required.

---

## What I (the assistant) can and cannot run

- **Can:** the whole of §1 (`npm test`), and drive §3 step-by-step **once you have the app
  running and are logged in** (I can issue the Playwright CLI commands and read the snapshots).
- **Cannot:** complete the Entra/Power Apps login, and cannot perform §2 or §4 — those need
  real user accounts with real Dataverse roles. Those are yours to run; the steps above are
  written so you can execute them directly.
