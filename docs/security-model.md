# The Daily Operation — Payroll Security Model

**Milestone 1:** Payroll · **Status:** Phase 2 — Security & Access Model (design)

This document is the security specification for the payroll module. It defines
the application roles, how they map to Dataverse security roles, the table-level
access matrix, and the record-level access strategy that keeps one employee's
payroll private from another.

Phases 3–4 create the tables this design refers to (`a365_employee`,
`a365_payrollperiod`, `a365_payrollentry`, statutory config). The actual
Dataverse security roles and privileges are **created and applied incrementally
as those tables land** (see §10, Enforcement roadmap). Nothing here is enforced
by hiding UI.

---

## 1. Principles

1. **The data layer is the security boundary.** Authorization is enforced by
   Microsoft Entra authentication + Dataverse security roles, privileges, and
   record ownership. SharePoint permissions protect documents.
2. **Application checks are UX only.** Hiding a button or filtering a list to the
   current user improves experience but never protects a record. Every access
   guarantee must hold against a direct data request, not just the UI.
3. **Least privilege.** Grant the narrowest access level that satisfies the
   need. Over-granting ("Swiss-cheese" roles) is the most common mistake;
   privileges are cumulative and the broadest grant wins, so a single
   Organization-level read cannot later be narrowed for one record.
4. **Custom roles are additive.** Custom roles are assigned *in addition to* a
   baseline (Basic User), never as a user's only role.

---

## 2. Application roles → Dataverse roles

| Application role | Dataverse role | Basis |
|---|---|---|
| **Payroll Employee** | `A365 - Payroll Employee` (custom) | Copied from **Basic User**; read-only on own payroll |
| **Payroll Admin** | `A365 - Payroll Admin` (custom) | Copied from **Basic User**; full payroll management |
| **System Administrator** | **System Administrator** (built-in) | Do **not** recreate; assign the platform role |

Notes:
- Every interactive user also needs the **Basic User** role (minimum privileges
  to run an app and access core tables). The custom roles above are assigned
  on top of it.
- **Payroll Admin is not System Administrator.** Admins manage payroll data;
  they do not get platform-admin privileges. There is **no Payroll Approver
  role** in V1 — do not build one.

---

## 3. Record ownership design

Ownership type is chosen when a table is created and **cannot be changed
later**, so it is decided here.

| Table | Ownership | Why |
|---|---|---|
| `a365_employee` | **User or Team owned** | Enables an employee to read their *own* employee record at User level |
| `a365_payrollperiod` | **User or Team owned** | Owned/managed by Payroll Admin; a cutoff is not employee-specific |
| `a365_payrollentry` | **User or Team owned** | The pivot of privacy — each entry is tied to one employee (see §4) |
| Statutory config (`a365_ssscontribution`, etc.) | **Organization owned** | Global reference data; everyone reads, only admins write |

Each `a365_employee` record links to the person's Microsoft Entra user through a
lookup to the **`systemuser`** table (the Phase 3 task "Link employee to Entra
user"). That link is what connects a signed-in user to their payroll.

---

## 4. The core rule — an employee sees only their own payroll

**Recommended mechanism: ownership-based access.**

When a payroll entry is created for an employee (loading employees into a period,
Phase 6), the entry's **owner is assigned to that employee's linked
`systemuser`**. The Payroll Employee role then grants **Read at *User* level** on
`a365_payrollentry`, so an employee can read only the entries they own — enforced
by Dataverse, regardless of how the request is made.

- The employee role grants **no Write, Delete, Assign, or Share** on payroll —
  read-only. An employee therefore cannot edit the record they own.
- Assigning ownership requires each payrolled employee to be a Dataverse user
  (they are — they authenticate via Entra to view payslips).

**Alternative considered:** an auto-created **access team** per entry that shares
Read with the employee. This avoids reassigning ownership but adds a team per
record and more moving parts. Ownership-based access is simpler and sufficient
for V1; revisit access teams only if ownership assignment proves limiting.

**Payroll Period visibility:** employees need the period's dates/label to render
a payslip, but a period may carry aggregate totals across all employees.
Employees are **not** granted broad read on `a365_payrollperiod`; the payslip
view reads the period context it needs through the employee's own
`a365_payrollentry` (which stores/relates the period dates). If any period
column must be shown to employees, expose only non-sensitive columns — protect
aggregate/total columns with **column (field-level) security** rather than
widening the read.

---

## 5. Table access matrix

Access level shorthand: **Org** = Organization, **User** = own records only,
**None** = no access. Privileges not listed are **None**.

### `a365_employee`
| Role | Create | Read | Write | Delete | Assign | Share |
|---|---|---|---|---|---|---|
| Payroll Employee | None | **User** (own record) | None | None | None | None |
| Payroll Admin | **Org** | **Org** | **Org** | None¹ | Org | Org |

### `a365_payrollperiod`
| Role | Create | Read | Write | Delete | Assign | Share |
|---|---|---|---|---|---|---|
| Payroll Employee | None | None² | None | None | None | None |
| Payroll Admin | **Org** | **Org** | **Org** | None¹ | Org | Org |

### `a365_payrollentry`
| Role | Create | Read | Write | Delete | Assign | Share |
|---|---|---|---|---|---|---|
| Payroll Employee | None | **User** (own) | None | None | None | None |
| Payroll Admin | **Org** | **Org** | **Org** | None¹ | **Org** | Org |

### Statutory configuration (org-owned: `a365_ssscontribution`, `a365_philhealthcontribution`, `a365_hdmfcontribution`, `a365_taxbracket`)
| Role | Create | Read | Write | Delete |
|---|---|---|---|---|
| Payroll Employee | None | **Org** (read-only) | None | None |
| Payroll Admin | **Org** | **Org** | **Org** | Org³ |

¹ **Delete is withheld by default** on payroll tables — financial records are
corrected by an auditable adjustment process, not deleted (see §7). Grant Delete
only to System Administrator, or via an explicit, audited exception.

⁴ **Append / Append To.** The Payroll Admin role also holds **Append** and
**Append To** at Organization on `a365_employee` (granted alongside the six
privileges above). They are the functional companions to Create/Write — without
them a non-System-Administrator admin cannot set the `a365_systemuser` lookup or
relate an employee to other records. They convey no additional read access to
employee data. The Payroll Employee role is **read-only** and holds neither.

² Read granted only if a specific UI need arises, and then limited to
non-sensitive columns via field-level security (see §4).

³ Statutory config is versioned/effective-dated; superseded rows are retired by
end-dating, not deletion, so historical payroll still resolves correctly.

---

## 6. Business unit & team strategy

- **Single root business unit** for Automations 365. With one business unit,
  *Business Unit* and *Organization* access levels are equivalent; the matrix
  uses **Organization** for Admin grants for clarity.
- **Owner team (optional):** payroll periods/entries may be owned by an
  **`A365 Payroll` owner team** (carrying the Payroll Admin role) instead of an
  individual admin, so payroll isn't tied to one person's account. Employee
  entries are still individually owned by the employee for the §4 rule; the
  team owns periods and administers entries.
- Revisit this only if the company later splits into multiple legal
  entities/business units.

---

## 7. Deletion & correction controls

**2026-10-22 owner-authorized addition:** Processing periods and individual
Processing entries can be deleted only through the validated deletion APIs,
with confirmation and a durable receipt. Employee master deletion is rejected
when payroll, leave or template references exist. Ready/Paid/Locked records
remain protected. See [deletion setup and verification](payroll-deletion-checklist.md).

**Observed environment drift:** the live solution export already contains
Organization-level payroll period/entry Delete grants for Payroll Admin, unlike
the original design below. This implementation does not alter those grants.
Synchronous server Delete guards reject direct deletes regardless of a caller's
existing Delete privilege; transactional children of the matching, authorized
API are required. Receipt writes are also guarded and receipts cannot be edited
or deleted through ordinary requests. The original no-Delete role design below
remains the recommended privilege baseline, rather than a claim about live grants.

- **No Delete privilege** on `a365_payrollperiod` / `a365_payrollentry` for
  either custom role. Payroll is not deleted to fix mistakes.
- Corrections to finalized payroll use an explicit, auditable
  **adjustment/correction process** (designed in Phase 7), never a silent edit
  or delete.
- Destructive operations (Void, Unlock, Remove-from-payroll) require
  authorization, confirmation, a stated impact, and an audit trail.

---

## 8. Finalized-payroll immutability

> **Security roles alone cannot enforce this.** Access levels are not
> status-conditional — a role that can Write a Draft entry can also Write a
> Locked one.

Immutability of finalized/locked payroll (Phase 7) therefore needs an additional
data-layer control, chosen there from:
- a **real-time plug-in / low-code plug-in** on Update that blocks changes when
  status is `Approved`/`Paid`/`Locked` (recommended — true data-layer
  enforcement), or
- **column-level security** locking calculated columns after finalization, or
- a **Power Automate** guard.

This document flags the requirement; Phase 7 selects and implements the
mechanism. The app's edit-blocking UI is a convenience on top of it, not the
guarantee.

---

## 9. SharePoint payslip documents

- Generated payslips live in SharePoint (Phase 11), not Dataverse.
- Employees may access **only their own** payslip documents. The exact
  enforcement (item-level permissions vs. brokering downloads through an
  identity-checked Power Automate flow) is decided in Phase 11 when the library
  structure is confirmed. Dataverse stores the document reference/metadata on
  the payroll entry, inheriting the entry's record-level access.

---

## 10. Enforcement roadmap (design now, enforce later)

| Security work | Enforced in |
|---|---|
| Roles & access matrix designed; System Administrator = built-in role | **Phase 2 (this doc)** |
| Create `A365 - Payroll Employee` / `A365 - Payroll Admin` roles; set `a365_employee` privileges | ✅ **Done in Phase 3** (2026-09-04) — see §13 |
| Employee↔`systemuser` link + owner assignment for User-level self-read | **Phase 4 / Phase 6** (needs employee records + user accounts; the lookup column exists) |
| Set `a365_payrollperiod` / `a365_payrollentry` privileges; owner-assignment-on-create; statutory-config read/write | **Phase 4 / Phase 6** (with those tables & the load-employees flow) |
| Finalized-payroll immutability control | **Phase 7** |
| SharePoint payslip permissions | **Phase 11** |
| Security tests (see §11) | **Phase 12** |

Role/privilege setup is done in the **Power Platform admin center / maker
portal** (or Dataverse Web API); `pac` has no security-role command. Each step
above will come with a precise, checkable action list at the time its table
exists.

---

## 11. Security test plan (executed in Phase 12)

Direct-data tests, not just UI checks:
- Employee A cannot read Employee B's `a365_payrollentry` by id or direct query.
- An employee cannot Write/Delete any payroll record, including their own.
- An employee cannot create a payroll period or entry.
- An employee cannot mark payroll Paid or transition status.
- A locked/finalized entry cannot be modified through a normal request.
- Payroll Admin has full intended CRUD but cannot Delete finalized payroll.
- Payroll Admin does not hold System Administrator privileges.
- Statutory config is read-only to employees, writable by Admin.
- SharePoint: an employee cannot open another employee's payslip document.

---

## 12. Confirmed decisions

These design choices were reviewed and **confirmed on 2026-09-03**. They are
settled inputs to Phases 3–4:

1. ✅ **Owner-based access** (§4) as the mechanism for "employee sees own
   payroll", with entries owned by the employee's `systemuser` — not access
   teams.
2. ✅ **Single business unit** (§6) for the company.
3. ✅ **Finalized immutability via a real-time plug-in** (§8) as the Phase 7
   mechanism.
4. ✅ **No Delete** on payroll tables for both custom roles (§5, §7).

Related links: `docs/architecture.md` §8 (security overview),
`docs/naming-conventions.md`, `docs/payroll-task-phases.md`.

---

## 13. Implementation status (Phase 3)

Created in `The Daily Operation - Dev` on **2026-09-04** via the Dataverse Web
API and exported into `solution/A365_DailyOperations` (component type Role):

| Role | Dataverse role name | `a365_employee` privileges |
|---|---|---|
| Payroll Employee | `A365 - Payroll Employee` | **Read** at *User* |
| Payroll Admin | `A365 - Payroll Admin` | **Create, Read, Write, Append, Append To, Assign, Share** at *Organization*; **no Delete** |

Notes:
- Roles are **additive** — each interactive user must also hold **Basic User**
  (§2). The custom roles are **not** assigned to anyone yet; assignment happens
  when app users are onboarded (`pac admin assign-user` / admin center), so no
  one's access changed by creating them.
- Payroll-table privileges (`a365_payrollperiod`, `a365_payrollentry`, statutory
  config) and the owner-assignment-on-create rule are added in **Phase 4 / 6**
  when those tables and the load-employees flow exist.
- Security is enforced here at the Dataverse layer; the app UI never gates it.
