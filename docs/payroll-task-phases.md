# Automations 365 -- The Daily Operation

## Milestone 1: Payroll -- Task Phases Breakdown

**Project:** Central Hub 2 -- The Daily Operation\
**Company:** Automations 365\
**Primary Stack:** Power Apps Code Apps + Dataverse + Power Automate\
**Documents:** SharePoint\
**Environments:** Development and Production

---

## Phase 1 -- Project Foundation & Environment Setup

**Goal:** Establish a secure and maintainable Power Platform foundation
before payroll development.

### Tasks

- [x] Create Development Power Platform environment (Dev sandbox `The Daily Operation - Dev` — provided by the team)
- [x] Create Dataverse database (Dev database provisioned; Prod deferred until Phase 13)
- [x] Create solution: `A365-DailyOperations` (publisher `Automations 365`, prefix `a365`; source-controlled under `solution/`)
- [x] Create and initialize the Power Apps Code App (`power.config.json` bound to Dev; `appId` populates on first `pac code push`)
- [x] Connect the Code App to Dataverse (SDK integration layer wired in `src/lib/power/`; per-table data sources added in Phase 3+ once tables exist)
- [x] Configure Microsoft Entra authentication (handled automatically by the Power Apps host; model documented in `docs/architecture.md` §8)
- [~] Define environment variables and connection references (naming conventions defined; per-environment values deferred to Phase 13 — none required for a Dev-only code app yet)
- [x] Establish naming conventions for tables, columns, flows, and
      components (`docs/naming-conventions.md`)
- [x] Document the initial application architecture (`docs/architecture.md`)

### Deliverable

A working Code App deployed to the Development environment and connected
securely to Dataverse.

---

## Phase 2 -- Security & Access Model

**Goal:** Protect payroll and financial information at the data layer.

### Tasks

- [x] Define application roles (`docs/security-model.md` §2)
  - Payroll Employee → `A365 - Payroll Employee`
  - Payroll Admin → `A365 - Payroll Admin`
  - System Administrator → built-in role (not recreated)
- [~] Create/configure Dataverse security roles (designed §2/§5; roles created in Phase 3 as tables land)
- [~] Configure employee-level record access (designed §3/§4; enforced in Phase 3 with the Employee↔Entra link)
- [~] Ensure employees can only read their own payroll records (owner-based access designed §4; enforced in Phase 4/6)
- [~] Allow Payroll Admins to manage employee payroll records (designed §5; enforced in Phase 3–4)
- [~] Configure approval permissions (no Approver role in V1; status-transition control designed for Phase 7 §8)
- [~] Restrict deletion of sensitive payroll records (no Delete on payroll tables, designed §7; enforced in Phase 4)
- [~] Define access to SharePoint payroll documents (designed §9; enforced in Phase 11)
- [ ] Test unauthorized record access (test plan defined §11; executed in Phase 12)
- [x] Document the payroll security model (`docs/security-model.md`)

### Deliverable

Role-based and record-level security enforced through Dataverse rather
than only through the application UI.

---

## Phase 3 -- Employee Master Data

**Goal:** Create the employee information required by payroll.

### Tasks

- [x] Create Employee Dataverse table (`a365_employee`; see `docs/data-model.md`)
- [x] Add employee identification fields
- [~] Link employee to Microsoft Entra user (`a365_systemuser` lookup column created; form wiring + owner assignment deferred to Phase 4/6 per `docs/security-model.md` §10 — needs real user accounts and the load-employees flow)
- [x] Add employment information
- [x] Add department and position
- [x] Add employment status
- [x] Add employment type
- [x] Add date hired
- [x] Add basic monthly salary
- [x] Add payroll frequency
- [x] Add SSS information
- [x] Add PhilHealth information
- [x] Add Pag-IBIG/HDMF information
- [x] Add TIN information
- [x] Add payment/bank information if required
- [x] Build employee list for Payroll Admin (TanStack Table: sorting, status filter, Loading/Empty/Error states)
- [x] Build employee create/edit form (validation, save-state, toasts)
- [x] Add active/inactive employee handling (status filter; `isActiveEmployee`)

### Deliverable

Payroll Admin can securely maintain the employee master records required
for payroll processing.

---

## Phase 4 -- Payroll Data Model

**Goal:** Create the Dataverse structure for payroll transactions.

### Tasks

- [x] Create Payroll Period table (`a365_payrollperiod`, User owned)
- [x] Add period start date (`a365_periodstart`)
- [x] Add period end date (`a365_periodend`)
- [x] Add pay date (`a365_paydate`)
- [x] Add payroll status (`a365_payrollstatus` global choice; Ready/Paid/Locked stamps)
- [x] Add created/ready/paid/locked metadata (standard stamps + `a365_readyby/on`, `a365_paidby/on`, `a365_lockedby/on`)
- [x] Create Payroll Entry table (`a365_payrollentry`, User owned)
- [x] Relate Payroll Entry to Employee (`a365_employee_payrollentry`, required, Restrict)
- [x] Relate Payroll Entry to Payroll Period (`a365_payrollperiod_payrollentry`, required, Restrict)
- [x] Add Basic Pay (`a365_basicpay`)
- [x] Add Allowances (`a365_allowances`)
- [x] Add Unpaid Leave deduction (`a365_unpaidleavedays` input + `a365_unpaidleave` computed)
- [x] Add Gross Pay (`a365_grosspay`)
- [x] Add SSS deduction (`a365_sss`)
- [x] Add PhilHealth deduction (`a365_philhealth`)
- [x] Add HDMF/Pag-IBIG deduction (`a365_hdmf`)
- [x] Add Withholding Tax (`a365_withholdingtax`)
- [x] Add Other Earnings (`a365_otherearnings`)
- [x] Add Other Deductions (`a365_otherdeductions`)
- [x] Add Total Deductions (`a365_totaldeductions`)
- [x] Add Net Pay (`a365_netpay`)
- [~] Consider separate Payroll Earning and Payroll Deduction tables — **decided
      against for V1**: variable pay is lump-sum columns on the entry
      (spec §2.5). Revisit only if itemized lines are needed later.

### Deliverable

A normalized Dataverse payroll data model supporting employees, cutoff
periods, earnings, deductions, and calculated payroll totals.

---

## Phase 5 -- Payroll Calculation Engine

**Goal:** Automatically calculate statutory deductions, taxes, and net
pay.

### Tasks

- [x] Define Gross Pay calculation (basic + allowances + other − unpaid leave)
- [x] Define Unpaid Leave calculation (days × daily rate; daily = monthly ÷ 22)
- [x] Create SSS contribution configuration/table (`a365_ssscontribution`, 61 brackets)
- [x] Create PhilHealth contribution configuration/table (`a365_philhealthcontribution`)
- [x] Create HDMF/Pag-IBIG contribution configuration/table (`a365_hdmfcontribution`)
- [x] Create withholding tax configuration/table (`a365_taxbracket`, BIR semi-monthly)
- [x] Add effective-from/effective-until dates to statutory rules
- [x] Implement SSS automatic calculation (verified 875/cutoff)
- [x] Implement PhilHealth automatic calculation (verified 537.50/cutoff)
- [x] Implement HDMF automatic calculation (verified 100/cutoff)
- [~] Implement withholding tax automatic calculation — bracket table + calc ship; **taxable-base rule TBD (accountant)**, isolated to `computeTaxableBase` (spec §7)
- [x] Calculate Total Deductions
- [x] Calculate Net Pay
- [x] Handle rounding rules (`round2`, half-up 2dp)
- [x] Handle calculation errors and missing configuration (typed throw, not silent 0)
- [x] Store calculation results in the payroll record (`calculateAndPersistEntry`)
- [x] Add payroll recalculation capability while payroll is in Draft (service ready; status guard is Phase 7)
- [x] Unit-test calculation scenarios (Vitest; payslip golden fixture + edges)

### Deliverable

A reusable payroll calculation service that calculates payroll
independently from the UI.

---

## Phase 6 -- Payroll Administration UI

**Goal:** Allow Payroll Admins to create and process each payroll
cutoff.

### Tasks

- [x] Build Payroll Dashboard
- [x] Display current payroll period
- [x] Display recent payroll periods
- [x] Display payroll totals and status
- [x] Build Create Payroll Period screen
- [x] Build Payroll Period detail screen
- [x] Load active employees into a payroll period
- [x] Build employee payroll editing screen
- [x] Allow Basic Pay editing
- [x] Allow Allowance editing
- [x] Allow Unpaid Leave editing
- [x] Allow other adjustments if enabled
- [x] Add Calculate/Recalculate Payroll action
- [x] Display Gross Pay
- [x] Display individual deductions
- [x] Display Total Deductions
- [x] Display Net Pay
- [x] Add validation and error messages
- [x] Add search/filtering for employees
- [x] Add payroll summary totals

### Deliverable

Payroll Admin can create a cutoff, populate employees, enter variable
payroll information, and calculate payroll.

---

## Phase 7 -- Payroll Review, Finalization & Locking

**Goal:** Prevent accidental changes to finalized payroll.

> **V1 decision:** there is **no separate Payroll Approver role** and **no
> For Review / Approved stage**. The Payroll Admin prepares, reviews, finalizes,
> and marks payroll paid. "Ready" is the Admin's finalize state before payment.
> See `docs/superpowers/specs/2026-09-06-phase-4-payroll-data-model-design.md` §2.

### Status Flow (V1)

`Draft → Processing → Ready → Paid → Locked`

(Backed by the `a365_payrollstatus` global choice — see `docs/data-model.md`.)

### Tasks

- [x] Implement payroll status workflow (centralized transition rules)
- [x] Add Mark Ready action (Admin finalize) and record Ready By / Ready At
- [x] Restrict status transitions to Payroll Admin (Dataverse-enforced)
- [x] Lock finalized payroll records
- [x] Prevent normal edits after locking (data-layer control — security-model §8)
- [x] Add Mark as Paid action and record Paid By / Paid At
- [x] Define correction/adjustment process for finalized payroll (audited Unlock → Processing)
- [x] Test all allowed and prohibited status transitions

### Deliverable

A controlled payroll lifecycle with review, finalization (Ready), payment, and
locking — all performed by the Payroll Admin, with no approver role.

---

## Phase 8 -- Employee Payroll Portal

**Goal:** Allow employees to securely view their own payroll
information.

### Tasks

- [x] Build My Payroll page (`src/pages/my-payroll.tsx`; role-gated nav via `useCurrentEmployee`, Paid/Locked payslips only)
- [x] Display latest payroll (latest cutoff totals card)
- [x] Display Net Pay (summary card + history table)
- [x] Display previous payroll periods (payroll history table)
- [x] Build Payslip detail page (`src/pages/payslip.tsx`)
- [x] Display Basic Pay (shared `PayslipBreakdown`)
- [x] Display Allowances
- [x] Display Gross Pay
- [x] Display SSS (itemized employee-share line)
- [x] Display PhilHealth (itemized employee-share line)
- [x] Display HDMF/Pag-IBIG (itemized employee-share line)
- [x] Display Withholding Tax (itemized employee-share line)
- [x] Display other deductions
- [x] Display Total Deductions
- [x] Display Net Pay
- [x] Ensure employees cannot access another employee's payroll by
      changing URLs/IDs (payslip resolved only from the caller's own visible
      payslips; unknown/foreign id → "not available")
- [~] Test employee record-level security (visibility rule unit-tested in
      `my-payroll.test.ts`; direct Dataverse record-access testing stays in
      Phase 12 §11, as it is data-layer enforced)

### Deliverable

Employees can securely view their own payslips and payroll history.

---

## Phase 9 -- Audit Trail & Financial Controls

**Goal:** Make sensitive payroll changes traceable.

### Tasks

- [ ] Enable appropriate Dataverse auditing
- [ ] Track payroll Created By / Created At
- [ ] Track Updated By / Updated At
- [ ] Track Calculated By / Calculated At
- [ ] Track Submitted By / Submitted At
- [ ] Track Approved By / Approved At
- [ ] Track Paid By / Paid At
- [ ] Track significant salary and deduction changes
- [ ] Define rules for payroll deletion
- [ ] Define adjustment/correction procedure
- [ ] Build an Admin audit/history view if required

### Deliverable

Important payroll actions and financial changes have a traceable audit
history.

---

## Phase 10 -- Copy Previous Cutoff

**Goal:** Reduce repetitive payroll encoding.

### Tasks

- [ ] Add Copy Previous Cutoff action
- [ ] Select the previous payroll period
- [ ] Copy eligible employee payroll entries
- [ ] Copy Basic Pay
- [ ] Copy recurring Allowances
- [ ] Copy recurring earnings/deductions where appropriate
- [ ] Keep copied entries editable
- [ ] Do not blindly copy calculated statutory deductions
- [ ] Recalculate SSS
- [ ] Recalculate PhilHealth
- [ ] Recalculate HDMF
- [ ] Recalculate Withholding Tax
- [ ] Recalculate Net Pay
- [ ] Handle employees hired/terminated between periods

### Deliverable

Payroll Admin can create a new cutoff from the previous cutoff and then
review/edit/recalculate it.

---

## Phase 11 -- Payslip Documents & SharePoint

**Goal:** Generate formal payslip documents and use SharePoint for
document storage.

### Tasks

- [ ] Design payslip document template
- [ ] Generate payslip PDF
- [ ] Create SharePoint payroll/payslip document structure
- [ ] Store generated payslips in SharePoint
- [ ] Associate SharePoint document reference with Payroll Entry
- [ ] Apply appropriate SharePoint permissions
- [ ] Add View/Download Payslip action
- [ ] Define document naming convention
- [ ] Test document access as Employee and Admin

### Deliverable

Approved payroll can produce employee payslip documents stored securely
in SharePoint.

---

## Phase 12 -- Testing & Quality Assurance

**Goal:** Verify payroll calculations, workflows, security, and user
experience before production.

### Tasks

- [ ] Unit-test payroll calculations
- [ ] Test SSS scenarios
- [ ] Test PhilHealth scenarios
- [ ] Test HDMF scenarios
- [ ] Test withholding tax scenarios
- [ ] Test unpaid leave scenarios
- [ ] Test allowances
- [ ] Test payroll copying
- [ ] Test payroll approval
- [ ] Test payroll locking
- [ ] Test employee-only access
- [ ] Test Payroll Admin access
- [ ] Test Payroll Approver access
- [ ] Test direct URL/record access attempts
- [ ] Test SharePoint document permissions
- [ ] Test empty/missing payroll data
- [ ] Test terminated/inactive employees
- [ ] Conduct User Acceptance Testing (UAT)
- [ ] Resolve UAT findings

### Deliverable

Payroll module passes calculation, workflow, security, and UAT
requirements.

---

## Phase 13 -- Production Deployment

**Goal:** Release the first Payroll milestone safely.

### Tasks

- [ ] Review production security roles
- [ ] Review environment variables
- [ ] Prepare production Dataverse configuration
- [ ] Deploy solution to Production
- [ ] Publish Code App to Production
- [ ] Configure production connections
- [ ] Load statutory contribution/tax configuration
- [ ] Load employee master data
- [ ] Perform production smoke testing
- [ ] Validate Employee access
- [ ] Validate Payroll Admin access
- [ ] Validate Payroll Approver access
- [ ] Document rollback/recovery procedure
- [ ] Train Payroll Admin/Approver
- [ ] Go live

### Deliverable

Payroll V1 is live in the Automations 365 Daily Operation production
environment.

---

# Suggested Implementation Order

For the initial release, prioritize:

1.  **Foundation & Environments**
2.  **Security**
3.  **Employee Master Data**
4.  **Payroll Data Model**
5.  **Calculation Engine**
6.  **Payroll Administration**
7.  **Review / Approval / Locking**
8.  **Employee Payroll Portal**
9.  **Audit Trail**
10. **Testing**
11. **Production Deployment**

After the core V1 is stable:

12. **Copy Previous Cutoff**
13. **PDF Payslips + SharePoint integration**

---

# Future Integration -- Leave Management

The payroll architecture should anticipate Milestone 2: Leave
Management.

Future flow:

`Approved Leave → Determine Paid/Unpaid Leave → Payroll Period → Unpaid Leave Deduction → Payroll Calculation`

The first Payroll version may allow the Payroll Admin to manually enter
unpaid leave deductions, but the long-term goal should be for approved
leave records to feed payroll automatically.

---

# Definition of Done -- Payroll V1

Payroll V1 can be considered complete when:

- [ ] Payroll Admin can maintain employee payroll information
- [ ] Payroll Admin can create a cutoff period
- [ ] Active employees can be loaded into the cutoff
- [ ] Basic Pay and Allowances can be recorded
- [ ] Unpaid Leave can be recorded
- [ ] SSS is automatically calculated
- [ ] PhilHealth is automatically calculated
- [ ] HDMF/Pag-IBIG is automatically calculated
- [ ] Withholding Tax is automatically calculated
- [ ] Gross Pay, Total Deductions, and Net Pay are automatically
      calculated
- [ ] Payroll can be reviewed and approved
- [ ] Finalized payroll cannot be casually modified
- [ ] Employees can only view their own payroll records
- [ ] Admins can view authorized payroll records
- [ ] Employees can view their payroll history and payslip
- [ ] Sensitive actions are auditable
- [ ] Development and Production environments are separated
- [ ] Security and payroll calculation tests pass
