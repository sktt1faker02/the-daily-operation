import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/power/data-client", () => ({ dataClient: { executeAsync: vi.fn() } }))
import { dataClient } from "@/lib/power/data-client"
import { ledgerService, LedgerError } from "./ledger-service"
import { categoryLabels } from "./rules"
import { emptyFilters, type LedgerPage, type LedgerRow } from "./types"
const row: LedgerRow = { id: "one", date: "2026-11-03", receipt: "0001", reference: "", direction: "debit", amount: -100, category: 1, description: "Payroll", version: "1", periodId: "p", employeeId: "e", entryId: "s", periodName: "Period", reopened: false, postedOn: null, postedBy: null }
const page: LedgerPage = { rows: [row], next: null, revision: "v1", balance: 9000, totals: { count: 1, debit: -100, credit: 0, net: 100 }, categories: categoryLabels.map((label, value) => ({ label, value })) }
const respond = (value: unknown) => ({ success: true, data: { Response: JSON.stringify(value) } }) as never
const invoke = vi.mocked(dataClient.executeAsync)
beforeEach(() => vi.resetAllMocks())
describe("Ledger command and complete export", () => {
  it("exports all pages with a stable revision and complete count", async () => {
    invoke.mockResolvedValueOnce(respond({ ...page, next: "page2", totals: { ...page.totals, count: 2 } }))
      .mockResolvedValueOnce(respond({ ...page, rows: [{ ...row, id: "two" }] })).mockResolvedValueOnce(respond(page))
    const result = await ledgerService.export(emptyFilters)
    expect(result.rows.map(row => row.id)).toEqual(["one", "two"])
    const calls = invoke.mock.calls.map(([request]) => JSON.parse((request as { dataverseRequest: { parameters: { body: { Request: string } } } }).dataverseRequest.parameters.body.Request))
    expect(calls[1]).toMatchObject({ cursor: "page2", revision: "v1" }); expect(calls[2]).toMatchObject({ revision: "v1" })
  })
  it("rejects a concurrent ledger change rather than downloading partial success", async () => {
    invoke.mockResolvedValueOnce(respond({ ...page, next: "page2" })).mockResolvedValueOnce(respond({ ...page, revision: "v2" }))
    await expect(ledgerService.export(emptyFilters)).rejects.toThrow("changed during export")
  })
  it("rejects duplicate rows, truncated reads and server failures", async () => {
    invoke.mockResolvedValueOnce(respond({ ...page, next: "page2" })).mockResolvedValueOnce(respond(page))
    await expect(ledgerService.export(emptyFilters)).rejects.toThrow("repeated")
    invoke.mockResolvedValueOnce(respond({ ...page, totals: { ...page.totals, count: 2 } }))
    await expect(ledgerService.export(emptyFilters)).rejects.toThrow("complete export")
    invoke.mockRejectedValueOnce(new Error("sensitive raw SQL and tokens"))
    await expect(ledgerService.export(emptyFilters)).rejects.not.toThrow("sensitive")
  })
  it("checks a durable operation receipt after a timeout and returns the committed result", async () => {
    invoke.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(respond({ completed: true, result: { periodId: "period" } }))
    await expect(ledgerService.pay("period", "same-operation", "version")).resolves.toEqual({ periodId: "period" })
    expect(invoke).toHaveBeenCalledTimes(2)
  })
  it("does not guess rollback or issue a replacement payment when the receipt is absent", async () => {
    invoke.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(respond({ completed: false }))
    await expect(ledgerService.pay("period", "same-operation", "version")).rejects.toBeInstanceOf(LedgerError)
    expect(invoke).toHaveBeenCalledTimes(2)
  })
  it("exposes only the server's controlled business message", async () => {
    invoke.mockRejectedValueOnce(new Error('backend: LEDGER: Payroll Admin access is required.\nSQL secret'))
    await expect(ledgerService.list(emptyFilters)).rejects.toThrow(/^Payroll Admin access is required\.$/)
  })
})
