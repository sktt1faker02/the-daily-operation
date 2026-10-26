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

### Current problem
1. The email looks like plain text and does not match the look of our other company emails.
2. It does not tell the employee how many leave credits they have left.

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