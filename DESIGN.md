# Active: Simplify the Payroll Period Status Flow (Processing → Ready → Locked)

## Requirements

- Integrate Power Platform Skills
- Extend existing files. Do not rewrite them.
- Use the existing `dataClient` and generated services. No raw fetch.
- Do NOT change any Dataverse security role. Do NOT edit generated data-source files by hand. Do NOT change the Dataverse schema or run any data migration without my approval. Tell me the manual steps instead.
- Do not change payroll calculations or the Archive behavior unless a Draft or Paid reference forces it. Report any such case first.

## Feature: New status flow, earlier employee visibility, and Mark as Paid locks automatically

### Context
Power Apps code app (React + Vite + TypeScript, Dataverse backend) called "The Daily Operation". A payroll period currently moves through Draft → Processing → Ready → Paid → Locked. The period table has Paid By, Paid On, Locked By and Locked On columns. Employees (`A365 - Payroll Employee`, read-only) can see a period's payslips only after it is marked Paid and then Locked.

### Current problem
There are too many statuses and too many manual steps. Draft is unnecessary, Paid and Locked are separate steps, and employees can't see their payslip until the very end.

### Target flow
Processing → Ready → Locked (shown to the admin as "Paid / Locked").
1. **Create period**: initial status is **Processing**. The Draft status no longer exists.
2. **Mark Ready**: status becomes **Ready**. From this moment employees can see their payslips for this period.
3. **Mark as Paid**: one action. It sets Paid By and Paid On, sets Locked By and Locked On, and sets the status to **Locked**, all in the same update. "Paid" is no longer a separate resting status.

### Investigation first
Before changing code, tell me:
- Every place the status is defined or used: enums or option constants, type unions, label and badge maps, status filters, button visibility and disabled rules, the dashboard "Recent Payroll" list and its latest-cutoff logic, the employee My Payroll list and payslip screens, PDF code, and tests.
- The numeric option values of the Status choice in the generated model, and which options exist (Draft, Processing, Ready, Paid, Locked, Archived or others).
- What currently moves a period from Draft to Processing (a button, or automatic). Report it. It will be removed.
- Whether a standalone "Lock" or "Unlock" button exists, and whether a Ready → Processing "reopen" action exists. Report them and wait for my answer on Unlock or reopen. Remove only the standalone Lock button.
- **How employee visibility is enforced today**: a status filter in the employee query, and/or ownership or sharing of entries assigned when a period is marked Paid or Locked. Name the file and function for each.
- The Dataverse default value of the Status column, if the generated model shows one.

### Expected behavior
1. **Single source of truth.** Create one status module (for example `period-status.ts`) that defines the statuses, allowed transitions, display labels, whether admin editing is allowed, and whether employees can see the period. All components read from it. Remove scattered status checks.
2. **Create**: new periods are saved with status Processing. Set it explicitly in code, even if Dataverse has a different default.
3. **Remove Draft everywhere in the app**: types, maps, labels, colors, filters, tests, and any "Start processing" control. Anything that was available in Draft or Processing (Load employees, Copy previous cutoff, Load template, editing entries, Mark Ready) is available in Processing.
4. **Allowed transitions**: Processing → Ready → Locked. Nothing else, unless the investigation finds an existing Archive or reopen rule that must be kept. Report those.
5. **Mark Ready**: keep the existing check that every entry has calculated values (recalculate or block with a clear message). Then set status Ready and make the period visible to employees (rule 7). If making it visible fails for any entry, do not change the status, show a clear error, and keep the action retryable.
6. **Mark as Paid**: allowed only from Ready. Set Paid By and Paid On to the current admin user and now, set Locked By and Locked On to the same, and set status Locked, in a single Dataverse update. On failure nothing changes. Remove the separate Lock step. Locked periods stay read-only, as locked periods are today.
7. **Employee visibility**: employees can see a period's payslips when its status is Ready or Locked, and never in Processing. Move whatever grants visibility today (the status filter, and any ownership assignment or sharing triggered on Paid or Locked) so it takes effect at Mark Ready. Keep the Mark as Paid step from needing to grant anything again. If a reopen action exists, report how visibility is removed on reopen and wait for my decision.
8. **Display**: admin status badges show Processing, Ready and Locked (use the existing Locked label and style). Where a "Paid" badge was shown, use the Locked label. On the employee payslip, a Ready period shows the Ready badge. Do not invent new wording. List every place a badge is rendered so I can review the wording.
9. **Dashboard and lists**: update any "latest cutoff" or "recent payroll" logic that depended on Draft, Paid or Locked so it uses the new flow. Tell me what you changed.
10. Keep the existing Archive behavior. If Archive depended on Paid or Locked, tell me how it behaves now.

### Existing data (do not run anything yet)
Propose a one-time migration and wait for my approval:
- Periods with status Draft become Processing.
- Periods with status Paid (not yet Locked) become Locked. Copy Paid By and Paid On into Locked By and Locked On only where those are empty.
- Periods already Locked, and Ready, Processing and Archived, are unchanged.
Also list the manual Dataverse steps I will do afterwards: remove the Draft option (and the Paid option if nothing uses it) from the Status choice, change the column's default to Processing if it differs, and refresh the data source so the generated model matches.

### Implementation requirements
- Put the transition and visibility rules in pure functions (for example `canTransition(from, to)`, `isVisibleToEmployee(status)`, `isEditable(status)`) and unit-test them.
- Dates and user fields are written the same way as today (same types and formats).
- Do not weaken Dataverse security or add any client-side-only protection and call it security.
- The employee My Payroll list must show a Ready period and hide a Processing period.

### Acceptance criteria
- A new period is created as Processing. Draft appears nowhere in the app.
- Mark Ready sets Ready, and the test employee can immediately open that period's payslip.
- A Processing period is not visible to the employee.
- Mark as Paid works only from Ready, and in one update sets Paid By/On, Locked By/On and status Locked. The period is then read-only.
- No separate Lock button remains.
- A failure in Mark Ready or Mark as Paid leaves the period's status and data unchanged and shows an error.
- Dashboard and period lists show the new statuses correctly. Calculations are unchanged.
- Unit tests for the status module pass, `npm run build` passes, and the app works after `pac code push`.

### Workflow
First report the investigation findings, including how employee visibility is enforced, then wait for my answers on Unlock, reopen and the migration. Then make the code changes.