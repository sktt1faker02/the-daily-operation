import { dataClient } from "@/lib/power/data-client"
import { validateFilters } from "./rules"
import type { HistoryJob, HistoryPreview, LedgerFilters, LedgerPage, LedgerRow, LedgerValues } from "./types"

export class LedgerError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain = false) { super(message); this.name = "LedgerError"; this.uncertain = uncertain }
}
export async function ledgerCommand<T>(request: Record<string, unknown>): Promise<T> {
  try {
    // The release tooling generates the API data source; never edit generated files.
    const result = await dataClient.executeAsync<{ Request: string }, { Response: string }>({ dataverseRequest: {
      action: "customapi", parameters: { operationName: "a365_LedgerCommand", tableName: "a365_ledgercommand", body: { Request: JSON.stringify(request) } },
    } })
    if (!result.success) throw result.error
    const response: unknown = JSON.parse(result.data.Response)
    if (!response || typeof response !== "object") throw new Error("Invalid response")
    return response as T
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error)
    const safe = /LEDGER: ([^"\\\r\n]+)/.exec(message)?.[1]
    throw new LedgerError(safe ?? "The Ledger service response could not be confirmed. Verify that the Ledger server update is installed, then retry the same operation.", !safe)
  }
}

/** Check the durable receipt after an uncertain write, then retry the SAME identity. */
async function write<T>(request: Record<string, unknown>): Promise<T> {
  const confirm = (result: T): T => {
    const record = result && typeof result === "object" ? result as Record<string, unknown> : null
    const field = request.command === "pay" ? "periodId" : "id"
    const expected = request.command === "pay" ? request.periodId : request.id ?? request.operationId
    if (!record || record[field] !== expected) throw new LedgerError("The committed Ledger result could not be verified. Retry the same operation.", true)
    return result
  }
  try { return confirm(await ledgerCommand<T>(request)) }
  catch (error) {
    if (!(error instanceof LedgerError) || !error.uncertain) throw error
    const status = await ledgerCommand<{ completed: boolean; result?: T }>({ command: "operation", operationId: request.operationId })
    if (status.completed && status.result) return confirm(status.result)
    throw error
  }
}

export const ledgerService = {
  list(filters: LedgerFilters, cursor?: string, revision?: string): Promise<LedgerPage> {
    validateFilters(filters)
    return ledgerCommand({ command: "list", ...filters, cursor, revision })
  },
  save(values: LedgerValues, operationId: string, row?: LedgerRow) {
    return write<{ id: string }>({ command: "save", ...values, operationId, id: row?.id, version: row?.version })
  },
  delete(row: LedgerRow, operationId: string) { return write<{ id: string }>({ command: "delete", id: row.id, version: row.version, operationId }) },
  pay(periodId: string, operationId: string, version: string) { return write<{ periodId: string }>({ command: "pay", periodId, operationId, version }) },
  preview(): Promise<HistoryPreview> { return ledgerCommand({ command: "historyPreview" }) },
  sources(periodId: string): Promise<{ rows: { id: string; employeeId: string; name: string; amount: number }[] }> { return ledgerCommand({ command: "sources", periodId }) },
  link(row: LedgerRow, entryId: string, operationId: string) { return write({ command: "link", id: row.id, version: row.version, entryId, operationId }) },
  startHistory(revision: string, operationId: string): Promise<HistoryJob> { return write({ command: "historyStart", revision, operationId }) },
  jobs(): Promise<{ jobs: HistoryJob[] }> { return ledgerCommand({ command: "historyJobs" }) },
  retryJob(id: string, operationId: string) { return write({ command: "historyRetry", id, operationId }) },
  async export(filters: LedgerFilters): Promise<LedgerPage> {
    const first = await ledgerService.list(filters)
    const rows = [...first.rows], seen = new Set(rows.map(row => row.id)), cursors = new Set<string>()
    let cursor = first.next
    while (cursor) {
      if (cursors.has(cursor)) throw new LedgerError("The complete export could not be verified. Try again.")
      cursors.add(cursor)
      const page = await ledgerService.list(filters, cursor, first.revision)
      if (page.revision !== first.revision) throw new LedgerError("The ledger changed during export. Export again.")
      for (const row of page.rows) {
        if (seen.has(row.id)) throw new LedgerError("The export contains repeated records. Export again.")
        seen.add(row.id); rows.push(row)
      }
      cursor = page.next
    }
    if (rows.length !== first.totals.count) throw new LedgerError("The complete export could not be verified. No file was downloaded.")
    // Final check also covers a single page and changes after the last page read.
    const final = await ledgerService.list(filters, undefined, first.revision)
    if (final.revision !== first.revision) throw new LedgerError("The ledger changed during export. Export again.")
    return { ...first, rows, next: null }
  },
}
