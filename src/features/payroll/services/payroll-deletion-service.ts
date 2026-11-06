import { A365_DeletePayrollPeriodService } from "@/generated/services/A365_DeletePayrollPeriodService"
import { A365_DeletePayrollEntryService } from "@/generated/services/A365_DeletePayrollEntryService"
import { sendDeletionCommand } from "@/lib/power/deletion-command"
import { dataSourcesInfo } from "../../../../.power/schemas/appschemas/dataSourcesInfo"

export interface DeletePayrollInput {
  periodId: string
  periodName: string
  operationId: string
}
export interface DeletePayrollEntryInput extends DeletePayrollInput {
  entryId: string
  employeeId: string
  employeeName: string
}
export const payrollDeletionService = {
  isConfigured: (kind: "period" | "entry" = "period") =>
    Object.hasOwn(dataSourcesInfo, kind === "period" ? "a365_deletepayrollperiod" : "a365_deletepayrollentry"),

  async deletePeriod(input: DeletePayrollInput): Promise<void> {
    if (!payrollDeletionService.isConfigured()) throw new Error("Payroll deletion requires the Dataverse server setup before it can be used.")
    await sendDeletionCommand((request) => A365_DeletePayrollPeriodService.a365_DeletePayrollPeriod(request), input, { field: "periodId", id: input.periodId })
  },
  async deleteEntry(input: DeletePayrollEntryInput): Promise<void> {
    if (!payrollDeletionService.isConfigured("entry")) throw new Error("Payroll deletion requires the Dataverse server setup before it can be used.")
    await sendDeletionCommand((request) => A365_DeletePayrollEntryService.a365_DeletePayrollEntry(request), input, { field: "entryId", id: input.entryId })
  },
}
