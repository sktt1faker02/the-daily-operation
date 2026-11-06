# Active: Export Payroll Period to Excel, Stage 2 of 5 (Dialog, Summary Sheet, Column Groups)

## Requirements

- Integrate Power Platform Skills
- Stage 1 is done (Export button, row builder, workbook builder, download helper). Extend it. Do not rewrite it.
- Use the existing dialog and checkbox components. Do not add new UI libraries.
- Do NOT change any Dataverse security role, table or column.
- Scope: ONLY this stage. Still exporting only the period being viewed. No list-page changes, filters or audit entry yet.

## Feature: Export dialog with detail level, column groups and a Summary sheet

### Context
The Export button on the period page currently downloads immediately. It should open a dialog where the admin picks what goes in the file, with defaults that make the common case one click.

### Investigation first
Tell me:
- Where the Stage 1 code lives, and how the dialog component is used elsewhere (for example the "New payroll period" dialog) so this one matches.
- Where the current user's display name is available for "Exported by".
- Which columns belong to each group below, based on what the Stage 1 builder produces. Bank details (bank name and account number) come from the Employee table. Tell me whether the loaded employee data already includes them, and if not, what the smallest extra read would be.

### Expected behavior
1. The Export button opens a dialog titled "Export payroll to Excel". The title area shows the period name and status.
2. **Detail level** (segmented control, default Full detail):
   - **Summary**: Details sheet with only Period info, Employee, Department, Gross Pay, Total Deductions, Net Pay.
   - **Full detail**: all column groups except Bank details.
   - **Custom**: shows the group checkboxes below.
3. **Column groups**: Employee info (ID, department), Earnings (basic pay, allowances, other earnings, unpaid leave days and amount), Government deductions (SSS, PhilHealth, HDMF, withholding tax), Other deductions and comment, and Bank details. Gross Pay, Total Deductions and Net Pay are always included and cannot be unticked. Choosing Summary or Full detail updates the checkboxes to match. Editing a checkbox switches the level to Custom.
4. **Bank details** is off by default. When ticked, show a short warning: "Includes bank account numbers. Share this file carefully."
5. A live count line, for example "4 employees · 1 period · 19 columns", and the file name.
6. Workbook now has two sheets: **Summary** (one row per period with Period, Start, End, Pay date, Status, Employees, Gross, Total Deductions, Net, plus "Exported by" and "Exported on" with the date and time) and **Details** (as selected).
7. Buttons: Cancel and **Download Excel**. Download shows a spinner, then closes the dialog and shows the success toast. On error, keep the dialog open and show the error.
8. Keyboard support, focus trap, Escape closes, and a visible focus state.

### Implementation requirements
- The group-to-column mapping is a single config object used by the dialog, the row builder and the column count. No duplicated lists.
- Pure function `selectColumns(level, groups)` with unit tests for every level, the always-included totals, and the Bank details default.
- Summary sheet formatting: bold header, peso formats, frozen header.

### Acceptance criteria
- Export opens the dialog, and one click on Download gives the same full file as before plus a Summary sheet.
- Summary level gives the short Details sheet, and Custom lets groups be ticked.
- Bank details are absent unless ticked, and the warning shows when they are.
- The count line matches the file.
- Unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Report the investigation findings first, then implement only this stage.