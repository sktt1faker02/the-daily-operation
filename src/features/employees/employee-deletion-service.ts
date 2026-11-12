import { A365_DeleteEmployeeService } from "@/generated/services/A365_DeleteEmployeeService"
import { sendDeletionCommand } from "@/lib/power/deletion-command"
import { dataSourcesInfo } from "../../../.power/schemas/appschemas/dataSourcesInfo"

export interface DeleteEmployeeInput {
  employeeId: string
  employeeName: string
  operationId: string
}
export const employeeDeletionService = {
  isConfigured: () => Object.hasOwn(dataSourcesInfo, "a365_deleteemployee"),
  async deleteEmployee(input: DeleteEmployeeInput): Promise<void> {
    if (!employeeDeletionService.isConfigured()) throw new Error("Employee deletion requires the Dataverse server setup before it can be used.")
    await sendDeletionCommand((request) => A365_DeleteEmployeeService.a365_DeleteEmployee(request), input, { field: "employeeId", id: input.employeeId })
  },
}
