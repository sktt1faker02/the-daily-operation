// Synthetic boundary responses only; external requests are blocked.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const browser = await chromium.launch({ channel: "msedge", headless: true })
const base = "http://127.0.0.1:3100"
const employeeId = "10000000-0000-0000-0000-000000000001"
const employee = { a365_employeeid: employeeId, a365_name: "Synthetic Employee" }
let checks = 0
async function scenario({ admin = false, width = 1280, linked = true, failed = false, empty = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage(); const requests = []; const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.exposeFunction("personalLeaveTestRead", raw => {
    const request = JSON.parse(raw); requests.push(request)
    assert.equal(request.employeeId, employeeId)
    assert.ok(["myLeaves", "myLeave", "myCredits"].includes(request.command))
    if (failed) return { success: false, data: {}, error: { message: "PRIVATE BACKEND ERROR" } }
    const record = i => ({ a365_leaveid: `20000000-0000-0000-0000-${String(i).padStart(12, "0")}`, _a365_employee_value: employeeId, a365_name: `Leave record ${i}`, a365_leavetype: 749910000, a365_benefit: 749910002, a365_days: 5, a365_leavestatus: 749910000, a365_startdate: "2026-10-26", a365_enddate: "2026-10-30", a365_issuedon: "2026-10-27T04:00:00Z", a365_paiddays: 4, a365_unpaiddays: 1,
      a365_allocationjson: JSON.stringify({ version: 1, days: [26, 27, 28, 29, 30].map((date, index) => ({ date: `2026-10-${date}`, paidDays: index < 4 ? 1 : 0, unpaidDays: index < 4 ? 0 : 1 })) }) })
    let rows; let next
    if (request.command === "myCredits") rows = [{ a365_leavecredittransactionid: "30000000-0000-0000-0000-000000000003", _a365_employee_value: employeeId, a365_year: request.year, a365_creditpool: 749910000, a365_days: 7.5 }]
    else if (request.command === "myLeave") rows = [{ ...record(1), a365_leaveid: request.operationId }]
    else { rows = empty || request.search === "Absent" ? [] : request.cursor ? [record(21)] : Array.from({ length: 20 }, (_, i) => record(i + 1)); if (!request.cursor && rows.length) next = "2" }
    return { success: true, data: { Response: JSON.stringify({ employeeId, employeeName: employee.a365_name, rows, next }) } }
  })
  await page.route("**/*", route => {
    const url = new URL(route.request().url()); if (url.origin !== base) return route.abort()
    let body
    if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile=()=>({isAdmin:${admin},ready:true,showMyPayroll:${linked},roleSettled:true,roleError:false,roleNames:[${JSON.stringify(admin ? "A365 - Payroll Admin" : "A365 - Payroll Employee")}]});`
    if (url.pathname === "/src/hooks/use-power-context.ts") body = `export const powerContextQueryKey=['power','context']; export const usePowerContext=()=>({data:{user:{fullName:'Synthetic Employee'}}});`
    if (url.pathname === "/src/generated/services/WhoAmIService.ts") body = `export const WhoAmIService={WhoAmI:async()=>({success:true,data:{UserId:'40000000-0000-0000-0000-000000000004'}})};`
    if (url.pathname === "/src/features/employees/employee-service.ts") body = `export const employeeService={getBySystemUserId:async()=>(${JSON.stringify(linked ? employee : null)})};`
    if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `export const A365_LeaveCommandService={a365_LeaveCommand:window.personalLeaveTestRead};`
    return body ? route.fulfill({ contentType: "text/javascript", body }) : route.continue()
  })
  await page.goto(`${base}/leave-history`, { waitUntil: "domcontentloaded", timeout: 60000 })
  return { page, context, requests, errors }
}
try {
  for (const admin of [false, true]) {
    const run = await scenario({ admin }); const { page, requests } = run
    const table = page.getByRole("table", { name: "Leave records" }); await table.waitFor().catch(async error => { console.error({ errors: run.errors, requests, text: await page.locator("body").innerText() }); throw error })
    assert.equal(await table.getByRole("row").count(), 21)
    const nav = page.locator("aside"); await nav.getByText("My Portal", { exact: true }).waitFor()
    assert.equal(await nav.getByRole("link", { name: "Leave History" }).count(), 1)
    assert.equal(await nav.getByRole("link", { name: "Leave Management", exact: true }).count(), admin ? 1 : 0)
    assert.equal(await page.getByRole("button", { name: "Add Leave" }).count(), 0)
    assert.equal(await page.getByRole("combobox", { name: "Employee" }).count(), 0); checks++
    await table.getByRole("button", { name: "View Leave record 1", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Leave details" }); await dialog.getByText("Leave record 1", { exact: true }).waitFor()
    await dialog.getByText("Partially Paid", { exact: true }).waitFor()
    await dialog.getByText("Oct 30, 2026 (1 day)", { exact: true }).waitFor()
    assert.equal(await dialog.getByRole("button", { name: /resend|edit|cancel|delete|issue/i }).count(), 0)
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" }); checks++
    await page.getByRole("button", { name: "Next page" }).click(); await table.getByText("Leave record 21", { exact: true }).waitFor()
    assert.ok(requests.some(r => r.cursor === "2")); checks++
    await page.getByRole("button", { name: "Previous page" }).click(); await table.getByText("Leave record 1", { exact: true }).waitFor()
    await page.getByRole("searchbox", { name: "Search record name" }).fill("Absent")
    await page.getByRole("button", { name: "Apply filters" }).click(); await page.getByText("No leave records match these filters. Try changing your filters.").waitFor()
    await page.getByRole("button", { name: "Refresh balances" }).waitFor()
    const credits = requests.filter(r => r.command === "myCredits").length
    await page.getByRole("button", { name: "Refresh balances" }).click()
    await page.waitForFunction(() => document.querySelector('button') !== null)
    await page.getByRole("button", { name: "Refresh balances" }).waitFor()
    assert.equal(requests.filter(r => r.command === "myCredits").length, credits + 1); checks++
    assert.deepEqual(run.errors, []); await run.context.close()
  }
  let run = await scenario({ width: 390 }); await run.page.getByRole("table", { name: "Leave records" }).waitFor()
  assert.ok(await run.page.getByRole("link", { name: "Leave History" }).last().isVisible())
  assert.equal(await run.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++
  await run.context.close()
  run = await scenario({ linked: false }); await run.page.getByText("No employee profile linked").waitFor(); assert.equal(run.requests.length, 0); checks++; await run.context.close()
  run = await scenario({ failed: true }); await run.page.getByRole("button", { name: "Retry records" }).waitFor(); await run.page.getByRole("button", { name: "Retry balances" }).waitFor()
  assert.equal(await run.page.getByText("PRIVATE BACKEND ERROR").count(), 0); checks++; await run.context.close()
  run = await scenario({ empty: true }); await run.page.getByText(/No leave recorded for/).waitFor(); checks++; await run.context.close()
  console.log(`Passed ${checks} synthetic Leave History browser checks (employee/admin, details, paging, filters, refresh, mobile and failure states).`)
} finally { await browser.close() }
