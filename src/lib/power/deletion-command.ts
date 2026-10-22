import type { IOperationResult } from "@microsoft/power-apps/data"

const UNCONFIRMED = "Deletion could not be confirmed. Retry here to check the same operation."
const SAFE_MESSAGES = [
  "Payroll Admin access is required.",
  "Only Processing payroll periods and their entries can be deleted. Refresh the payroll list.",
  "The record name changed. Close this confirmation and review it again.",
  "The payroll entry changed. Close this confirmation and review it again.",
  "This employee has payroll, leave or template records and cannot be deleted. Set the employee to Inactive instead to preserve history.",
  "Employee deletion requires review of additional relationships. Set the employee to Inactive instead.",
  "This payroll exceeds the interactive deletion limit. Contact your administrator.",
  "This operation identity belongs to another deletion.",
] as const

function safeError(error: unknown): Error {
  const message = typeof error === "string" ? error :
    error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : ""
  const safe = SAFE_MESSAGES.find((text) => message.includes(`PAYROLL_DELETE: ${text}`))
  return new Error(safe ?? UNCONFIRMED)
}

/** Shared transport only: domain services supply generated API bindings and identities. */
export async function sendDeletionCommand(
  invoke: (request: string) => Promise<IOperationResult<Record<string, unknown>>>,
  input: { operationId: string },
  expected: { field: "periodId" | "entryId" | "employeeId"; id: string },
): Promise<void> {
  try {
    const result = await invoke(JSON.stringify(input))
    if (!result.success) throw result.error
    if (typeof result.data?.Response !== "string") throw new Error(UNCONFIRMED)
    const response: unknown = JSON.parse(result.data.Response)
    if (typeof response !== "object" || response === null ||
      !(expected.field in response) || (response as Record<string, unknown>)[expected.field] !== expected.id ||
      !("operationId" in response) || response.operationId !== input.operationId ||
      !("deleted" in response) || response.deleted !== true) throw new Error(UNCONFIRMED)
  } catch (error) { throw safeError(error) }
}
