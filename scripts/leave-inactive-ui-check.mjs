// Real Leave components/services; synthetic Dataverse boundaries; no live writes.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { readFileSync } from "node:fs"
const { browserHash } = JSON.parse(readFileSync(new URL("../node_modules/.vite/deps/_metadata.json", import.meta.url), "utf8"))
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3107", support = "10000000-0000-0000-0000-000000000001", active = "10000000-0000-0000-0000-000000000002"
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const scenario of ["picker", "stale", "status-error", "conversion", "paid", "mobile"]) {
    const context = await browser.newContext({ viewport: { width: scenario === "mobile" ? 390 : 1280, height: 1000 } })
    try {
      const page = await context.newPage(), errors = []
      page.on("pageerror", error => errors.push(error.message))
      const conversion = ["conversion", "paid"].includes(scenario), balance = ["stale", "status-error"].includes(scenario)
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        let body
        if (url.pathname === "/src/main.tsx") body = `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {createMemoryRouter,RouterProvider} from '/node_modules/.vite/deps/react-router-dom.js?v=${browserHash}';
          import {QueryProvider} from '/src/providers/query-provider.tsx';
          import LeavePage from '/src/pages/leave.tsx';
          import ConversionPage from '/src/pages/leave-conversion.tsx';
          import {LeaveBalances} from '/src/features/leave/leave-balances.tsx';
          import '/src/index.css';window.__queries=[];
          const element=${balance ? `React.createElement(LeaveBalances,{employeeId:'${support}',employee:{a365_employeeid:'${support}',a365_name:'Support User'},year:2026})` : conversion ? "React.createElement(ConversionPage)" : "React.createElement(LeavePage)"};
          const router=createMemoryRouter([{path:'${conversion ? "/leave-conversion/:year" : "*"}',element}],{initialEntries:['${conversion ? "/leave-conversion/2026" : "/leave"}']});
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryProvider,null,React.createElement(RouterProvider,{router})));`
        if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile=()=>({isAdmin:true,roleSettled:true,roleError:false});`
        if (url.pathname === "/src/lib/power/data-client.ts") body = `export const dataClient={async retrieveMultipleRecordsAsync(table,options){window.__queries.push({table,...options});
          if(options.select.includes('a365_employmentstatus'))return ${scenario === "status-error" ? "{success:false,error:new Error('private detail')}" : `{success:true,data:[{a365_employeeid:'${support}',a365_employmentstatus:749910001}]}`};
          if(!options.filter.includes('a365_employmentstatus ne 749910001'))throw new Error('Inactive picker filter missing');
          return {success:true,data:options.filter.includes("Support")?[]:[{a365_employeeid:'${active}',a365_name:'Active Employee'}]};
        }};`
        if (url.pathname === "/src/generated/services/A365_leavesService.ts") body = `export const A365_leavesService={async getAll(options){window.__queries.push(options);if(!options.filter.includes('a365_Employee/a365_employmentstatus ne 749910001'))throw new Error('Inactive list filter missing');return {success:true,data:[]};}};`
        if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `export const A365_LeaveCommandService={async a365_LeaveCommand(raw){const request=JSON.parse(raw);if(request.command!=='conversionRows')throw new Error('Unexpected mutation');return {success:true,data:{Response:JSON.stringify({transaction:{id:'${active}',year:2026,version:'1',paid:${scenario === "paid"}},rows:[{id:'${active}',employeeId:'${active}',employeeName:'Active Employee',employeeNumber:'ACT-1',dailyRate:100,availableVL:5,days:5,amount:500}]})}};}};`
        return body === undefined ? route.continue() : route.fulfill({ contentType: "application/javascript", body })
      })
      await page.goto(base)
      if (balance) {
        await page.getByText(scenario === "stale" ? "This employee is inactive. Leave balances and actions are hidden." : "Balances unavailable. The complete credit history could not be verified.").waitFor()
        assert.equal(await page.getByRole("button", { name: "Sync leave credits" }).count(), 0)
        assert.equal(await page.getByText("0.00", { exact: true }).count(), 0)
      } else if (conversion) {
        try { await page.getByRole("table", { name: "Employee conversions" }).getByText("Active Employee").waitFor({ timeout: 5000 }) }
        catch (error) { console.error(scenario, await page.locator("body").innerText(), errors); throw error }
        assert.equal(await page.getByText("Support User", { exact: true }).count(), 0)
        if (scenario === "paid") assert.equal(await page.getByRole("button", { name: "Paid (locked)" }).isDisabled(), true)
      } else {
        await page.getByRole("combobox", { name: "Employee", exact: true }).click()
        await page.getByRole("option", { name: "Active Employee" }).waitFor()
        assert.equal(await page.getByText("Support User", { exact: true }).count(), 0)
        await page.locator("[cmdk-input]").fill("Support")
        await page.getByText("No matching employees.").waitFor()
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  console.log("Passed 6 inactive employee browser scenarios: picker, stale balances, status error, unpaid conversion, paid conversion and mobile. No live writes.")
} finally { await browser.close() }
