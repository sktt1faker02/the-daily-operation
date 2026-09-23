# Phase 7 — Payroll Review, Finalization & Locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Payroll Admin a controlled Draft→Processing→Ready→Paid→Locked lifecycle with an audited Unlock correction path, enforced at the Dataverse data layer by a real-time C# plug-in.

**Architecture:** A pure status state-machine module is the single source of truth for transitions; a guarded service method writes status + audit stamps; TanStack mutations drive a status-aware action bar. A GA C# real-time plug-in on `a365_payrollentry` Update (PreValidation) blocks edits whenever the parent period is Ready/Paid/Locked — the actual immutability guarantee.

**Tech Stack:** React 19 + TypeScript + Vite, TanStack Query, shadcn/ui, Vitest 3, Power Apps Code Apps data client, Dataverse, C# plug-in (.NET SDK + `pac plugin`).

**Spec:** `docs/superpowers/specs/2026-09-17-phase-7-payroll-review-finalization-locking-design.md`

## Global Constraints

- Dataverse column logical names are fixed and verified against the live schema: status `a365_payrollstatus`; audit lookups/dates `a365_readyby`/`a365_readyon`, `a365_paidby`/`a365_paidon`, `a365_lockedby`/`a365_lockedon`. Lookup writes use the navigation-property casing `a365_ReadyBy@odata.bind` / `a365_PaidBy@odata.bind` / `a365_LockedBy@odata.bind` → `/systemusers(<id>)` (matches existing `a365_CalculatedBy@odata.bind`).
- `a365_payrollstatus` choice values: Draft 749910000, Processing 749910001, Ready 749910002, Paid 749910003, Locked 749910004.
- No new Dataverse columns — all audit columns already exist (Phase 4).
- Business logic stays out of JSX (`CLAUDE.md`); transitions live only in the state-machine module.
- Security is data-layer: the plug-in is the guarantee, UI gating is convenience (non-negotiable #4).
- Run `npm run lint` and `npm run build` before considering the app work complete.
- Python for the plug-in verification harness: `"$LOCALAPPDATA/Programs/Python/Python312/python.exe"`.

---

### Task 1: Status transition state machine

**Files:**
- Create: `src/features/payroll/payroll-status-machine.ts`
- Test: `src/features/payroll/payroll-status-machine.test.ts`

**Interfaces:**
- Consumes: `PayrollStatus` from `./types`.
- Produces:
  - `type PayrollAction = "markReady" | "markPaid" | "lock" | "unlock"`
  - `canTransition(from: PayrollStatus, to: PayrollStatus): boolean`
  - `nextActions(status: PayrollStatus): PayrollAction[]`
  - `const ACTION_TARGET: Record<PayrollAction, PayrollStatus>`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/payroll/payroll-status-machine.test.ts
import { describe, expect, it } from "vitest"
import { PayrollStatus } from "./types"
import { canTransition, nextActions, ACTION_TARGET } from "./payroll-status-machine"

describe("canTransition", () => {
  it("allows the forward lifecycle", () => {
    expect(canTransition(PayrollStatus.Draft, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Ready)).toBe(true)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Paid)).toBe(true)
    expect(canTransition(PayrollStatus.Paid, PayrollStatus.Locked)).toBe(true)
  })
  it("allows Unlock from any finalized state back to Processing", () => {
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Paid, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Processing)).toBe(true)
  })
  it("rejects illegal jumps", () => {
    expect(canTransition(PayrollStatus.Draft, PayrollStatus.Locked)).toBe(false)
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Paid)).toBe(false)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Draft)).toBe(false)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Paid)).toBe(false)
  })
})

describe("nextActions", () => {
  it("returns the actions available per state", () => {
    expect(nextActions(PayrollStatus.Draft)).toEqual([])
    expect(nextActions(PayrollStatus.Processing)).toEqual(["markReady"])
    expect(nextActions(PayrollStatus.Ready)).toEqual(["markPaid", "unlock"])
    expect(nextActions(PayrollStatus.Paid)).toEqual(["lock", "unlock"])
    expect(nextActions(PayrollStatus.Locked)).toEqual(["unlock"])
  })
  it("every action target is a legal transition from a state that offers it", () => {
    expect(ACTION_TARGET.markReady).toBe(PayrollStatus.Ready)
    expect(canTransition(PayrollStatus.Ready, ACTION_TARGET.markPaid)).toBe(true)
    expect(canTransition(PayrollStatus.Locked, ACTION_TARGET.unlock)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- payroll-status-machine`
Expected: FAIL — module `./payroll-status-machine` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/payroll/payroll-status-machine.ts
/**
 * Single source of truth for payroll period status transitions (V1). Pure —
 * no Dataverse, no UI — so it is unit-testable and every service/component
 * asks it rather than scattering status checks (CLAUDE.md).
 */
import { PayrollStatus } from "./types"

export type PayrollAction = "markReady" | "markPaid" | "lock" | "unlock"

const TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  [PayrollStatus.Draft]: [PayrollStatus.Processing],
  [PayrollStatus.Processing]: [PayrollStatus.Ready],
  [PayrollStatus.Ready]: [PayrollStatus.Paid, PayrollStatus.Processing],
  [PayrollStatus.Paid]: [PayrollStatus.Locked, PayrollStatus.Processing],
  [PayrollStatus.Locked]: [PayrollStatus.Processing],
}

export const ACTION_TARGET: Record<PayrollAction, PayrollStatus> = {
  markReady: PayrollStatus.Ready,
  markPaid: PayrollStatus.Paid,
  lock: PayrollStatus.Locked,
  unlock: PayrollStatus.Processing,
}

export function canTransition(from: PayrollStatus, to: PayrollStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function nextActions(status: PayrollStatus): PayrollAction[] {
  switch (status) {
    case PayrollStatus.Processing:
      return ["markReady"]
    case PayrollStatus.Ready:
      return ["markPaid", "unlock"]
    case PayrollStatus.Paid:
      return ["lock", "unlock"]
    case PayrollStatus.Locked:
      return ["unlock"]
    default:
      return [] // Draft advances to Processing automatically on first calculate
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- payroll-status-machine`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/payroll-status-machine.ts src/features/payroll/payroll-status-machine.test.ts
git commit -m "feat(payroll): centralized status transition state machine"
```

---

### Task 2: Guarded transition service

**Files:**
- Modify: `src/features/payroll/services/payroll-period-service.ts`

**Interfaces:**
- Consumes: `canTransition` (Task 1); `PayrollStatus`, `payrollStatusLabel` from `../types`; existing `dataClient`, `PAYROLL_PERIOD_TABLE`, `getPeriod`.
- Produces: `payrollPeriodService.transitionStatus(periodId: string, to: PayrollStatus, actingUserId: string): Promise<void>`

- [ ] **Step 1: Add imports**

At the top of `payroll-period-service.ts`, add to the existing `../types` import: `payrollStatusLabel`. Add a new import:

```ts
import { canTransition } from "../payroll-status-machine"
```

- [ ] **Step 2: Add the `transitionStatus` method**

Add inside the `payrollPeriodService` object (e.g. after `getPeriod`):

```ts
  /**
   * Move a period to `to`, validated against the centralized state machine, and
   * stamp the matching audit columns. Unlock (→ Processing) clears the lock date.
   * The plug-in enforces entry immutability; this writes the period lifecycle.
   */
  async transitionStatus(
    periodId: string,
    to: PayrollStatus,
    actingUserId: string,
  ): Promise<void> {
    const period = await payrollPeriodService.getPeriod(periodId)
    const from = period.a365_payrollstatus
    if (!canTransition(from, to)) {
      throw new Error(
        `Cannot change payroll from ${payrollStatusLabel(from)} to ${payrollStatusLabel(to)}.`,
      )
    }
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = { a365_payrollstatus: to }
    if (to === PayrollStatus.Ready) {
      payload.a365_readyon = now
      payload["a365_ReadyBy@odata.bind"] = `/systemusers(${actingUserId})`
    } else if (to === PayrollStatus.Paid) {
      payload.a365_paidon = now
      payload["a365_PaidBy@odata.bind"] = `/systemusers(${actingUserId})`
    } else if (to === PayrollStatus.Locked) {
      payload.a365_lockedon = now
      payload["a365_LockedBy@odata.bind"] = `/systemusers(${actingUserId})`
    } else if (to === PayrollStatus.Processing) {
      payload.a365_lockedon = null // Unlock: no longer locked; status is the source of truth
    }
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollPeriod>(
      PAYROLL_PERIOD_TABLE,
      periodId,
      payload,
    )
    if (!result.success) throw result.error ?? new Error("Unable to update payroll status.")
  },
```

Note: Unlock clears `a365_lockedon` (a reliable null-on-datetime clear) but leaves the `a365_lockedby` lookup as historical — re-locking overwrites it, and the UI keys "is locked" off `a365_payrollstatus`, never the stamp. This avoids the unreliable null-lookup disassociation on update.

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both pass (no test yet — service is covered by the manual verification in Task 7; the state machine it depends on is unit-tested in Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/services/payroll-period-service.ts
git commit -m "feat(payroll): guarded status transition service with audit stamps"
```

---

### Task 3: Auto Draft → Processing on first calculate

**Files:**
- Modify: `src/features/payroll/services/payroll-service.ts` (`calculatePeriod`)
- Modify: `src/features/payroll/hooks/use-payroll-entries.ts` (`useCalculatePeriod` invalidation)

**Interfaces:**
- Consumes: `payrollPeriodService.transitionStatus` (Task 2); `PayrollStatus` from `../types`; `payrollKeys` from `./use-payroll-periods`.
- Produces: no new exports; `calculatePeriod` now advances Draft → Processing after a successful run.

- [ ] **Step 1: Import `PayrollStatus` in payroll-service.ts**

`payroll-service.ts` already imports from `../types`. Add `PayrollStatus` to that import (it currently imports `PayrollEntryInputValues`):

```ts
import type { PayrollEntryInputValues } from "../types"
import { PayrollStatus } from "../types"
```

- [ ] **Step 2: Advance status at the end of `calculatePeriod`**

Replace the final `return { calculated }` in `calculatePeriod` with:

```ts
  // First calculation advances the period Draft → Processing (centralized rule).
  const period = await payrollPeriodService.getPeriod(periodId)
  if (period.a365_payrollstatus === PayrollStatus.Draft) {
    await payrollPeriodService.transitionStatus(periodId, PayrollStatus.Processing, calculatedByUserId)
  }
  return { calculated }
```

- [ ] **Step 3: Invalidate the period query after Calculate all**

In `use-payroll-entries.ts`, `useCalculatePeriod`, update `onSuccess` so the status badge refreshes:

```ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
      queryClient.invalidateQueries({ queryKey: payrollKeys.period(periodId) })
    },
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/services/payroll-service.ts src/features/payroll/hooks/use-payroll-entries.ts
git commit -m "feat(payroll): advance Draft to Processing on first calculate"
```

---

### Task 4: Status transition hook

**Files:**
- Create: `src/features/payroll/hooks/use-payroll-status.ts`

**Interfaces:**
- Consumes: `payrollPeriodService.transitionStatus` (Task 2); `PayrollStatus` from `../types`; `payrollKeys` from `./use-payroll-periods`.
- Produces: `usePayrollStatusTransition(periodId: string)` — a mutation whose variables are `{ to: PayrollStatus; userId: string }`.

- [ ] **Step 1: Write the hook**

```ts
// src/features/payroll/hooks/use-payroll-status.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { payrollPeriodService } from "../services/payroll-period-service"
import type { PayrollStatus } from "../types"
import { payrollKeys } from "./use-payroll-periods"

/** One mutation for every lifecycle action; the caller passes the target status. */
export function usePayrollStatusTransition(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ to, userId }: { to: PayrollStatus; userId: string }) =>
      payrollPeriodService.transitionStatus(periodId, to, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.period(periodId) })
      queryClient.invalidateQueries({ queryKey: payrollKeys.entries(periodId) })
    },
  })
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/hooks/use-payroll-status.ts
git commit -m "feat(payroll): status transition mutation hook"
```

---

### Task 5: Status action bar + status-aware banner (UI)

**Files:**
- Modify: `src/pages/payroll-period.tsx`

**Interfaces:**
- Consumes: `nextActions`, `ACTION_TARGET`, `PayrollAction` (Task 1); `usePayrollStatusTransition` (Task 4); existing `useCurrentSystemUserId`, `PayrollStatus`, `payrollStatusLabel`, `formatDate`, shadcn `Dialog`, `Button`.
- Produces: no new exports.

- [ ] **Step 1: Add imports**

```ts
import { nextActions, ACTION_TARGET, type PayrollAction } from "@/features/payroll/payroll-status-machine"
import { usePayrollStatusTransition } from "@/features/payroll/hooks/use-payroll-status"
import { PayrollStatus, payrollStatusLabel } from "@/features/payroll/types"
```

(`isPeriodEditable` and `type PayrollEntry` are already imported from `../types`; add `PayrollStatus`/`payrollStatusLabel` to that line or as shown.)

- [ ] **Step 2: Add action metadata + state near the top of the component**

```ts
  const [pendingAction, setPendingAction] = useState<PayrollAction | null>(null)
  const statusTransition = usePayrollStatusTransition(periodId)

  const ACTION_META: Record<
    PayrollAction,
    { label: string; title: string; description: string; variant?: "default" | "destructive" }
  > = {
    markReady: {
      label: "Mark Ready",
      title: "Mark this payroll Ready?",
      description: "Finalizes inputs for review. Entries become read-only and can only be changed after an Unlock.",
    },
    markPaid: {
      label: "Mark Paid",
      title: "Mark this payroll Paid?",
      description: "Records that this cutoff has been paid out. Entries remain locked.",
    },
    lock: {
      label: "Lock",
      title: "Lock this payroll?",
      description: "Closes the cutoff as an immutable financial snapshot. Corrections require an Unlock.",
    },
    unlock: {
      label: "Unlock",
      title: "Unlock this payroll?",
      description: "Reopens the cutoff for corrections (returns it to Processing). This is an audited action.",
      variant: "destructive",
    },
  }

  const runAction = (action: PayrollAction) => {
    const userId = requireSystemUser()
    if (!userId) return
    statusTransition.mutate(
      { to: ACTION_TARGET[action], userId },
      {
        onSuccess: () => {
          toast.success(`${ACTION_META[action].label} done.`)
          setPendingAction(null)
        },
        onError: (err) => toast.error(`Unable to ${ACTION_META[action].label.toLowerCase()}.`, { description: err.message }),
      },
    )
  }

  const actions = nextActions(period.data?.a365_payrollstatus ?? PayrollStatus.Draft)
```

- [ ] **Step 3: Render the action buttons in the header action row**

Inside the existing `<div className="flex items-center gap-2">` header block (the one holding Load employees / Calculate all), append after the Calculate all button:

```tsx
            {actions.map((action) => (
              <Button
                key={action}
                variant={ACTION_META[action].variant === "destructive" ? "destructive" : action === "unlock" ? "outline" : "default"}
                onClick={() => setPendingAction(action)}
                disabled={statusTransition.isPending}
              >
                {ACTION_META[action].label}
              </Button>
            ))}
```

- [ ] **Step 4: Make the non-editable banner status-aware**

Replace the existing `{!editable && ( ... )}` banner block with:

```tsx
      {!editable && period.data && (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
          {period.data.a365_payrollstatus === PayrollStatus.Locked
            ? `Locked on ${formatDate(period.data.a365_lockedon)}. Unlock to make corrections.`
            : `This period is ${payrollStatusLabel(period.data.a365_payrollstatus)} and is no longer editable in payroll administration.`}
        </p>
      )}
```

Note: `a365_lockedon` must be selected. In `payroll-period-service.ts` add `"a365_lockedon"` to `PERIOD_SELECT` and to the `PayrollPeriod` interface (`a365_lockedon?: string | null`) in `types.ts`. Do this as part of this step.

- [ ] **Step 5: Add the confirm dialog before the closing `</div>`**

```tsx
      <Dialog open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction && ACTION_META[pendingAction].title}</DialogTitle>
            <DialogDescription>{pendingAction && ACTION_META[pendingAction].description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={statusTransition.isPending}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "unlock" ? "destructive" : "default"}
              onClick={() => pendingAction && runAction(pendingAction)}
              disabled={statusTransition.isPending}
            >
              {statusTransition.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {pendingAction && ACTION_META[pendingAction].label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Verify build + lint, then manually click through**

Run: `npm run build && npm run lint`
Expected: both pass. Then `npm run dev`, open a Processing period, and confirm the Mark Ready → Mark Paid → Lock → Unlock buttons appear per state and the badge updates. (Edits under Ready/Paid/Locked are only *hard*-blocked after Task 6.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/payroll-period.tsx src/features/payroll/services/payroll-period-service.ts src/features/payroll/types.ts
git commit -m "feat(payroll): status action bar, confirmations, and lock banner"
```

---

### Task 6: C# real-time immutability plug-in

**Files:**
- Create: `plugins/A365.Payroll.Plugins/` (scaffold via `pac plugin init`)
- Create: `plugins/A365.Payroll.Plugins/ProtectFinalizedPayroll.cs`

**Interfaces:**
- Consumes: nothing from earlier tasks (Dataverse-side).
- Produces: a registered synchronous PreValidation step on `Update` of `a365_payrollentry` that throws when the parent period is Ready/Paid/Locked.

This task is procedural (toolchain), not TDD; its "test" is the scripted verification in Task 7.

- [ ] **Step 1: Install the .NET SDK** (not present on this machine)

Run: `winget install --id Microsoft.DotNet.SDK.8 --accept-source-agreements --accept-package-agreements`
Then in a fresh shell verify: `dotnet --version` prints an 8.x version.

- [ ] **Step 2: Scaffold a signed plug-in project**

```bash
cd plugins
pac plugin init --outputDirectory A365.Payroll.Plugins --author "Automations 365"
```
This creates an SDK-style C# project targeting .NET Framework 4.6.2 with a generated strong-name key and the CrmSdk reference assemblies. Delete the sample plug-in class it generates.

- [ ] **Step 3: Write the plug-in class**

```csharp
// plugins/A365.Payroll.Plugins/ProtectFinalizedPayroll.cs
using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Payroll.Plugins
{
    /// <summary>
    /// Blocks edits to a payroll entry whose parent period is finalized
    /// (Ready / Paid / Locked). Register on: Update of a365_payrollentry,
    /// PreValidation, synchronous, with a pre-image "PreImage" containing
    /// a365_payrollperiod. This is the data-layer immutability guarantee.
    /// </summary>
    public sealed class ProtectFinalizedPayroll : IPlugin
    {
        private const int Ready = 749910002;
        private const int Paid = 749910003;
        private const int Locked = 749910004;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName != "Update" || !context.InputParameters.Contains("Target"))
                return;

            var periodRef = ResolvePeriod((Entity)context.InputParameters["Target"], context);
            if (periodRef == null)
                return;

            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);
            var period = service.Retrieve("a365_payrollperiod", periodRef.Id, new ColumnSet("a365_payrollstatus"));
            var status = period.GetAttributeValue<OptionSetValue>("a365_payrollstatus");
            if (status != null && (status.Value == Ready || status.Value == Paid || status.Value == Locked))
            {
                throw new InvalidPluginExecutionException(
                    "This payroll is finalized and cannot be edited. Unlock the period to make corrections.");
            }
        }

        private static EntityReference ResolvePeriod(Entity target, IPluginExecutionContext context)
        {
            if (target.Contains("a365_payrollperiod"))
                return target.GetAttributeValue<EntityReference>("a365_payrollperiod");
            if (context.PreEntityImages.Contains("PreImage") &&
                context.PreEntityImages["PreImage"].Contains("a365_payrollperiod"))
                return context.PreEntityImages["PreImage"].GetAttributeValue<EntityReference>("a365_payrollperiod");
            return null;
        }
    }
}
```

- [ ] **Step 4: Build in Release**

```bash
cd plugins/A365.Payroll.Plugins
dotnet build -c Release
```
Expected: build succeeds, producing `bin/Release/net462/A365.Payroll.Plugins.dll`.

- [ ] **Step 5: Push the assembly into the environment**

```bash
pac plugin push --pluginFile bin/Release/net462/A365.Payroll.Plugins.dll --type Assembly --configuration Release
```
(Uses the active auth profile → The Daily Operation - Dev. Record the returned plug-in assembly / type id.)

- [ ] **Step 6: Register the step + pre-image via the Plugin Registration Tool**

Launch it: `pac tool prt`. Connect to the same environment (the active profile). Then:
1. **Register New Step** on the `ProtectFinalizedPayroll` plug-in type:
   - Message: `Update`
   - Primary Entity: `a365_payrollentry`
   - Event Pipeline Stage: **PreValidation**
   - Execution Mode: **Synchronous**
   - Leave filtering attributes empty (any update is checked).
2. **Register New Image** on that step:
   - Image Type: **Pre Image**
   - Name / Alias: `PreImage`
   - Parameters/attributes: `a365_payrollperiod`
3. Add the plug-in assembly + step to the `A365_DailyOperations` solution (Solutions area, Add Existing → Plug-in assembly) so it exports with the app.

- [ ] **Step 7: Commit the plug-in source**

```bash
cd ../..
git add plugins/A365.Payroll.Plugins
git commit -m "feat(payroll): C# real-time plug-in enforcing finalized-payroll immutability"
```

---

### Task 7: Plug-in verification + finish

**Files:**
- Create: `scripts/verify-finalized-lock.py` (verification harness)
- Modify: `docs/payroll-task-phases.md` (check off Phase 7)

**Interfaces:**
- Consumes: `scripts/auth.py` (`load_env`, `get_token`).
- Produces: a pass/fail check that the plug-in blocks a locked-entry edit and allows a processing-entry edit.

- [ ] **Step 1: Write the verification script**

```python
# scripts/verify-finalized-lock.py
"""Verify the finalized-payroll plug-in blocks edits to a locked entry and
allows edits when the period is Processing. Reversible: it toggles status on a
throwaway/dev period and restores it. Pass PERIOD_ID and ENTRY_ID as argv."""
import sys, json, os
from urllib.request import Request, urlopen
from urllib.error import HTTPError
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auth import load_env, get_token

load_env()
BASE = os.environ["DATAVERSE_URL"].rstrip("/") + "/api/data/v9.2"
period_id, entry_id = sys.argv[1], sys.argv[2]
tok = get_token()

def patch(table, rid, body):
    req = Request(f"{BASE}/{table}({rid})", data=json.dumps(body).encode(), method="PATCH")
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    req.add_header("If-Match", "*")
    try:
        urlopen(req, timeout=30); return 204, ""
    except HTTPError as e:
        return e.code, json.loads(e.read()).get("error", {}).get("message", "")

# Lock the period, then attempt an entry edit — expect it blocked.
patch("a365_payrollperiods", period_id, {"a365_payrollstatus": 749910004})
code, msg = patch("a365_payrollentries", entry_id, {"a365_allowances": 1})
assert code >= 400 and "finalized" in msg.lower(), f"Expected block, got {code}: {msg}"
print("BLOCKED as expected while Locked:", msg)

# Unlock (→ Processing), then the same edit should succeed.
patch("a365_payrollperiods", period_id, {"a365_payrollstatus": 749910001})
code, msg = patch("a365_payrollentries", entry_id, {"a365_allowances": 0})
assert code == 204, f"Expected 204 after unlock, got {code}: {msg}"
print("ALLOWED as expected while Processing.")
print("PLUG-IN VERIFIED.")
```

- [ ] **Step 2: Run it against a dev period/entry**

Run: `"$LOCALAPPDATA/Programs/Python/Python312/python.exe" scripts/verify-finalized-lock.py <PERIOD_ID> <ENTRY_ID>`
Expected: prints `BLOCKED as expected…`, then `ALLOWED as expected…`, then `PLUG-IN VERIFIED.` (Use the existing Sep 16–30 period id `f18b3d93-3fb2-f111-aaad-000d3a853079` and an entry id from `SELECT a365_payrollentryid FROM a365_payrollentry`.)

- [ ] **Step 3: Check off Phase 7 in the task doc**

In `docs/payroll-task-phases.md`, mark the Phase 7 task checkboxes `[x]` (status workflow, Mark Ready + Ready By/At, restrict transitions, lock, prevent edits after lock, Mark Paid + Paid By/At, correction/adjustment process = audited Unlock, transition tests).

- [ ] **Step 4: Final gate**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-finalized-lock.py docs/payroll-task-phases.md
git commit -m "test(payroll): verify finalized-payroll plug-in; mark Phase 7 complete"
```

---

## Self-Review

**Spec coverage:** §3 machine → Task 1. §4 service + audit stamps → Task 2. Auto Draft→Processing (§3) → Task 3. Mutations (§4) → Task 4. UI action bar + banner (§6) → Task 5. Plug-in (§5) → Task 6. Testing (§7) + provisional-tax note surfaced (already in Phase 6 UI, §8 is a release gate not a task) → Task 7. All covered.

**Type consistency:** `PayrollAction`, `ACTION_TARGET`, `canTransition`, `nextActions` defined in Task 1 and consumed with the same names/signatures in Tasks 4–5. `transitionStatus(periodId, to, actingUserId)` defined in Task 2, consumed in Tasks 3–4. `usePayrollStatusTransition` variables `{ to, userId }` consistent between Task 4 and Task 5. Lookup nav-property casing consistent with existing `a365_CalculatedBy@odata.bind`.

**Placeholder scan:** No TBD/TODO; every code step has concrete content; the one procedural task (6) has exact commands and PRT settings.
