// Actual row-action and dialog components, synthetic platform boundaries only.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const period = { a365_payrollperiodid: "period", a365_name: "Synthetic cutoff", a365_periodstart: "2026-10-16", a365_periodend: "2026-10-31", a365_paydate: "2026-10-31", a365_payrollstatus: 749910001 }
const entry = { a365_payrollentryid: "entry", a365_name: "Synthetic payroll", _a365_employee_value: "employee", a365_employeename: "Synthetic Employee", a365_isincluded: true, a365_basicpay: 1000, a365_allowances: 0, a365_grosspay: 1000, a365_totaldeductions: 0, a365_netpay: 1000 }
const employee = { a365_employeeid: "employee", a365_name: "Synthetic Employee", a365_employeenumber: "TEST-001", a365_employmentstatus: 749910000, a365_basicmonthlysalary: 2000 }
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  const scenarios = ["entry-cancel", "entry-confirm", "entry-ready", "employee-cancel", "employee-confirm", "employee-history", "entry-mobile", "employee-mobile"]
  for (const scenario of scenarios) {
    const isEmployee = scenario.startsWith("employee"), mobile = scenario.endsWith("mobile")
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 900 } })
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
        import {PayrollEntryTable} from '/src/features/payroll/payroll-entry-table.tsx';
        import {DeleteEntryDialog} from '/src/features/payroll/delete-entry-dialog.tsx';
        import {EmployeeTable} from '/src/features/employees/employee-table.tsx';
        import {DeleteEmployeeDialog} from '/src/features/employees/delete-employee-dialog.tsx';
        import '/src/index.css'; window.__deletions=[]; window.__edits=0;
        function Harness(){const [open,setOpen]=React.useState(false);const h=React.createElement;return h(QueryProvider,null,
          ${isEmployee ? `h(EmployeeTable,{employees:[${JSON.stringify(employee)}],departmentNames:new Map(),positionNames:new Map(),onEdit:()=>window.__edits++,onDelete:()=>setOpen(true)}),open?h(DeleteEmployeeDialog,{employee:${JSON.stringify(employee)},isAdmin:true,onClose:()=>setOpen(false),onDeleted:()=>setOpen(false)}):null` : `h(PayrollEntryTable,{entries:[${JSON.stringify(entry)}],editable:${scenario !== "entry-ready"},onEdit:()=>window.__edits++,onDelete:()=>setOpen(true)}),open?h(DeleteEntryDialog,{entry:${JSON.stringify(entry)},period:${JSON.stringify(period)},isAdmin:true,onClose:()=>setOpen(false),onDeleted:()=>setOpen(false)}):null`}
        );} ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));`
      if (url.pathname === "/src/features/payroll/services/payroll-deletion-service.ts") body = `export const payrollDeletionService={isConfigured:()=>true,async deleteEntry(input){window.__deletions.push(input);await new Promise(r=>setTimeout(r,500));}};`
      if (url.pathname === "/src/features/employees/employee-deletion-service.ts") body = `export const employeeDeletionService={isConfigured:()=>true,async deleteEmployee(input){window.__deletions.push(input);${scenario === "employee-history" ? "throw new Error('This employee has payroll history. Set to Inactive instead.');" : "await new Promise(r=>setTimeout(r,500));"}}};`
      if (url.pathname === "/src/features/payroll/services/payroll-period-service.ts") body = "export const payrollPeriodService={};"
      if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
      return route.continue()
    })
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 })
    await page.getByRole("table").waitFor()
    if (scenario === "entry-ready") {
      assert.equal(await page.getByRole("button", { name: /Delete payroll entry/ }).count(), 0)
    } else {
      const edit = page.getByRole("button", { name: "Edit Synthetic Employee", exact: true })
      assert.equal(await edit.textContent(), "")
      assert.equal(await edit.getAttribute("title"), "Edit")
      await edit.click()
      assert.equal(await page.evaluate(() => window.__edits), 1)
      await page.getByRole("button", { name: isEmployee ? "Delete Synthetic Employee" : "Delete payroll entry for Synthetic Employee", exact: true }).click()
      const dialog = page.getByRole("dialog")
      await dialog.waitFor()
      assert.match(await dialog.innerText(), /Synthetic Employee/)
      if (!isEmployee) assert.match(await dialog.innerText(), /Synthetic cutoff/)
      assert.equal(await page.evaluate(() => window.__deletions.length), 0)
      if (scenario.endsWith("cancel")) {
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
        await dialog.waitFor({ state: "hidden" })
        assert.equal(await page.evaluate(() => window.__deletions.length), 0)
      } else if (mobile) {
        const box = await dialog.boundingBox()
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390)
      } else {
        await dialog.getByRole("button", { name: isEmployee ? "Delete employee" : "Delete payroll entry", exact: true }).click()
        if (scenario === "employee-history") {
          await dialog.getByRole("alert").filter({ hasText: "Inactive" }).waitFor()
          assert.equal(await dialog.isVisible(), true)
        } else {
          await page.keyboard.press("Escape")
          assert.equal(await dialog.isVisible(), true)
          await dialog.waitFor({ state: "hidden" })
        }
        assert.equal(await page.evaluate(() => window.__deletions.length), 1)
      }
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log("Passed 8 entry/employee deletion and icon browser scenarios. No live data writes.")
} finally { await browser.close() }
