# Active: Leave Conversion, Add New Transaction, Editable Annual Records and Save

## Owner authorization and correction — 2026-10-23

Owner explicitly approved the documented additions in The Daily Operation - Dev /
A365_DailyOperations: unique-year parent, parent lookup and employee uniqueness
key, Available VL decimal field, Days minimum 0.00, and four minimal Payroll
Admin parent-table permissions. Owner also directed: **remove Refresh balances;
it is not needed**. This supersedes the requirements below that retain that
control. Schema approval does not authorize publishing the app, updating the
server assembly, registering new plug-in steps or real financial test records.

## Requirements

Mark as paid follow-up: owner declined new payment fields/permissions and
requested only the button, with paid years locked. Reuse the existing annual
header Active/Inactive state for this payment lock; keep employee conversion
statuses and all calculations unchanged. No schema or role changes.
Owner subsequently explicitly approved deploying the tested Leave 1.0.3.0 and
Code App to Dev. This approval does not authorize marking any actual year paid.

Deployment follow-up, 2026-10-23: owner explicitly approved deploying the tested
Leave plugin 1.0.2.0, conversion write guards and Code App to Dev to repair year
loading and the disabled Add new transaction button. This supersedes the earlier
deployment restriction for this release only; no financial test records or
additional schema/role changes are authorized.

- Read AGENTS.md, DESIGN.md, PLANS.md, Leave-Follow-Up.md, Payroll-Enhancements.md, the Leave implementation checklist and docs/leave-conversion-editing-plan.md before starting.
- Use relevant Power Platform skills and Microsoft Learn documentation.
- Extend the existing Leave Conversion module and reuse existing components, services and data sources.
- Preserve the Power Apps Code App architecture, authentication and Dataverse integration.
- Do not change Dataverse schema or security roles without separate authorization.
- Do not change payroll formulas, existing cash conversion rules, historical Leave records or existing financial records.
- This task covers the Leave Conversion year list, new year transaction creation, default values, inline row editing and saving. Do not implement unrelated Leave features.
- Creating this prompt does not start implementation.

## Feature: Admin creates and edits an annual Leave Conversion transaction

### Context

The Daily Operation uses Dataverse for Leave records, credit transactions and Leave Conversion. The Leave Conversion page currently lets the admin choose a year and open it. The year page lists each employee's Daily rate, Available VL, VL to convert (max. 5) and Total amount to be paid. It currently works as a preview only.

Reuse the existing Employee, Leave Conversion and Leave Credit Transaction data sources, the existing access profile and the confirmed business rules. Existing employee conversion records will be reused.

The latest owner decisions in PLANS.md and Leave-Follow-Up.md supersede earlier defaults. These include the January 5 annual reset, first effective January 5, 2027 (10 VL and 5 SL). Do not restore older reset rules or assume policies that remain unresolved.

### Current problem

- Admins must pick a year manually through the Year dropdown and "Open year", so a wrong or duplicate year can be opened.
- Available VL and VL to convert have no standard defaults.
- Conversion values cannot be edited or saved. The page is only a preview.

### Investigation first

Before changing code, identify:

- The existing Leave Conversion page, year list, year detail page and their services and queries.
- The actual Dataverse tables, fields and choice values for conversion records, including how a year and an employee's conversion are stored.
- How Daily rate is currently computed (monthly basic salary ÷ 22, rounded to 2 decimals) and where that logic lives.
- How "Active" employees are determined, and how to page through the complete employee set.
- The current meaning of "Refresh balances", and whether saved values must be protected from it.
- Whether the existing server operation supports consistent, retry-safe writes for a whole year of rows.
- Existing admin authorization checks and any unresolved policy that affects saving.
- Whether saving needs fields that do not exist yet (for example year status or audit metadata).

Convert the acceptance criteria into a verification checklist. Report missing prerequisites and any required schema addition without presenting incomplete functionality as working. If a required field is missing, stop that dependent part and ask for authorization.

### Expected behavior

1. **Year list page**
   - Remove the Year dropdown and the "Open year" button.
   - Add a primary "Add new transaction" button in the same position.
   - Keep the year table (Year and Action columns). "View employees" opens that year's page.
   - Show the button only to authorized admins and check authorization again in the click handler. Dataverse/server permissions remain the actual security boundary.

2. **Automatic year**
   - The user never selects or types the year.
   - New year = the highest existing conversion year + 1. If the latest record is 2026, the new transaction is 2027.
   - If no records exist, use the current calendar year.
   - Block duplicates: if the computed year already exists, show a clear message and create nothing.
   - Prevent double clicks. Show a loading state while creating, and show a useful error on failure.
   - After confirmed creation, open the new year's page.

3. **Default values for the new year**
   - Create or load one row for every Active employee.
   - Available VL defaults to 10.00 for all employees.
   - VL to convert defaults to 5.00 for all employees.
   - Daily rate is read-only and uses the existing formula (current monthly basic salary ÷ 22, rounded to 2 decimals).
   - Total amount to be paid = VL to convert × Daily rate, rounded to 2 decimals.
   - Reuse existing employee conversion records where they already exist instead of creating duplicates.

4. **Year detail page**
   - Keep the back link, title, banner, Employees table, paging and "Refresh balances".
   - Columns in order: Employee name (with employee ID), Daily rate, Available VL, VL to convert (max. 5), Total amount to be paid, and a new last column, Action.
   - Display currency as ₱ with thousands separators and two decimals, and VL values with two decimals.

5. **Action column and Edit**
   - Add an Edit button to every row.
   - Edit switches that row to inline edit mode, with no separate page.
   - Employee name, employee ID and Daily rate stay read-only.
   - Available VL and VL to convert become numeric inputs.
   - Total amount recalculates live while editing.
   - In edit mode the Edit button is replaced by "Done" and "Cancel". Cancel restores the row's last values.
   - Validation, with a clear message under the input that blocks Done:
     - Values cannot be negative and must be numeric.
     - VL to convert cannot exceed Available VL.
     - VL to convert cannot exceed 5.
   - Only authorized admins can edit. Reuse the existing access profile.

6. **Save**
   - Add a primary "Save" button to save the leave conversion record for the year.
   - Disable it while there are no unsaved changes, any row is invalid, or saving is pending.
   - Show an "Unsaved changes" indicator and warn before leaving the page or navigating away with unsaved edits.
   - Revalidate authorization and values through the supported server path, then save all rows for the year (update existing, create missing) consistently.
   - Double clicks, retries and uncertain network responses must not create duplicate records.
   - On failure, keep the entered values and show a useful error.
   - After confirmed save, reload the saved values and show: "Leave conversion for {year} saved."
   - Saved values persist and are shown when the year is reopened.

7. **Refresh balances**
   - Do not overwrite unsaved edits without confirmation.
   - Do not silently change saved values. If the intended meaning is unresolved, report the question instead of guessing.

8. **Banner text**
   - Update the current banner, which says amounts are previews, to describe the new behavior accurately.
   - Say that saving records the conversion values.
   - Do not state that credits are deducted or payments are made unless the implementation actually does so.

### Existing data and environment

- Reuse existing tables, generated services and Employee lookups.
- Do not recreate the schema or repeat completed permission setup.
- Do not silently recalculate historical balances or modify existing Leave records.
- Do not create real financial transactions or modify production records without authorization.

### Implementation requirements

- Keep business rules, defaults, calculations and save logic outside presentation components.
- Use strict TypeScript (no `any`), TanStack Query and the existing generated services.
- Use existing shadcn/Radix components, loading indicators and toast patterns.
- Support keyboard navigation, labelled inputs, focus management and accessible error messages.
- Use date-only local values without timezone shifts where dates are involved.
- Do not log employee salary data or personal information.
- Any new field, table, flow or privilege must be identified with its exact purpose before it is added.
- Run relevant unit and integration tests, UI tests, lint and build.
- Record delivered behavior, verification and limitations in the existing Leave checklist, docs/leave-conversion-editing-plan.md and Payroll-Enhancements.md.
- Do not commit, push or deploy unless requested.

### Acceptance criteria

- AC-01: The Year dropdown and "Open year" button are gone, and an authorized admin sees "Add new transaction".
- AC-02: Clicking it creates the next year automatically (latest 2026 becomes 2027), and never creates a duplicate year.
- AC-03: A new year shows every Active employee with Available VL 10.00 and VL to convert 5.00.
- AC-04: Daily rate and Total amount are calculated correctly and Daily rate is not editable.
- AC-05: The Action column has an Edit button that edits only Available VL and VL to convert.
- AC-06: Employee name and Daily rate are view-only in edit mode.
- AC-07: Validation blocks negative values, VL to convert above Available VL and VL to convert above 5.
- AC-08: Total amount updates live while editing and Cancel restores the previous values.
- AC-09: Save persists all rows for the year, and reopening the year shows the saved values.
- AC-10: Save failures preserve edits and leave no incomplete business operation.
- AC-11: Double clicks and retries do not duplicate records.
- AC-12: Leaving the page with unsaved changes prompts the user, and Refresh balances never overwrites them silently.
- AC-13: Non-admin users cannot create, edit or save through the UI or direct data requests.
- AC-14: Payroll formulas, historical records and unrelated features remain unchanged.
- AC-15: Relevant tests, lint and build pass, and unavailable verification is explicitly reported.

### Workflow

1. Investigate the existing implementation, data model and confirmed policies.
2. Report the verification checklist and any specific missing prerequisites or required schema additions.
3. Implement within existing authorization. Pause only the parts that depend on missing decisions or environment changes.
4. Verify new-year creation, defaults, editing, validation, save, persistence and access control.
5. Report completed work, test results and remaining limitations.
