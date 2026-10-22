```markdown
# Active: Add Leave Button, Admin Entry Modal and Email Notification

## Requirements

- Read AGENTS.md, DESIGN.md, PLANS.md, Leave-Follow-Up.md and the Leave implementation checklist before starting.
- Use relevant Power Platform skills and Microsoft Learn documentation.
- Extend the existing Leave module and reuse existing components, services and data sources.
- Preserve the Power Apps Code App architecture, authentication and Dataverse integration.
- Do not change Dataverse schema or security roles without separate authorization.
- Do not change payroll formulas, cash conversion or existing financial records.
- This task covers adding a Leave record and notifying the employee. Do not implement unrelated Leave features.
- Creating this prompt does not start implementation.

## Feature: Admin records employee leave through a modal and sends an email confirmation

### Context

The Daily Operation uses Dataverse for Leave records and credit transactions. Payroll Admin manages leave directly; there is no approval workflow.

Reuse the existing Leave, Employee and Leave Credit Transaction data sources, existing access profile and confirmed business rules.

The latest owner decisions in PLANS.md and Leave-Follow-Up.md supersede earlier defaults. Do not restore January reset rules or assume policies that remain unresolved.

### Current problem

Admins need a clear action to record employee leave, see the selected employee’s available credits before submitting, and notify that employee once the leave is successfully recorded.

### Investigation first

Before changing code, identify:

- The existing Leave page and suitable location for an Add Leave button.
- Existing leave-entry dialogs or operations that can be extended instead of duplicated.
- Employee lookup, current balance queries, credit allocation rules and safe posting service.
- Actual Dataverse fields, choice values and relationship bindings.
- The available email connector or Power Automate notification mechanism, sender account and required connection.
- Any unresolved counting, holiday, insufficient-credit or allocation rule that affects submission.
- Whether the existing server operation guarantees consistent Leave and ledger writes, safe retries and concurrent balance validation.

Convert the acceptance criteria into a verification checklist. Report missing prerequisites without presenting incomplete posting or email functionality as working.

### Expected behavior

1. **Add Leave button**
   - Add a clearly labelled “Add Leave” button to the existing Leave page.
   - Show it only to authorized admins.
   - Check authorization inside the submit handler as an additional safeguard.
   - Dataverse/server permissions remain the actual security boundary.

2. **Leave modal**
   - Clicking Add Leave opens a modal titled “Add Leave”.
   - Include:
     - Employee: searchable selection using existing Employee records.
     - Leave Type: VL, SL or Emergency.
     - Benefit: Paid or Unpaid, following the confirmed allocation policy.
     - Start Date and End Date as separate labelled date fields.
     - Calculated leave days, using approved counting and partial-day rules.
     - Optional Note.
   - Do not guess whether insufficient credits require fully Unpaid leave or a Paid/Unpaid split. Follow recorded decisions or clarify the unresolved case.
   - Use date-only local values without timezone shifts.

3. **Current leave balance**
   - After selecting an employee, show their current VL and SL balances with the applicable balance period.
   - Use complete, correctly scoped ledger data, including pagination where needed.
   - Display credits with two decimal places.
   - Show the applicable credit pool and proposed deduction or unpaid treatment.
   - Refresh the preview when relevant selections change.
   - Show loading and error states. Never display a failed balance query as zero.
   - Prevent an older employee’s response from appearing after the selection changes.

4. **Cancel**
   - Provide footer buttons labelled “Cancel” and “Submit”.
   - Cancel closes the modal without creating Leave records, changing credits or sending email.
   - Reopening starts a fresh form.
   - While submitting, prevent dismissal from suggesting that an in-flight operation has been cancelled.

5. **Validation**
   - Require Employee, Leave Type, Benefit and valid dates.
   - End Date cannot precede Start Date.
   - Apply confirmed eligibility, overlap, holiday, day-counting and credit rules.
   - Block filing on Philippine holidays according to the approved counting policy and verified holiday source.
   - If necessary policy or holiday data is unavailable, show a clear explanation instead of inventing a result.
   - Disable Submit while invalid, required data is loading or submission is pending.

6. **Submit and save**
   - Revalidate authorization and current balance through the supported server posting path.
   - Save the Leave as Issued with the authenticated admin and issue timestamp.
   - For Paid leave, create the required credit deductions consistently with the Leave record.
   - Unpaid leave creates no credit deduction.
   - Preserve transaction and concurrency guarantees already required by PLANS.md.
   - Double clicks, retries and uncertain network responses must not duplicate the Leave or its ledger transactions.
   - On save failure, retain entered values and show a useful error.
   - After confirmed save, refresh the Leave list and affected balances, then close the modal.

7. **Email notification**
   - Only after the Leave operation commits, notify the selected employee at their stored Work Email.
   - Do not send to an arbitrary address entered in the modal.
   - Use the approved connector or flow and confirmed sender identity.
   - Subject: “Your leave has been recorded”.
   - Include employee name, leave type, benefit, dates and recorded days.
   - Include remaining credits only when accurately available.
   - State that the leave has been recorded; do not describe an approval process.
   - Exclude internal notes and other employees’ information.
   - Record notification status using the existing fields.
   - Set Sent and Notified On only after the sending mechanism confirms acceptance. Do not claim inbox delivery.
   - If email is missing or sending fails, preserve the committed Leave, record Failed and show:
     “Leave recorded, but the email notification could not be sent.”
   - Provide a retry/resend action that operates on the existing Leave without creating another record or deduction.
   - Reuse existing notification handling and avoid duplicate send triggers.
   - Report any uncertainty after a send timeout; do not promise exactly-once email delivery without supported safeguards.

### Existing data and environment

- Reuse existing tables, generated services and actual Employee/User lookups.
- Do not recreate the schema or repeat completed permission setup.
- Do not silently recalculate historical balances or modify existing Leave records.
- Do not grant employees access to Leave tables merely to send an email.
- Do not create real Leave transactions or send test emails without authorization for the test employee and recipient.

### Implementation requirements

- Keep business rules, posting and notification logic outside presentation components.
- Use strict TypeScript, TanStack Query and existing generated services.
- Use existing shadcn/Radix Dialog, form controls, loading indicators and toast patterns.
- Support keyboard navigation, labelled fields, focus management and accessible errors.
- Preserve values after failed submission.
- Distinguish “saving leave” from notification status.
- Do not log employee addresses, notes or email contents.
- Any new connector, flow, server component or privilege must be identified with its exact purpose and configuration.
- Use mocks for automated email tests.
- Run relevant unit/integration tests, UI tests, lint and build.
- Record delivered behavior, verification and limitations in the existing Leave checklist and Payroll-Enhancements.md.
- Do not commit, push or deploy unless requested.

### Acceptance criteria

- AC-01: An authorized admin can open Add Leave from the Leave page.
- AC-02: The modal supports employee, leave type, benefit and date-range selection.
- AC-03: Selecting an employee shows correct current VL/SL balances with loading and error states.
- AC-04: Cancel closes the modal without writes or notifications.
- AC-05: Invalid dates and other confirmed business-rule violations block submission with clear messages.
- AC-06: Submit creates one Issued Leave and exactly its required credit transactions.
- AC-07: Save failures preserve form values and leave no incomplete business operation.
- AC-08: Duplicate submissions and retries do not duplicate Leave records or deductions.
- AC-09: Successful creation refreshes the list and balances and closes the modal.
- AC-10: Email is triggered only for a committed Leave and uses the selected employee’s stored Work Email.
- AC-11: Missing email or send failure preserves the Leave and supports notification-only retry.
- AC-12: Non-admin users cannot perform the operation through the UI or direct data requests.
- AC-13: Payroll formulas, historical records and unrelated features remain unchanged.
- AC-14: Relevant tests, lint and build pass; unavailable verification is explicitly reported.

### Workflow

1. Investigate existing implementation and confirmed policies.
2. Report the checklist and any specific missing prerequisites.
3. Implement within existing authorization; pause only dependent actions requiring missing decisions or additional environment changes.
4. Verify modal behavior, posting consistency, access and notification failure/retry cases.
5. Report completed work, test results and remaining limitations.
```

## Owner-authorized submission follow-on — 2026-10-22

The subsequent owner instruction to execute the recommended approaches resolves
the earlier date/eligibility/holiday/April-credit/server/Outlook setup blockers.
Concrete adopted policies, exact new components and verification are recorded in
[submission implementation](docs/leave-posting-implementation.md) and the
[acceptance checklist](docs/leave-implementation-checklist.md). The original
requirements above remain the Add Leave scope; older blocker descriptions are
historical. 2027 filing awaits separate Eid proclamations. No app publication,
financial test transaction or test email was performed. Expanded cancellation,
conversion and Payroll integration remain in [Leave follow-up](Leave-Follow-Up.md).
