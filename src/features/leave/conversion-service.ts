import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { requireGuid, validYear } from "./rules"
import type { ConversionChange, ConversionPage, ConversionRow, ConversionYear } from "./conversion-types"

export class ConversionError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain: boolean) { super(message); this.name = "ConversionError"; this.uncertain = uncertain }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unconfirmed conversion response")
  return value as Record<string, unknown>
}
function transaction(value: unknown): ConversionYear {
  const row = object(value)
  if (!validYear(Number(row.year)) || typeof row.version !== "string" || !/^\d+$/.test(row.version)) throw new Error("Unconfirmed transaction")
  if (row.paid !== undefined && typeof row.paid !== "boolean") throw new Error("Unconfirmed payment status")
  return { id: requireGuid(String(row.id)), year: Number(row.year), version: row.version, ...(row.paid === undefined ? {} : { paid: row.paid }) }
}
function employeeRow(value: unknown): ConversionRow {
  const row = object(value)
  if (["dailyRate", "availableVL", "days", "amount"].some(key => typeof row[key] !== "number" || !Number.isFinite(row[key]) || Number(row[key]) < 0) || typeof row.employeeName !== "string" || typeof row.employeeNumber !== "string") throw new Error("Unconfirmed conversion row")
  return { id: requireGuid(String(row.id)), employeeId: requireGuid(String(row.employeeId)), employeeName: row.employeeName, employeeNumber: row.employeeNumber,
    dailyRate: Number(row.dailyRate), availableVL: Number(row.availableVL), days: Number(row.days), amount: Number(row.amount) }
}
async function command(request: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const response = await A365_LeaveCommandService.a365_LeaveCommand(JSON.stringify(request))
    if (!response.success) throw response.error
    if (typeof response.data?.Response !== "string") throw new Error("Unconfirmed response")
    return object(JSON.parse(response.data.Response))
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : ""
    const safe = /LEAVE: ([^"\\\r\n]+)/.exec(message)?.[1]
    if (safe?.startsWith("Unknown Leave command.")) {
      throw new ConversionError("Leave Conversion is unavailable because its server update has not been deployed. Ask your administrator to deploy the updated Leave plugin and conversion write guards, then retry.", false)
    }
    throw new ConversionError(safe ?? "The conversion service response could not be confirmed. Your edits are retained. Retry the same operation.", !safe)
  }
}
export const conversionService = {
  async years(): Promise<{ years: ConversionYear[]; nextYear: number | null }> {
    const result = await command({ command: "conversionYears" })
    if (!Array.isArray(result.years) || (result.nextYear !== null && !validYear(Number(result.nextYear)))) throw new Error("Conversion years could not be verified.")
    return { years: result.years.map(transaction), nextYear: result.nextYear === null ? null : Number(result.nextYear) }
  },
  async create(operationId: string, expectedYear: number): Promise<ConversionYear> {
    return transaction(await command({ command: "conversionCreate", operationId: requireGuid(operationId), year: expectedYear }))
  },
  async rows(year: number, cursor?: string): Promise<ConversionPage> {
    const result = await command({ command: "conversionRows", year, cursor })
    if (!Array.isArray(result.rows) || (result.next !== undefined && typeof result.next !== "string")) throw new Error("Conversion rows could not be verified.")
    return { transaction: transaction(result.transaction), rows: result.rows.map(employeeRow), next: result.next as string | undefined }
  },
  async save(value: ConversionYear, changes: ConversionChange[]): Promise<ConversionYear> {
    return transaction(await command({ command: "conversionSave", year: value.year, operationId: value.id, version: value.version, changes }))
  },
  async markPaid(value: ConversionYear): Promise<ConversionYear> {
    const result = transaction(await command({ command: "conversionMarkPaid", year: value.year, operationId: value.id, version: value.version }))
    if (result.paid !== true) throw new ConversionError("Payment status could not be confirmed. Retry marking this year as paid.", true)
    return result
  },
}
