# Active: Split the New Payroll Period Date Range Into Start Date and End Date

## Requirements

- Integrate Power Platform Skills
- Extend existing files. Do not rewrite them.
- Use the existing date picker / calendar component. Do not add a new date library.
- Scope: ONLY the "New payroll period" dialog. Do not change how periods are saved, named or listed, and do not change any Dataverse table, column or security role.

## Feature: Separate Start Date and End Date fields with linked defaults

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". On the Payroll Periods page, "New payroll period" opens a dialog with a single range field ("Period (start – end)", for example "Sep 15, 2026 – Sep 15, 2026") that opens a two-month range calendar, plus a Pay date field. The dialog also shows "This period will be named Sep 15–15, 2026."

### Current problem
One range field for both dates is easy to misread and misclick. It is unclear which click sets the start and which sets the end, and the pay date is set separately and can be left inconsistent with the period (for example a period ending Sep 15 with a pay date of Nov 15).

### Investigation first
Before changing code, tell me:
- The files for the dialog, the date range picker, the default-date logic ("Semi-monthly defaults are suggested from today"), the period label builder, and the create handler.
- How the start, end and pay dates are currently stored in the form state and sent to Dataverse (type and format).
- What the current defaults logic does for today's date, and whether it produces the values in the screenshot (period Sep 15 – Sep 15, pay date Nov 15). Report only. Do not change the defaults logic.

### Expected behavior
1. Replace the single range field with two fields: **Start date** (required) and **End date** (required). Each opens its own single-date calendar.
2. **End date follows the start date.** When the dialog opens, and whenever the Start date changes, the End date is set to the Start date until the admin explicitly picks an End date. After the admin has picked one, changing the Start date does not change the End date, except in rule 4.
3. **End date calendar:**
   - It opens on the Start date's month.
   - Every date earlier than the Start date is disabled: shown muted, not selectable by click or keyboard, and marked `aria-disabled`.
   - The Start date itself and all later dates are selectable, so a one-day period remains possible.
4. If the Start date is changed to a date later than the current End date, set the End date to the new Start date.
5. **Pay date is auto-populated and equals the End date.** It updates whenever the End date changes, until the admin edits the Pay date manually. After a manual edit, the End date no longer overwrites it. The Pay date stays editable.
6. Keep the "This period will be named …" preview and update it live from the Start and End dates, using the existing label builder. Do not change the label format.
7. Keep the existing starting defaults for Start and End as they are. Pay date now follows End from the first render.
8. "Create period" is disabled until both Start and End are set and End is not earlier than Start. Keep the existing Cancel behavior and reset the dialog state each time it opens.
9. Show a short helper text under End date, for example "Dates before the start date are unavailable."

### Implementation requirements
- Treat the three dates as date-only values in local time. No UTC conversion, so no off-by-one-day errors when saving or showing them.
- Put the linking rules in small pure helper functions (for example `applyStartChange`, `applyEndChange`, `isEndDateDisabled`) so they are unit-testable. Do not bury them in the component.
- The values sent to the create handler must have the same shape and format as before.
- Keep accessibility: each field has its own label, the required marker, keyboard navigation, and visible focus. If the calendar is react-day-picker, use its `disabled` and `defaultMonth` props.
- Keep the dialog layout consistent with the existing style and usable on narrow screens: fields stacked, or Start and End side by side on wide screens.

### Acceptance criteria
- The dialog shows separate Start date and End date fields, with no combined range field.
- Opening the dialog sets End date equal to Start date and Pay date equal to End date.
- Picking a Start date updates End date (if the admin hasn't picked one) and Pay date to match.
- In the End date calendar, dates before the Start date are disabled and cannot be clicked or selected with the keyboard.
- Choosing a later End date updates Pay date to the same date, until the Pay date is edited by hand.
- Changing the Start date to a date after the current End date moves End and Pay date to the new Start date.
- The period name preview updates live and uses the same format as before.
- Created periods are saved with the same data shape as before, and the dates are not off by a day.
- Unit tests cover: start change before and after the end date, end change, pay date following end, pay date after a manual edit, disabled-date check, and a one-day period.
- `npm run build` passes and the app works after `pac code push`.

### Workflow
First report the investigation findings, then make the changes.