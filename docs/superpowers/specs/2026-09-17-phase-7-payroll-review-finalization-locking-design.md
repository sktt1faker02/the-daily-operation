# Phase 7 — Payroll Review, Finalization & Locking (Design)

**Milestone 1:** Payroll · **Phase:** 7 · **Date:** 2026-09-17 · **Status:** Design (approved)

## 1. Goal

Give the Payroll Admin a controlled payroll lifecycle — review, finalize
(Ready), mark paid, lock — and make finalized payroll entries **immutable
against edits (Update), including a direct Web API request**, with an explicit
audited correction path. (V1 delivers Update-only enforcement; the Create/Delete
scope decision is recorded in §5.) There is no separate approver role and no For
Review / Approved stage
(V1 decision, `CLAUDE.md` / `security-model.md` §12).

Status flow (backed by the `a365_payrollstatus` global choice):

```
Draft → Processing → Ready → Paid → Locked
                   ▲                    │
                   └──── Unlock (audited)┘   (from Ready | Paid | Locked)
```

## 2. Scope

**In scope**

- A centralized status-transition state machine (pure, testable).
- A guarded transition service that writes status + audit stamps.
- The four admin actions (Mark Ready, Mark Paid, Lock, Unlock) with confirm
  dialogs and a status-driven action bar on the period page.
- A GA C# real-time plug-in enforcing finalized-payroll immutability at the data
  layer (the confirmed mechanism, `security-model.md` §8/§12.3).

**Out of scope**

- No Dataverse **schema** work: `a365_payrollperiod` already carries the status
  choice and every audit column (`a365_readyby/on`, `a365_paidby/on`,
  `a365_lockedby/on`), provisioned in Phase 4.
- Adjustment-entry accounting (a separate correction model). V1 corrects via the
  audited Unlock action.
- Resolving the provisional withholding-tax base (a business input tracked
  separately). Locking freezes whatever was calculated; see §8.
- Formal security test execution (Phase 12) — this phase only adds the unit and
  manual verifications in §7.

## 3. Status transition model

A new pure module `src/features/payroll/payroll-status-machine.ts` (mirrors the
existing UI-free, Dataverse-free `period-utils.ts`), the single source of truth:

```ts
// Valid transitions, V1.
const TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  [Draft]:      [Processing],
  [Processing]: [Ready],
  [Ready]:      [Paid, Processing],   // Processing = Unlock
  [Paid]:       [Locked, Processing], // Processing = Unlock
  [Locked]:     [Processing],         // Processing = Unlock
}

canTransition(from, to): boolean
nextActions(status): PayrollAction[]   // drives the UI action bar
```

- **Draft → Processing is automatic** on the first successful calculate (a
  calculate mutation, on success, transitions the period if it is still Draft).
  "Processing" means inputs are being finalized — matching the data-model spec.
- **Ready / Paid / Locked → Processing is the single Unlock action** — the chosen
  correction path. One action, valid from any finalized state.
- Every action and every UI affordance asks this module. No status `switch`
  statements scattered across services or components (`CLAUDE.md`: "update the
  centralized status transition logic rather than scattering checks").

## 4. Service & audit layer

Extend `src/features/payroll/services/payroll-period-service.ts` with:

```ts
transitionStatus(periodId, to: PayrollStatus, actingUserId: string): Promise<void>
```

It (1) loads the period's current status, (2) rejects the call if
`canTransition(current, to)` is false (surfaced as a user-facing error), (3)
writes `a365_payrollstatus` plus the matching audit stamps in one update:

| Action  | To         | Stamps written                                         |
|---------|------------|--------------------------------------------------------|
| Mark Ready | Ready   | `a365_readyby` (`/systemusers(id)`), `a365_readyon`    |
| Mark Paid  | Paid    | `a365_paidby`, `a365_paidon`                           |
| Lock       | Locked  | `a365_lockedby`, `a365_lockedon`                       |
| Unlock     | Processing | clears `a365_lockedby/on`; re-finalizing overwrites the ready/paid stamps. Dataverse column auditing on `a365_payrollstatus` records who/when the unlock happened. |

`actingUserId` comes from the existing `useCurrentSystemUserId` hook (already used
for calculate audit stamps). A new hook `src/features/payroll/hooks/use-payroll-status.ts`
exposes one mutation per action, each invalidating the smallest relevant scope
(`payrollKeys.period(id)` and `payrollKeys.entries(id)`).

`isPeriodEditable(status)` (Draft/Processing) already gates entry editing in the
UI and stays the convenience layer — the plug-in is the guarantee.

## 5. Enforcement — C# real-time plug-in

The only control that makes a finalized record resist a direct write. Roles are
not status-aware; Power Automate is async and cannot prevent a write. A
synchronous plug-in can.

- **Project:** `plugins/A365.Payroll.Plugins` — C# class library, .NET Framework
  4.6.2, referencing `Microsoft.CrmSdk.CoreAssemblies`. Signed with a strong-name
  key. Built with `dotnet build -c Release`, then registered with the **Plugin
  Registration Tool** (`pac tool prt` → Register New Assembly + step + image).
  Note: `pac plugin push` is update-only (requires an existing plug-in id), so
  it cannot do the first-time registration — PRT is the documented first-time
  path. This is its own build/register step, separate from the Code App toolchain.
- **Registration:** step on **`Update`** of **`a365_payrollentry`**, **PreValidation**
  stage, **synchronous**. PreValidation throws before the database transaction, so
  a rejected edit costs no rollback (MS Learn, "Handle exceptions in plug-ins").
- **Logic:** read the target entry's parent period via `_a365_payrollperiod_value`;
  retrieve that period's `a365_payrollstatus`; if it is **Ready (749910002) /
  Paid (749910003) / Locked (749910004)**, throw
  `InvalidPluginExecutionException("This payroll is finalized and cannot be edited. Unlock the period to make corrections.")`.
  Otherwise do nothing (allow).
- **Why entries, not the period:** `a365_payrollperiod` stores no money columns
  (period totals are computed client-side from entries), so the financial
  snapshot to freeze is entirely in `a365_payrollentry`. Freezing entries by the
  parent's live status covers all three finalized states uniformly; Unlock sets
  the parent back to Processing, which the plug-in reads live, so writes resume
  with no special-casing in the plug-in.
- **Unlock is deliberately not blocked:** it is an authorized, audited change to
  the *period's* status (the Admin holds Write on the period by design). The
  guarantee is against silent edits to frozen entries, not against a sanctioned
  reopen.

**V1 scope — Update only (accepted 2026-09-17).** The step is registered on
`Update` only. `Create` and `Delete` of a finalized period's entries are not
plug-in-guarded. This is accepted for V1 because: (1) **Delete** is already
withheld from both payroll roles by Dataverse privileges — only System
Administrator can delete (`security-model.md` §5/§7); and (2) **Create** into a
finalized period is possible only for a Payroll Admin, who can Unlock (audited)
anyway, so it is not a privilege escalation, only an audit-trail bypass. With a
small org (a single Payroll Admin, ~6 employees) this residual is negligible.
**Follow-up (revisit when the org grows or a second admin is added):** register
the same plug-in type on `Create` (resolve the period from the Target) and
`Delete` (resolve from a Pre Image) to fully deliver "immutable against any
write". The plug-in class already resolves the period generically, so this is a
registration-plus-small-code change, not a redesign.

## 6. UI

On `src/pages/payroll-period.tsx`, a status-driven action bar built from
`nextActions(period.status)`:

- **Mark Ready** (Processing), **Mark Paid** (Ready), **Lock** (Paid), **Unlock**
  (any finalized state). Each behind a shadcn `Dialog` confirm stating the impact,
  matching the existing "Load employees" confirmation pattern.
- The current "no longer editable" banner becomes status-aware, e.g. "Locked on
  {date} by {name}" / "Marked paid on {date}". Status is never communicated by
  color alone (the badge carries text — `CLAUDE.md` Accessibility).
- Buttons show pending/disabled state during the mutation; duplicate submits are
  disabled while saving.

## 7. Error handling & testing

**Error handling.** The plug-in's `InvalidPluginExecutionException` message flows
back through the existing `IOperationResult.error` path to a Sonner toast, so a
blocked edit reads *"This payroll is finalized…"*, not a raw fault. Illegal or
stale transitions surface the same way. Sensitive backend detail is not exposed.

**Testing.**

- **Unit (Vitest):** `payroll-status-machine` — every allowed transition passes,
  every illegal transition (e.g. Draft → Locked, Ready → Draft) is rejected;
  `nextActions` returns the right actions per state.
- **Service:** each transition writes the correct audit stamps; Unlock clears the
  lock stamps; invalidation scope is correct.
- **Plug-in (manual, against Dev):** a direct Web API `PATCH` to an entry whose
  period is Locked returns the thrown message (scripted with the existing Python
  probe harness); the same `PATCH` under Processing succeeds; Unlock reopens and
  a subsequent edit succeeds.
- **Security (noted; formalized Phase 12):** a locked entry rejects a direct
  request; an employee cannot transition status.

## 8. Known constraint — provisional tax base

Withholding tax is currently provisional pending accountant confirmation of the
taxable-base rule (surfaced in the Phase 6 UI). Locking freezes whatever was
calculated, so a real cutoff should not be **Locked** in production until that
rule is confirmed. This does not block building the Phase 7 workflow; it is a
release gate on locking live payroll, not an engineering dependency.

## 9. Files

**New**

- `src/features/payroll/payroll-status-machine.ts` + `.test.ts`
- `src/features/payroll/hooks/use-payroll-status.ts`
- `plugins/A365.Payroll.Plugins/` (C# project, plug-in class, strong-name key)

**Changed**

- `src/features/payroll/services/payroll-period-service.ts` — `transitionStatus`
- `src/features/payroll/hooks/use-payroll-entries.ts` — auto Draft → Processing
  on first calculate
- `src/pages/payroll-period.tsx` — action bar + status-aware banner
- `docs/payroll-task-phases.md` — check off Phase 7 tasks on completion

## 10. Non-negotiables honored

- #4 UI-only authorization is never the security boundary — the plug-in is the
  data-layer guarantee; UI gating is convenience.
- #5 No guessed Dataverse names — all column logical names verified against the
  live `a365_payrollperiod` / `a365_payrollentry` schema.
- #8 Finalized payroll is never silently modified — edits are blocked server-side;
  corrections go through the audited Unlock.
- #12 Business logic (transition rules) lives outside presentation components.
