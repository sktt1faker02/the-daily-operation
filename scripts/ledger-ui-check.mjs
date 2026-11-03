// Real Ledger page, layout, hooks, forms and Excel export; synthetic SDK boundary.
// Every non-local request is blocked. No live business records are read/written.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { copyFile, mkdir } from "node:fs/promises"
import ExcelJS from "exceljs"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3104"
const artifacts = new URL("../artifacts/ledger.local/", import.meta.url)
await mkdir(artifacts, { recursive: true })
const categories = ["Utilities", "Payroll", "Government Contributions", "Taxes", "Software and Licenses", "Rent and Coworking", "Capital Deposits", "Capital Withdrawals", "Client Payments"].map((label, index) => ({ label, value: 749910000 + index }))
const rows = Array.from({ length: 53 }, (_, index) => ({
  id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`, date: "2026-11-03", receipt: index === 0 ? "0001" : "", reference: "",
  direction: index === 0 ? "credit" : "debit", amount: index === 0 ? 10000 : index === 1 ? -100 : 1,
  category: categories[index === 0 ? 6 : index === 1 ? 1 : 0].value, description: index === 0 ? "Capital deposit" : index === 1 ? "Signed payroll" : `Internet ${index}`,
  version: "1", periodId: null, employeeId: null, entryId: null, periodName: null, reopened: false, postedOn: null, postedBy: null,
}))
const browser = await chromium.launch({ channel: "msedge", headless: true })
const checks = []
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true })
    const page = await context.newPage(), errors = []
    page.on("pageerror", error => errors.push(error.message))
    const compiled = await (await context.request.get(`${base}/src/features/accounting/ledger/ledger-access.tsx`)).text()
    const routerModule = compiled.match(/\/node_modules\/\.vite\/deps\/react-router-dom\.js[^"'\s]*/)?.[0]
    assert.ok(routerModule)
    await page.addInitScript(() => { window.__ledgerState = { calls: [], employee: false, fail: false, empty: false } })
    await page.route("**/*", async route => {
      const url = new URL(route.request().url())
      if (url.origin !== base) return route.abort()
      let body
      if (url.pathname === "/src/main.tsx") body = `
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import {MemoryRouter,Routes,Route} from '${routerModule}';
        import {QueryProvider} from '/src/providers/query-provider.tsx';
        import Layout from '/src/pages/_layout.tsx';
        import Ledger from '/src/pages/ledger.tsx';
        import {LedgerOnly} from '/src/features/accounting/ledger/ledger-access.tsx';
        import '/src/index.css';
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryProvider,null,
          React.createElement(MemoryRouter,{initialEntries:['/ledger']},React.createElement(Routes,null,
          React.createElement(Route,{element:React.createElement(Layout)},
          React.createElement(Route,{path:'/ledger',element:React.createElement(LedgerOnly,null,React.createElement(Ledger))}),
          React.createElement(Route,{path:'/my-payroll',element:React.createElement('p',null,'Employee portal')}))))));`
      if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = `export const useAccessProfile=()=>({isAdmin:!window.__ledgerState.employee,ready:true,roleSettled:true,roleError:false,roleNames:[window.__ledgerState.employee?'A365 - Payroll Employee':'A365 - Payroll Admin'],showMyPayroll:true});`
      if (url.pathname === "/src/hooks/use-power-context.ts") body = `export const usePowerContext=()=>({data:{user:{fullName:'Synthetic Admin'}}});`
      if (url.pathname === "/src/lib/power/data-client.ts") body = `
        const rows=${JSON.stringify(rows)},categories=${JSON.stringify(categories)};
        export const dataClient={async executeAsync(input){
          const request=JSON.parse(input.dataverseRequest.parameters.body.Request),state=window.__ledgerState;
          state.calls.push(request);
          if(state.fail&&request.command==='list'){state.fail=false;return {success:false,error:{message:'LEDGER: Synthetic read failure.'}};}
          let response;
          if(request.command==='list'){
            let selected=state.empty?[]:rows.filter(row=>(!request.search||[row.description,row.receipt,row.reference].some(value=>value.toLowerCase().includes(request.search.toLowerCase())))&&(!request.category||String(row.category)===request.category)&&(!request.direction||row.direction===request.direction)&&(!request.start||row.date>=request.start)&&(!request.end||row.date<=request.end));
            const debit=selected.filter(row=>row.direction==='debit').reduce((sum,row)=>sum+row.amount,0),credit=selected.filter(row=>row.direction==='credit').reduce((sum,row)=>sum+row.amount,0);
            const offset=request.cursor?50:0;
            response={rows:selected.slice(offset,offset+50),totals:{debit,credit,net:credit-debit,count:selected.length},balance:state.empty?0:10049,revision:'one',next:selected.length>offset+50?'second':null,categories};
          }else if(request.command==='historyJobs')response={jobs:[]};
          else if(request.command==='historyPreview')response={periods:[],manual:[],missing:0,revision:'one'};
          else if(request.command==='save')response={id:request.id??request.operationId};
          else throw new Error('Unexpected synthetic command '+request.command);
          return {success:true,data:{Response:JSON.stringify(response)}};
        }};`
      if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
      return route.continue()
    })
    await page.goto(base, { waitUntil: "domcontentloaded" })
    const table = page.getByRole("table", { name: "Ledger records" })
    await table.getByText("0001", { exact: true }).waitFor()
    assert.equal(await table.getByRole("columnheader").count(), 8)
    assert.equal(await table.locator("tbody tr").count(), 50)
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await page.getByText("Page 2", { exact: true }).waitFor()
    assert.equal(await table.locator("tbody tr").count(), 3)
    await page.getByRole("button", { name: "Previous", exact: true }).click()
    await table.getByText("0001", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Edit Capital deposit", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("OR Number (optional)").waitFor()
    assert.equal(await dialog.getByLabel("OR Number (optional)").inputValue(), "0001")
    await page.keyboard.press("Tab")
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true)
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.getByRole("button", { name: "Delete Capital deposit", exact: true }).click()
    await dialog.getByRole("heading", { name: "Delete this ledger record?" }).waitFor()
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal(await page.evaluate(() => window.__ledgerState.calls.filter(call => call.command === "delete").length), 0)
    const downloadEvent = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export to Excel", exact: true }).click()
    const download = await downloadEvent
    const target = new URL(`Ledger-${width}.xlsx`, artifacts)
    const downloadedPath = await download.path()
    assert.ok(downloadedPath)
    await copyFile(downloadedPath, target.pathname.replace(/^\/([A-Za-z]:)/, "$1"))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(downloadedPath)
    const sheet = workbook.worksheets[0]
    assert.equal(sheet.getCell("B2").value, "0001")
    assert.equal(sheet.getCell("D3").value, -100)
    assert.equal(sheet.getCell("G54").value, "Internet 52")
    assert.equal(sheet.getCell("E58").value, 10049)
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("0001")
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    await table.getByText("0001", { exact: true }).waitFor()
    await page.getByText(/all 1 matching records/).waitFor()
    assert.equal(await table.locator("tbody tr").count(), 1)
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("no-matches")
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    await page.getByText(/No records match these filters/).waitFor()
    await page.evaluate(() => { window.__ledgerState.fail = true })
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("fault")
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    await page.getByText("Synthetic read failure.", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Retry ledger", exact: true }).click()
    await page.getByRole("button", { name: "Clear", exact: true }).click()
    await table.getByText("0001", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Page should fit viewport; table scrolls within its wrapper")
    await page.screenshot({ path: new URL(`ledger-${width}.png`, artifacts).pathname.replace(/^\/([A-Za-z]:)/, "$1"), fullPage: true })
    assert.deepEqual(errors, [])
    checks.push(`desktop/mobile ${width}: columns, pagination, confirmation, keyboard, filters, errors/retry and complete Excel`)
    // Re-render with the employee identity before the route mounts.
    await page.addInitScript(() => { window.__ledgerState = { calls: [], employee: true, fail: false, empty: false } })
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.getByText("Employee portal", { exact: true }).waitFor()
    assert.equal(await page.getByRole("link", { name: "Ledger Management", exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => window.__ledgerState.calls.length), 0)
    await context.close()
  }
  console.log(`Passed Ledger browser checks: ${checks.join("; ")}. Employee route/navigation denied before data requests. Synthetic SDK only; no live writes.`)
} finally { await browser.close() }
