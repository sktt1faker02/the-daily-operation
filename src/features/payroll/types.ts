/**
 * Payroll period & entry domain models. Logical names and choice values are
 * verified against Dataverse (`The Daily Operation - Dev`) and the generated
 * models (A365_payrollperiodsModel.ts, A365_payrollentriesModel.ts). Do not
 * guess Dataverse schema names (CLAUDE.md #5).
 */

/** Entity set names registered as data sources under `.power/schemas`. */
export const PAYROLL_PERIOD_TABLE = "a365_payrollperiods"
export const PAYROLL_ENTRY_TABLE = "a365_payrollentries"
export const PAYROLL_TEMPLATE_TABLE = "a365_payrolltemplates"
export const PAYROLL_TEMPLATE_LINE_TABLE = "a365_payrolltemplatelines"

/** `a365_payrollstatus` global choice (see A365_payrollperiodsModel.ts). */
export const PayrollStatus = {
  Draft: 749910000,
  Processing: 749910001,
  Ready: 749910002,
  Paid: 749910003,
  Locked: 749910004,
} as const
export type PayrollStatus = (typeof PayrollStatus)[keyof typeof PayrollStatus]

const STATUS_LABELS: Record<PayrollStatus, string> = {
  [PayrollStatus.Draft]: "Draft",
  [PayrollStatus.Processing]: "Processing",
  [PayrollStatus.Ready]: "Ready",
  [PayrollStatus.Paid]: "Paid",
  [PayrollStatus.Locked]: "Locked",
}

export function payrollStatusLabel(value: PayrollStatus | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return STATUS_LABELS[value] ?? "—"
}

export type PayrollStatusTone =
  | "draft"
  | "processing"
  | "ready"
  | "paid"
  | "locked"
  | "unknown"

export function payrollStatusBadgeTone(
  value: PayrollStatus | null | undefined,
): PayrollStatusTone {
  switch (value) {
    case PayrollStatus.Draft:
      return "draft"
    case PayrollStatus.Processing:
      return "processing"
    case PayrollStatus.Ready:
      return "ready"
    case PayrollStatus.Paid:
      return "paid"
    case PayrollStatus.Locked:
      return "locked"
    default:
      return "unknown"
  }
}

/** A period is editable in Phase 6 while Draft or Processing. */
export function isPeriodEditable(value: PayrollStatus | null | undefined): boolean {
  return value === PayrollStatus.Draft || value === PayrollStatus.Processing
}

// --- Read models (shape returned by the Dataverse Web API) -------------------

export interface PayrollPeriod {
  a365_payrollperiodid: string
  a365_name: string
  a365_periodstart: string
  a365_periodend: string
  a365_paydate: string | null
  a365_payrollstatus: PayrollStatus
  a365_lockedon?: string | null
  createdon?: string
  modifiedon?: string
  // Audit stamps (Phase 9): actor lookups. The Web API exposes only the `_value`
  // GUID here — the `...name` columns are NOT valid `$select` properties, so
  // display names are resolved separately (see payrollPeriodService.getPeriod).
  a365_readyon?: string | null
  a365_paidon?: string | null
  _createdby_value?: string | null
  _modifiedby_value?: string | null
  _a365_readyby_value?: string | null
  _a365_paidby_value?: string | null
  _a365_lockedby_value?: string | null
  // Resolved actor display names (attached by the service, not selected).
  createdbyname?: string
  modifiedbyname?: string
  a365_readybyname?: string
  a365_paidbyname?: string
  a365_lockedbyname?: string
}

export interface PayrollEntry {
  a365_payrollentryid: string
  a365_name: string
  a365_isincluded: boolean
  // Inputs (editable)
  a365_basicpay: number | null
  a365_allowances: number | null
  a365_otherearnings: number | null
  a365_otherdeductions: number | null
  a365_unpaidleavedays: number | null
  // Calculated (read-only in the UI)
  a365_grosspay: number | null
  a365_sss: number | null
  a365_philhealth: number | null
  a365_hdmf: number | null
  a365_unpaidleave: number | null
  a365_withholdingtax: number | null
  a365_totaldeductions: number | null
  a365_netpay: number | null
  a365_calculatedon: string | null
  /** Free-text admin note on the entry (optional). */
  a365_comment: string | null
  /** Lookup → a365_employee (read as `_value`). */
  _a365_employee_value: string | null
  /** Lookup → a365_payrollperiod (read as `_value`). Used to join period status. */
  _a365_payrollperiod_value?: string | null
  /** Formatted lookup name of the linked employee. */
  a365_employeename?: string
}

// --- Entry input form model (controlled string state) ------------------------

export interface PayrollEntryInputValues {
  a365_basicpay: string
  a365_allowances: string
  a365_otherearnings: string
  a365_otherdeductions: string
  a365_unpaidleavedays: string
  a365_withholdingtax: string
  a365_comment: string
}

export const emptyEntryInputValues: PayrollEntryInputValues = {
  a365_basicpay: "",
  a365_allowances: "",
  a365_otherearnings: "",
  a365_otherdeductions: "",
  a365_unpaidleavedays: "",
  a365_withholdingtax: "",
  a365_comment: "",
}

function numToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value)
}

export function toEntryInputValues(entry: PayrollEntry): PayrollEntryInputValues {
  return {
    a365_basicpay: numToInput(entry.a365_basicpay),
    a365_allowances: numToInput(entry.a365_allowances),
    a365_otherearnings: numToInput(entry.a365_otherearnings),
    a365_otherdeductions: numToInput(entry.a365_otherdeductions),
    a365_unpaidleavedays: numToInput(entry.a365_unpaidleavedays),
    a365_withholdingtax: numToInput(entry.a365_withholdingtax),
    a365_comment: entry.a365_comment ?? "",
  }
}

// --- Payroll cutoff templates -------------------------------------------------
// Templates store payroll entry INPUTS only (never calculated results), so a
// saved template can be re-applied to a future period and recalculated fresh.

export interface PayrollTemplate {
  a365_payrolltemplateid: string
  a365_name: string
  a365_description: string | null
  createdon: string
}

export interface PayrollTemplateLineRow {
  a365_payrolltemplatelineid: string
  a365_name: string | null
  _a365_template_value: string | null
  _a365_employee_value: string | null
  a365_basicpay: number | null
  a365_allowances: number | null
  a365_otherearnings: number | null
  a365_otherdeductions: number | null
  a365_unpaidleavedays: number | null
  a365_withholdingtax: number | null
  a365_comment: string | null
}
