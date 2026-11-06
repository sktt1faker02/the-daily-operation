// Real conversion page and queries; synthetic API boundary, no external access.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3107"
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    try {
      const compiled = await (await context.request.get(`${base}/src/pages/leave-conversion.tsx`)).text()
      const router = compiled.match(/\/node_modules\/\.vite\/deps\/react-router-dom\.js[^"'\s]*/)?.[0]
      const provider = await (await context.request.get(`${base}/src/providers/query-provider.tsx`)).text()
      const queryModule = provider.match(/\/node_modules\/\.vite\/deps\/@tanstack_react-query\.js[^"'\s]*/)?.[0]
      assert.ok(router && queryModule)
      const page = await context.newPage(), errors = []
      page.on("pageerror", error => errors.push(error.message))
      page.on("dialog", dialog => dialog.accept())
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        let body
        if (url.pathname === "/src/main.tsx") body = `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {createMemoryRouter,RouterProvider} from '${router}';
          import {QueryClient,QueryClientProvider} from '${queryModule}';
          import Conversion from '/src/pages/leave-conversion.tsx';import '/src/index.css';
          window.__live=9;window.__limitVL=10;window.__limitDays=5;window.__version=1;window.__paid=false;window.__saved=[];
          const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
          window.__refresh=()=>client.invalidateQueries({queryKey:['leave','conversion','rows',2026]});
          const router=createMemoryRouter([{path:'/leave-conversion/:year',element:React.createElement(Conversion)}],{initialEntries:['/leave-conversion/2026']});
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(RouterProvider,{router})));`
        if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = "export const useAccessProfile=()=>({isAdmin:true,roleSettled:true,roleError:false});"
        if (url.pathname === "/src/generated/services/A365_LeaveCommandService.ts") body = `export const A365_LeaveCommandService={async a365_LeaveCommand(raw){
          const request=JSON.parse(raw);const transaction=()=>({id:'10000000-0000-0000-0000-000000000001',year:2026,version:String(window.__version),paid:window.__paid});
          if(request.command==='conversionRows'){const availableVL=Math.min(window.__limitVL,window.__live);const days=Math.min(window.__limitDays,availableVL,5);
            return {success:true,data:{Response:JSON.stringify({transaction:transaction(),rows:[{id:'20000000-0000-0000-0000-000000000002',employeeId:'30000000-0000-0000-0000-000000000003',employeeName:'Synthetic Employee',employeeNumber:'TEST-01',dailyRate:100,availableVL,days,amount:100*days,limitAvailableVL:window.__limitVL,limitDays:window.__limitDays,liveVL:window.__live}]})}};}
          if(request.command==='conversionSave'){window.__saved.push(request);window.__limitVL=request.changes[0].availableVL;window.__limitDays=request.changes[0].days;window.__version++;return {success:true,data:{Response:JSON.stringify(transaction())}};}
          throw new Error('Unexpected command');}};`
        return body === undefined ? route.continue() : route.fulfill({ status: 200, contentType: "text/javascript", body })
      })
      await page.goto(base, { waitUntil: "domcontentloaded" })
      const row = page.getByRole("row").filter({ hasText: "Synthetic Employee" })
      await row.waitFor()
      assert.deepEqual((await row.getByRole("cell").allTextContents()).slice(2, 4), ["9.00", "5.00"])
      await page.evaluate(() => { window.__live = 4; return window.__refresh() })
      await row.getByRole("cell", { name: "4.00", exact: true }).first().waitFor()
      assert.deepEqual((await row.getByRole("cell").allTextContents()).slice(2, 4), ["4.00", "4.00"])
      await row.getByRole("button", { name: "Edit Synthetic Employee" }).click()
      assert.equal(await row.getByRole("spinbutton", { name: "Available VL for Synthetic Employee" }).inputValue(), "10.00")
      await row.getByRole("spinbutton", { name: "VL to convert for Synthetic Employee" }).fill("3")
      await row.getByText(/Payable now: 3.00 days/).waitFor()
      await row.getByRole("button", { name: "Done" }).click()
      await page.getByRole("button", { name: "Save", exact: true }).click()
      await page.getByRole("status").filter({ hasText: "Unsaved changes" }).waitFor({ state: "hidden" })
      assert.deepEqual((await row.getByRole("cell").allTextContents()).slice(2, 4), ["4.00", "3.00"])
      await page.evaluate(() => { window.__live = 2; return window.__refresh() })
      assert.deepEqual((await row.getByRole("cell").allTextContents()).slice(2, 4), ["2.00", "2.00"])
      await page.evaluate(() => { window.__live = 4; return window.__refresh() })
      assert.deepEqual((await row.getByRole("cell").allTextContents()).slice(2, 4), ["4.00", "3.00"])
      assert.equal(await page.evaluate(() => window.__saved.length), 1)
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  console.log("Passed linked VL balance, manual-limit retention, automatic cap, restoration and saved-rate amount scenarios at desktop/mobile widths. No live writes.")
} finally { await browser.close() }
