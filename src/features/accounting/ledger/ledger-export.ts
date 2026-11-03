import type { LedgerPage } from "./types"

export async function buildLedgerWorkbook(data: LedgerPage) {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Ledger")
  sheet.columns = [
    { header: "Date", key: "date", width: 15 }, { header: "OR Number", key: "receipt", width: 20 },
    { header: "Reference", key: "reference", width: 30 }, { header: "Debit (Money out)", key: "debit", width: 23 },
    { header: "Credit (Money in)", key: "credit", width: 23 }, { header: "Chart of Account", key: "category", width: 30 },
    { header: "Description", key: "description", width: 65 },
  ]
  for (const row of data.rows) sheet.addRow({ date: new Date(`${row.date}T00:00:00Z`), receipt: row.receipt, reference: row.reference,
    debit: row.direction === "debit" ? row.amount : null, credit: row.direction === "credit" ? row.amount : null,
    category: data.categories.find(category => category.value === row.category)?.label ?? "Unknown category", description: row.description })
  sheet.getColumn("date").numFmt = "yyyy-mm-dd"
  sheet.getColumn("receipt").numFmt = "@"
  sheet.getColumn("reference").numFmt = "@"
  for (const key of ["debit", "credit"]) sheet.getColumn(key).numFmt = '"PHP "#,##0.00;[Red]-"PHP "#,##0.00'
  sheet.addRow([])
  sheet.addRow({ description: "Filtered totals — all matching records", debit: data.totals.debit, credit: data.totals.credit })
  sheet.addRow({ description: "Filtered net movement (Credit minus Debit)", credit: data.totals.net })
  sheet.addRow({ description: "Company balance — all recorded ledger entries, independent of filters", credit: data.balance })
  sheet.addRow({ description: "Balance reflects recorded movements only. It is not a bank reconciliation." })
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
  return workbook
}
export async function downloadLedger(data: LedgerPage) {
  const workbook = await buildLedgerWorkbook(data)
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  const link = document.createElement("a")
  link.href = url; link.download = "Ledger.xlsx"; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
