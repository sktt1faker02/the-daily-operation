# Active: Employee Leave History under My Portal

## Requirements

- Integrate relevant Power Platform Skills.
- Follow `AGENTS.md`, `DESIGN.md` and Payroll domain guidance.
- Extend existing files and reuse existing components, hooks and services where appropriate. Do not rewrite unrelated features.
- Use the existing `dataClient` and generated services. No raw fetch or hand-editing generated files.
- Do NOT change Dataverse security roles, schema, ownership or sharing, or run migrations without my approval. Report any required manual steps.
- Work on the currently checked-out branch.
- Scope: a read-only **Leave History** page under **My Portal**. Preserve existing admin Leave Management, leave rules, balances, notifications and payroll behavior.

## Feature: Employees and admins can view their own leave history

### Context

The Daily Operation is a Power Apps code app using React, Vite, TypeScript and Dataverse.

The existing admin Leave Management page displays employee leave records, VL and SL balances, filters and record details.

Employees need a personal version under **My Portal → Leave History**. Payroll Admins who are also linked to an employee record must be able to view their own leave history through the same portal.

### Current problem

Employees need a dedicated page to review their recorded leave and remaining balances. Only admins can add leave through the existing admin workflow.

### Required behavior

1. **Navigation and access**
   - Add **Leave History** under **My Portal**, alongside **My Payroll**.
   - Show this portal grouping for eligible employees and admins linked to an employee record.
   - Resolve the current employee using the existing authenticated-user mapping.
   - An admin’s Leave History page shows their own records. Their existing admin Leave Management access remains available separately.
   - If no employee record is linked, show an explanatory unavailable state without querying unrestricted leave data.

2. **Page layout**
   - Use the supplied screenshot as the layout reference while following existing application styling.
   - Page title: **Leave History**.
   - Subtitle: **View your leave records and remaining balances.**
   - Do not display **Add Leave**, including for admins viewing this personal page.
   - Replace the admin instructions with: **Leave is recorded by your administrator. This page is read-only.**
   - Display the current employee’s name as read-only information. Do not provide an employee selector.

3. **Year and search**
   - Include **Year**, **Search record name** and **Apply filters**.
   - Default to the current year.
   - Reuse existing year validation and leave-year filtering semantics.
   - Applying filters must retain the current employee scope.
   - Do not hardcode the screenshot’s employee, year or sample records.

4. **Leave balances**
   - Display **VL balance · [year]** and **SL balance · [year]**, with values in days.
   - Reuse the existing balance service, calculation and formatting.
   - Balances represent the current employee and selected year; search and record filters must not alter them.
   - Include **Refresh balances**, which refreshes displayed data without creating or changing credit movements.
   - Preserve existing no-credit-history messaging. Never present an unavailable or incomplete balance as zero.

5. **Record filters and table**
   - Include **Status**, **Leave type** and **Benefit** filters, each defaulting to **All**.
   - Reuse existing choice labels and filtering behavior.
   - Match the screenshot’s table columns: **Record, Employee, Type, Benefit, Dates, Days, Status, Action**.
   - Every row belongs to the current employee.
   - The only row action is **Details**.
   - Reuse existing sorting and paging behavior, with server filtering and paging where supported.

6. **Read-only details**
   - Open details for the selected personal leave record.
   - Verify the record belongs to the current employee before displaying it.
   - Provide no create, edit, issue, cancel, delete, resend or other administrative actions.
   - Reuse suitable existing detail fields. Report uncertainty about sensitive or internal fields before exposing them.

7. **States and accessibility**
   - Provide clear loading, success, empty and error states for employee resolution, records, balances and details.
   - Distinguish no recorded leave from no matching filter results.
   - Provide retry actions for failed reads.
   - Keep filters labelled, statuses readable as text, details keyboard accessible and the layout usable on smaller screens.

### Security requirements

- Employee identity must come from authenticated context, never a user-selectable employee ID.
- Scope list, balance and detail requests to the resolved employee.
- Prevent URL or record-ID manipulation from displaying another employee’s records through this portal.
- Enforce employee record access through Dataverse permissions; application filters are supplementary protection.
- Preserve admins’ existing authorized privileges. The personal page’s scope must not be described as a restriction on their broader admin access.
- If current permissions cannot support this safely, report the gap and required manual configuration before dependent implementation.

### Implementation requirements

- Follow Component → Hook → Service → Dataverse.
- Use TanStack Query for server state, with cache keys scoped by employee and relevant filters.
- Reuse leave-domain logic without duplicating balance calculations or introducing new leave policies.
- Keep admin actions out of the personal details flow.
- Convert every acceptance criterion below into a concrete verification checklist before editing.
- Record the completed enhancement in `Payroll-Enhancements.md`, including verification and remaining limits.

### Acceptance criteria

- [ ] Eligible employees and admins see **My Portal → Leave History**.
- [ ] Both roles see their own linked employee’s records and balances.
- [ ] No employee selector or Add Leave button appears.
- [ ] Year, search, Status, Leave type and Benefit filters work together without losing employee scope.
- [ ] VL and SL balances match existing admin results for the same employee and year.
- [ ] Record filters do not change balance totals; Refresh balances performs no business-data writes.
- [ ] The table contains the specified columns and opens read-only details.
- [ ] Administrative actions are absent from the personal page and its details.
- [ ] Missing employee linkage, loading, empty results and read failures have clear states.
- [ ] Employee A cannot read Employee B’s records through the page, manipulated IDs or direct Dataverse requests.
- [ ] Existing admin Leave Management, leave calculations, notifications and payroll behavior remain unchanged.
- [ ] Relevant automated tests, `npm test`, `npm run lint`, `npm run build` and relevant Playwright checks pass.
- [ ] Live security checks are verified with actual user accounts, or explicitly reported as unverified.
