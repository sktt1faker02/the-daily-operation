# Active: Show the Other Deductions Comment on the Employee Payslip

## Requirements

- Integrate Power Platform Skills
- Do NOT change any Dataverse security role or environment setting. If the comment comes back empty for the employee because of column-level security or a privilege, tell me the exact table, column and security profile instead of working around it in code.
- Extend existing files. Do not rewrite them.
- Use the existing `dataClient` and generated services. Do not use raw fetch.
- Do not change `calculatePayroll(entry)` or any payroll formulas. This task does not touch calculations.

## Feature: Show the admin's comment under Other Deductions on the payslip screen and PDF

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". In the admin's Edit modal for a payroll entry, the **Comment** field holds the reason for the **Other Deductions** amount. Employees hold `A365 - Payroll Employee` (read-only). They open My Payroll, then Payslip, then "View Payslip" for the PDF.

### Current problem
The employee's payslip shows the Other Deductions amount (for example ₱5,000.00) but not the comment, so they can't tell what the deduction is for. The comment is missing on the screen and in the PDF.

### Investigation first
Before changing code, tell me:
- Which files hold the payslip screen, the PDF generator, the employee payslip query and its select list, and the payslip view model.
- The logical name of the Comment column on Payroll Entry.
- Whether the employee's query selects the comment column, and whether it is mapped into the view model used by the screen and by the PDF.
- Whether the comment comes back null for the employee but has a value when read as an admin. Log the raw row as the employee. If it does, that is column-level security. Report the table, column and profile, and stop there.
- The existing rule that decides whether the Other Deductions row is shown (always, or only when non-zero).

### Expected behavior
1. When the entry has a non-empty (trimmed) comment and the Other Deductions row is shown, display the comment directly under the Other Deductions line on the screen, as a small muted note, for example "Reason: <comment>".
2. In the PDF, show the same comment under the Other Deductions row, or in a "Remarks" line below the deductions table. Keep the existing layout, branding and signature area.
3. Hide the comment completely when it is empty or whitespace-only. No empty placeholder.
4. Render the comment as plain text only, escaped, preserving line breaks. Long comments wrap and must not overflow the card or the PDF page.
5. The amounts and totals do not change.
6. Admin Edit modal: keep the Comment field, but change its placeholder to say it is shown to the employee, for example "Reason for other deductions (shown to the employee on their payslip)".

### Implementation requirements
- Add the comment to the select list of the employee payslip query and to the payslip view model once, and have both the screen and the PDF read it from the same view model. Do not fetch it separately in the PDF.
- Employees remain read-only. Do not add any edit control.
- Keep current visibility rules: employees only see their own finalized payslips.
- If the comment column is unavailable to the employee, the payslip must still render without it. Tell me what is missing.
- Add unit tests for the mapping and rendering logic: non-empty comment, empty comment, whitespace-only comment, multi-line comment, very long comment, and a comment that contains HTML characters.

### Acceptance criteria
- The test user (Payroll Employee) opens a payslip where Other Deductions is non-zero and has a comment: the comment shows under that line on the screen and in the PDF.
- A payslip with an empty comment shows nothing extra.
- A comment with `<`, `>` or `&` characters appears as typed.
- Amounts and totals are identical to before.
- The admin Edit modal text says the comment is shown to the employee.
- Unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Before changing code, briefly tell me which files hold the payslip screen, the PDF generator, the employee payslip query, and the Edit modal, and what the investigation found about the comment column for an employee. Then make the changes.