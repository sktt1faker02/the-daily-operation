// Real Leave page/dialog; synthetic platform boundaries; all external requests blocked.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3107"
const preview = { resetVersion: 1, year: 2026, periodStart: "2026-04-01", employeeCount: 3, VL: 10, SL: 5, version: "a".repeat(64) }
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const scenario of ["cancel", "success", "preview-error", "uncertain", "empty", "mobile", "employee"]) {
    const context = await browser.newContext({ viewport: { width: scenario === "mobile" ? 390 : 1280, height: 1000 } })
    try {
      const page = await context.newPage(), errors = []
      page.on("pageerror", error => { errors.push(error.message); console.error(scenario, error.message) })
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        let body
        if (url.pathname === "/src/main.tsx") body = `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {QueryProvider} from '/src/providers/query-provider.tsx';
          import LeavePage from '/src/pages/leave.tsx';
          import '/src/index.css';window.__resets=[];window.__previewCalls=0;
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryProvider,null,React.createElement(LeavePage)));`
        if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile=()=>({isAdmin:${scenario !== "employee"},roleSettled:true,roleError:false});`
        if (url.pathname === "/src/features/leave/leave-service.ts") body = `export const buildLeaveFilter=()=>'';export const leaveService={async list(){return {leaves:[],credits:[],conversions:[],employees:[]};},async balances(){return {VL:10,SL:5,movements:2};},async searchEmployees(){return {rows:[]};}};`
        if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `
          export const A365_LeaveCommandService={async a365_LeaveCommand(raw){const request=JSON.parse(raw);
            if(request.command==='resetPreview'){window.__previewCalls++;
              ${scenario === "preview-error" ? "throw new Error('LEAVE: Synthetic preview failure.');" : ""}
              return {success:true,data:{Response:JSON.stringify(${JSON.stringify({ ...preview, employeeCount: scenario === "empty" ? 0 : 3 })})}};}
            if(request.command==='resetBalances'){window.__resets.push(request);await new Promise(resolve=>setTimeout(resolve,150));
              ${scenario === "uncertain" ? "if(window.__resets.length===1)throw new Error('Synthetic uncertain network response');" : ""}
              return {success:true,data:{Response:JSON.stringify({...${JSON.stringify(preview)},completed:true,operationId:request.operationId})}};}
            throw new Error('Unexpected command');}};`
        if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
        return route.continue()
      })
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 })
      if (scenario === "employee") {
        await page.getByRole("heading", { name: "Leave access denied" }).waitFor()
        assert.equal(await page.getByRole("button", { name: "Reset leave balances" }).count(), 0)
      } else {
        await page.getByRole("button", { name: "Reset leave balances" }).click().catch(async error => { console.error({scenario,errors,text:await page.locator("body").innerText()});throw error })
        const dialog = page.getByRole("dialog")
        await dialog.waitFor()
        if (scenario === "preview-error") {
          await dialog.getByRole("alert").waitFor()
          assert.equal(await dialog.getByRole("button", { name: "Reset balances", exact: true }).isDisabled(), true)
          assert.equal(await page.evaluate(() => window.__resets.length), 0)
        } else {
          await dialog.getByText(scenario === "empty" ? "No active employees need resetting." : "3 active employees", { exact: true }).waitFor()
          if (["cancel", "mobile"].includes(scenario)) {
            if (scenario === "mobile") {
              const box = await dialog.boundingBox()
              assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
            }
            await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
            assert.equal(await page.evaluate(() => window.__resets.length), 0)
          } else if (scenario === "empty") {
            assert.equal(await dialog.getByRole("button", { name: "Reset balances", exact: true }).isDisabled(), true)
          } else {
            await dialog.getByRole("button", { name: "Reset balances", exact: true }).click()
            if (scenario === "uncertain") {
              await dialog.getByRole("button", { name: "Retry same reset" }).waitFor()
              assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true)
              await page.keyboard.press("Escape")
              assert.equal(await dialog.isVisible(), true)
              await dialog.getByRole("button", { name: "Retry same reset" }).click()
            }
            await dialog.waitFor({ state: "hidden" })
            const writes = await page.evaluate(() => window.__resets)
            assert.equal(writes.length, scenario === "uncertain" ? 2 : 1)
            if (writes.length === 2) assert.deepEqual(writes[0], writes[1])
          }
        }
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  console.log("Passed 7 leave reset browser scenarios: confirmation/cancel, success, preview error, uncertain retry, empty, mobile and employee denial. No live writes.")
} finally { await browser.close() }
