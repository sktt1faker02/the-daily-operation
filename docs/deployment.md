# Production Deployment Runbook — Payroll V1 (Phase 13)

How to promote **The Daily Operation** from Dev to a new Production environment via
Power Platform ALM (managed solution). Written against Microsoft's code-app ALM
guidance: <https://learn.microsoft.com/power-apps/developer/code-apps/how-to/alm>.

## Environment facts (Dev)

| Thing | Value |
|---|---|
| Dev environment | `The Daily Operation - Dev` |
| Dev environment id | `b58b083e-d27d-eabd-a143-2a49dcb9d89a` |
| Dev org url | `https://org9a7651f0.crm5.dynamics.com/` |
| Solution (unique name) | `A365_DailyOperations` |
| **Solution id (GUID)** | `498e4ec8-94c6-4e16-82e8-33bb19e8e11d` |
| Code App id | `d4f0731a-e91a-40d4-ac0b-3f7e2400fa0f` |
| Publisher / prefix | Automations 365 / `a365` |

**Solution contents today:** 10 tables, 5 global choices, 2 security roles
(`A365 - Payroll Admin`, `A365 - Payroll Employee`). **Missing: the Code App** — add it (Step 1).

> Code-app ALM limitations (Microsoft): you must target a solution by its **GUID**
> (names aren't accepted), and code apps don't support Dataverse git source integration.

---

## Step 1 — Add the Code App to the solution (the one gap) — do in Dev now

The schema is already in the solution; the app is not. Two ways:

**A. Maker portal (no redeploy):** make.powerapps.com → **Solutions** → *A365-DailyOperations*
→ **Add existing** → **App** → **Code app** → select *The Daily Operation* → Add.

**B. CLI (`pa app push` — rebuilds and republishes to Dev, and adds the app to the
solution):**
```bash
npm run build
pa app push --solution-id 498e4ec8-94c6-4e16-82e8-33bb19e8e11d
```
Verify: the app now appears under the solution's **Apps**.

---

## Step 2 — Export the solution as MANAGED (from Dev)

Managed is the standard for downstream (Prod) environments.

```bash
# bump the version first (portal: Solution → Settings → Version, or pac)
pac solution export \
  --name A365_DailyOperations \
  --managed true \
  --path ./out/A365_DailyOperations_managed.zip
```
Keep the exported zip as the release artifact (store with the release tag).

> No connection references and no environment variables are defined
> (`power.config.json` → `connectionReferences: {}`), so **no `deployment-settings.json`
> remapping is required** on import. If either is added later, generate one with
> `pac solution create-settings` and pass it via `--settings-file` on import.

---

## Step 3 — Stand up Production (when the Prod env exists)

1. Create the **Production** environment with a **Dataverse** database (admin center).
2. `pac auth create --environment <PROD_ENV_URL>` and confirm with `pac org who`.
3. Recreate the **security roles' user assignments** context: the two app roles ship
   *in* the managed solution, so they arrive on import — but **members are per-environment**
   and must be assigned in Prod (Step 6).

---

## Step 4 — Import the managed solution into Production

```bash
pac auth select --environment <PROD_ENV_URL>
pac solution import --path ./out/A365_DailyOperations_managed.zip --publish-changes true
```
This brings the 10 tables, 5 choices, 2 roles, and the Code App into Prod.

---

## Step 5 — Load configuration data (NOT carried by the solution)

Solutions move **schema, not table rows**. The statutory/tax **reference data** must be
migrated or the calculation engine will throw "missing configuration":

- `a365_ssscontribution` (61 brackets)
- `a365_philhealthcontribution`
- `a365_hdmfcontribution`
- `a365_taxbracket` (BIR semi-monthly)

Move it with the **Configuration Migration tool** (schema → export from Dev → import to
Prod): <https://learn.microsoft.com/power-platform/admin/manage-configuration-data>.
Verify effective-from/until dates match the go-live cutoff.

**Business data** (`a365_employee`, and later payroll periods/entries) is entered fresh in
Prod or migrated separately — do **not** copy Dev test payroll into Prod.

---

## Step 6 — Configure access & connections in Prod

1. Assign users to **`A365 - Payroll Admin`** / **`A365 - Payroll Employee`** (admin center → env → Users).
2. Link each Employee record to its Entra user (`a365_systemuser`) so own-record access works.
3. Confirm the Code App's Dataverse connection is authorized for the Prod org.
4. Share the Code App with the intended users/roles.

---

## Step 7 — Production smoke test

Run the go-live checks from `docs/phase-12-test-plan.md`:
- Admin: create a cutoff → load employees → calculate → Mark Ready → Paid → Lock.
- Employee: My Payroll shows only own finalized payslips; payslip PDF opens.
- Security spot-check (S1/S3/S5 from the test plan) as a real Prod Employee.
- Validate one payslip's figures against a known-good computation.

---

## Step 8 — Rollback / recovery

- The managed solution can be **deleted/uninstalled** from Prod to remove its components
  (destroys their data — only before real payroll exists).
- Prefer forward-fix: export a new managed version from Dev and re-import (upgrade).
- Take a Prod **environment backup** before go-live and before each subsequent import.

---

## Release checklist

- [ ] Code App added to `A365_DailyOperations` (Step 1)
- [ ] Solution version bumped
- [ ] Managed solution exported and tagged as the release artifact
- [ ] Prod env + Dataverse created; `pac auth` connected
- [ ] Managed solution imported and published
- [ ] Statutory/tax config data migrated and verified
- [ ] Security roles assigned; employees linked to Entra users
- [ ] Smoke test + security spot-check passed
- [ ] Prod backup taken; rollback plan confirmed
