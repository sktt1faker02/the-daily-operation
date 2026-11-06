# Active: Export Payroll Period to Excel, Stage 4 of 5 (Filters)

## Requirements

- Integrate Power Platform Skills
- Stages 1 to 3 are done. Extend the dialog and the data loading. Do not rewrite them.
- Reuse the pattern from the "New payroll period" dialog: two separate single-date fields (Start and End), where dates in the End calendar before the Start date are disabled.
- Do NOT change any Dataverse security role, table or column.
- Scope: ONLY this stage. No audit entry yet.

## Feature: Date range, status and department filters in the export dialog

### Investigation first
Tell me:
- The files to change, and how periods are fetched for a date range today.
- The status definitions, including how Archived is represented, and where department comes from on the employee data.

### Expected behavior
1. In the dialog's "What to export" section add a third option, **Date range**, next to "This period" (period page) and "Selected periods" (list page). On the list page also offer "All periods".
2. **Date range** has Start date and End date fields with the disabled-before-start behavior. It matches periods whose **pay date** falls inside the range, and a helper text says so.
3. **Status** checkboxes use the app's status definitions (not hardcoded text). Archived is off by default and the others are on by default. Archived periods are included only if ticked.
4. **Department** multi-select, built from the departments that appear on the loaded employees. Default is all. It filters the Details rows only. Period totals on the Summary sheet are recalculated from the rows included.
5. On the period page, add a checkbox "Only the employees currently shown in the table" that respects the page's employee search. Off by default.
6. The count line updates live: "9 employees · 3 periods · 19 columns". When nothing matches, show "No payroll data matches these filters" and disable Download.
7. Filters never change the saved data, and the dialog resets its filters each time it opens.

### Implementation requirements
- Pure function `filterPeriodsAndEntries(periods, entries, filters)` with unit tests: pay date on the range boundaries, status combinations, Archived off and on, department filter, empty result, one-day range.
- Dates are date-only local values with no UTC off-by-one.
- Use the same chunked loading as Stage 3.

### Acceptance criteria
- A date range returns exactly the periods whose pay date is inside it.
- Unticking a status removes those periods, and Archived appears only when ticked.
- The department filter reduces the rows, and the Summary sheet totals still reconcile with the rows.
- "Only the employees currently shown" matches the table search on the period page.
- No matches disables Download with the message.
- Unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Report the investigation findings first, then implement only this stage.