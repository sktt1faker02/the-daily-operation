# Payroll domain guidance

Read for Payroll, financial calculations, payslips or related integrations after
[AGENTS.md](../AGENTS.md), [DESIGN.md](../DESIGN.md) and the full requirements.
Extracted from the original root instructions to reduce unrelated task context.
Latest confirmed owner decisions in [PLANS.md](../PLANS.md) and task-specific
requirements supersede historical defaults. This documentation change authorizes
no application, financial, schema, data, security or workflow change.

## Workflow

The Payroll Admin creates a cutoff, loads active employees, enters earnings and
variable adjustments, calculates, reviews, finalizes, records payment and locks.
Employees view their own finalized payslips/history. There is no separate
approver, approval queue, For Review or Approved stage in V1.

The original `a365_payrollstatus` flow was Draft -> Processing -> Ready -> Paid ->
Locked. PLANS.md subsequently specifies Processing -> Ready -> Locked, with Mark
as Paid recording payment and locking together. Follow current confirmed
requirements and the centralized status module; never restore obsolete stages
from this historical description. Each period represents one cutoff. Centralize
valid transitions, editability and employee visibility. Confirm numeric choices.

Prioritize employee master data, periods, entries, calculation, admin review,
finalization/payment/locking, employee payslips/history, audit and security.
Use [task phases](payroll-task-phases.md) for planning and
[Payroll-Enhancements.md](../Payroll-Enhancements.md) for delivery history.

## Entries, calculations and money

Each employee has an entry related to the employee and period; avoid unnecessary
copies of employee information. Core entry and payslip values are:

- Employee and Payroll Period.
- Basic Pay, Allowances, Other Earnings and Gross Pay.
- Unpaid Leave, SSS, PhilHealth, HDMF / Pag-IBIG, Withholding Tax and Other
  Deductions.
- Total Deductions and Net Pay.

Gross pay, statutory deductions, tax, other deductions, total deductions and net
pay belong in services/pure utilities, never JSX. Use approved or officially
verified rules; never invent contribution rates or tax treatment.

Prefer configuration-driven SSS, PhilHealth, HDMF and withholding tax rules with
Effective From/Until, rate/bracket, employee contribution, employer contribution
when required and version. Historical snapshots retain their applicable rules.
Do not permanently hardcode government tables into React components.

Centralize consistent rounding and Philippine Peso formatting (`PHP`, `en-PH`,
the peso symbol). Separate display formatting from stored/calculated values;
avoid raw floating-point equality where rounding matters.

Finalized/locked records stop normal editing and silent recalculation. Payslip
values remain stable when current salary or rules change. Corrections use an
explicit auditable process. Preserve supported creation/modification,
calculation, finalization and payment actor/timestamp metadata and auditing.

## Copy previous cutoff

Copy only appropriate recurring inputs: Basic Pay, recurring allowances and
approved recurring earnings/deductions. Do not blindly copy statutory results,
withholding tax, Net Pay, one-time adjustments or obsolete employee eligibility.
Recalculate the new period after copying.

## Integration boundaries and documents

Leave Management may supply unpaid leave inputs; V1 permits manual entry.
Keep calculations independent of that temporary UI. The eventual integration
is finalized/approved leave -> period -> unpaid leave deduction -> calculation,
using confirmed policies. Accounting consumes clean finalized financial data;
do not implement Accounting inside Payroll components.

SharePoint stores generated payslips, exports and supporting documents. Confirm
the site, library and folder structure; the earlier example
`Daily Operation/Payroll/year/month/cutoff` was conceptual only. Dataverse holds
business records and enough document metadata/references to associate each
document with its business record. Never guess site/library identifiers.

Payslips reflect the finalized snapshot and include all core values above.
Employees access only their own documents through actual permissions. Use Power
Automate where appropriate for generation, SharePoint operations, notifications,
scheduled work and cross-service automation, with visible error handling.

## Verification and policy

Verify creation, editing, calculation, review/finalization, payment, locking,
copying and relevant history/document behavior against current acceptance
criteria. Verify direct data access as well as UI behavior: Employee A cannot
see Employee B's payroll; employees cannot edit/finalize/pay; admins have intended
privileges; locked payroll rejects normal modification.

Resolve uncertainty before encoding formulas, cutoff behavior, salary basis,
statutory rates, tax treatment, leave deductions, finalization authority,
correction, document retention or security/access policy. Financially important
actions require confirmation. Delete, void, unlock and employee removal also
require authorization, clear impact and required auditing. Never remove financial
history merely to correct ordinary mistakes.
