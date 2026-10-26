// Fictional data only. Builds the real template; never sends an email.
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createServer } from "vite"

const payslip = process.argv.includes("--payslip")
const playwrightPath = process.argv.slice(2).find(argument => argument !== "--payslip")
const output = resolve(payslip ? ".playwright-cli/payslip-ready-email" : ".playwright-cli/leave-email")
// Keep this standalone renderer from replacing the running app's Vite cache.
const server = await createServer({ configFile: false, appType: "custom", cacheDir: resolve(output, ".vite"),
  resolve: { alias: { "@": resolve("src") } }, server: { middlewareMode: true } })
try {
  const { buildRecordedLeaveEmail } = await server.ssrLoadModule("/src/features/leave/notification-template.ts")
  const employee = { a365_employeeid: "10000000-0000-0000-0000-000000000001",
    a365_name: "Alex Santos", a365_workemail: "alex@example.invalid" }
  const record = { a365_leaveid: "20000000-0000-0000-0000-000000000002",
    _a365_employee_value: employee.a365_employeeid, a365_name: "Fictional leave",
    a365_leavetype: 749910000, a365_benefit: 749910001, a365_days: 1,
    a365_startdate: "2026-10-28", a365_enddate: "2026-10-28",
    a365_leavestatus: 749910000, a365_issuedon: "2026-10-26T08:00:00Z" }
  let draft = buildRecordedLeaveEmail(record, employee,
    { asOf: "2026-10-26", balances: { VL: 9.17, SL: 5 } })
  assert.equal(draft.status, "prepared")
  if (payslip) {
    const { buildPayslipReadyEmail } = await server.ssrLoadModule("/src/features/payroll/payslip-ready-email.ts")
    draft = buildPayslipReadyEmail(employee, { a365_payrollperiodid: "period", a365_name: "Oct 16–31, 2026",
      a365_periodstart: "2026-10-16", a365_periodend: "2026-10-31", a365_paydate: "2026-10-31",
      a365_payrollstatus: 749910002 }, "2026-10-26")
  }
  await mkdir(output, { recursive: true })
  await writeFile(resolve(output, "preview.html"), draft.html, "utf8")
  console.log(`Email preview: ${resolve(output, "preview.html")}`)

  // Optional installed Playwright entrypoint for browser checks/screenshots.
  if (playwrightPath) {
    const { chromium } = await import(pathToFileURL(resolve(playwrightPath)).href)
    const browser = await chromium.launch({ channel: "msedge", headless: true })
    try {
      for (const width of [1000, 390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } })
        await page.route("**/*", route => route.abort())
        await page.setContent(draft.html)
        await page.getByRole("heading", { name: payslip ? "Your payslip is ready" : "Your leave has been recorded" }).waitFor()
        assert.equal(await page.getByText(payslip ? "Open The Daily Operation and select My Payroll to view your payslip." : "Remaining VL balance: 9.17 days (as of Oct 26, 2026)").count(), 1)
        assert.equal(await page.locator("li").count(), payslip ? 4 : 5)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await page.screenshot({ path: resolve(output, `preview-${width}.png`), fullPage: true })
        await page.close()
      }
      console.log("Passed desktop, 390px and 320px email layout checks. No network requests or email.")
    } finally { await browser.close() }
  }
} finally { await server.close() }
