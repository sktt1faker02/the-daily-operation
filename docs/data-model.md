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

- **Status:** confirmed, pending creation
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

### After the table exists (remainder of Phase 3)

1. Add `a365_employee` as a code-app data source (`code-apps-preview:add-dataverse`),
   generating typed model/service files.
2. Build the Employee list (TanStack Table) and create/edit form for Payroll
   Admin, with Loading/Success/Empty/Error states.
3. Handle active/inactive employees (status filter; payroll loads Active).
4. Create the `A365 - Payroll Employee` and `A365 - Payroll Admin` security roles
   and apply the `a365_employee` privileges from security-model §5; wire the
   Employee↔`systemuser` link that owner-based access depends on.

---

## Phase 4 — Payroll tables (to be designed)

`a365_payrollperiod`, `a365_payrollentry`, and statutory-configuration tables
are specified in Phase 4. Ownership per security-model §3:
periods/entries **User/Team owned**, statutory config **Organization owned**.
