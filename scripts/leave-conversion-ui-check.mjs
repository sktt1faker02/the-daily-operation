// Synthetic API boundary only. Block every external request; never use live records.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
if (!process.argv[2]) throw new Error("Supply playwright/index.mjs path.")
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const browser = await chromium.launch({ channel: "msedge", headless: true })
const base = "http://127.0.0.1:3100"
let checks = 0
async function scenario({ employee = false, width = 1280, empty = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const errors = []; page.on("pageerror", error => errors.push(error.message))
  const state = { years: [], rows: new Map(), requests: [], failSave: false, failRead: false }
  await page.exposeFunction("conversionTestCommand", async raw => {
    const request = JSON.parse(raw); state.requests.push(request)
    if (state.failRead) throw new Error("PRIVATE PLATFORM ERROR")
    let result
    if (request.command === "conversionYears") result = { years: state.years, nextYear: state.years.length ? Math.max(...state.years.map(y => y.year)) + 1 : 2026 }
    else if (request.command === "conversionCreate") {
      await new Promise(resolve => setTimeout(resolve, 150))
      const transaction = { id: request.operationId, year: request.year, version: "1", paid: false }
      if (state.years.some(y => y.year === request.year)) throw new Error("LEAVE: That conversion year already exists.")
      state.years.push(transaction)
      state.rows.set(request.year, Array.from({ length: empty ? 0 : 21 }, (_, i) => ({ id: `20000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`, employeeId: `30000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`, employeeName: `Employee ${i + 1}`, employeeNumber: `EMP-${i + 1}`, dailyRate: 2272.73, availableVL: 10, days: 5, amount: 11363.65 })))
      result = transaction
    } else if (request.command === "conversionRows") {
      const rows = state.rows.get(request.year) ?? []
      result = { transaction: state.years.find(y => y.year === request.year), rows: request.cursor ? rows.slice(20) : rows.slice(0, 20), ...(!request.cursor && rows.length > 20 ? { next: "second" } : {}) }
    } else if (request.command === "conversionSave") {
      if (state.failSave) { state.failSave = false; throw new Error("PRIVATE PLATFORM ERROR") }
      for (const change of request.changes) {
        const row = state.rows.get(request.year).find(r => r.id === change.id)
        Object.assign(row, { availableVL: change.availableVL, days: change.days, amount: Math.round(227273 * change.days) / 100 })
      }
      const transaction = state.years.find(y => y.year === request.year); transaction.version = String(Number(transaction.version) + 1); result = transaction
    } else if (request.command === "conversionMarkPaid") {
      const transaction = state.years.find(y => y.year === request.year)
      transaction.paid = true; transaction.version = String(Number(transaction.version) + 1); result = transaction
    } else throw new Error("Unexpected command")
    return { success: true, data: { Response: JSON.stringify(result) } }
  })
  page.on("dialog", dialog => dialog.accept())
  await page.route("**/*", async route => {
    const url = new URL(route.request().url()); if (url.origin !== base) return route.abort()
    let body
    if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile=()=>({isAdmin:${!employee},ready:true,showMyPayroll:false,roleSettled:true,roleError:false,roleNames:[${JSON.stringify(employee ? "A365 - Payroll Employee" : "A365 - Payroll Admin")}]});`
    if (url.pathname === "/src/hooks/use-power-context.ts") body = `export const powerContextQueryKey=['power','context'];export const usePowerContext=()=>({data:{user:{fullName:'Synthetic Admin'}}});`
    if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `export const A365_LeaveCommandService={a365_LeaveCommand:window.conversionTestCommand};`
    return body ? route.fulfill({ contentType: "text/javascript", body }) : route.continue()
  })
  await page.goto(`${base}/leave-conversion`, { waitUntil: "domcontentloaded", timeout: 60000 })
  return { context, page, state, errors }
}
async function create(run) {
  await run.page.getByRole("button", { name: "Add new transaction" }).click()
  await run.page.getByRole("dialog", { name: "Add new leave conversion?" }).getByRole("button", { name: "Add new transaction" }).click()
  await run.page.getByRole("table", { name: "Employee conversions" }).waitFor()
}
try {
  let run = await scenario(); let { page } = run
  await page.getByRole("table", { name: "Leave conversion years" }).waitFor()
  assert.equal(await page.getByRole("spinbutton").count(), 0)
  assert.equal(await page.getByRole("button", { name: "Open year" }).count(), 0)
  const addBounds = await page.getByRole("button", { name: "Add new transaction" }).boundingBox()
  const headingBounds = await page.getByRole("heading", { name: "Leave Conversion", exact: true }).boundingBox()
  assert(addBounds.x > headingBounds.x + headingBounds.width)
  assert(addBounds.y < headingBounds.y + headingBounds.height + 40)
  checks++
  await create(run)
  assert.equal(run.state.requests.filter(r => r.command === "conversionCreate").length, 1)
  assert.equal(await page.getByRole("button", { name: "Refresh balances" }).count(), 0)
  assert.equal(await page.getByRole("columnheader", { name: "Action", exact: true }).count(), 1)
  assert.equal(await page.getByText("10.00", { exact: true }).count(), 20)
  checks++
  await page.getByRole("button", { name: "Edit Employee 1", exact: true }).click()
  assert.equal(await page.getByRole("spinbutton").count(), 2)
  const days = page.getByRole("spinbutton", { name: "VL to convert for Employee 1", exact: true })
  await days.fill("6")
  assert(await page.getByRole("button", { name: "Done", exact: true }).isDisabled())
  assert(await page.getByRole("button", { name: "Save", exact: true }).isDisabled())
  await days.fill("3")
  await page.getByText("₱6,818.19", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  assert(await page.getByRole("button", { name: "Edit Employee 1", exact: true }).evaluate(button => button === document.activeElement))
  checks++
  assert(await page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented }))
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await page.getByRole("button", { name: "Edit Employee 21", exact: true }).waitFor()
  await page.getByRole("button", { name: "Previous page", exact: true }).click()
  await page.getByText("3.00", { exact: true }).waitFor()
  checks++
  await page.getByRole("link", { name: "Leave Conversion", exact: true }).last().click()
  await page.getByRole("dialog", { name: "Leave without saving?" }).waitFor()
  await page.getByRole("button", { name: "Keep editing", exact: true }).click()
  checks++
  run.state.failSave = true
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByRole("alert").filter({ hasText: "response could not be confirmed" }).waitFor()
  assert.equal(await page.getByText("PRIVATE PLATFORM ERROR").count(), 0)
  await page.getByText("Unsaved changes", { exact: true }).waitFor()
  checks++
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Leave conversion for 2026 saved.", { exact: true }).waitFor()
  assert(await page.getByRole("button", { name: "Save", exact: true }).isDisabled())
  await page.getByRole("link", { name: "Leave Conversion", exact: true }).last().click()
  await page.getByRole("link", { name: "View employees", exact: true }).click()
  await page.getByText("3.00", { exact: true }).waitFor()
  checks++
  await page.getByRole("link", { name: "Leave Conversion", exact: true }).last().click()
  await create(run)
  assert.equal(run.state.years.at(-1).year, 2027)
  await page.getByRole("button", { name: "Mark as paid", exact: true }).click()
  const paidDialog = page.getByRole("dialog", { name: "Mark this leave conversion Paid?" })
  await paidDialog.waitFor()
  await paidDialog.getByRole("button", { name: "Cancel", exact: true }).click()
  assert.equal(run.state.requests.filter(request => request.command === "conversionMarkPaid").length, 0)
  await page.getByRole("button", { name: "Mark as paid", exact: true }).click()
  await paidDialog.getByRole("button", { name: "Mark as Paid", exact: true }).click()
  await page.getByRole("button", { name: "Paid (locked)", exact: true }).waitFor()
  assert(await page.getByRole("button", { name: "Edit Employee 1", exact: true }).isDisabled())
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).count(), 0)
  checks++
  await page.getByRole("link", { name: "Leave Conversion", exact: true }).last().click()
  await page.getByRole("link", { name: "2027", exact: true }).click()
  await page.getByRole("button", { name: "Paid (locked)", exact: true }).waitFor()
  checks++
  assert.deepEqual(run.errors, [])
  checks++
  await run.context.close()
  run = await scenario({ employee: true })
  await run.page.getByText("Leave access denied", { exact: true }).waitFor()
  assert.equal(run.state.requests.length, 0)
  checks++; await run.context.close()
  run = await scenario({ width: 390, empty: true }); await create(run)
  await run.page.getByText("No employees were recorded for this transaction.").waitFor()
  assert(await run.page.getByRole("button", { name: "Save", exact: true }).isDisabled())
  assert(await run.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  checks++; await run.context.close()
  console.log(`Passed ${checks} Leave Conversion browser checks with synthetic data. No Dataverse writes.`)
} finally { await browser.close() }
