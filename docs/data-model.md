# The Daily Operation — Dataverse Data Model

Confirmed table schemas for the payroll module. This is the **executable
specification** for creating tables in Dataverse (via the Dataverse MCP
`create_table` tool or the maker portal). Names follow
`docs/naming-conventions.md`; ownership decisions follow
`docs/security-model.md`.

> Reminder: display names below are the intended names; always verify the
> resulting **logical name** in Dataverse before binding to it in code.

---

## Phase 3 — `a365_employee` (Employee)

- **Status:** ✅ **created** in `The Daily Operation - Dev` (2026-09-04) and
  exported into `solution/A365_DailyOperations`. Verified: `OwnershipType =
  UserOwned`, primary name `a365_name`, entity set `a365_employees`, autonumber
  `A365-EMP-{SEQNUM:0000}`, lookup `a365_systemuser` (Lookup → `systemuser`).
  The logical names below match what was created.
- **Ownership:** **User or Team owned** (immutable after creation — required so
  an employee can read their own record; see security-model §3)
- **Solution:** `A365-DailyOperations`
- **Primary name column:** Full Name (`a365_name`, Text)

### Columns

| Display name | Logical name | Type | Required | Notes |
|---|---|---|---|---|
| Employee Number | `a365_employeenumber` | Autonumber `A365-EMP-{SEQNUM:0000}` | System | Unique, system-generated |
| Full Name | `a365_name` | Text | Yes | Primary column |
| First Name | `a365_firstname` | Text | Yes | |
| Last Name | `a365_lastname` | Text | Yes | |
| Middle Name | `a365_middlename` | Text | No | |
| Work Email | `a365_workemail` | Text (email format) | No | |
| Entra User | `a365_systemuser` | Lookup → `systemuser` | No | **Security link** for owner-based access |
| Department | `a365_department` | Text | No | Text for V1; may become a lookup later |
| Position | `a365_position` | Text | No | Job title |
| Employment Status | `a365_employmentstatus` | Choice (global) | Yes | see below |
| Employment Type | `a365_employmenttype` | Choice (global) | Yes | see below |
| Date Hired | `a365_datehired` | Date only | Yes | |
| End Date | `a365_enddate` | Date only | No | Resigned/terminated |
| Basic Monthly Salary | `a365_basicmonthlysalary` | Currency | No | |
| Payroll Frequency | `a365_payrollfrequency` | Choice (global) | No | see below |
| SSS Number | `a365_sssnumber` | Text | No | Stored as text, no format enforcement |
| PhilHealth Number | `a365_philhealthnumber` | Text | No | " |
| Pag-IBIG / HDMF Number | `a365_hdmfnumber` | Text | No | " |
| TIN | `a365_tin` | Text | No | " |
| Payment Method | `a365_paymentmethod` | Choice (global) | No | see below |
| Bank Name | `a365_bankname` | Text | No | Sensitive |
| Bank Account Number | `a365_bankaccountnumber` | Text | No | Sensitive — field-level-security candidate |

### Global choices (option sets)

| Choice | Logical name | Options |
|---|---|---|
| Employment Status | `a365_employmentstatus` | Active, Inactive, On Leave, Resigned, Terminated |
| Employment Type | `a365_employmenttype` | Regular, Probationary, Contractual, Project-based, Part-time, Consultant |
| Payroll Frequency | `a365_payrollfrequency` | Monthly, Semi-monthly |
| Payment Method | `a365_paymentmethod` | Bank Transfer, Cash, Check |

### After the table exists (remainder of Phase 3) — ✅ complete

1. ✅ Added `a365_employee` as a code-app data source
   (`code-apps-preview:add-dataverse`), generating typed model/service files
   (`src/generated/`, `src/features/employees/`).
2. ✅ Built the Employee list (TanStack Table) and create/edit form for Payroll
   Admin, with Loading/Success/Empty/Error states.
3. ✅ Handle active/inactive employees (status filter; payroll loads Active).
4. ✅ Created the `A365 - Payroll Employee` and `A365 - Payroll Admin` security
   roles and applied the `a365_employee` privileges from security-model §5
   (see security-model §13). The `a365_systemuser` lookup **column** exists, but
   **wiring the Employee↔`systemuser` link in the UI and the owner-based access it
   feeds is deferred to Phase 4/6** (security-model §10) — it needs real user
   accounts and the load-employees flow before it does anything.

---

## Phase 4 — Payroll tables

Design spec: `docs/superpowers/specs/2026-09-06-phase-4-payroll-data-model-design.md`.
Ownership per security-model §3: periods/entries **User/Team owned**. Statutory
configuration tables are **Phase 5** (Organization owned), not Phase 4.

### `a365_payrollstatus` (global choice)

- **Status:** ✅ **created** in `The Daily Operation - Dev` (2026-09-06), added to
  `A365_DailyOperations`. MetadataId `2f6f95ca-f6a9-f111-aaad-000d3a853079`.
- Values below were **read back** from Dataverse (do not guess).

| Label | Value | Meaning |
|---|---|---|
| Draft | `749910000` | Period created; entries being populated/edited |
| Processing | `749910001` | Calculation running / inputs being finalized |
| Ready | `749910002` | Admin reviewed & finalized; ready to pay |
| Paid | `749910003` | Marked paid; disbursed |
| Locked | `749910004` | Closed/immutable |

> V1 flow (no For Review / Approved, no approver): `Draft → Processing → Ready →
> Paid → Locked`. Transition rules are enforced in Phase 7, not by the choice.

### `a365_payrollperiod` (Payroll Period)

- **Status:** ✅ **created** in `The Daily Operation - Dev` (2026-09-06), added to
  `A365_DailyOperations`. Verified: `OwnershipType = UserOwned`, entity set
  `a365_payrollperiods`, primary key `a365_payrollperiodid`, primary name
  `a365_name`. Logical names below match what was created.
- **Ownership:** **User or Team owned** (immutable) — security-model §3.

| Display name | Logical name | Type | Required | Notes |
|---|---|---|---|---|
| Period Label | `a365_name` | Text | Yes | Primary; `YYYY-MM-DD to YYYY-MM-DD`. |
| Period Start | `a365_periodstart` | Date only | Yes | 1st or 16th. |
| Period End | `a365_periodend` | Date only | Yes | 15th or last day of month. |
| Pay Date | `a365_paydate` | Date only | No | Disbursement date. |
| Status | `a365_payrollstatus` | Choice → global `a365_payrollstatus` | Yes | Default Draft. |
| Ready On | `a365_readyon` | Date and Time | No | Stamped on → Ready. |
| Paid On | `a365_paidon` | Date and Time | No | Stamped on → Paid. |
| Locked On | `a365_lockedon` | Date and Time | No | Stamped on → Locked. |
| Ready By | `a365_readyby` | Lookup → `systemuser` | No | Read `_a365_readyby_value`. |
| Paid By | `a365_paidby` | Lookup → `systemuser` | No | Read `_a365_paidby_value`. |
| Locked By | `a365_lockedby` | Lookup → `systemuser` | No | Read `_a365_lockedby_value`. |

Relationships (systemuser → period): `a365_payrollperiod_readyby`,
`a365_payrollperiod_paidby`, `a365_payrollperiod_lockedby`. Created/Modified use
standard Dataverse stamps. No stored rollup totals (computed on demand, Phase 6).

### `a365_payrollentry` (Payroll Entry)

- **Status:** ✅ **created** in `The Daily Operation - Dev` (2026-09-06), added to
  `A365_DailyOperations`. Verified: `OwnershipType = UserOwned`, entity set
  `a365_payrollentries`, primary key `a365_payrollentryid`, primary name
  `a365_name`. Logical names below match what was created.
- **Ownership:** **User or Team owned** (immutable) — the privacy pivot of
  security-model §4 (Phase 6 assigns each entry's owner to the employee's
  `systemuser`).

| Display name | Logical name | Type | Required | Notes |
|---|---|---|---|---|
| Entry Label | `a365_name` | Text | Yes | Primary; composed `Employee — Period`. |
| Included | `a365_isincluded` | Yes/No | Yes | Default Yes; hold without deleting. |
| Basic Pay | `a365_basicpay` | Currency | No | ½ monthly salary; salary-basis snapshot. |
| Allowances | `a365_allowances` | Currency | No | Lump sum. |
| Other Earnings | `a365_otherearnings` | Currency | No | Lump sum. |
| Gross Pay | `a365_grosspay` | Currency | No | Computed (Phase 5). |
| Unpaid Leave Days | `a365_unpaidleavedays` | Decimal | No | Input; Leave Mgmt feeds later. |
| Unpaid Leave | `a365_unpaidleave` | Currency | No | Computed from days. |
| SSS | `a365_sss` | Currency | No | Computed. |
| PhilHealth | `a365_philhealth` | Currency | No | Computed. |
| HDMF / Pag-IBIG | `a365_hdmf` | Currency | No | Computed. |
| Withholding Tax | `a365_withholdingtax` | Currency | No | Computed. |
| Other Deductions | `a365_otherdeductions` | Currency | No | Lump sum. |
| Total Deductions | `a365_totaldeductions` | Currency | No | Computed. |
| Net Pay | `a365_netpay` | Currency | No | Computed. |
| Calculated On | `a365_calculatedon` | Date and Time | No | Set on calculate. |
| Calculated By | `a365_calculatedby` | Lookup → `systemuser` | No | Read `_a365_calculatedby_value`. |

Each Currency column has an auto `_base` companion and the table carries the
standard `transactioncurrencyid` / `exchangerate` columns (Dataverse money
behavior). Rel `a365_payrollentry_calculatedby` (systemuser → entry).

### Payroll Entry relationships (Phase 4)

Both **created + verified** (2026-09-06): required lookups on `a365_payrollentry`
with **Restrict** delete (payroll/employee records are not deleted to fix
mistakes — security-model §7).

| Relationship schema | Type | Parent | Lookup on entry | Read form | Required | Delete |
|---|---|---|---|---|---|---|
| `a365_payrollperiod_payrollentry` | 1:N | `a365_payrollperiod` | `a365_payrollperiod` | `_a365_payrollperiod_value` | Yes | Restrict |
| `a365_employee_payrollentry` | 1:N | `a365_employee` | `a365_employee` | `_a365_employee_value` | Yes | Restrict |
