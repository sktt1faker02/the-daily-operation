# Payroll Cutoff Templates (Design Spec)

**Project:** The Daily Operation · **Company:** Automations 365
**Milestone:** 1 — Payroll · **Feature:** Payroll Cutoff Templates
**Date:** 2026-09-23 · **Status:** Approved design, pending implementation plan
**Depends on:** Phase 4 data model (`a365_payrollperiod`, `a365_payrollentry`,
`a365_employee`), the existing copy-previous-cutoff flow.

---

## 1. Goal & scope

Let a Payroll Admin **save the per-employee inputs of a finalized cutoff as a
named, reusable template**, and later **load a template into an editable period**
to pre-fill it — a named, repeatable alternative to "Copy previous cutoff" that
can be applied to any period, not just the immediately previous one.

**In scope:**
- Two new **Organization-owned** Dataverse tables: `a365_payrolltemplate`
  (header) and `a365_payrolltemplateline` (one row per employee).
- A `payroll-template-service.ts` behind the data layer, plus TanStack Query hooks.
- **Save as template** from a payroll period — allowed **only when the period is
  Paid or Locked**.
- **Load template** into an **editable** period (Draft/Processing) via a picker,
  applying the template then recalculating.
- A new **Payroll Cutoff Templates** page (`/payroll/templates`, Admin-only):
  list, view lines (read-only), rename, delete.
- Extend the existing **Copy previous cutoff** to also carry the entry **Comment**
  field (`a365_comment`).

**Out of scope:**
- Sharing/exporting templates, versioning, or scheduling.
- Applying a template to a Paid/Locked (non-editable) period.
- Any change to the calculation engine or statutory rules.

---

## 2. Confirmed behavior (from brainstorming)

| Decision | Value |
|---|---|
| Storage | Two relational tables (header + line), not a JSON blob |
| Save source | Only periods with status **Paid** or **Locked** |
| Save content | One line per employee entry in the source period, capturing all **inputs** (not calculated results) |
| Load target | Only **editable** periods (Draft/Processing) |
| Load behavior | Overwrite inputs of employees in the template; **add** template employees missing from the period; **leave untouched** period employees not in the template; **skip** template employees who are inactive/removed; then **recalculate** |
| Copied fields | Basic Pay, Allowances, Other Earnings, Other Deductions, Unpaid Leave days, Withholding Tax, **Comment** |
| Never copied | Calculated results (gross, SSS/PhilHealth/HDMF, total deductions, net) — always recalculated |
| Templates page | List + View (read-only lines) + Rename + Delete |

This mirrors the copy-previous-cutoff model the client already approved
(copy-all-and-overwrite, admin verifies afterward — see the
`copy-previous-cutoff-behavior` project memory).

---

## 3. Data model

Both tables live in the `A365-DailyOperations` solution, **Organization-owned**
(admin-managed reference data holding sensitive pay values; ownership is immutable
— confirm at creation). Privileges: **Payroll Admin only** (create/read/write/
delete); ordinary users have **no access**. Display names below are intended;
**verify the resulting logical names in Dataverse at creation** (CLAUDE.md #5) and
record them in `docs/data-model.md`.

### 3.1 `a365_payrolltemplate` — header
| Display | Logical | Type | Notes |
|---|---|---|---|
| Name | `a365_name` | Text (primary) | e.g. "Standard semi-monthly" |
| Description | `a365_description` | Multiline text | Optional |

Audit columns (Created By/On, Modified By/On) come from Dataverse defaults.

### 3.2 `a365_payrolltemplateline` — one row per employee
| Display | Logical | Type | Notes |
|---|---|---|---|
| Name | `a365_name` | Text (primary) | Auto-set from employee + template name |
| Template | `a365_template` | Lookup → `a365_payrolltemplate` | **Parental** relationship (delete header → cascade lines) |
| Employee | `a365_employee` | Lookup → `a365_employee` | Read `_a365_employee_value` |
| Basic Pay | `a365_basicpay` | Currency | |
| Allowances | `a365_allowances` | Currency | |
| Other Earnings | `a365_otherearnings` | Currency | |
| Other Deductions | `a365_otherdeductions` | Currency | |
| Unpaid Leave Days | `a365_unpaidleavedays` | Decimal | |
| Withholding Tax | `a365_withholdingtax` | Currency | |
| Comment | `a365_comment` | Multiline text | |

The line field set intentionally matches the `a365_payrollentry` **input** columns
so save/load is a straight field-to-field map.

---

## 4. Services & hooks

New `features/payroll/services/payroll-template-service.ts` (all Dataverse access
behind it, per CLAUDE.md "Dataverse Rules"):

- `listTemplates()` → header rows with a line count.
- `getTemplateLines(templateId)` → the lines for the read-only viewer.
- `renameTemplate(id, { name, description })`.
- `deleteTemplate(id)` → deletes the header; parental relationship cascades lines.
- `saveTemplateFromPeriod(periodId, name, description)`:
  1. Load the period; **throw a typed error unless status is Paid or Locked.**
  2. Read the period's entries; create the header, then one line per entry
     (mapping the seven input fields). Return the new template id + line count.
- `applyTemplateToPeriod(templateId, periodId)`:
  1. Load template lines, the period's existing entries, and active employees.
  2. **Overwrite** inputs on entries whose employee is in the template.
  3. **Add** entries for template employees not yet in the period **and** still
     active (reuse the existing entry-creation path with owner assignment).
  4. **Skip** template employees who are inactive/removed; **leave untouched**
     period employees absent from the template.
  5. Return `{ created, updated, skipped }`.

**Shared logic.** The overwrite/add mechanics already exist in
`copyFromPreviousCutoff`. Extract the common "apply a set of `CopiedInputs`
keyed by employee to a period (overwrite existing, add missing active)" into a
reusable service helper so copy-previous and template-load stay in sync and don't
diverge. `CopiedInputs` (in `period-utils.ts`) gains a `comment: string` field.

Hooks (`features/payroll/hooks/`): `useTemplates`, `useTemplateLines(id)`,
`useSaveTemplate(periodId)`, `useRenameTemplate`, `useDeleteTemplate`, and
`useApplyTemplate(periodId)` — the last one applies then calls the existing
`calculatePeriod` (same composition as `useCopyPreviousCutoff`), and invalidates
the relevant query scopes.

---

## 5. UI

- **Save as template** — button on the payroll period page (`pages/payroll-period.tsx`),
  visible **only when the period is Paid or Locked**. Opens a shadcn `Dialog` with
  Name (required) + Description (optional); on success, toast + link to the
  Templates page.
- **Load template** — button on an **editable** period, beside "Copy previous
  cutoff". Opens a `Dialog` with a `Select` picker of templates; confirm applies
  the template and recalculates. Toast reports `X added, Y updated, Z skipped`.
  Disabled with an explanatory empty state when no templates exist.
- **Templates page** — new `pages/payroll-templates.tsx` at route
  `/payroll/templates`, wrapped in `AdminOnly`, linked in `_layout.tsx` sidebar
  under PAYROLL. Uses TanStack Table for the list (Name, Description, # employees,
  Created) with row actions: **View** (read-only lines dialog/panel), **Rename**
  (dialog), **Delete** (confirm dialog). Standard Loading / Empty / Error states.

---

## 6. Copy previous cutoff — comment field

Add `a365_comment` to the copied inputs so **both** copy-previous and template
save/load carry it: extend `CopiedInputs` with `comment`, include it in the
copy-previous source map, the existing-entry overwrite payload, and the
new-entry create payload. No behavior change beyond the extra field.

---

## 7. Security

- The Templates route and buttons are Admin-gated in the UI (`AdminOnly`), but the
  **real boundary is Dataverse privileges** (Payroll Admin only on both tables) —
  UI gating is UX, not the security boundary (CLAUDE.md non-negotiable #4).
- Templates hold sensitive pay values (Basic Pay, Withholding Tax), so ordinary
  users get no access at the Dataverse level.
- Save is refused server-side (service guard) for non-finalized periods; load is
  only offered on editable periods, and applying to a locked period is not exposed.

---

## 8. Testing

Vitest + RTL, colocated, mirroring `period-utils.test.ts`:

- **Pure line-planning:** mapping a period's entries → template lines (all seven
  input fields, incl. comment).
- **Apply-to-period logic:** overwrite existing, add missing-and-active, skip
  inactive/removed template employees, leave non-template employees untouched.
- **Save guard:** `saveTemplateFromPeriod` rejects Draft/Processing/Ready.
- **Copy-previous regression:** comment now carried forward.
- Component smoke tests for the save/load dialogs and the templates list
  (loading/empty/error), where practical.

`npm run lint` and `npm run build` must pass before completion.

---

## 9. Creation mechanics & docs

- Create both tables/columns/relationships via the Dataverse MCP
  (OrganizationOwned; currency/decimal/text columns; parental
  template→line relationship). **Read every logical name back** and record the
  confirmed schema in `docs/data-model.md`.
- Set Payroll Admin privileges on both tables (the Phase 4/6 security step).
- Export + unpack the solution and commit.
- Update `docs/architecture.md` (new service + page) and, if present, the task
  phases doc.

---

## 10. Acceptance criteria

- [ ] `a365_payrolltemplate` + `a365_payrolltemplateline` exist (OrganizationOwned, parental relationship) with the §3 columns; logical names recorded in `docs/data-model.md`.
- [ ] Payroll Admin privileges set on both tables; ordinary users have no access.
- [ ] "Save as template" appears only on Paid/Locked periods and creates a header + one line per employee input.
- [ ] "Load template" on an editable period overwrites/adds per §2 and recalculates.
- [ ] Templates page lists templates and supports View, Rename, Delete.
- [ ] Copy previous cutoff also carries the Comment field.
- [ ] Service enforces the Paid/Locked save guard (typed error, not silent).
- [ ] Unit tests pass (planning, apply, save-guard, copy-comment regression); lint + build clean.
