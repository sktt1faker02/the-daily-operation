# Specify paid/unpaid leave split

Owner confirmed implementation and Dev deployment on 2026-11-09. One leave
record covers the requested workdays; Payroll Admin may specify its paid portion
even when enough credits exist to pay the entire leave. The remainder is unpaid.
The motivating case is one full-day VL with 0.5 paid and 0.5 unpaid.

## Acceptance verification checklist

- [x] Paid requests offer an optional **Specify paid/unpaid split** control and
  labelled Paid days input; default automatic treatment is preserved.
- [x] Preview calculates unpaid days from total workdays minus specified paid
  days, shows Partially Paid when applicable and shows the dated allocation.
- [x] Server rejects negative/over-precision paid amounts, paid amounts above
  requested workdays/available credits, and a manual amount on an Unpaid request.
- [x] Save persists one source and its immutable version-1 dated allocation,
  deducts only paid credits, and preserves the requested split on retries.
- [x] A changed split/mode under the same operation identity is rejected.
- [x] Existing overlap, eligibility, holiday, half-day, transaction, authorization
  and reviewed-impact checks remain enforced; no two-record same-date bypass.
- [x] Deletion restores exactly the paid portion once; existing unpaid-payroll
  readers and notifications retain the saved unpaid portion without recalculation.
- [x] UI invalid input, stale preview, errors, uncertain retry, cancellation and
  desktop/mobile keyboard flows are verified.
- [x] Targeted/server regressions, full app tests, lint/build, browser checks and
  diff checks pass; report live security/financial-write verification limits.
- [x] Deploy tested backend before matching client to the existing Dev solution;
  verify installed DLL, read-only manual preview and exported native package.

No schema/security changes, migrations or changes to existing leave records are
required. Manual selection is recorded within the existing allocation JSON so
retry identity distinguishes automatic treatment from an explicit paid portion.
Existing earliest-paid-date allocation order and two-decimal credit precision
are retained. Existing overlapping records require the normal explicit correction
workflow; this feature does not merge or delete them automatically.

## Verification and deployment

Changed the Add Leave form, entry validation, preview query key, existing generated
API wrapper caller, server allocation and retry matching, plus their regression
tests and read-only release tooling. The earlier requested **Leave Recorded**
success toast is included in the matching frontend build.

Signed **1.0.3.13** DLL SHA-256:
`02CCDBAB73F3E8051BD15F239C376A417A05B164F201CA7A1622FE0DC5461938`.
The existing Dev **1.0.3.10** DLL was backed up and the update applied with an ETag
condition to the existing assembly, preserving all other registered components.
No table/column, role, generated source or configuration changes were made.

Verification so far: **815 synthetic server checks**, including 152 manual-split
checks and 137 deletion checks; **68 targeted app tests**; lint/build; **88 Edge
checks** with manual entry on desktop/mobile and keyboard activation. Build retains
the existing large-chunk notices. Initial parallel checks and cold browser loads
hit environment timeouts; final app rerun uses one worker and a 15-second test
budget, without reducing assertions.

The final app run passed **551 tests / 53 files** with
`npm test -- --maxWorkers=1 --testTimeout=15000`. The slow initial default-budget
runs were stopped after timeouts in existing UI flows. Final lint/build and
`git diff --check` pass.

Live read-only Dev verification passes: installed DLL hash, transactional API,
one-day VL preview with 0.5 paid / 0.5 unpaid and Partially Paid, explicit-mode echo,
invalid-amount rejection and unchanged Leave/credit counts. See
[backend evidence](leave-manual-split-deployment.json). The verifier is
[verify-manual-split.ps1](../scripts/leave-schema/verify-manual-split.ps1).

Actual issuance/deletion, financial rollback/concurrency and ordinary-account
security remain owner UAT. No real test leave, financial movement or email was
created, and production remains untouched. The matching client was published to
the existing Dev app with `pa app push --solution-id` after final checks passed.
The exported/unpacked native solution under ignored
`artifacts/leave-manual-split.local/` matches both tested artifacts exactly. The
client main bundle SHA-256 is
`B00FB96561FCB2E70DE8A2798ABFD4623CB170CC523F1A3B6EEF8F22CDA00ECB`.
Ledger **1.0.0.4** is preserved in the same solution. The current
[Dev app](https://apps.powerapps.com/play/e/b58b083e-d27d-eabd-a143-2a49dcb9d89a/app/d4f0731a-e91a-40d4-ac0b-3f7e2400fa0f)
contains the split control; reload/reopen it to use the published frontend.
