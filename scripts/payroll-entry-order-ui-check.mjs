// Exercise the real table with synthetic entries; block external requests.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const entries = [
  ["a", "Alice Example", "EMP-10"], ["b", "Zoe Example", "EMP-2"],
  ["c", "Maria Sample", "EMP-001"], ["d", "Missing Number", null],
].map(([id, name, number]) => ({ a365_payrollentryid: id, a365_employeename: name,
  a365_employeenumber: number, a365_basicpay: 1000, a365_allowances: 0,
  a365_grosspay: 1000, a365_totaldeductions: 0, a365_netpay: 1000 }))
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const width of [1280, 390]) {
    for (const editable of [true, false]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      page.on("pageerror", error => errors.push(error.message))
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        if (url.pathname === "/src/main.tsx") return route.fulfill({ contentType: "text/javascript", body: `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {PayrollEntryTable} from '/src/features/payroll/payroll-entry-table.tsx';
          import '/src/index.css';
          const entries=${JSON.stringify(entries)};
          function Harness(){
            const [search,setSearch]=React.useState('');
            const [selected,setSelected]=React.useState('');
            return React.createElement('main',null,
              React.createElement('input',{'aria-label':'Search employees',value:search,onChange:e=>setSearch(e.target.value)}),
              React.createElement(PayrollEntryTable,{entries:entries.filter(e=>e.a365_employeename.toLowerCase().includes(search.toLowerCase())),
                editable:${editable},onEdit:e=>setSelected(e.a365_payrollentryid),onViewPayslip:e=>setSelected(e.a365_payrollentryid)}),
              React.createElement('output',null,selected));
          }
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })
        return route.continue()
      })
      await page.goto(base, { waitUntil: "domcontentloaded" })
      await page.getByRole("cell", { name: "Maria Sample", exact: true }).waitFor()
      const names = () => page.locator("tbody tr td:first-child").allTextContents()
      assert.deepEqual(await names(), ["Maria Sample", "Zoe Example", "Alice Example", "Missing Number"])
      assert.deepEqual(await page.getByRole("columnheader").allTextContents(), ["Employee", "Basic Pay", "Allowances", "Gross", "Deductions", "Net Pay", "Actions"])
      assert.equal(await page.getByText("EMP-001", { exact: true }).count(), 0)
      await page.getByRole("button", { name: editable ? "Edit Zoe Example" : "View payslip for Zoe Example", exact: true }).click()
      assert.equal(await page.locator("output").textContent(), "b")
      await page.getByRole("textbox", { name: "Search employees" }).fill("Example")
      await page.getByRole("cell", { name: "Maria Sample", exact: true }).waitFor({ state: "hidden" })
      assert.deepEqual(await names(), ["Zoe Example", "Alice Example"])
      await page.getByRole("textbox", { name: "Search employees" }).fill("")
      await page.getByRole("cell", { name: "Maria Sample", exact: true }).waitFor()
      assert.deepEqual(await names(), ["Maria Sample", "Zoe Example", "Alice Example", "Missing Number"])
      assert.deepEqual(errors, [])
      await page.close()
    }
  }
  console.log("Passed employee-number ordering, hidden numbers, search/reset and row actions in editable/read-only tables at desktop/mobile widths. Synthetic data only.")
} finally { await browser.close() }
