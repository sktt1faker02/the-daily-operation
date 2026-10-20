# Active: Export Payroll Period to Excel, Stage 5 of 5 (Audit Trail, Safeguards, Polish)

## Requirements

- Integrate Power Platform Skills
- Stages 1 to 4 are done. Extend them. Do not rewrite them.
- Do NOT change any Dataverse security role, table or column unless the investigation shows the audit table cannot store an export entry. If so, stop and tell me what's needed.
- Scope: ONLY this stage.

## Feature: Audit trail entry, "not final" marking, and large-export handling

### Investigation first
Tell me:
- How the existing audit trail entries are written (table, fields, wording, and how an entry is tied to a period), with one example of the current format.
- How the app determines admin access, and whether the export code checks it only by hiding the button.

### Expected behavior
1. **Audit trail:** after a successful export, write an entry per exported period, following the existing format, for example "Exported payroll for Nov 15–30, 2026 (4 employees)". If writing the audit entry fails, still deliver the file but show a warning toast that the audit entry could not be saved. Do not write an entry when the export fails.
2. **Not final:** if any exported period is not in its final status (use the status definitions, for example Processing), add a clearly visible note on the Summary sheet ("Includes periods that are not final: …") and keep the Status column in Details. Show the same warning in the dialog before download.
3. **Admin enforcement:** the export handler itself checks the admin rule and refuses to run otherwise, not only the visibility of the buttons. This is a UI safeguard. Dataverse security is the real boundary.
4. **Workbook properties:** set the title (for example "Payroll export") and creator (the admin's display name).
5. **Large exports:** show a progress message while preparing, keep the UI responsive, prevent double submits, and warn before building if the export would exceed 5,000 detail rows, with Continue and Cancel.
6. **Accessibility and polish:** focus returns to the Export button after the dialog closes, toasts are announced (`aria-live`), and error messages say what to do next.
7. No console logs left over, and no personal data (such as bank numbers) written to the console or the audit trail.

### Implementation requirements
- Pure function that decides the "not final" note from the exported periods, with unit tests: all final, mixed, none final, Archived.
- Pure function for the large-export check with a boundary test at exactly 5,000 rows.
- Add no new dependencies.

### Acceptance criteria
- Each export creates audit entries in the existing format, and a failed audit write only warns.
- Exporting a period that isn't final shows the warning in the dialog and the note on the Summary sheet.
- A non-admin cannot trigger the export even if the handler is called directly.
- Large exports warn before building, and progress text shows.
- Workbook properties are set.
- All earlier stages still work, unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Report the investigation findings first, then implement only this stage.