// Real sync dialog and service; synthetic API responses, no external requests.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3107"
const id = "10000000-0000-0000-0000-000000000001"
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const scenario of ["cancel", "success", "retry", "pending", "historical", "mobile"]) {
    const context = await browser.newContext({ viewport: { width: scenario === "mobile" ? 390 : 1280, height: 900 } })
    try {
      const page = await context.newPage(), errors = []
      page.on("pageerror", error => errors.push(error.message))
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        let body
        if (url.pathname === "/src/main.tsx") body = `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {QueryProvider} from '/src/providers/query-provider.tsx';
          import {SyncEmployeeLeave} from '/src/features/leave/sync-employee-leave.tsx';
          import {currentCreditYear} from '/src/features/leave/employee-leave-service.ts';
          import '/src/index.css';window.__syncs=[];
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryProvider,null,React.createElement(SyncEmployeeLeave,{employee:{a365_employeeid:'${id}',a365_name:'Support User'},year:currentCreditYear()-${scenario === "historical" ? 1 : 0}})));`
        if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `
          export const A365_LeaveCommandService={async a365_LeaveCommand(raw){const request=JSON.parse(raw);window.__syncs.push(request);
            if(request.command!=='syncEmployee')throw new Error('Unexpected command');
            ${scenario === "pending" ? "await new Promise(resolve=>setTimeout(resolve,1000));" : ""}
            ${scenario === "retry" ? "if(window.__syncs.length===1)throw new Error('LEAVE: Temporary setup failure.');" : ""}
            return {success:true,data:{Response:JSON.stringify({employeeId:request.employeeId,year:request.year,eligible:true,VL:8.33,SL:5,conversionAdded:true})}};
          }};`
        return body === undefined ? route.continue() : route.fulfill({ contentType: "application/javascript", body })
      })
      await page.goto(base)
      const trigger = page.getByRole("button", { name: "Sync leave credits", exact: true })
      await trigger.waitFor()
      if (scenario === "historical") assert.equal(await trigger.isDisabled(), true)
      else {
        await trigger.click()
        await page.getByRole("dialog", { name: "Sync leave credits for Support User?" }).waitFor()
        assert.match(await page.getByRole("dialog").innerText(), /does not reset balances or make a payment/)
        if (scenario === "cancel") await page.getByRole("button", { name: "Cancel", exact: true }).click()
        else {
          await page.getByRole("button", { name: "Confirm sync", exact: true }).click()
          if (scenario === "pending") {
            assert.equal(await page.getByRole("button", { name: "Syncing…", exact: true }).isDisabled(), true)
            await page.keyboard.press("Escape")
            assert.equal(await page.getByRole("dialog").count(), 1)
          }
          if (scenario === "retry") {
            await page.getByRole("alert").waitFor()
            assert.match(await page.getByRole("alert").innerText(), /Temporary setup failure/)
            await page.getByRole("button", { name: "Confirm sync", exact: true }).click()
          }
        }
        await page.getByRole("dialog").waitFor({ state: "detached" })
      }
      const calls = await page.evaluate(() => window.__syncs)
      assert.equal(calls.length, ["cancel", "historical"].includes(scenario) ? 0 : scenario === "retry" ? 2 : 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  console.log("Passed 6 employee leave sync browser scenarios: cancel, success, retry, pending, historical and mobile. No live writes.")
} finally { await browser.close() }
