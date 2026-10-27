<<<<<<< HEAD
# Active: Leave Notification Email (New Layout and Remaining Leave Balance)

## Requirements

- Integrate Power Platform Skills
- Extend existing files. Do not rewrite them.
- Use the existing `dataClient`, generated services and shared helpers. No raw fetch. Do not edit generated files by hand.
- Do NOT change any Dataverse security role, table or column.
- Scope: ONLY the leave notification email. Do not change leave rules, credit rules, validation, who gets notified, when it is sent, or anything in payroll.
- Work on a new branch `feature/leave-email-template`. Do not commit to `develop` or `main`.

## Feature: Restyle the leave notification email and show the employee's remaining leave balance

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". When an admin issues a leave, the app emails the employee. The current email has the subject "Your leave has been recorded" and a plain body: "Hello <name>," then "Your leave has been recorded." then Leave type, Benefit, Start date, End date and Recorded days (for example "Recorded days: 1.00"), with no styling. The leave module keeps credits in a ledger, with a balance per employee, leave pool (VL or SL) and year.
=======
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
>>>>>>> feature/Leave-module

### Current problem
1. The email looks like plain text and does not match the look of our other company emails.
2. It does not tell the employee how many leave credits they have left.

<<<<<<< HEAD
### Required behavior
1. **Copy only the layout and styling from the reference email (the "Welcome to Identity & Access Management" notification). Do not copy any of its wording.** The reference layout is:
   - A light grey page background, with a white card on it that has rounded corners and a thin light border. The card is centered, about 600px wide, and fluid on small screens.
   - A bold title at the top of the card, in a dark navy-purple colour, around 17px.
   - Body text in a small, clean sans-serif (about 12px, with generous line height) and near-black.
   - Bold section labels with a colon, followed by a bulleted list.
   - A footer band at the bottom of the card with a slightly darker light-grey background and small, muted, centered text on two lines.
2. **Email structure (the content wording stays as it is today unless listed here):**
   - Title: "Your leave has been recorded"
   - Greeting: "Hello <Employee name>,"
   - Intro line: "Your leave has been recorded."
   - Bold label "Leave details:" followed by a bulleted list: Leave type, Benefit, Start date, End date, Recorded days, and then the new **Remaining balance** item.
   - Footer band: line 1 "© <current year> Automations 365" and line 2 "This is an automated notification from The Daily Operation." Keep these two strings as constants.
3. **Remaining balance item**, based on the leave type:
   - VL leave: the remaining **VL** balance.
   - SL leave: the remaining **SL** balance.
   - Emergency leave: the remaining balance of the pool that Emergency leave is deducted from, using the same pool mapping the leave module uses for deductions. Do not define a second mapping.
   - Format: "Remaining VL balance: 9.17 days (as of Oct 26, 2026)". Two decimals, the pool name in the label, and the send date in the same date style the email already uses.
4. The balance is the balance **after** this leave was recorded. Read it **fresh from Dataverse** after the leave's ledger rows have been written. Do not use cached data. Use the same balance function the Leave page uses, for the same employee, pool and year as the leave dates. Do not write a second calculation.
5. **Unpaid leave and any leave that used no credits:** show the current balance and add one short muted line under the list, "No leave credits were used for this leave." Show this line only when no deduction was written for this leave. Do not decide it from the word "Unpaid" alone.
6. **If the balance cannot be read** (for example a query error), still send the email, leave out the Remaining balance item completely (no blank, no "undefined", no zero), and log a non-sensitive warning. A balance problem never blocks the leave or the email.
7. **Resend and cancellation:** if the app has a Resend action, it uses the same template, and the balance and its "as of" date are the values at the time of sending. If the app already sends a cancellation email, apply the same layout and show the balance after the credits were restored. Do not add new kinds of notification.

### Implementation requirements
- Find where the notification body is built and sent, and where the Resend action is. Tell me which files hold them.
- Put the email layout in one pure function (for example `buildLeaveEmailHtml(data)`) that returns the HTML string, separate from the sending code. All colours, font sizes, the footer text and widths are constants in one style object, so I can adjust them without searching.
- Match the colours and sizes of the reference as closely as you can from the screenshot. Approximate defaults: page background `#f3f5f8`, card `#ffffff` with a `#e3e6ea` border and about 6px radius, title `#3b3b6b`, body text `#1f1f1f`, footer band `#f0f1f3` with `#9a9a9a` text.
- **Email-safe HTML only.** Table-based layout with inline styles, an explicit `bgcolor`/`background-color` and text colour on every block so it stays readable in dark mode, a web-safe font stack (Arial, Helvetica, sans-serif), no external CSS, scripts, web fonts or remote images, and no flexbox or grid. Rounded corners may be ignored by Outlook desktop, and that is fine.
- **Escape every dynamic value** (employee name, leave type, dates and anything else) before putting it into the HTML.
- If the sending method supports a plain-text alternative, include one with the same content. Otherwise skip it.
- Keep the same subject, sender, recipient (the employee's Work Email) and error handling as today. If sending fails, the leave stays issued, a warning is shown, and Resend still works.
- Do not log email bodies, addresses or balances to the console.
- Give me one command to generate a sample HTML file with fictional data, so I can open it in a browser. Do not commit the generated file.
- Add unit tests for `buildLeaveEmailHtml` and the balance line: VL leave, SL leave, Emergency leave, unpaid leave with the "no credits used" line, balance unavailable (item left out), HTML characters in the employee name, and a two-decimal format check.

### Acceptance criteria
1. The email shows the new layout: grey page background, white rounded card, bold title, greeting, bold "Leave details:" label with a bulleted list, and a muted footer band.
2. None of the reference email's wording appears in it. Existing labels and wording stay as they are today, plus the new items above.
3. A VL leave shows the remaining VL balance, an SL leave shows the remaining SL balance, and an Emergency leave shows the balance of the pool it is deducted from.
4. The balance in the email equals the balance on the Leave page for that employee, pool and year at that moment.
5. An unpaid leave shows the unchanged balance and the "No leave credits were used" line. A leave that did deduct credits does not show that line.
6. If the balance cannot be read, the email is still sent without the balance item and has no blank or broken text.
7. Resend (and cancellation, if it exists) use the same layout, and the "as of" date matches the send date.
8. Dynamic values are escaped, and the email has no external resources.
9. It reads correctly in Outlook (desktop and web), Gmail and on a phone, in light and dark mode.
10. Unit tests pass, `npm run build` passes, and the app works after `pac code push`.
=======
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
>>>>>>> feature/Leave-module
