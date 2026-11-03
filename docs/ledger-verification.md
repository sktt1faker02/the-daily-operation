# Ledger acceptance verification — review draft

2026-11-03. Future checks for [PLANS.md](../PLANS.md); no ledger implementation
or live security verification is claimed by this documentation task.

## Before implementation

- [ ] Owner resolves plan decisions and approves scope/account mappings.
- [ ] Confirm real schema, relationships, choices and Payroll Admin access;
  propose exact metadata and release steps for approval.
- [ ] Define expected behavior for unresolved policies before dependent tests.

## Acceptance verification checklist

| Criterion | Concrete verification | Status |
| --- | --- | --- |
| L1 Access/navigation | Payroll Admin sees Ledger > Ledger Management and can view/access records. Other app roles see neither category/page nor data; route, manipulated-ID and direct Dataverse access fail. No separate Chart of Accounts page. | Owner requirement confirmed; implementation/live checks pending. |
| L2 | Render all seven fields; preserve OR 0001 text and accept blank OR/reference. Reference remains plain text. Payroll date uses actual Paid On in Asia/Manila, including a UTC midnight boundary test. | Confirmed; implementation pending. |
| L3 | Require exactly one category per record; reject missing/invalid choice, direction and invalid manual amount/precision. Accept generated zero/negative signed payroll Debit. No allocations or Mixed category. Failed saves retain values and avoid partial writes. | Confirmed; implementation pending. |
| L4 | Verify nine confirmed choices and mappings. Capital Deposits uses Credit; Capital Withdrawals uses Debit. No Office Supplies, Bank/Payment Fees or Registration/Filing Fees choice. Represent combined BIR/PHIC using separate verified records, without also saving the combined total. | Confirmed; implementation pending. |
| L5 Filters | Combine date/category/direction/text filters; test boundaries, equal-date ordering, no matches and next/previous pages with synthetic data. | Pending. |
| L6 | Start empty at zero. Record Capital Deposits Credit 10,000, Client Payments Credit 2,000 and Payroll Debit 3,000: company balance 9,000 with no separate opening amount/date. Date/category filters/pages change filtered totals only. Test signed payroll, edits/deletes, historical posting/resynchronization and aggregate failures. Deposits are counted once. | Confirmed; implementation pending. |
| L7 Choice history | Verify category is a Dataverse Choice, not an account lookup; used options preserve historical meaning and invalid values fail server validation. No account-maintenance UI is introduced. | Pending schema design/implementation. |
| L8 | Payroll Admin can create/edit/delete ledger rows with deletion confirmation and retained audit. Unlock preserves rows; re-payment updates edited and recreates deleted ledger rows without conflict prompts. Delete a source payroll entry after unlock: next re-payment deletes only its linked ledger row atomically. Source payroll protection remains. No employee-exclusion workflow: retain a zero-pay source and verify a zero-Debit row remains; delete the source and verify linked-row removal on re-payment. | Deleted-source behavior confirmed; implementation pending. |
| L9 | Blank optional OR/reference does not block save or posting. No document/attachment table, upload, clickable document-link UI or SharePoint setup is introduced. | Confirmed; implementation pending. |
| L10 UI | Check loading, populated, empty, filtered-empty, read/save errors, retry, keyboard/focus, accessible labels and 390px/desktop layouts; actions remain aligned. | Pending. |
| L11 Boundaries | Payroll/Leave calculations and historical values remain unchanged. Preserve existing notifications; only the requested paid-payroll ledger posting is added. | Pending. |
| L12 Checks | Run targeted meaningful tests, full npm test, npm run lint, npm run build and relevant Playwright once after final edits; report unavailable live checks. | Pending implementation. |
| L13 | Mark paid with existing source entries at net pays 20,000, 25,000, 0 and -100: four linked Payroll Debit rows preserve exact signed amounts, Credit unused, actual Paid On date and actor/time. Employees with no source entry get no row; a zero-pay source still gets its row. Ready/cancel/failed payment creates no rows. | Owner core behavior confirmed; implementation pending. |
| L14 | Inject failure at each employee write: all new/updated ledger writes, payment/lock metadata and status roll back. Test timeout after successful commit, retries and concurrent requests: read operation result, no duplicates or replay over later manual edits. Re-payment uses a new operation on the same source rows. | Atomic strategy confirmed; server design/implementation pending. |
| L15 | First review existing unlinked manual Payroll rows and link confirmed source matches without changing their amount/date; verify linked matches are skipped and ambiguous affected sources are not blindly posted. Preview old paid periods/missing employee rows and signed totals, confirm and post only missing linked rows using stored Paid On. Existing edited rows skipped; deleted ledger rows recreated without conflict prompts. Missing Paid On periods skipped/reported, never dated today. Test per-period failure/resume, live-posting concurrency, accurate progress and disable-when-complete; exceptions remain visible. No source payroll changes or notifications. | Interaction confirmed; implementation pending. |
| L16 Export | As Payroll Admin, filter a dataset spanning multiple pages and export to Excel: all matching rows appear once, seven source columns retain values/receipt zeros, signed payroll is preserved, totals equal the filtered result and all-record company balance is separately labelled. Filters do not change company balance. Unauthorized export fails; read/aggregate errors prevent partial-success downloads. Empty export has clear behavior and exporting state prevents duplicate clicks. No business writes occur. | Export requested; implementation pending. |

## Documentation-only review

Verify local links/paths, archived plan preservation, consistency/conflict markers
and git diff --check. Runtime tests/builds are unnecessary for documentation-only
edits. Spreadsheet reconciliation and accounting approval remain outside this review.
