import { describe, expect, it } from "vitest"
import { buildLedgerWorkbook } from "./ledger-export"
import { categoryLabels } from "./rules"
import type { LedgerPage } from "./types"
describe("Ledger Excel workbook", () => {
  it("preserves receipt text, signed payroll, empty references and separately scoped totals", async () => {
    const page: LedgerPage = { rows: [{ id: "id", date: "2026-11-03", receipt: "0001", reference: "", direction: "debit", amount: -100, category: 1, description: "=SUM(A1)", version: "1", periodId: "p", employeeId: "e", entryId: "s", periodName: "Period", reopened: false, postedOn: null, postedBy: null }], totals: { count: 1, debit: -100, credit: 0, net: 100 }, balance: 9000, next: null, revision: "1", categories: categoryLabels.map((label, value) => ({ label, value })) }
    const workbook = await buildLedgerWorkbook(page), sheet = workbook.worksheets[0]
    expect(sheet.getCell("B2").value).toBe("0001"); expect(sheet.getCell("B2").numFmt).toBe("@")
    expect(sheet.getCell("D2").value).toBe(-100); expect(sheet.getCell("E2").value).toBeNull()
    expect(sheet.getCell("G2").value).toBe("=SUM(A1)"); expect(sheet.getCell("G2").type).not.toBe(6)
    expect(sheet.getCell("A2").value).toEqual(new Date("2026-11-03T00:00:00Z"))
    expect(sheet.getCell("E5").value).toBe(100); expect(sheet.getCell("E6").value).toBe(9000)
    expect(sheet.getCell("G6").value).toContain("independent of filters")
  })
})
