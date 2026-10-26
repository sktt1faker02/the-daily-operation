// Synthetic platform boundaries only. Every external request is blocked.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const periodId = "10000000-0000-0000-0000-000000000001"
const adminId = "10000000-0000-0000-0000-000000000002"
const employeeId = number => `20000000-0000-0000-0000-${String(number).padStart(12, "0")}`
const employees = [1, 2, 3].map(number => ({ a365_employeeid: employeeId(number), a365_name: `Employee ${number}`, a365_workemail: `employee${number}@example.invalid` }))
const entries = employees.map((employee, index) => ({
  a365_payrollentryid: `30000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  a365_name: employee.a365_name, _a365_employee_value: employee.a365_employeeid, _a365_payrollperiod_value: periodId,
  a365_isincluded: index < 2, a365_basicpay: 25000, a365_allowances: 0, a365_otherearnings: 0,
  a365_otherdeductions: 0, a365_unpaidleavedays: 0, a365_withholdingtax: 0, a365_unpaidleave: 0,
  a365_grosspay: 25000, a365_sss: 875, a365_philhealth: 625, a365_hdmf: 100,
  a365_totaldeductions: 1600, a365_netpay: 23400, a365_calculatedon: "2026-10-26T08:00:00Z", a365_comment: null,
}))
const period = { a365_payrollperiodid: periodId, a365_name: "Oct 16–31, 2026", a365_periodstart: "2026-10-16",
  a365_periodend: "2026-10-31", a365_paydate: "2026-10-31", a365_payrollstatus: 749910001 }
const browser = await chromium.launch({ channel: "msedge", headless: true })
let count = 0
try {
  for (const scenario of ["success", "missing", "unknown", "update-failure", "mobile"]) {
    const context = await browser.newContext({ viewport: { width: scenario === "mobile" ? 390 : 1280, height: 1000 } })
    // Use Vite's exact router module URL so the harness and page share contexts.
    const compiled = await (await context.request.get(`${base}/src/pages/payroll-period.tsx`)).text()
    const routerModule = compiled.match(/\/node_modules\/\.vite\/deps\/react-router-dom\.js[^"'\s]*/)?.[0]
    assert.ok(routerModule, "Unable to resolve the app's router module")
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
        import {createBrowserRouter,RouterProvider} from '${routerModule}';
        import {QueryProvider} from '/src/providers/query-provider.tsx';
        import PayrollPeriodPage from '/src/pages/payroll-period.tsx';
        import '/src/index.css';
        window.__period=${JSON.stringify(period)};window.__employees=${JSON.stringify(employees)};window.__emails=[];window.__writes=[];window.__allowSend=false;
        ${scenario === "missing" ? "window.__employees[1].a365_workemail='';" : ""}
        const router=createBrowserRouter([{path:'/payroll/:periodId',element:React.createElement(PayrollPeriodPage)}]);
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryProvider,null,React.createElement(RouterProvider,{router})));`
      if (url.pathname === "/src/lib/power/data-client.ts") body = `
        export const dataClient={
          async retrieveRecordAsync(table,id){return {success:true,data:table==='a365_payrollperiods'?{...window.__period}:window.__employees.find(row=>row.a365_employeeid===id)};},
          async retrieveMultipleRecordsAsync(table,options={}){
            let data=[];
            if(table==='a365_payrollentries')data=${JSON.stringify(entries)}.filter(row=>!options.filter?.includes('a365_isincluded eq true')||row.a365_isincluded);
            if(table==='a365_employees')data=window.__employees;
            if(table==='roles')data=[{roleid:'admin-role',name:'A365 - Payroll Admin'}];
            return {success:true,data};
          },
          async updateRecordAsync(table,id,payload){window.__writes.push({table,id,payload});
            ${scenario === "update-failure" ? "return {success:false,error:new Error('Synthetic status failure')};" : "Object.assign(window.__period,payload);return {success:true,data:{...window.__period}};"}
          }
        };`
      if (url.pathname === "/src/generated/services/WhoAmIService.ts") body = `export const WhoAmIService={async WhoAmI(){return {success:true,data:{UserId:'${adminId}'}};}};`
      if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = "export function useAccessProfile(){return {isAdmin:true,roleSettled:true,roleError:false};}"
      if (url.pathname === "/src/hooks/use-power-context.ts") body = "export function usePowerContext(){return {data:{user:{fullName:'Test Admin'}}};}"
      if (url.pathname === "/src/generated/services/Office365OutlookService.ts") body = `export const Office365OutlookService={async SendEmailV2(message){
        if(window.__period.a365_payrollstatus!==749910002)throw new Error('Email before Ready');
        window.__emails.push(message);await new Promise(resolve=>setTimeout(resolve,100));
        return {success:${scenario === "unknown" ? "window.__allowSend||message.To!=='employee2@example.invalid'" : "true"}};
      }};`
      if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
      return route.continue()
    })
    await page.goto(`${base}/payroll/${periodId}`)
    await page.getByRole("heading", { name: period.a365_name, exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
      throw new Error(`${error.message}; browser errors: ${errors.join("; ")}; page: ${await page.locator("body").innerText()}`)
    })
    assert.equal(await page.evaluate(() => window.__emails.length), 0)
    await page.getByRole("button", { name: "Mark Ready", exact: true }).click()
    let dialog = page.getByRole("dialog", { name: "Mark this payroll Ready?" })
    assert.equal(await page.evaluate(() => window.__emails.length), 0)
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal(await page.evaluate(() => window.__emails.length), 0)
    await page.getByRole("button", { name: "Mark Ready", exact: true }).click()
    dialog = page.getByRole("dialog", { name: "Mark this payroll Ready?" })
    await dialog.getByRole("button", { name: "Mark Ready", exact: true }).click()
    if (scenario === "update-failure") {
      await page.waitForFunction(() => window.__writes.length === 1)
      await dialog.getByRole("button", { name: "Mark Ready", exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.__emails.length), 0)
      assert.equal(await page.evaluate(() => window.__period.a365_payrollstatus), 749910001)
    } else {
      const report = page.getByRole("region", { name: "Payslip email notifications" })
      await report.waitFor()
      await dialog.waitFor({ state: "hidden" })
      assert.equal(await page.evaluate(() => window.__period.a365_payrollstatus), 749910002)
      if (scenario === "missing" || scenario === "unknown") {
        await report.getByText(scenario === "missing" ? "Work Email needed" : "Outcome uncertain", { exact: true }).waitFor()
        if (scenario === "missing") await page.evaluate(() => { window.__employees[1].a365_workemail = 'employee2@example.invalid' })
        else {
          assert.equal(await report.getByRole("button", { name: "Retry remaining notifications" }).isDisabled(), true)
          await page.evaluate(() => { window.__allowSend = true })
          await report.getByRole("checkbox").check()
        }
        await report.getByRole("button", { name: "Retry remaining notifications" }).click()
      }
      await report.getByText("2 accepted by the sending service.", { exact: true }).waitFor()
      if (scenario === "success") {
        await page.getByRole("button", { name: "Mark as Paid", exact: true }).click()
        await page.getByRole("dialog", { name: "Mark this payroll Paid?" }).getByRole("button", { name: "Mark as Paid", exact: true }).click()
        await page.waitForFunction(() => window.__period.a365_payrollstatus === 749910004)
        await report.getByText("2 accepted by the sending service.", { exact: true }).waitFor()
      }
      const messages = await page.evaluate(() => window.__emails)
      assert.equal(messages.filter(message => message.To === "employee1@example.invalid").length, 1)
      assert.equal(messages.filter(message => message.To === "employee2@example.invalid").length, scenario === "unknown" ? 2 : 1)
      assert.equal(messages.some(message => message.To === "employee3@example.invalid"), false)
      assert.ok(messages.every(message => message.Subject === "Your payslip is ready" && message.Body.includes("My Payroll") && !message.Body.includes("25,000")))
      if (scenario === "mobile") assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        JSON.stringify(await page.locator("body *").evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(element => ({ tag: element.tagName, className: element.className })))) )
    }
    assert.deepEqual(errors, [])
    count++
    await context.close()
  }
  console.log(`Passed ${count} Mark Ready notification browser scenarios. No real emails or financial writes.`)
} finally { await browser.close() }
