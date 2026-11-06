// Synthetic browser verification only. Every external request is blocked.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const period = { a365_payrollperiodid: "11111111-1111-1111-1111-111111111111", a365_name: "Oct 16–31, 2026", a365_periodstart: "2026-10-16", a365_periodend: "2026-10-31", a365_paydate: "2026-10-31", a365_payrollstatus: 749910001, statecode: 0 }
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const scenario of ["cancel", "confirm", "failure", "setup", "mobile"]) {
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
        import {DeletePeriodDialog} from '/src/features/payroll/delete-period-dialog.tsx';
        import '/src/index.css';
        window.__deletions=[];
        function Harness(){const [open,setOpen]=React.useState(true);return React.createElement(QueryProvider,null,open?React.createElement(DeletePeriodDialog,{period:${JSON.stringify(period)},isAdmin:true,onClose:()=>setOpen(false),onDeleted:()=>setOpen(false)}):null);}
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));`
      if (url.pathname === "/src/features/payroll/services/payroll-deletion-service.ts") body = `export const payrollDeletionService={isConfigured:()=>${scenario !== "setup"},async deletePeriod(input){window.__deletions.push(input);${scenario === "failure" ? "throw new Error('Retry the same operation.');" : "await new Promise(r=>setTimeout(r,250));"}}};`
      if (url.pathname === "/src/features/payroll/services/payroll-period-service.ts") body = "export const payrollPeriodService={};"
      if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
      return route.continue()
    })
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 })
    const dialog = page.getByRole("dialog", { name: "Delete this payroll period?" })
    await dialog.waitFor()
    assert.match(await dialog.innerText(), /Oct 16–31, 2026/)
    assert.equal(await page.evaluate(() => window.__deletions.length), 0)
    const confirm = dialog.getByRole("button", { name: "Delete payroll", exact: true })
    if (scenario === "cancel") {
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      await dialog.waitFor({ state: "hidden" })
      assert.equal(await page.evaluate(() => window.__deletions.length), 0)
    } else if (scenario === "setup") {
      assert.equal(await confirm.isDisabled(), true)
      await dialog.getByRole("alert").filter({ hasText: "Dataverse server setup" }).waitFor()
    } else if (scenario === "failure") {
      await confirm.click()
      await dialog.getByRole("alert").waitFor()
      await confirm.click()
      await page.waitForFunction(() => window.__deletions.length === 2)
      assert.equal(await page.evaluate(() => window.__deletions[0].operationId === window.__deletions[1].operationId), true)
    } else if (scenario === "mobile") {
      const box = await dialog.boundingBox()
      assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
    } else {
      await confirm.click()
      await dialog.waitFor({ state: "hidden" })
      assert.equal(await page.evaluate(() => window.__deletions.length), 1)
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log("Passed 5 synthetic payroll deletion browser scenarios. No live deletions.")
} finally { await browser.close() }
