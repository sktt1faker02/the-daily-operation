# Payslip-ready email notifications

Owner request: 2026-10-26. Implement on the current `Payroll-enhancements`
branch, with the layout from the existing leave notification. No branch switch.

## Scope and task phases

- Phase 7: connect the existing confirmed Mark Ready transition to notification
  sending. Preserve calculations, audit stamps, locking and existing permissions.
- Phase 8: tell each included employee to open The Daily Operation > My Payroll.
- Phase 11: share the existing email-safe card layout and Outlook connector.
- Phase 12: verify recipient scope, complete paging, lifecycle ordering, retries,
  email privacy, desktop/mobile UI and regression behavior.

## Behavior

The existing Mark Ready confirmation explains that it emails included employees.
Only a successful Ready update starts sending; cancellation, a failed transition,
Mark as Paid and Unlock do not send a new batch. The status is refreshed as soon
as the update succeeds, and notification problems do not roll back Ready or
present it as a failed payroll operation.

The sender verifies the signed-in caller's Payroll Admin role and checks the
current period's employee visibility, active state and Ready timestamp. It reads
**every page** of included entries before sending anything, deduplicates by
employee id, then reads only each employee's id, name and stored Work Email.
Excluded entries are never notified, and a partial/unverified roster sends none.
No salary amounts, bank details or PDF attachments are included. Every email
has one recipient; no CC/BCC or shared employee-recipient list is used.

The email uses the existing Outlook connection and shared inline-table layout:
light background, white card, navy heading, payroll-period details, My Payroll
instructions and the Automations 365 footer. Dynamic text is escaped. The app's
existing Dataverse permissions remain the payslip-access boundary.

The results panel distinguishes sender **acceptance**, missing/invalid Work
Email, unreadable employees and uncertain sends. Acceptance is not confirmation
of inbox delivery. One recipient's problem does not prevent later recipients
from being attempted. No automatic email retries occur.

After correcting an employee's Work Email, Retry remaining notifications reads
it again and retries only the remaining entries. An uncertain outcome requires
explicit confirmation after checking the sending account. Accepted recipients
are excluded from retries. A retry keeps the original Ready timestamp and is
blocked after a different release or when the period is no longer visible or
active. Results remain visible after Mark as Paid in the same page session.

Duplicate clicks and action dismissal are blocked while running. Normal route
navigation is blocked until the batch finishes, and tab close/reload requests
the browser's unsaved-work confirmation. Keep the page open until finished.

## Verification checklist

- [x] Remain on the current branch; no generated-source/schema/role changes.
- [x] Mark Ready success precedes all emails; cancel/failure/other actions send none.
- [x] Complete paged roster, employee deduplication, excluded-entry filtering and
  private stored Work Email recipients.
- [x] Reference HTML layout, escaping, correct date-only period/pay dates and no
  financial amounts or attachments.
- [x] Missing address, read failures, empty included list and uncertain outcomes
  produce useful results without undoing Ready or exposing backend details.
- [x] Explicit retry targets only remaining entries, refreshes Work Email and
  requires confirmation for uncertain sends; preserve release identity.
- [x] Sender rejection/lost response is uncertain, not silently retried or
  claimed as delivered.
- [x] Browser flow: success, missing-email repair, uncertain-send confirmation,
  failed status update, cancel, Mark as Paid and 390px layout.
- [x] Email layout at 1000px, 390px and 320px.
- [ ] Live sending, actual Outlook/Gmail inbox rendering and ordinary-account
  security testing require approved users/records and were not performed.

Full automated counts and build/lint results are recorded in
[Payroll-Enhancements.md](../Payroll-Enhancements.md).

## Files and preview

- `src/lib/notification-email.ts`: shared escaped email layout and stored-address
  validation, also reused by the leave composer without changing its content.
- `src/features/payroll/payslip-ready-email.ts`: payroll notification wording.
- `src/features/payroll/services/payslip-ready-notification-service.ts`: authorization, complete
  recipient reads, private sends and per-recipient outcomes.
- `src/features/payroll/hooks/use-payroll-status.ts`, `src/pages/payroll-period.tsx`: Mark Ready wiring,
  confirmation, pending state, navigation protection and results.
- `src/features/payroll/payslip-ready-notifications.tsx`: results and explicit retry UI.

Generate a fictional preview without sending email:

```powershell
node scripts/preview-leave-email.mjs --payslip
```

Open `.playwright-cli/payslip-ready-email/preview.html`. Preview output/cache
is ignored by Git and excluded from lint; it does not replace the app Vite cache.
`scripts/payroll-ready-email-ui-check.mjs` verifies the real page/hooks/services
with synthetic platform boundaries; pass an installed Playwright `index.mjs`
path and run a local Vite server on `127.0.0.1:3103`. External requests are blocked.

## Delivery limits

This follows the existing app-side Outlook pattern, with no new Dataverse
notification fields or Power Automate flow. It runs while this app page stays
open. There is no durable background queue or cross-session send ledger; a
refresh discards the retry report, and a closed/crashed browser can interrupt
delivery. Do not unlock/re-finalize a period just to retry email. Unknown results
must be checked in the sending account before authorizing another attempt.
Concurrent releases/actions from another browser remain governed by existing
Dataverse lifecycle controls; this client does not claim transactional or
exactly-once email delivery. No live emails, records, deployment, commit or push
are part of this implementation.
