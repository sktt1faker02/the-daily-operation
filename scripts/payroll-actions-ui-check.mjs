// Render the real payroll page with synthetic reads; block all external requests.
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { chromium } = await import(pathToFileURL(process.argv[2]).href)
const base = "http://127.0.0.1:3103"
const periods = [749910001, 749910002, 749910004].map((status, index) => ({
  a365_payrollperiodid: `period-${index}`, a365_name: `Cutoff ${index}`,
  a365_periodstart: "2026-10-01", a365_periodend: "2026-10-15",
  a365_paydate: "2026-10-15", a365_payrollstatus: status,
}))
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    try {
      const compiled = await (await context.request.get(`${base}/src/pages/payroll.tsx`)).text()
      const routerModule = compiled.match(/\/node_modules\/\.vite\/deps\/react-router-dom\.js[^"'\s]*/)?.[0]
      assert.ok(routerModule)
      const page = await context.newPage(), errors = []
      page.on("pageerror", error => errors.push(error.message))
      await page.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        let body
        if (url.pathname === "/src/main.tsx") body = `
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {MemoryRouter} from '${routerModule}';
          import {QueryProvider} from '/src/providers/query-provider.tsx';
          import Payroll from '/src/pages/payroll.tsx';
          import '/src/index.css';
          ReactDOM.createRoot(document.getElementById('root')).render(
            React.createElement(QueryProvider,null,React.createElement(MemoryRouter,null,React.createElement(Payroll))));`
        if (url.pathname === "/src/features/payroll/services/payroll-period-service.ts") body = `
          export const payrollPeriodService={
            async listPeriods(){return ${JSON.stringify(periods)};},
            async listArchivedPeriods(){return ${JSON.stringify(periods.map(p => ({ ...p, a365_name: `Archived ${p.a365_name}`, statecode: 1 })))};}
          };`
        if (url.pathname === "/src/features/payroll/hooks/use-access-profile.ts") body = "export const useAccessProfile=()=>({isAdmin:true});"
        if (url.pathname === "/src/hooks/use-power-context.ts") body = "export const usePowerContext=()=>({data:{user:{fullName:'Synthetic Admin'}}});"
        if (body !== undefined) return route.fulfill({ status: 200, contentType: "text/javascript", body })
        return route.continue()
      })
      await page.goto(base, { waitUntil: "domcontentloaded" })
      const tablePositions = []
      for (const [name, prefix, archiveAction] of [
        ["Active payroll periods", "", "Archive"],
        ["Archived payroll periods", "Archived ", "Unarchive"],
      ]) {
        const table = page.getByRole("table", { name })
        await table.getByRole("button", { name: `Export ${prefix}Cutoff 0 to Excel`, exact: true }).waitFor()
        const positions = []
        for (let index = 0; index < 3; index++) {
          const exportButton = table.getByRole("button", { name: `Export ${prefix}Cutoff ${index} to Excel`, exact: true })
          const archiveButton = table.getByRole("button", { name: `${archiveAction} ${prefix}Cutoff ${index}`, exact: true })
          const exportBox = await exportButton.boundingBox(), archiveBox = await archiveButton.boundingBox()
          assert.ok(exportBox && archiveBox)
          assert.ok(Math.abs(archiveBox.x - exportBox.x - 40) < 1, "Consistent button spacing")
          positions.push([exportBox.x, archiveBox.x])
          assert.equal(await table.getByRole("button", { name: `Delete ${prefix}Cutoff ${index}`, exact: true }).count(), index === 0 ? 1 : 0)
          const actionCell = exportButton.locator("xpath=ancestor::td")
          assert.equal(await actionCell.locator('button, [tabindex="0"]').count(), index === 0 ? 3 : 2)
        }
        for (const position of positions) assert.deepEqual(position, positions[0], "Actions align across statuses")
        tablePositions.push(positions[0])
      }
      if (width === 1280) assert.deepEqual(tablePositions[0], tablePositions[1], "Both tables align on desktop")
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  console.log("Passed payroll action alignment at desktop/mobile widths, active/archived lists, and all three statuses. No live writes.")
} finally { await browser.close() }
