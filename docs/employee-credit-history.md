# Employee Credit History — 2026-10-23

**Removed by owner request, 2026-10-23.** The page, navigation, route, personal
API implementation and dedicated tests were removed before deployment. Do not
deploy the historical assembly changes described below. Leave Management,
its balance cards and all underlying records remain intact. The remainder of
this document records the superseded implementation.

Owner request: remove the Credit History tab from Leave Management and add a
module immediately below My Payroll, available to `A365 - Payroll Employee`
for their own credit movements and leave records. The owner's subsequent
same-day correction locks this module to the signed-in employee for every role,
including admins, and adds the employee/year/search and VL/SL balance header.

## Acceptance checklist

- [x] Leave Management keeps its filters, balances and Add Leave; tabs removed.
- [x] `/credit-history` appears below My Payroll in desktop/mobile navigation.
  A unique linked employee profile is required to read personal data for every role.
- [x] Credit movements and leave records have independent server pagination.
  Year/search apply to both; movement/pool apply to credits. Employee is a locked,
  labelled name field for every role; no employee selector or admin collection reads.
- [x] VL/SL cards use the complete signed recorded ledger for the selected year,
  independent of search/movement/pool filters. The server pages all records;
  later-page errors, repeated data and invalid amounts/pools fail visibly. Loading
  and errors never appear as zero. No projected grants or new entitlement rules.
- [x] Loading, empty, error/retry, detail and denied states are covered locally.
  Unresolved/failed/denied access checks do not mount data queries. When the
  existing portal permission probe succeeds after denied role-table reads,
  only the personal API is used; its own role checks remain authoritative.
- [x] Personal reads use the existing generated `a365_LeaveCommand` binding.
  New `myHistory`/`myHistoryDetail`/`myHistorySummary` handlers check direct/team Payroll Employee
  or Payroll Admin membership, resolve exactly one Employee by
  `a365_systemuser = InitiatingUserId`, and ignore client employee IDs.
- [x] Every business query combines that employee with year/filters/source ID;
  pagination rebuilds that scope. Foreign and missing source IDs are unavailable.
- [x] Explicit server field projections exclude internal notes, actor lookups
  and notification state/attempts. Personal details have no mutation controls.
- [x] Existing mutations, previews and notifications remain admin-only. No
  employee write privileges, table grants, ownership/sharing, schema, generated
  data-source or financial-record changes.
- [ ] Deploy the signed Leave assembly `1.0.2.0` before publishing the Code App.
  The deployed handler does not yet support these personal read commands.
- [ ] Test in Power Apps as ordinary employees A/B and an ordinary admin:
  foreign-ID calls, mutation denial, direct-table denial and additive roles/teams.
  Local tests are not proof of live effective access.

## Security and release

The existing Dataverse custom API provides narrow privileged reads to
authenticated employees. Direct table access stays unchanged; no broad read
grant is needed. The server's role check and initiating-user relationship enforce
isolation. Credit History always uses this API, including for admins. The separate
Leave Management module retains its existing admin services and functionality.
Historical records and their owners remain unchanged; no backfill is needed.

The existing action accepts a String Request and returns a String Response;
read-only live metadata inspection on October 23 confirmed `ExecutePrivilegeName`
is null and `AllowedCustomProcessingStepType` is 0. No API metadata/binding
regeneration is needed. `build-posting.ps1` now includes
`PersonalHistory.cs`. After deployment authorization, update only the existing
signed Leave assembly using `scripts/leave-schema/update-posting-assembly.ps1`;
do not rerun schema provisioning. Publish the Code App through the existing
Code Apps workflow afterwards. No deployment, commit, role change or
financial/notification write occurred during implementation.

Local checks: signed server compilation; 54 history-isolation checks; 16
write-guard regression checks; 20 existing policy checks. See the
[enhancement log](../Payroll-Enhancements.md) for app/browser/lint/build results.

Reference: [Microsoft plug-in execution identity](https://learn.microsoft.com/power-apps/developer/data-platform/impersonate-a-user).
The initiating identity remains the authorization input when the bounded
read service runs in system context.
