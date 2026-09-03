# The Daily Operation — Naming Conventions

**Publisher:** Automations 365 · **Customization prefix:** `a365`
**Solution (unique):** `A365_DailyOperations` · **Solution (display):** `A365-DailyOperations`

These conventions keep Dataverse schema, Power Platform assets, and application
code consistent and predictable. They were established in Phase 1 and apply to
everything created afterward.

> **Non-negotiable:** never *guess* a generated Dataverse schema name. Display
> names and logical names are not the same thing. Before referencing a column,
> relationship, or choice value in code, confirm the actual logical/schema name
> in Dataverse. These conventions define how we **create** names, not a licence
> to assume them.

---

## 1. Dataverse

Dataverse lowercases logical names and prepends the publisher prefix `a365_`.
When you create a table or column, set the **display name** in the intended
casing and let Dataverse derive the logical name; then verify it.

### Tables

- **Display name:** singular, Title Case — e.g. `Employee`, `Payroll Period`,
  `Payroll Entry`, `SSS Contribution`.
- **Schema/logical name:** `a365_` + lowercase singular — e.g. `a365_employee`,
  `a365_payrollperiod`, `a365_payrollentry`.
- **Primary name column:** a meaningful human-readable identifier
  (e.g. `a365_name` holding an employee full name or a period label), not an
  auto-number unless a code is genuinely required.

### Columns

- **Schema/logical name:** `a365_` + lowercase, no separators — e.g.
  `a365_basicpay`, `a365_grosspay`, `a365_sss`, `a365_withholdingtax`,
  `a365_netpay`, `a365_perioddatestart`, `a365_perioddateend`, `a365_paydate`.
- **Money columns** use the Currency data type; never store formatted strings.
- **Booleans** read as a state — e.g. `a365_isactive`.
- **Audit stamps** use standard Dataverse fields (`createdby`, `createdon`,
  `modifiedby`, `modifiedon`) plus explicit business stamps where required
  (`a365_calculatedby`, `a365_calculatedon`, `a365_approvedby`,
  `a365_approvedon`, `a365_paidby`, `a365_paidon`).

### Choices (option sets)

- **Global choices** for values reused across tables — e.g.
  `a365_payrollstatus` (Draft, Processing, For Review, Approved, Paid, Locked),
  `a365_employmentstatus`, `a365_employmenttype`, `a365_payrollfrequency`.
- Prefer global choices over local ones when a value set is shared.
- Confirm the integer values of choice options before encoding them in code.

### Relationships

- **Schema name:** `a365_<parent>_<child>` — e.g.
  `a365_payrollperiod_payrollentry`, `a365_employee_payrollentry`.
- Use lookups/relationships rather than duplicating employee data onto payroll
  entries.

### Statutory configuration tables

Contribution/tax rules are **configuration-driven**, never hardcoded in code.
Each is a table with effective-dating — e.g. `a365_ssscontribution`,
`a365_philhealthcontribution`, `a365_hdmfcontribution`, `a365_taxbracket` —
with `a365_effectivefrom`, `a365_effectiveuntil`, bracket/rate columns, and a
version. Historical payroll always resolves against the rule effective at the
time.

---

## 2. Solution & publisher

- **Publisher name:** `Automations365` · **prefix:** `a365` ·
  **option-value prefix:** derived by Dataverse.
- **Solution unique name:** `A365_DailyOperations` (no hyphens — Dataverse
  disallows them in unique names).
- **Solution display name:** `A365-DailyOperations`.
- All custom Dataverse components (tables, columns, choices, flows, connection
  references, environment variables) belong to this solution.

---

## 3. Power Automate flows

- **Naming:** `A365 | <Domain> | <Action>` — e.g.
  `A365 | Payroll | Generate Payslip`, `A365 | Payroll | Finalization Notification`.
- Flows are added to the `A365-DailyOperations` solution.
- Flows must handle errors explicitly and never fail silently.

---

## 4. Connection references & environment variables

- **Connection reference schema name:** `a365_<service>` —
  e.g. `a365_dataverse`, `a365_sharepoint`, `a365_office365`.
- **Environment variable schema name:** `a365_<purpose>` —
  e.g. `a365_sharepointsiteurl`, `a365_payslipslibrary`.
- These are **defined** as part of the solution but their per-environment
  **values** are set during ALM (Phase 13), once Production exists. For a
  Dev-only code app today, none are required yet.

---

## 5. SharePoint

Document library structure (to be confirmed before implementation):

```
Daily Operation / Payroll / <year> / <month> / <period-range>
```

Example: `Daily Operation/Payroll/2026/09/2026-09-01_to_2026-09-15`.
Document naming and exact library/site identifiers are confirmed in Phase 11 —
do not guess site or library ids.

---

## 6. Application code (React / TypeScript)

| Kind | Convention | Example |
|------|-----------|---------|
| File / folder names | kebab-case | `payroll-service.ts`, `use-payroll-period.ts` |
| React components | PascalCase, one per file | `PayrollTable`, `HomePage` |
| Hooks | `use-` prefix, camelCase export | `usePowerContext`, `usePayrollPeriods` |
| Services | `<domain>-service.ts`, business-named methods | `getPayrollPeriods()`, `submitPayroll(id)` |
| Types | PascalCase, colocated in `types/` or the service | `PayrollEntry`, `PowerContext` |
| Query keys | array, domain-scoped | `["payroll", periodId]` |
| Feature folders | `src/features/<domain>/{components,hooks,services,types}` | `features/payroll/` |
| Platform integration | `src/lib/power/` | `power-context.ts` |

- Service method names express **business operations**, not UI or Dataverse
  mechanics (`submitPayroll`, not `patchStatusField`).
- Currency formatting is centralized (PHP, `en-PH`) and kept separate from
  stored/calculation values.

---

## 7. Quick reference

| Thing | Value |
|-------|-------|
| Prefix | `a365` |
| Employee table | `a365_employee` |
| Payroll period table | `a365_payrollperiod` |
| Payroll entry table | `a365_payrollentry` |
| Payroll status choice | `a365_payrollstatus` |
| Solution (unique / display) | `A365_DailyOperations` / `A365-DailyOperations` |
| Flow pattern | `A365 \| <Domain> \| <Action>` |

Table and column names above are the **intended** names to create; always
verify the resulting logical name in Dataverse before using it in code.
