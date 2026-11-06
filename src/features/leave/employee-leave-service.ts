import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { requireGuid } from "./rules"

export function currentCreditYear() {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(new Date()))
}

export interface EmployeeLeaveSync {
  employeeId: string
  year: number
  eligible: boolean
  VL: number
  SL: number
  conversionAdded: boolean
}

export const employeeLeaveService = {
  async sync(employeeId: string, year = currentCreditYear()): Promise<EmployeeLeaveSync> {
    const id = requireGuid(employeeId)
    try {
      const response = await A365_LeaveCommandService.a365_LeaveCommand(JSON.stringify({ command: "syncEmployee", employeeId: id, year }))
      if (!response.success) throw response.error
      if (typeof response.data?.Response !== "string") throw new Error("Unconfirmed response")
      const raw: unknown = JSON.parse(response.data.Response)
      if (!raw || typeof raw !== "object") throw new Error("Unconfirmed response")
      const row = raw as Record<string, unknown>
      if (row.employeeId !== id || row.year !== year || typeof row.eligible !== "boolean" || typeof row.conversionAdded !== "boolean" ||
          ["VL", "SL"].some(key => typeof row[key] !== "number" || !Number.isFinite(row[key]))) throw new Error("Unconfirmed response")
      return row as unknown as EmployeeLeaveSync
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : ""
      const safe = /LEAVE: ([^"\\\r\n]+)/.exec(message)?.[1]
      throw new Error(safe?.startsWith("Unknown Leave command.")
        ? "The employee leave setup server update is required. Deploy the updated Leave plugin, then retry Sync leave credits."
        : safe ?? "Leave setup could not be confirmed. Retry Sync leave credits for this employee; do not create another employee.")
    }
  },
}
