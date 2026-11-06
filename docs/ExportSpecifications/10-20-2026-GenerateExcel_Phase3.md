# Active: Export Payroll Period to Excel, Stage 3 of 5 (List Page: Row Icon and Multi-Select)

## Requirements

- Integrate Power Platform Skills
- Stages 1 and 2 are done. Reuse the dialog, row builder, workbook builder and download helper. Do not duplicate them.
- Do NOT change any Dataverse security role, table or column.
- Scope: ONLY this stage. No date-range, status or department filters and no audit entry yet.

## Feature: Export one or several periods from the Payroll list page

### Context
The Payroll list shows the active periods (Period, Start, End, Pay date, Status, Archive) and, below it, an Archived section. Several periods share the same label (for example two "Oct 16–31, 2026" rows), so labels are not unique.

### Investigation first
Tell me:
- The files for the list page and its two tables.
- How to load the entries and employees for several periods in one go: the existing service functions, whether queries page their results, and how large a filter can be. Propose chunking (for example 10 periods per query) if needed.
- Whether period ID is available on each row.

### Expected behavior
1. **Row icon**: a small download icon button with a tooltip "Export to Excel" on each row, active and archived. It opens the existing dialog for that period.
2. **Multi-select**: a checkbox on each row of the active table, plus a select-all checkbox in the header (active rows only). Archived rows get the icon only.
3. When at least one row is selected, show a bar above the table: "3 periods selected · Export to Excel · Clear". Export opens the dialog with "Selected periods (3)".
4. **Dialog additions for multiple periods**: a **Layout** choice: "One Details sheet for all periods" (default) or "One sheet per period".
   - Single sheet: every row carries Period, Start, End, Pay date and Status, so duplicates are distinguishable.
   - Per-period sheets: sheet names are at most 31 characters, remove the characters `\ / ? * [ ] :`, and are unique (append the start date or " (2)" when labels collide).
   - The Summary sheet has one row per period.
5. File name for several periods: `Payroll <earliest start> to <latest end>.xlsx`, sanitized. Single period keeps the Stage 1 name.
6. Count line updates: "12 employees · 3 periods · 19 columns".
7. Loading: fetch entries for the selected periods in chunks, handle paging, show progress text such as "Preparing 2 of 3 periods…", disable the button to prevent double submits, and fail the whole export with a clear error if any chunk fails (no partial file).
8. Selection persists until cleared or the page is left. Export does not clear it.
9. The icon and selection controls are admin-only, like the period page button.

### Implementation requirements
- Pure functions for sheet-name sanitizing and de-duplication, and for building the multi-period row set, with unit tests: duplicate labels, long labels, invalid characters, zero selected, one selected, many selected.
- Reuse the Stage 2 column-group config. Do not fork it.
- Keep the list page's existing sorting, Archive and Unarchive behavior unchanged.

### Acceptance criteria
- The row icon exports that period through the same dialog.
- Ticking several rows shows the bar, and the dialog offers both layouts.
- The single-sheet file has rows from every selected period with distinguishing columns, and the per-period file has unique, valid sheet names.
- Totals per period match the numbers on each period page.
- Unit tests pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
Report the investigation findings first, then implement only this stage.