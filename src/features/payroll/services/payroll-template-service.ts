/**
 * Payroll cutoff template data service. All Dataverse access for the template
 * tables stays behind this layer. Templates store INPUTS only; applying a
 * template overwrites/adds entries (shared plan logic with copy-previous) and
 * the caller recalculates. Saving is restricted to Paid/Locked periods.
 */
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { EmploymentStatus } from "@/features/employees/types"
import { planApplyInputs, type CopiedInputs } from "../period-utils"
import { payrollPeriodService } from "./payroll-period-service"
import {
  PAYROLL_TEMPLATE_TABLE,
  PAYROLL_TEMPLATE_LINE_TABLE,
  PAYROLL_ENTRY_TABLE,
  PayrollStatus,
  type PayrollTemplate,
  type PayrollTemplateLineRow,
  type PayrollEntry,
} from "../types"

const FINALIZED = new Set<PayrollStatus>([PayrollStatus.Paid, PayrollStatus.Locked])

export interface PayrollTemplateSummary {
  id: string
  name: string
  description: string | null
  lineCount: number
  createdOn: string
}
export interface PayrollTemplateLine {
  employeeId: string
  employeeName: string
  inputs: CopiedInputs
}

const LINE_SELECT = [
  "a365_payrolltemplatelineid",
  "a365_name",
  "_a365_template_value",
  "_a365_employee_value",
  "a365_basicpay",
  "a365_allowances",
  "a365_otherearnings",
  "a365_otherdeductions",
  "a365_unpaidleavedays",
  "a365_withholdingtax",
  "a365_comment",
]

function lineToInputs(r: PayrollTemplateLineRow): CopiedInputs {
  return {
    basicPay: r.a365_basicpay ?? 0,
    allowances: r.a365_allowances ?? 0,
    otherEarnings: r.a365_otherearnings ?? 0,
    otherDeductions: r.a365_otherdeductions ?? 0,
    unpaidLeaveDays: r.a365_unpaidleavedays ?? 0,
    withholdingTax: r.a365_withholdingtax ?? 0,
    comment: r.a365_comment ?? "",
  }
}

export const payrollTemplateService = {
  async listTemplates(): Promise<PayrollTemplateSummary[]> {
    const headers = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplate>(PAYROLL_TEMPLATE_TABLE, {
      select: ["a365_payrolltemplateid", "a365_name", "a365_description", "createdon"],
      orderBy: ["createdon desc"],
    })
    if (!headers.success) throw headers.error ?? new Error("Unable to load templates.")
    const lines = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplateLineRow>(PAYROLL_TEMPLATE_LINE_TABLE, {
      select: ["_a365_template_value"],
    })
    if (!lines.success) throw lines.error ?? new Error("Unable to load template lines.")
    const counts = new Map<string, number>()
    for (const l of lines.data ?? []) {
      const id = l._a365_template_value
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return (headers.data ?? []).map((h) => ({
      id: h.a365_payrolltemplateid,
      name: h.a365_name,
      description: h.a365_description ?? null,
      lineCount: counts.get(h.a365_payrolltemplateid) ?? 0,
      createdOn: h.createdon,
    }))
  },

  async getTemplateLines(templateId: string): Promise<PayrollTemplateLine[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<PayrollTemplateLineRow>(PAYROLL_TEMPLATE_LINE_TABLE, {
      select: LINE_SELECT,
      filter: `_a365_template_value eq ${templateId}`,
    })
    if (!result.success) throw result.error ?? new Error("Unable to load template lines.")
    return (result.data ?? [])
      .filter((r) => r._a365_employee_value)
      .map((r) => ({
        employeeId: r._a365_employee_value as string,
        employeeName: r.a365_name ?? "",
        inputs: lineToInputs(r),
      }))
  },

  async saveTemplateFromPeriod(periodId: string, name: string, description: string | null) {
    const period = await payrollPeriodService.getPeriod(periodId)
    if (!FINALIZED.has(period.a365_payrollstatus)) {
      throw new Error("A template can only be saved from a Paid or Locked payroll period.")
    }
    const entries = await payrollPeriodService.listEntries(periodId)

    const header = await dataClient.createRecordAsync<Record<string, unknown>, PayrollTemplate>(
      PAYROLL_TEMPLATE_TABLE,
      { a365_name: name, a365_description: description || null },
    )
    if (!header.success) throw header.error ?? new Error("Unable to create the template.")
    const templateId = header.data.a365_payrolltemplateid

    let lineCount = 0
    for (const e of entries) {
      if (!e._a365_employee_value) continue
      const line = await dataClient.createRecordAsync<Record<string, unknown>, PayrollTemplateLineRow>(
        PAYROLL_TEMPLATE_LINE_TABLE,
        {
          a365_name: e.a365_employeename ?? name,
          "a365_Template@odata.bind": `/${PAYROLL_TEMPLATE_TABLE}(${templateId})`,
          "a365_Employee@odata.bind": `/a365_employees(${e._a365_employee_value})`,
          a365_basicpay: e.a365_basicpay ?? 0,
          a365_allowances: e.a365_allowances ?? 0,
          a365_otherearnings: e.a365_otherearnings ?? 0,
          a365_otherdeductions: e.a365_otherdeductions ?? 0,
          a365_unpaidleavedays: e.a365_unpaidleavedays ?? 0,
          a365_withholdingtax: e.a365_withholdingtax ?? 0,
          a365_comment: e.a365_comment ?? null,
        },
      )
      if (!line.success) throw line.error ?? new Error("Unable to save a template line.")
      lineCount++
    }
    return { templateId, lineCount }
  },

  async applyTemplateToPeriod(templateId: string, periodId: string) {
    const [lines, active, existing, template, period] = await Promise.all([
      payrollTemplateService.getTemplateLines(templateId),
      employeeService.list({ filter: `a365_employmentstatus eq ${EmploymentStatus.Active}` }),
      payrollPeriodService.listEntries(periodId),
      dataClient.retrieveRecordAsync<PayrollTemplate>(PAYROLL_TEMPLATE_TABLE, templateId, {
        select: ["a365_name"],
      }),
      payrollPeriodService.getPeriod(periodId),
    ])
    if (!template.success) throw template.error ?? new Error("Unable to load the template.")

    const sourceByEmployee = new Map<string, CopiedInputs>()
    for (const l of lines) sourceByEmployee.set(l.employeeId, l.inputs)

    const plan = planApplyInputs(sourceByEmployee, existing, active, {
      id: periodId,
      name: period.a365_name,
    })
    for (const { entryId, inputs } of plan.updates) {
      const res = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollEntry>(
        PAYROLL_ENTRY_TABLE,
        entryId,
        {
          a365_basicpay: inputs.basicPay,
          a365_allowances: inputs.allowances,
          a365_otherearnings: inputs.otherEarnings,
          a365_otherdeductions: inputs.otherDeductions,
          a365_unpaidleavedays: inputs.unpaidLeaveDays,
          a365_withholdingtax: inputs.withholdingTax,
          a365_comment: inputs.comment || null,
        },
      )
      if (!res.success) throw res.error ?? new Error("Unable to update payroll entry from template.")
    }
    const created = await payrollPeriodService.createEntriesFromPlans(periodId, plan.creates)
    return {
      created,
      updated: plan.updates.length,
      skipped: plan.skipped,
      templateName: template.data.a365_name,
    }
  },

  async renameTemplate(id: string, values: { name: string; description: string | null }) {
    const res = await dataClient.updateRecordAsync<Record<string, unknown>, PayrollTemplate>(
      PAYROLL_TEMPLATE_TABLE,
      id,
      { a365_name: values.name, a365_description: values.description || null },
    )
    if (!res.success) throw res.error ?? new Error("Unable to rename the template.")
  },

  async deleteTemplate(id: string) {
    const res = await dataClient.deleteRecordAsync(PAYROLL_TEMPLATE_TABLE, id)
    if (!res.success) throw res.error ?? new Error("Unable to delete the template.")
  },
}
