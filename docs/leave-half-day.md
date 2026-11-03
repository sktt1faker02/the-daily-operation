# Half-day VL and General Leave

Owner request: 2026-11-03. Owner authorized deployment; app and Leave plugin
1.0.3.7 are published to The Daily Operation - Dev.

## Verification checklist

- [x] New VL records offer Full day and Half day (0.5 VL credit), with no AM/PM field.
- [x] Half day synchronizes End Date to Start Date and prevents editing End Date.
- [x] The server enforces VL and a single working date, retaining holiday,
  employment, overlap, access and balance-period validation.
- [x] With sufficient credits, paid half-day VL saves 0.5 days and a -0.5 VL
  credit movement in the existing transaction. Existing insufficient-credit and
  explicit-Unpaid treatment still apply; no new entitlement rule is introduced.
- [x] Preview, immutable allocation parsing and submission support 0.5 days.
  Duration changes invalidate preview; an old server's full-day response blocks
  half-day submission. Retries preserve the original duration and avoid duplicates.
- [x] General Leave replaces Emergency in application choices, records, details
  and new email content through the shared label map. Numeric value 749910002
  and its existing VL treatment are preserved; historical amounts are unchanged.
- [x] Verification passed: 156 targeted Leave tests, full suite of 493 tests
  across 48 files, 59 synthetic server issuance checks, 42 desktop/mobile Edge
  checks, lint, build and `git diff --check`. Build retains its large-chunk notice.
- [x] Deploy the updated Leave plugin and client to Dev; verify the deployed DLL
  hash, synchronous transaction validation and live 0.5-day VL preview.
- [ ] Owner live issuance testing and ordinary-user direct access verification.

## Release notes

No schema, security role, generated data-source or historical-record changes.
Half-day duration uses the existing Days and versioned allocation fields; a
new Dataverse Leave Type choice is unnecessary.

The rename currently uses the application label map. To match the label in
Dataverse forms and external integrations, manually change the Leave table's
`a365_leavetype` label for value **749910002** from **Emergency** to
**General Leave**, publish, and refresh the generated source using platform
tooling. Keep the numeric value. That metadata change has not been performed.

Local tests use synthetic platform boundaries. Release verification also used a
live read-only preview and confirmed 0.5 VL credit treatment for an eligible
employee. No live leave, credit movements or employee emails were created. An
initial employee outside employment dates was correctly rejected. Live issuance,
ordinary-user security and production behavior remain unverified.

[Deployment evidence](leave-half-day-deployment.json). The verified app is at
[The Daily Operation - Dev](https://apps.powerapps.com/play/e/b58b083e-d27d-eabd-a143-2a49dcb9d89a/app/d4f0731a-e91a-40d4-ac0b-3f7e2400fa0f).
