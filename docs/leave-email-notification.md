# Leave email layout and remaining balance

Updated 2026-10-26 on `feature/leave-email-template`.

## Scope and implementation

Enhance the recorded-leave notification using the existing Outlook connector.
Keep recipient, subject, notification-attempt handling and posting rules intact.
No schema, security, server assembly, financial records or Payroll changes.

- `src/features/leave/notification-template.ts`: self-contained, escaped HTML
  with a white card, navy heading, leave details, highlighted remaining balance
  and muted footer. Inline styles and presentation tables support email clients;
  layout settings are in `leaveEmailStyle`. No remote images, scripts or fonts.
- `src/features/leave/posting-service.ts`: reads `leaveService.balances` directly
  after confirmed commit/on notification retry. This is the same complete,
  paged **calendar-year ledger balance** used by the Leave page, scoped to the
  recorded employee and leave start year. It does not use the Add Leave form's
  projected pending credits or silently subtract the leave a second time.
- Existing `leaveCreditPool` maps VL/Emergency to VL and SL to SL. No new pool
  mapping or entitlement calculation. Paid and Unpaid use the confirmed stored
  balance. Zero is displayed; an unavailable balance is omitted rather than zero.
- The balance is labelled with the send/retry date in Asia/Manila. Repeated
  notification attempts refresh it. Already-accepted attempts retain the
  existing no-resend behavior. Failure to read balances logs only a generic
  warning and does not stop email sending or change the committed Leave.
- `src/features/leave/retry-email-button.tsx` continues to call the same notify
  operation. No cancellation-email workflow is introduced.

The existing `SendEmailV2` contract accepts HTML but no separate plain-text MIME
alternative. The composer still returns text for consumers/tests; delivery uses
the same HTML body field as before. See [Microsoft's email formatting guidance](https://learn.microsoft.com/power-automate/email-customization).

## Verification checklist

- [x] Preserve subject, linked Work Email, greeting and recorded details; exclude
  internal notes and escape dynamic text.
- [x] Show VL, SL and Emergency's mapped pool with two decimal places.
- [x] Show unchanged available balance for Unpaid; do not apply a second debit.
- [x] Read all ledger pages after commit and refresh on retry; preserve year and
  employee scope. Tests use generated connector mocks, not the balance calculator.
- [x] Omit failed/invalid balances, show verified zero, and send despite read failure.
- [x] Preserve commit/attempt/send/completion order, recipient validation and
  uncertain-send safeguards.
- [x] Browser layout checks at 1000px, 390px and 320px; no horizontal overflow.
- [x] Build/lint and focused tests; final full-suite results in the enhancement log.
- [ ] Outlook desktop/web, Gmail and mobile-mail dark-mode rendering with actual
  approved delivery. Browser checks do not establish email-client fidelity.
- [ ] Live committed balance/send/retry verification with an approved recipient.

## Preview

Generate a fictional preview without contacting Dataverse or sending an email:

```powershell
node scripts/preview-leave-email.mjs
```

Open `.playwright-cli/leave-email/preview.html`. Outputs are ignored by Git.
Optionally pass the path to an installed Playwright `index.mjs` to check Edge
desktop/mobile layouts and save screenshots in the same ignored directory.
The runner blocks network requests and never calls a mail connector.

No commit, push, deployment or real email is included in this implementation.
