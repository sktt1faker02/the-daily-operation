# Phase 4 — Payroll Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Dataverse tables, global choice, and relationships that store payroll transactions (one semi-monthly cutoff and one employee-entry within it), and update the project docs to match.

**Architecture:** Two User/Team-owned custom tables — `a365_payrollperiod` (dates-only cutoff + workflow status + finalize/paid/lock stamps) and `a365_payrollentry` (lump-sum variable pay, per-entry include flag, unpaid leave as days + computed amount, and the computed money columns) — related 1:N from both `a365_payrollperiod` and `a365_employee`. Status is a five-value global choice. This phase creates **schema only**; calculations (Phase 5), UI (Phase 6), and status-workflow enforcement (Phase 7) are out of scope.

**Tech Stack:** Microsoft Dataverse; the `dataverse` plugin (`dv-metadata` skill + the plugin's MCP tools `create_table` / `update_table` / `describe` / `read_query`, with the Web API `scripts/auth.py` path for metadata the MCP tool cannot express — OwnershipType, global option sets, currency/lookup columns); solution `A365_DailyOperations` under `solution/`.

**Spec:** `docs/superpowers/specs/2026-09-06-phase-4-payroll-data-model-design.md`

## Global Constraints

- **Publisher prefix:** `a365` on every table, column, choice, and relationship.
- **Solution:** every component belongs to `A365_DailyOperations` (unique name `A365_DailyOperations`, no hyphens).
- **Ownership is immutable at creation:** `a365_payrollperiod` and `a365_payrollentry` are both **User or Team owned** — set this when the table is created; it cannot be changed later.
- **Never guess generated names** (`CLAUDE.md` #5): after creating each component, read its actual logical name, entity-set name, choice integer values, and relationship schema name back from Dataverse and record them in `docs/data-model.md` before anything in a later phase references them.
- **Money = Currency** data type; `a365_unpaidleavedays` = Decimal. Never store formatted strings.
- **Status flow (V1):** `Draft → Processing → Ready → Paid → Locked` — no For Review / Approved, no approver role.
- **No Delete on payroll tables** for the custom roles (`security-model.md` §7); relationship cascade favors Restrict Delete on both parents. (Role privileges themselves are a later security step, not this plan.)
- **After any metadata change:** export + unpack the solution into `solution/A365_DailyOperations/src` and commit.
- Dev org: `https://org9a7651f0.crm5.dynamics.com`.

---

### Task 1: `a365_payrollstatus` global choice

**Files:**
- Create: Dataverse global option set `a365_payrollstatus`.
- Modify (commit): `solution/A365_DailyOperations/src/**` (exported solution).

**Interfaces:**
- Produces: the global choice `a365_payrollstatus` with five options, reused by `a365_payrollperiod.a365_payrollstatus` in Task 2. Its integer values (publisher option prefix `74991…`) are read back and recorded for later code.

- [ ] **Step 1: Confirm connection**

Use the `dataverse` plugin (`dv-connect` if the MCP server is not already live). Verify the target env is `The Daily Operation - Dev` (`org9a7651f0`). Do not create anything until confirmed.

- [ ] **Step 2: Create the global choice**

Using the `dv-metadata` skill (Web API path for option sets), create global option set `a365_payrollstatus` with options in this order:

| Label | Intended purpose |
|---|---|
| Draft | Period created; entries being populated/edited |
| Processing | Calculation running / inputs being finalized |
| Ready | Admin reviewed & finalized; ready to pay |
| Paid | Marked paid; disbursed |
| Locked | Closed/immutable |

- [ ] **Step 3: Verify — read the choice back**

Use `describe` (or the metadata read the plugin exposes) to fetch `a365_payrollstatus`.
Expected: five options present, labels exactly as above, in order. Capture each option's **integer value**.

- [ ] **Step 4: Record confirmed values**

In `docs/data-model.md`, add the `a365_payrollstatus` choice with each label → integer value as read back. Do not invent the integers.

- [ ] **Step 5: Export solution & commit**

Add the choice to `A365_DailyOperations`, export + unpack into `solution/A365_DailyOperations/src`, then:

```bash
git add solution/A365_DailyOperations docs/data-model.md
git commit -m "Phase 4: add a365_payrollstatus global choice (Draft->Processing->Ready->Paid->Locked)"
```

---

### Task 2: `a365_payrollperiod` table

**Files:**
- Create: Dataverse table `a365_payrollperiod` (User/Team owned) + columns.
- Modify (commit): `solution/A365_DailyOperations/src/**`, `docs/data-model.md`.

**Interfaces:**
- Consumes: `a365_payrollstatus` global choice (Task 1).
- Produces: table `a365_payrollperiod` with primary name `a365_name`; entity-set name (read back) used as the code-app data-source key in Phase 6; parent of the period→entry relationship in Task 4.

- [ ] **Step 1: Create the table**

Create table **Display name** `Payroll Period`, intended logical `a365_payrollperiod`, **OwnershipType = UserOwned**, primary name column **`a365_name`** (Text, display `Period Label`). Add to `A365_DailyOperations`.

- [ ] **Step 2: Add the scalar columns**

Add these columns with exact display names, intended logical names, types, and required levels:

| Display name | Intended logical | Type | Required |
|---|---|---|---|
| Period Start | `a365_periodstart` | Date only | Required |
| Period End | `a365_periodend` | Date only | Required |
| Pay Date | `a365_paydate` | Date only | Optional |
| Status | `a365_payrollstatus` | Choice → global `a365_payrollstatus`, default **Draft** | Required |
| Ready On | `a365_readyon` | Date and Time | Optional |
| Paid On | `a365_paidon` | Date and Time | Optional |
| Locked On | `a365_lockedon` | Date and Time | Optional |

- [ ] **Step 3: Add the workflow-stamp lookups**

Add three lookups to `systemuser`:

| Display name | Intended logical | Target |
|---|---|---|
| Ready By | `a365_readyby` | `systemuser` |
| Paid By | `a365_paidby` | `systemuser` |
| Locked By | `a365_lockedby` | `systemuser` |

- [ ] **Step 4: Verify — describe the table**

`describe` `a365_payrollperiod`.
Expected: `OwnershipType = UserOwned`; primary name `a365_name`; all columns from Steps 2–3 present with the intended logical names; `a365_payrollstatus` bound to the global choice with default Draft. Capture the **entity-set name** and every **confirmed logical name**.

- [ ] **Step 5: Record confirmed schema**

Update `docs/data-model.md` with the confirmed `a365_payrollperiod` schema (logical names, entity-set name, ownership) — matching the spec §4 table.

- [ ] **Step 6: Export solution & commit**

Export + unpack, then:

```bash
git add solution/A365_DailyOperations docs/data-model.md
git commit -m "Phase 4: create a365_payrollperiod table (User owned)"
```

---

### Task 3: `a365_payrollentry` table

**Files:**
- Create: Dataverse table `a365_payrollentry` (User/Team owned) + columns.
- Modify (commit): `solution/A365_DailyOperations/src/**`, `docs/data-model.md`.

**Interfaces:**
- Consumes: nothing from Task 2 yet (the lookups to period/employee are Task 4).
- Produces: table `a365_payrollentry` with primary name `a365_name`; entity-set name (read back) used as the Phase 6 data-source key; child of both relationships in Task 4.

- [ ] **Step 1: Create the table**

Create **Display name** `Payroll Entry`, intended logical `a365_payrollentry`, **OwnershipType = UserOwned**, primary name column **`a365_name`** (Text, display `Entry Label`). Add to `A365_DailyOperations`.

- [ ] **Step 2: Add the control + earnings columns**

| Display name | Intended logical | Type | Required |
|---|---|---|---|
| Included | `a365_isincluded` | Yes/No (Boolean), default **Yes** | Required |
| Basic Pay | `a365_basicpay` | Currency | Optional |
| Allowances | `a365_allowances` | Currency | Optional |
| Other Earnings | `a365_otherearnings` | Currency | Optional |
| Gross Pay | `a365_grosspay` | Currency | Optional |

- [ ] **Step 3: Add the deduction + result columns**

| Display name | Intended logical | Type | Required |
|---|---|---|---|
| Unpaid Leave Days | `a365_unpaidleavedays` | Decimal | Optional |
| Unpaid Leave | `a365_unpaidleave` | Currency | Optional |
| SSS | `a365_sss` | Currency | Optional |
| PhilHealth | `a365_philhealth` | Currency | Optional |
| HDMF / Pag-IBIG | `a365_hdmf` | Currency | Optional |
| Withholding Tax | `a365_withholdingtax` | Currency | Optional |
| Other Deductions | `a365_otherdeductions` | Currency | Optional |
| Total Deductions | `a365_totaldeductions` | Currency | Optional |
| Net Pay | `a365_netpay` | Currency | Optional |

- [ ] **Step 4: Add the calc-stamp columns**

| Display name | Intended logical | Type | Target |
|---|---|---|---|
| Calculated By | `a365_calculatedby` | Lookup | `systemuser` |
| Calculated On | `a365_calculatedon` | Date and Time | — |

- [ ] **Step 5: Verify — describe the table**

`describe` `a365_payrollentry`.
Expected: `OwnershipType = UserOwned`; primary name `a365_name`; all columns from Steps 2–4 present with intended logical names; `a365_basicpay` etc. are Currency; `a365_unpaidleavedays` is Decimal; `a365_isincluded` default Yes. Capture the entity-set name and confirmed logical names.

- [ ] **Step 6: Record confirmed schema**

Update `docs/data-model.md` with the confirmed `a365_payrollentry` schema, matching spec §5.

- [ ] **Step 7: Export solution & commit**

```bash
git add solution/A365_DailyOperations docs/data-model.md
git commit -m "Phase 4: create a365_payrollentry table (User owned)"
```

---

### Task 4: Relationships (period→entry, employee→entry)

**Files:**
- Create: two 1:N relationships / lookup columns on `a365_payrollentry`.
- Modify (commit): `solution/A365_DailyOperations/src/**`, `docs/data-model.md`.

**Interfaces:**
- Consumes: `a365_payrollperiod` (Task 2), `a365_payrollentry` (Task 3), existing `a365_employee`.
- Produces: required lookup columns `a365_payrollperiod` and `a365_employee` on the entry; relationship schema names read back for use in Phase 6 expands.

- [ ] **Step 1: Create the period→entry relationship**

Create 1:N relationship, intended schema `a365_payrollperiod_payrollentry`: parent `a365_payrollperiod`, child `a365_payrollentry`, lookup column on child **`a365_payrollperiod`** (display `Payroll Period`), **Required**, delete behavior **Restrict**.

- [ ] **Step 2: Create the employee→entry relationship**

Create 1:N relationship, intended schema `a365_employee_payrollentry`: parent `a365_employee`, child `a365_payrollentry`, lookup column on child **`a365_employee`** (display `Employee`), **Required**, delete behavior **Restrict**.

- [ ] **Step 3: Verify — describe entry relationships**

`describe` `a365_payrollentry` (or query relationship metadata).
Expected: two lookup columns present and Required; both relationships Restrict-on-delete; confirm the actual relationship **schema names** and the lookup **logical names** (note the `_value` read form, e.g. `_a365_payrollperiod_value`).

- [ ] **Step 4: Record confirmed relationships**

Update `docs/data-model.md` with the confirmed relationship schema names and lookup logical/`_value` names (spec §8).

- [ ] **Step 5: Export solution & commit**

```bash
git add solution/A365_DailyOperations docs/data-model.md
git commit -m "Phase 4: relate payroll entry to period and employee"
```

---

### Task 5: Doc corrections (status flow + phase tracker)

**Files:**
- Modify: `docs/naming-conventions.md`, `docs/payroll-task-phases.md`.
- (No Dataverse change.)

**Interfaces:**
- Consumes: the confirmed schema recorded in Tasks 1–4.
- Produces: docs consistent with the V1 status flow; a raised flag on the `CLAUDE.md` discrepancy.

- [ ] **Step 1: Fix the status values in naming-conventions**

In `docs/naming-conventions.md`, change the `a365_payrollstatus` option list from `Draft, Processing, For Review, Approved, Paid, Locked` to **`Draft, Processing, Ready, Paid, Locked`** (both the §1 Choices bullet and the §7 quick-reference row if present).

- [ ] **Step 2: Fix the Phase 7 workflow in the tracker**

In `docs/payroll-task-phases.md` Phase 7: replace the `Draft → Processing → For Review → Approved → Paid → Locked` flow with **`Draft → Processing → Ready → Paid → Locked`**, and replace the "Payroll Approver review screen / Approve Payroll / record approver / prevent unauthorized approval" tasks with Admin-only finalize (`Submit`/`Mark Ready`, `Mark as Paid`, `Lock`) tasks. Remove approver references.

- [ ] **Step 3: Check off Phase 4 tasks**

In `docs/payroll-task-phases.md` Phase 4, mark the delivered items complete: Payroll Period table + its columns/status/metadata; Payroll Entry table + relationships + all money columns; and note the earning/deduction child-table item as **decided against for V1 (lump sums)** with a pointer to the spec.

- [ ] **Step 4: Verify — read the docs back**

Re-read the changed sections. Expected: no remaining "For Review", "Approved", or "Approver" in the payroll status flow; Phase 4 boxes reflect reality; the five-value choice appears consistently.

- [ ] **Step 5: Commit docs**

```bash
git add docs/naming-conventions.md docs/payroll-task-phases.md
git commit -m "Phase 4: align docs to V1 status flow (Ready; no approver) and check off Phase 4"
```

- [ ] **Step 6: Flag CLAUDE.md to the product owner**

Do **not** edit `CLAUDE.md` unprompted (it is the owner's instruction file with unrelated uncommitted edits). Report to the user that `CLAUDE.md`'s "Payroll Period" and "Payroll Domain" sections still describe the six-status flow and an Approve step, and ask whether they want it updated to match.

---

### Task 6: Phase 4 acceptance verification

**Files:**
- Modify (if needed): `docs/data-model.md` (final reconciliation).

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a checked acceptance list confirming Phase 4 is complete.

- [ ] **Step 1: Re-describe both tables and the choice**

`describe` `a365_payrollstatus`, `a365_payrollperiod`, `a365_payrollentry`. Confirm against spec §12 acceptance criteria: choice has exactly five options; both tables UserOwned with their full column sets; both relationships present with Required lookups.

- [ ] **Step 2: Confirm solution membership**

Query solution components (or inspect `solution/A365_DailyOperations/src`) to confirm the choice, both tables, and both relationships are all in `A365_DailyOperations`.

- [ ] **Step 3: Reconcile data-model.md**

Ensure `docs/data-model.md` records the final confirmed logical names, entity-set names, choice integers, and relationship schema names for all Phase 4 components — no intended-but-unconfirmed names remain.

- [ ] **Step 4: Final commit (if reconciliation changed anything)**

```bash
git add docs/data-model.md solution/A365_DailyOperations
git commit -m "Phase 4: reconcile confirmed payroll schema in data-model.md"
```

---

## Self-Review

**Spec coverage:**
- Global choice (spec §3) → Task 1.
- `a365_payrollperiod` (spec §4) → Task 2.
- `a365_payrollentry` (spec §5) → Task 3.
- Relationships (spec §7/§8) → Task 4.
- Immutability/snapshot (spec §6) → schema only; no action needed now (columns exist to hold the snapshot; enforcement is Phase 7) — covered by Tasks 2–3 creating the columns.
- Creation mechanics + verification (spec §9) → the verify/record steps in every task + Task 6.
- Doc updates (spec §10) → Task 5 (naming-conventions, task-phases, CLAUDE.md flag) + the per-task `data-model.md` records.
- Testing considerations (spec §11) → schema-verification steps now (Task 6); Phase 5/12 tests are out of scope by design.
- Acceptance criteria (spec §12) → Task 6.

**Placeholder scan:** No TBD/TODO/"handle edge cases". Each metadata component has exact display names, intended logical names, types, and required levels; each task verifies by reading back and records confirmed names. No unbound references.

**Type consistency:** Column logical names, the choice name `a365_payrollstatus`, and relationship schema names `a365_payrollperiod_payrollentry` / `a365_employee_payrollentry` are identical across Tasks 1–6 and match the spec tables. Currency vs Decimal (`a365_unpaidleavedays`) is consistent between Task 3 and spec §5.
