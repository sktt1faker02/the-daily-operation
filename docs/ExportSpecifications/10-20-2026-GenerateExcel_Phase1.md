# Active: Export Payroll Period to Excel, Stage 1 of 5 (One Period, One Sheet)

## Requirements

- Integrate Power Platform Skills
- Extend existing files. Do not rewrite them.
- Use the existing `dataClient`, generated services and shared helpers. No raw fetch. Do not edit generated files by hand.
- Do NOT change any Dataverse security role, table or column.
- Scope: ONLY this stage. No dialog, no Summary sheet, no filters, no list-page changes, no audit entry.
- Use ExcelJS for the workbook (not the old `xlsx`/SheetJS package). Pin an exact version and load it with a dynamic import so the main bundle does not grow.

## Feature: "Export" button on the payroll period page that downloads the period's details as .xlsx

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". The period page header shows the period name, a status badge, and buttons (Mark as Paid, Unlock, Archive), followed by summary cards and an employee table (Basic Pay, Allowances, Gross, Deductions, Net Pay).

### Investigation first
Tell me before changing code:
- The files for the period page and its header buttons, the hook that loads the period and its entries and employees, the admin check (for example `isAdmin` from the access profile), the toast component, and the money and date helpers.
- Whether the loaded entry data already has: employee ID, department, other earnings, unpaid leave (days and amount), SSS, PhilHealth, HDMF, withholding tax, other deductions, comment, total deductions, net pay. List any that are missing and where they can come from. Do not recalculate anything differently from the shared calculation function.
- Whether `exceljs` is installed, and the build tool's handling of dynamic imports.

### Expected behavior
1. Add an **Export** button (download icon, secondary style) in the header next to Archive. It is visible only to admins, using the same rule as the other admin-only actions. Employees never see it.
2. Clicking it downloads an `.xlsx` with one sheet named **Details**: one row per employee entry in this period, from the data the page already loaded.
3. Columns, in order: Period, Start, End, Pay date, Status, Employee ID, Employee, Department, Basic Pay, Allowances, Other Earnings, Unpaid Leave (days), Unpaid Leave (amount), Gross Pay, SSS, PhilHealth, HDMF, Withholding Tax, Other Deductions, Comment, Total Deductions, Net Pay. Do not include bank details. Skip a column only if the investigation shows the data truly doesn't exist, and tell me.
4. Formatting: bold header row, frozen first row, autofilter, sensible column widths, money columns as real numbers with a peso format (`"₱"#,##0.00`), dates as real Excel dates, and a bold totals row at the bottom using SUM formulas for the money columns.
5. File name: `Payroll <period label>.xlsx`, with characters invalid in file names removed.
6. The values must match the table on screen exactly. Use the same fields and helpers. Do not recompute totals independently.
7. While building, disable the button and show a spinner. On success, show a toast such as "Exported 4 employees". On failure, show an error toast and download nothing.
8. Use the status label from the app's existing status definitions, not hardcoded text.

### Implementation requirements
- Pure function `buildPayrollDetailRows(period, entries)` that returns plain row objects, separate from the workbook code, so it is unit-testable.
- A separate `createPayrollWorkbook(rows)` and a small `downloadBlob(blob, fileName)` helper using a Blob and an anchor click.
- Unit tests for the row builder and the file-name sanitizer: zero values, empty or null comment, several employees, status label mapping, invalid characters in a period label.
- Downloads from the Power Apps player may behave differently from local dev. Do not build a workaround. Tell me how to test it in the published app.

### Acceptance criteria
- An admin sees Export on the period page, and an employee does not.
- Clicking it downloads a file that opens in Excel with correct, formatted data and a totals row that matches the on-screen cards.
- Numbers are numbers (not text), and the Comment column shows the entry comment.
- Failure shows an error and no file.
- Unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Report the investigation findings first, then implement only this stage.