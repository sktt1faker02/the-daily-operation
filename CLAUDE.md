# CLAUDE.md

## Project Overview

**Project:** The Daily Operation\
**Company:** Automations 365\
**Current Milestone:** Payroll\
**Future Modules:** Leave Management, Accounting

The Daily Operation is an internal operational hub for Automations 365.
The application will centralize operational workflows beginning with
Payroll, followed by Leave Management and Accounting.

This is a **Microsoft Power Platform Code App**, not a traditional
standalone React application. Preserve Power Platform integration and
conventions when implementing features.

https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview

---

## Technology Stack

### Application

- Microsoft Power Apps Code Apps
- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui / Radix UI
- Lucide React
- TanStack Query
- TanStack Table
- Zustand
- date-fns
- Sonner
- Recharts when charts are genuinely required

The project is based on Microsoft's official
`PowerAppsCodeApps/templates/starter` template.

### Backend

**Dataverse is the system of record for application/business data.**

Use Dataverse for:

- Employees
- Payroll periods
- Payroll entries
- Earnings
- Deductions
- Statutory contribution configuration
- Tax configuration
- Payroll statuses
- Finalization metadata
- Application configuration
- Audit-related business records
- Future leave records
- Future accounting records

Do not introduce another application database unless explicitly
requested.

### Documents

**SharePoint is the document repository.**

Use SharePoint for:

- Generated payslips
- Payroll-related documents
- Employee documents when introduced
- Supporting attachments
- Future accounting documents

Do not store document binaries in Dataverse unless there is a specific
justified requirement.

Dataverse should normally contain the business record and, where
necessary, metadata/reference information associated with the SharePoint
document.

### Automation

Use **Power Automate** when server-side/background workflow is
appropriate, especially for:

- Document generation
- SharePoint document operations
- Notifications
- Finalization-related automation
- Scheduled processes
- Cross-service workflows

Do not move simple client-side interaction or ordinary Dataverse CRUD
into Power Automate without a reason.

---

# Core Architecture

Keep business logic out of presentation components.

# Coding Principles

## TypeScript

Use TypeScript strictly.

Avoid:

```ts
any;
```

unless interacting with an API where the shape genuinely cannot yet be
represented.

# React Rules

Use functional components.

Move reusable/business behavior into hooks, services, or utilities.

Avoid unnecessary `useEffect`.

Do not use `useEffect` for state that can be derived directly during
rendering.

---

# UI & Design System

Use the components already provided by the Power Apps Code Apps starter.

Prefer **shadcn/ui** components over custom recreations.

Examples:

- Button
- Card
- Dialog
- Dropdown Menu
- Select
- Tabs
- Checkbox
- Tooltip
- Popover
- Progress
- Separator

Use Tailwind CSS for layout and styling.

Use **Lucide React** for application icons.

Do not use emoji as application UI icons.

Keep the UI appropriate for a professional internal business/financial
application.

Prioritize:

- clarity
- readable tables
- predictable navigation
- clear status indicators
- accessible controls
- responsive layouts
- minimal unnecessary decoration

---

# Data Fetching

Use **TanStack Query** for Dataverse server state.

Use it for:

- queries
- mutations
- caching
- invalidation
- loading states
- retry behavior where appropriate

Example conceptual pattern:

```ts
const payrollQuery = useQuery({
  queryKey: ["payroll", payrollPeriodId],
  queryFn: () => payrollService.getPayroll(payrollPeriodId),
});
```

After mutations, invalidate the smallest relevant query scope.

Do not store fetched Dataverse collections in Zustand simply to
duplicate TanStack Query state.

---

# Zustand

Use Zustand only for genuine client/global UI state.

Examples:

- navigation state
- temporary multi-step workflow state
- user UI preferences
- cross-page UI state

Do not use Zustand as the primary Dataverse cache.

---

# Dataverse Rules

Dataverse is authoritative for business data.

Keep Dataverse access behind a data/service layer.

Preferred:

```text
Component
   |
Hook
   |
Service
   |
Dataverse
```

Avoid performing complex Dataverse calls directly inside presentation
components.

Example:

```text
features/payroll/services/payroll-service.ts
```

The service should expose business-oriented operations such as:

```ts
getPayrollPeriods();
getPayrollPeriod(id);
getPayrollEntries(periodId);
createPayrollPeriod(input);
updatePayrollEntry(id, input);
submitPayroll(periodId);
```

Names should represent business operations rather than leaking UI
implementation details.

---

# Dataverse Naming

Before adding or referencing a Dataverse column:

1.  Confirm the actual table schema name.
2.  Confirm the actual column logical/schema name.
3.  Confirm relationship names.
4.  Confirm option-set/choice values.
5.  Do not guess generated Dataverse names.

Do not assume display names equal logical names.

Never silently invent Dataverse schema names.

---

# Security

Payroll and financial information is sensitive.

**Never rely on UI hiding as the security boundary.**

Bad:

```ts
if (!isAdmin) {
  return null;
}
```

This may improve UX but does not protect the underlying Dataverse
record.

Security must primarily be enforced through:

- Microsoft Entra authentication
- Dataverse security roles
- Dataverse privileges
- record ownership/access
- appropriate SharePoint permissions

Application checks are an additional UX/security layer, not the primary
authorization mechanism.

---

# Application Roles

Design around these roles:

## Payroll Employee / User

Can:

- view own profile
- view own payroll history
- view own payslips

Cannot:

- access another employee's payroll
- edit payroll calculations
- finalize payroll
- mark payroll paid

## Payroll Admin

The Payroll Admin is the administrative role responsible for Payroll.

Can:

- manage employee payroll information
- create payroll periods
- populate payroll
- enter and edit payroll inputs while editable
- calculate/recalculate payroll
- review payroll
- finalize/lock payroll
- mark payroll as paid
- view payroll reports
- manage payroll-related documents where authorized

There is currently **no separate Payroll Approver role**.

Do not build an approval layer, approval queue, or approver-specific permissions unless explicitly requested later.

## System Administrator

Administrative Power Platform access.

Do not automatically give System Administrator functionality to ordinary Payroll Admin users.

---

# Payroll Domain

Payroll is Milestone 1.

Core flow:

```text
Create Payroll Period
        |
Load Active Employees
        |
Enter / Load Earnings
        |
Enter Variable Adjustments
        |
Calculate Payroll
        |
Review
        |
Submit
        |
Approve
        |
Finalize / Lock
        |
Mark Paid
        |
Employee Payslip
```

---

# Payroll Period

A payroll period represents one cutoff.

Suggested statuses:

```text
Draft
Processing
For Review
Approved
Paid
Locked
```

Do not allow arbitrary status transitions.

Business rules must determine which transitions are valid.

Example:

```text
Draft -> Processing
Processing -> For Review
For Review -> Approved
Approved -> Paid
Paid -> Locked
```

If the final workflow differs, update the centralized status transition
logic rather than scattering checks throughout the UI.

---

# Payroll Entry

Each employee has a payroll entry associated with a payroll period.

Core fields include:

```text
Employee
Payroll Period

Basic Pay
Allowances
Other Earnings

Gross Pay

Unpaid Leave
SSS
PhilHealth
HDMF / Pag-IBIG
Withholding Tax
Other Deductions

Total Deductions
Net Pay
```

Relationships should be used instead of duplicating employee information
unnecessarily.

---

# Payroll Calculations

Payroll calculations are business logic.

Do not place calculation formulas directly inside JSX.

Bad:

```tsx
<div>{basicPay + allowance - sss - tax}</div>
```

Preferred:

```ts
const result = calculatePayroll(input);
```

or a dedicated payroll calculation service.

Calculation responsibilities should include:

```text
Gross Pay
Statutory Deductions
Tax
Other Deductions
Total Deductions
Net Pay
```

---

# Statutory Contributions

The application will calculate:

- SSS
- PhilHealth
- HDMF / Pag-IBIG
- Withholding Tax

Do **not** permanently hardcode government contribution tables into
React components.

Contribution/tax rules should be configuration-driven where practical.

Configuration should support:

```text
Effective From
Effective Until
Rate / Bracket
Employee Contribution
Employer Contribution (when required)
Version
```

This allows historical payroll to remain associated with the rules
applicable at the time.

When implementing statutory calculations, do not invent rates or tax
rules. Use approved business requirements/current official rules
supplied or verified for the project.

---

# Money

Payroll amounts must not be treated casually.

Use consistent rounding rules.

Do not compare floating-point money using unreliable direct equality
where rounding can matter.

Centralize currency formatting.

Display Philippine Peso using:

```text
₱
```

and appropriate locale formatting.

Example:

```ts
new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
}).format(amount);
```

Keep formatting separate from stored/calculation values.

---

# Payroll Immutability

Finalized financial records must be protected.

Once payroll reaches the designated finalized/locked state:

- normal payroll editing must stop
- calculations must not silently change
- employee payslip values must remain stable
- corrections should use an explicit adjustment/correction process

Never silently modify historical payroll because an employee's current
salary or a government contribution configuration changed.

Historical payroll represents a financial snapshot.

---

# Copy Previous Cutoff

The system should eventually support copying the previous cutoff.

Copy appropriate recurring/input values such as:

- Basic Pay
- recurring allowances
- recurring earnings/deductions where approved

Do not blindly copy:

- statutory calculation results
- withholding tax result
- Net Pay
- one-time adjustments
- outdated employee eligibility

After copying, recalculate the new payroll period.

---

# Leave Management Integration

Leave Management is a future milestone.

Design Payroll so Leave Management can eventually provide unpaid leave
information.

Future flow:

```text
Leave Request
     |
Finalization
     |
Approved Leave
     |
Payroll Period
     |
Unpaid Leave Deduction
     |
Payroll Calculation
```

For V1, unpaid leave may be entered manually.

Do not tightly couple payroll calculations to a temporary manual UI
implementation.

---

# Accounting Integration

Accounting is a future milestone.

Payroll should expose clean finalized financial data that Accounting can
consume later.

Do not implement Accounting behavior inside Payroll components.

Keep module boundaries clear.

---

# SharePoint Documents

Use SharePoint as the document repository.

For payroll, likely documents include:

```text
Payslips
Payroll exports
Supporting documents
```

Suggested conceptual organization:

```text
Daily Operation
  /
  Payroll
    /
    2026
      /
      09
        /
        2026-09-01_to_2026-09-15
```

Exact SharePoint structure must be confirmed before implementation.

Do not guess library/site identifiers.

Store enough Dataverse metadata to associate documents with the correct
business record.

---

# Payslips

Payslips must reflect the finalized payroll snapshot.

A payslip should contain at minimum:

```text
Employee
Payroll Period

Basic Pay
Allowances
Other Earnings
Gross Pay

Unpaid Leave
SSS
PhilHealth
HDMF
Withholding Tax
Other Deductions
Total Deductions

Net Pay
```

Employees must only be able to access their own payslips.

Generated payslips should be stored in SharePoint when document
generation is implemented.

---

# Power Automate

Use Power Automate selectively.

Good candidates:

```text
Generate payslip document
Save payslip to SharePoint
Send payroll/payslip notification
Finalization notification
Scheduled operational workflows
Cross-service automation
```

Avoid creating flows for trivial UI operations that can be safely and
cleanly performed through the Code App and Dataverse.

Flows must handle errors and should not silently fail.

---

# Tables & Data Grids

Payroll is data-heavy.

Use **TanStack Table** for complex payroll tables where useful.

Support appropriate:

- sorting
- filtering
- pagination
- column formatting
- row actions
- loading states
- empty states

Do not render hundreds/thousands of Dataverse records unnecessarily if
server-side filtering/paging can be used.

---

# Forms

Forms must:

- validate required values
- display useful validation messages
- disable duplicate submission while saving
- show saving/loading state
- handle Dataverse errors
- confirm destructive/financially important actions

Do not clear a form until the mutation succeeds.

---

# Error Handling

Never silently swallow errors.

Bad:

```ts
try {
  await save();
} catch {}
```

Handle errors appropriately and surface user-friendly feedback.

Use Sonner/toasts for transient feedback where suitable.

Examples:

```text
Payroll period created.
Payroll recalculated.
Unable to save payroll entry.
Payroll cannot be edited because it is locked.
```

Do not expose sensitive raw backend details to ordinary users.

---

# Loading & Empty States

Every data-dependent page must account for:

```text
Loading
Success
Empty
Error
```

Avoid blank screens while queries are loading.

Use skeletons or appropriate loading indicators.

Empty states should explain what the user can do next.

---

# Accessibility

Use semantic HTML.

Use labels for form fields.

Interactive controls must be keyboard accessible.

Use shadcn/Radix primitives rather than rebuilding accessible dialogs,
dropdowns, and similar controls manually.

Do not rely on color alone to communicate payroll status.

---

# Performance

Avoid unnecessary Dataverse requests.

Use:

- TanStack Query caching
- targeted query invalidation
- server-side filtering where supported
- pagination for large collections
- appropriate query keys

Avoid:

- loading every employee's complete payroll history on initial
  dashboard load
- duplicate queries for the same data
- unnecessary global state
- unnecessary re-renders

---

# Auditability

Payroll actions must be traceable.

Where supported/required, preserve:

```text
Created By
Created At
Modified By
Modified At

Calculated By
Calculated At

Finalized By
Finalized At

Paid By
Paid At
```

Use Dataverse auditing where appropriate.

Do not remove financial records simply to correct ordinary mistakes.

Prefer an auditable correction/adjustment process.

---

# Destructive Actions

For actions such as:

```text
Delete Payroll
Void Payroll
Unlock Payroll
Remove Employee from Payroll
```

require:

- appropriate authorization
- confirmation
- clear explanation of impact
- auditability where required

Never implement destructive payroll actions casually.

---

# Testing

At minimum test:

## Calculation

- Gross Pay
- allowances
- unpaid leave
- SSS
- PhilHealth
- HDMF
- withholding tax
- total deductions
- Net Pay
- rounding

## Workflow

- payroll creation
- payroll editing
- calculation
- submission
- finalization
- locking
- payment
- copy previous cutoff

## Security

Verify:

```text
Employee A cannot access Employee B payroll.
Employee cannot finalize payroll.
Employee cannot mark payroll as paid.
Employee cannot alter payroll through direct requests.
Payroll Admin has intended permissions.
Locked payroll cannot be modified normally.
```

Security testing must include direct record/data access behavior, not
only hidden buttons.

---

# Development Commands

Use the scripts provided by the starter project.

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Before considering implementation complete:

```bash
npm run lint
npm run build
```

must succeed unless an existing unrelated project issue is explicitly
documented.

---

# Dependency Rules

Prefer dependencies already included in the Microsoft starter template.

Before installing another package:

1.  Check whether the existing stack already solves the problem.
2.  Prefer platform/browser capabilities for simple requirements.
3.  Avoid overlapping libraries.
4.  Explain why a significant new dependency is required.

Do not replace the starter architecture unnecessarily.

---

# Working With Existing Code

Before modifying a feature:

1.  Inspect the existing implementation.
2.  Inspect related components.
3.  Inspect related types.
4.  Inspect related Dataverse services.
5.  Understand the current routing.
6.  Reuse existing patterns where reasonable.
7.  Make the smallest coherent change.

Do not rewrite unrelated code.

Do not change architecture simply because another pattern is personally
preferred.

---

# When Requirements Are Unclear

Payroll is financially sensitive.

Do not invent business rules.

Ask/flag uncertainty when implementation depends on:

- payroll formula
- cutoff behavior
- salary basis
- statutory rates
- tax treatment
- leave deduction rules
- finalization authority
- payroll correction policy
- document retention
- security/access policy

It is better to identify a missing business rule than to silently encode
an assumption.

---

# Current Product Priority

Development priority is:

```text
Milestone 1
Payroll

Milestone 2
Leave Management

Milestone 3
Accounting
```

Do not prematurely build Leave Management or Accounting unless required
to establish a clean integration boundary.

Current Payroll V1 priority:

```text
Employee Master Data
        |
Payroll Period
        |
Payroll Entry
        |
Payroll Calculations
        |
Payroll Admin UI
        |
Review / Finalization
        |
Lock / Finalize
        |
Employee Payslip
        |
Payroll History
        |
Audit & Security
```

---

# General Rules

- use mcp microsoft learn for latest documentation
- user the skil - vercel react best practices

# Non-Negotiable Rules

1.  **Dataverse is the application system of record.**
2.  **SharePoint is the document repository.**
3.  **Do not introduce another database without explicit finalization.**
4.  **Do not use UI-only authorization for payroll security.**
5.  **Do not guess Dataverse schema names.**
6.  **Do not invent payroll formulas or statutory rates.**
7.  **Do not hardcode statutory contribution rules into JSX.**
8.  **Do not silently modify finalized payroll.**
9.  **Do not expose one employee's payroll to another employee.**
10. **Do not store server data redundantly in Zustand when TanStack
    Query should own it.**
11. **Prefer existing shadcn/ui components and the starter stack.**
12. **Keep business logic outside presentation components.**
13. **Run lint and build before declaring implementation complete.**
14. **Keep Payroll, Leave Management, and Accounting as clear domain
    modules.**
15. **Treat payroll and financial information as sensitive by default.**
