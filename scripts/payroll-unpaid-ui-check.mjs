// Browser-only integration with synthetic data at platform boundaries.
// All external requests are blocked. No Dataverse writes or email.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const employeeId = "10000000-0000-0000-0000-000000000001"
const entry = { a365_payrollentryid: "entry", _a365_employee_value: employeeId, a365_name: "Synthetic payroll", a365_employeename: "Test Employee", a365_isincluded: true, a365_basicpay: 25000, a365_allowances: 0, a365_otherearnings: 0, a365_otherdeductions: 0, a365_withholdingtax: 0, a365_unpaidleavedays: 0, a365_comment: null }
const leave = { a365_leaveid: "leave", _a365_employee_value: employeeId, a365_startdate: "2026-10-22", a365_enddate: "2026-10-23", a365_days: 2, a365_benefit: 749910001, a365_leavestatus: 749910000 }
const config = { sss: [{ compensationFrom: 0, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3500, ecAmount: 30 }], philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 }, hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 }, taxBrackets: [] }
const browser = await chromium.launch({ channel: "msedge", headless: true })
let checks = 0
try {
  for (const scenario of ["save", "cancel", "error", "readonly", "mobile", "screenshot"]) {
    const scenarioEntry = scenario === "screenshot" ? { ...entry, a365_otherdeductions: 3000,
      a365_unpaidleavedays: 1, a365_unpaidleave: 2272.73, a365_grosspay: 22727.27,
      a365_totaldeductions: 4600, a365_netpay: 18127.27 } : entry
    const scenarioLeave = scenario === "screenshot"
      ? { ...leave, a365_enddate: "2026-10-22", a365_days: 1 } : leave
    const context = await browser.newContext({ viewport: { width: scenario === "mobile" ? 390 : 1280, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    await page.route("**/*", async route => {
      const url = new URL(route.request().url())
      if (url.origin !== base) return route.abort()
      let body
      if (url.pathname === "/src/main.tsx") body = `
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import {QueryProvider} from '/src/providers/query-provider.tsx';
        import {PayrollEntryDialog} from '/src/features/payroll/payroll-entry-dialog.tsx';
        import '/src/index.css';
        window.__saves=[];
        function Harness(){const [open,setOpen]=React.useState(true);return React.createElement(QueryProvider,null,React.createElement(PayrollEntryDialog,{open,onOpenChange:setOpen,entry:${JSON.stringify(scenarioEntry)},periodId:'period',periodStartDate:'2026-10-16',periodEndDate:'2026-10-31',editable:${scenario !== "readonly"}}));}
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));`
      if (url.pathname === "/src/features/employees/employee-service.ts") body = `export const employeeService={async get(){return {a365_employeeid:'${employeeId}',a365_basicmonthlysalary:50000};}};`
      if (url.pathname === "/src/features/payroll/services/statutory-config-service.ts") body = `export async function getStatutoryConfig(){return ${JSON.stringify(config)};}`
      if (url.pathname === "/src/generated/services/WhoAmIService.ts") body = `export const WhoAmIService={async WhoAmI(){return {success:true,data:{UserId:'admin'}};}};`
      if (url.pathname === "/src/generated/services/A365_leavesService.ts") body = `export const A365_leavesService={async getAll(){return ${JSON.stringify(scenario === "error" ? { success: false, data: [] } : { success: true, data: [scenarioLeave] })};}};`
      if (url.pathname === "/src/features/payroll/services/payroll-service.ts") body = `export async function saveAndCalculateEntry(...args){window.__saves.push(args);} export async function calculatePeriod(){} export async function calculateAndPersistEntry(){} export function getPayrollCalculationContext(){throw new Error('Unexpected legacy preview request');} export function previewPayrollEntry(){throw new Error('Unexpected legacy preview request');}`
      if (url.pathname === "/src/features/payroll/services/payroll-period-service.ts") body = "export const payrollPeriodService={};"
      if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
      return route.continue()
    })
    await page.goto(base)
    const dialog = page.getByRole("dialog", { name: "Test Employee" })
    const days = dialog.getByRole("spinbutton", { name: "Unpaid Leave (days)" })
    await dialog.waitFor({ timeout: 10000 }).catch(async error => { throw new Error(`${error.message}; browser errors: ${errors.join("; ")}; page: ${await page.locator("body").innerText()}`) })
    if (scenario === "error") {
      await dialog.getByText(/Unable to load unpaid leave/).waitFor()
      assert.equal(await dialog.getByRole("button", { name: "Save changes" }).isDisabled(), true)
    } else if (scenario === "readonly") {
      assert.equal(await days.inputValue(), "0")
      assert.equal(await days.isDisabled(), true)
    } else if (scenario === "screenshot") {
      await dialog.getByText("₱6,872.73", { exact: true }).waitFor()
      const amount = label => dialog.getByText(label, { exact: true }).locator("..").locator("+ dd")
      assert.equal(await amount("Gross Pay").innerText(), "₱25,000.00")
      assert.equal(await amount("Net Pay").innerText(), "₱18,127.27")
      await days.fill("2")
      await dialog.getByText("₱9,145.46", { exact: true }).waitFor()
      assert.equal(await amount("Gross Pay").innerText(), "₱25,000.00")
      assert.equal(await amount("Net Pay").innerText(), "₱15,854.54")
      assert.equal(await page.evaluate(() => window.__saves.length), 0)
    } else {
      await dialog.getByText(/2.00 unpaid leave days recorded/).waitFor()
      assert.equal(await days.inputValue(), "2")
      await dialog.getByText("₱18,854.54", { exact: true }).waitFor()
      assert.equal(await dialog.getByText("Gross Pay", { exact: true }).locator("..").locator("+ dd").innerText(), "₱25,000.00")
      assert.equal(await dialog.getByText("Total Deductions", { exact: true }).locator("..").locator("+ dd").innerText(), "₱6,145.46")
      assert.equal(await page.evaluate(() => window.__saves.length), 0)
      if (scenario === "save") {
        await days.fill("1.5")
        await dialog.getByRole("button", { name: "Save changes" }).click()
        await dialog.waitFor({ state: "hidden" })
        assert.equal(await page.evaluate(() => window.__saves[0][4].a365_unpaidleavedays), "1.5")
      } else if (scenario === "cancel") {
        await dialog.getByRole("button", { name: "Cancel" }).click()
        assert.equal(await page.evaluate(() => window.__saves.length), 0)
      } else {
        const box = await dialog.boundingBox()
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
      }
    }
    assert.deepEqual(errors, [])
    checks++
    await context.close()
  }
  console.log(`Passed ${checks} payroll unpaid-Leave browser scenarios. No live writes.`)
} finally { await browser.close() }
