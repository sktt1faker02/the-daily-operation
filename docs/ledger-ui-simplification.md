# Ledger view simplification - 2026-11-09

Latest owner presentation request supersedes the earlier Ledger Management naming,
on-page filtered-total cards and direction-filter requirements in PLANS.md.

## Verification checklist

- [x] Page title and sidebar item read **Ledger**, retaining the existing route,
  access checks and Accounting domain boundary.
- [x] Only Company balance remains as a summary card; remove the three filtered
  totals and the explanatory text from the page.
- [x] Remove the Direction filter; date/category/search and Apply/Clear remain.
  Preserve debit/credit entry fields, financial direction values and Excel totals.
- [x] Hide the disabled completed-history indicator. Keep historical posting
  available for missing/manual-review work, with exceptions/progress/retries intact.
- [x] Preserve the complete record table, CRUD confirmation, reference links,
  pagination, loading/empty/error states and server-verified complete export.
- [x] Verify Company balance stays independent of active filters and paging;
  no financial records, calculations, backend, schema or security changes.
- [x] Targeted/full app tests, lint/build, desktop/mobile browser and diff checks
  pass; publish the tested frontend to the existing Dev app/solution.

This request changes presentation only. Earlier release evidence remains historical;
filtered aggregates are still calculated server-side and included in Excel export.

## Verification and Dev release

- Targeted Ledger UI/service/export checks: 25 passed.
- Full suite: 552 tests across 53 files passed with one worker and a 30-second
  per-test timeout. The initial parallel run had unrelated Leave timing failures;
  the complete single-worker rerun passed without application changes.
- Lint, production build and desktop/mobile Ledger Playwright checks passed,
  including filters, pagination, confirmations, export, errors and employee access.
  Initial browser attempts timed out during local loading; the retry passed after
  concurrent build/lint work completed. Browser data was synthetic; no live writes.
- Published successfully to Dev app `d4f0731a-e91a-40d4-ac0b-3f7e2400fa0f`
  in environment `b58b083e-d27d-eabd-a143-2a49dcb9d89a`, solution
  `498e4ec8-94c6-4e16-82e8-33bb19e8e11d`. Prod was not changed.
- Tested and published bundle: `index-m1AVJS__.js`, SHA-256
  `B5C7E1629368A4331EEB078B067EA8E72B1C22E805B22A4AD6570F6F1A2A7149`.
- Live Power Apps host interaction remains a manual check after refresh; local
  browser checks cannot verify the hosted session or real Dataverse permissions.
