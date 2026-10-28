// Local browser checks with synthetic platform-boundary responses only.
// No Dataverse records, credentials, notifications or financial writes.
// Run Vite on port 3100, then:
// node scripts/leave-ui-check.mjs <absolute path to playwright/index.mjs>
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { mkdir } from "node:fs/promises"

if (!process.argv[2]) throw new Error("Supply the installed Playwright module path.")
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const browser = await chromium.launch({ channel: "msedge", headless: true })
const base = "http://127.0.0.1:3100"
const employeeId = "10000000-0000-0000-0000-000000000001"
const leaveId = "20000000-0000-0000-0000-000000000002"
const employee = { a365_employeeid: employeeId, a365_name: "Test Employee", a365_employeenumber: "TEST-01" }
const leave = {
  a365_leaveid: leaveId, a365_name: "Test leave", _a365_employee_value: employeeId,
  a365_leavetype: 749910002, a365_benefit: 749910000, a365_startdate: "2026-01-01T00:00:00+14:00", a365_enddate: "2026-01-01",
  a365_days: 1, a365_leavestatus: 749910001, a365_issuedon: "2026-01-01T00:00:00Z", a365_note: "Test note", a365_cancellationreason: "Test cancellation",
}
const splitLeave = { ...leave, a365_benefit: 749910002, a365_leavestatus: 749910000, a365_startdate: "2026-10-26", a365_enddate: "2026-10-30", a365_days: 5, a365_paiddays: 4, a365_unpaiddays: 1,
  a365_allocationjson: JSON.stringify({ version: 1, days: [26, 27, 28, 29, 30].map((date, index) => ({ date: `2026-10-${date}`, paidDays: index < 4 ? 1 : 0, unpaidDays: index < 4 ? 0 : 1 })) }) }
let checks = 0
async function scenario(name, role = "admin", width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  await page.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.origin !== base) return route.abort()
    const path = url.pathname
    let body
    if (path === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile = () => ({isAdmin:${role === "admin"}, ready:true, showMyPayroll:false, roleSettled:true, roleError:false, roleNames:[${JSON.stringify(role === "admin" ? "A365 - Payroll Admin" : "A365 - Payroll Employee")}], roleLookupBlocked:false, probeSettled:true, probeAllowed:false});`
    if (path === "/src/hooks/use-power-context.ts") body = `export const powerContextQueryKey = ['power','context']; export const usePowerContext = () => ({data:{user:{fullName:'Test Admin'}}});`
    if (path === "/src/features/leave/posting-service.ts") body = `
      export class LeavePostingError extends Error { constructor(message, uncertain=false){super(message);this.uncertain=uncertain;} }
      export const postingService = {
        async preview(values){
          const complete=Boolean(values.startDate&&values.endDate&&values.leaveType&&values.benefit);
          return {policyVersion:'2026-10-22.1',periodStart:'2026-04-01',periodEnd:'2027-03-31',VL:7.5,SL:5,pendingVL:0,pendingSL:0,allocationVersion:1,paidDays:complete?(values.benefit==='749910000'?1:0):null,unpaidDays:complete?(values.benefit==='749910001'?1:0):null,allocation:null,days:complete?1:null,benefit:complete?Number(values.benefit):null,pool:complete?'VL':null};
        },
        async submit(values,id,reviewed,onCommitted){onCommitted?.();return {record:{...${JSON.stringify(leave)},a365_leaveid:id,a365_leavestatus:749910000},notification:'failed'};},
        async notify(){return 'accepted';}
        ,async deletionPreview(){if(${JSON.stringify(name)}==='delete-error')throw new LeavePostingError('Credit history needs review.');return {restoredDays:${name === "delete" ? 4 : 1},pool:'VL',creditPeriod:'2026-04-01',year:2026};}
        ,async deleteLeave(record,expected){if(${JSON.stringify(name)}==='delete'&&expected!==4)throw new Error('Unexpected reviewed credits');window.leaveDeleteCalls=(window.leaveDeleteCalls||0)+1;window.leaveRemoved=true;}
      };
    `
    if (path === "/src/features/leave/leave-service.ts") body = `
      export const buildLeaveFilter = () => '';
      const employee = ${JSON.stringify(employee)};
      const record = ${JSON.stringify(["partial", "delete"].includes(name) ? splitLeave : leave)};
      export const leaveService = {
        async list(filters, token) {
          if (${JSON.stringify(name)} === 'error') throw new Error('Synthetic failure');
          const rows = window.leaveRemoved || ${JSON.stringify(name)} === 'empty' || filters.search === 'absent' ? [] : [{...record,a365_name:token ? 'Second record' : 'Test leave'}];
          return {leaves:filters.section==='leave'?rows:[],credits:[],conversions:[],employees:[employee],next:!token&&rows.length?'second':undefined};
        },
        async searchEmployees(){return {rows:[employee]};},
        async balances(){ if (${JSON.stringify(name)} === 'balance-error') throw new Error('Synthetic failure'); return {VL:7.5,SL:5,movements:5}; },
        async detail(){return {record,employees:[employee],actors:new Map()};}
      };
    `
    if (body) return route.fulfill({ contentType: "text/javascript", body })
    return route.continue()
  })
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(`${base}/leave`)
  return { context, page, errors }
}

try {
  let run = await scenario("records")
  let { page } = run
  await page.getByRole("heading", { name: "Leave Management", exact: true }).waitFor().catch(async error => { console.error({ errors: run.errors, text: await page.locator("body").innerText() }); throw error })
  assert.equal(await page.getByRole("link", { name: "Leave Management", exact: true }).count(), 1)
  await page.getByRole("button", { name: "View Test leave" }).click()
  await page.getByRole("dialog", { name: "Leave details" }).getByText("Test note", { exact: true }).waitFor()
  assert.equal(await page.getByRole("dialog").getByText("Jan 1, 2026", { exact: true }).count(), 2)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await page.getByText("Second record", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Previous page", exact: true }).click()
  await page.getByRole("button", { name: "View Test leave" }).waitFor()
  await page.getByRole("combobox", { name: "Employee", exact: true }).click()
  await page.getByRole("option", { name: /Test Employee/ }).click()
  await page.getByRole("region", { name: "Leave balances" }).waitFor()
  await page.getByText("7.5", { exact: false }).waitFor()
  assert.equal(await page.getByRole("tab", { name: "Credit History" }).count(), 0)
  assert.equal(await page.getByRole("tab", { name: "Cash Conversions" }).count(), 0)
  assert.deepEqual(run.errors, [])
  checks += 8
  await page.getByRole("button", { name: "Add Leave", exact: true }).click()
  let modal = page.getByRole("dialog", { name: "Add Leave", exact: true })
  await modal.getByLabel("Start Date", { exact: true }).waitFor()
  assert.equal(await modal.getByRole("button", { name: "Submit", exact: true }).isDisabled(), true)
  await modal.getByRole("combobox", { name: "Employee", exact: true }).click()
  await page.getByRole("option", { name: /Test Employee/ }).click()
  await modal.getByText("7.50 days", { exact: true }).waitFor()
  await modal.getByLabel("Start Date", { exact: true }).fill("2026-10-23")
  await modal.getByLabel("End Date", { exact: true }).fill("2026-10-22")
  await modal.getByText("End Date cannot precede Start Date.", { exact: true }).waitFor()
  await modal.getByLabel("Note (optional)", { exact: true }).fill("Unsaved test note")
  await modal.getByRole("button", { name: "Cancel", exact: true }).click()
  await page.getByRole("button", { name: "Add Leave", exact: true }).click()
  modal = page.getByRole("dialog", { name: "Add Leave", exact: true })
  assert.equal(await modal.getByLabel("Note (optional)", { exact: true }).inputValue(), "")
  assert.equal(await modal.getByLabel("Start Date", { exact: true }).inputValue(), "")
  await modal.getByRole("combobox", { name: "Employee", exact: true }).click()
  await page.getByRole("option", { name: /Test Employee/ }).click()
  await modal.getByLabel("Start Date", { exact: true }).fill("2026-10-23")
  await modal.getByLabel("End Date", { exact: true }).fill("2026-10-23")
  await modal.getByRole("combobox", { name: "Leave Type", exact: true }).click()
  await page.getByRole("option", { name: "Emergency", exact: true }).click()
  await modal.getByRole("combobox", { name: "Benefit", exact: true }).click()
  await page.getByRole("option", { name: "Paid", exact: true }).click()
  await modal.getByRole("button", { name: "Submit", exact: true }).click()
  await modal.waitFor({ state: "hidden" })
  assert.deepEqual(run.errors, [])
  checks += 7
  await run.context.close()

  run = await scenario("partial")
  const splitTable = run.page.getByRole("table", { name: "Leave records" })
  await splitTable.getByText("Partially Paid", { exact: true }).waitFor()
  await splitTable.getByText("4 paid / 1 unpaid", { exact: true }).waitFor()
  await splitTable.getByRole("button", { name: "View Test leave" }).click()
  const splitDialog = run.page.getByRole("dialog", { name: "Leave details" })
  await splitDialog.getByText("Oct 30, 2026 (1 day)", { exact: true }).waitFor()
  await splitDialog.getByText("Issued", { exact: true }).waitFor()
  assert.deepEqual(run.errors, []); checks++
  await run.context.close()

  run = await scenario("delete", "admin", 390)
  await run.page.getByRole("button", { name: "Delete Test leave" }).click()
  let deleteDialog = run.page.getByRole("dialog", { name: "Delete leave record?" })
  await deleteDialog.getByText(/4 VL days will be restored/).waitFor()
  assert.equal(await run.page.evaluate(() => window.leaveDeleteCalls || 0), 0)
  await deleteDialog.getByRole("button", { name: "Cancel", exact: true }).click()
  assert.equal(await run.page.evaluate(() => window.leaveDeleteCalls || 0), 0)
  await run.page.getByRole("button", { name: "Delete Test leave" }).click()
  deleteDialog = run.page.getByRole("dialog", { name: "Delete leave record?" })
  await deleteDialog.getByRole("button", { name: "Delete leave", exact: true }).click()
  await deleteDialog.waitFor({ state: "hidden" })
  await run.page.getByText(/No leave records match/).waitFor()
  assert.equal(await run.page.evaluate(() => window.leaveDeleteCalls), 1)
  assert.deepEqual(run.errors, []); checks += 2
  await run.context.close()
  run = await scenario("delete-error")
  await run.page.getByRole("button", { name: "Delete Test leave" }).click()
  deleteDialog = run.page.getByRole("dialog", { name: "Delete leave record?" })
  await deleteDialog.getByText("Credit history needs review.", { exact: false }).waitFor()
  assert.equal(await deleteDialog.getByRole("button", { name: "Delete leave", exact: true }).isDisabled(), true)
  assert.equal(await run.page.evaluate(() => window.leaveDeleteCalls || 0), 0)
  assert.deepEqual(run.errors, []); checks++
  await run.context.close()

  for (const name of ["empty", "error", "balance-error"]) {
    run = await scenario(name)
    if (name === "empty") await run.page.getByText(/No leave records match/).waitFor()
    if (name === "error") await run.page.getByRole("button", { name: "Retry records" }).waitFor()
    if (name === "balance-error") {
      await run.page.getByRole("combobox", { name: "Employee", exact: true }).click()
      await run.page.getByRole("option", { name: /Test Employee/ }).click()
      await run.page.getByText(/Balances unavailable/).waitFor()
      assert.equal(await run.page.getByRole("region", { name: "Leave balances" }).count(), 0)
    }
    assert.deepEqual(run.errors, [])
    checks++
    await run.context.close()
  }
  run = await scenario("records", "employee")
  await run.page.getByRole("heading", { name: "Leave access denied" }).waitFor()
  assert.equal(await run.page.getByRole("link", { name: "Leave Management", exact: true }).count(), 0)
  assert.equal(await run.page.getByRole("table").count(), 0)
  assert.equal(await run.page.getByRole("button", { name: "Add Leave", exact: true }).count(), 0)
  checks++
  await run.context.close()

  run = await scenario("empty", "admin", 390)
  await run.page.getByRole("table", { name: "Leave records" }).waitFor()
  assert.equal(await run.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await mkdir(".playwright-cli", { recursive: true })
  await run.page.screenshot({ path: ".playwright-cli/leave-mobile.png", fullPage: true, animations: "disabled" })
  await run.page.getByRole("button", { name: "Add Leave", exact: true }).click()
  const mobileModal = run.page.getByRole("dialog", { name: "Add Leave", exact: true })
  await mobileModal.getByLabel("Start Date", { exact: true }).waitFor()
  const box = await mobileModal.boundingBox()
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
  await mobileModal.getByRole("button", { name: "Cancel", exact: true }).scrollIntoViewIfNeeded()
  assert.equal(await mobileModal.getByRole("button", { name: "Submit", exact: true }).isVisible(), true)
  await mobileModal.evaluate(element => { element.scrollTop = 0 })
  await run.page.screenshot({ path: ".playwright-cli/leave-add-mobile.png", fullPage: true, animations: "disabled" })
  checks += 2
  assert.deepEqual(run.errors, [])
  checks++
  await run.context.close()
  console.log(`Passed ${checks} Leave browser checks in Edge using synthetic boundary responses.`)
} finally {
  await browser.close()
}
