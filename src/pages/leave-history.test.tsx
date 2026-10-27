import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WhoAmIService } from "@/generated/services/WhoAmIService"
import { employeeService } from "@/features/employees/employee-service"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import LeaveHistoryPage from "./leave-history"

vi.mock("@/generated/services/WhoAmIService", () => ({ WhoAmIService: { WhoAmI: vi.fn() } }))
vi.mock("@/features/employees/employee-service", () => ({ employeeService: { getBySystemUserId: vi.fn() } }))
vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
const employeeId = "10000000-0000-0000-0000-000000000001"
const recordId = "20000000-0000-0000-0000-000000000002"
const employee = { a365_employeeid: employeeId, a365_name: "Portal Employee" }
const record = { a365_leaveid: recordId, _a365_employee_value: employeeId, a365_name: "Recorded leave", a365_leavetype: 749910000, a365_benefit: 749910000, a365_days: 1, a365_leavestatus: 749910000, a365_startdate: "2026-10-27", a365_enddate: "2026-10-27", a365_issuedon: "2026-10-27T04:00:00Z" }
const requests: Record<string, unknown>[] = []
const original = { scroll: Element.prototype.scrollIntoView, has: Element.prototype.hasPointerCapture, set: Element.prototype.setPointerCapture, release: Element.prototype.releasePointerCapture }
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn(); Element.prototype.releasePointerCapture = vi.fn()
})
afterAll(() => {
  Element.prototype.scrollIntoView = original.scroll; Element.prototype.hasPointerCapture = original.has
  Element.prototype.setPointerCapture = original.set; Element.prototype.releasePointerCapture = original.release
})
beforeEach(() => {
  vi.resetAllMocks(); requests.length = 0
  vi.mocked(WhoAmIService.WhoAmI).mockResolvedValue({ success: true, data: { UserId: "30000000-0000-0000-0000-000000000003" } })
  vi.mocked(employeeService.getBySystemUserId).mockResolvedValue(employee as Awaited<ReturnType<typeof employeeService.getBySystemUserId>>)
  vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockImplementation(async raw => {
    const request = JSON.parse(raw); requests.push(request)
    const rows = request.command === "myCredits" ? [{ a365_leavecredittransactionid: recordId, _a365_employee_value: employeeId, a365_year: request.year, a365_creditpool: 749910000, a365_days: 7.5 }] : [record]
    return { success: true, data: { Response: JSON.stringify({ employeeId, employeeName: employee.a365_name, rows }) } }
  })
})
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><LeaveHistoryPage /></QueryClientProvider>) }

describe("personal Leave History", () => {
  it("shows own records and balances with read-only details and no admin actions", async () => {
    const user = userEvent.setup(); renderPage()
    const table = await screen.findByRole("table", { name: "Leave records" })
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Record", "Employee", "Type", "Benefit", "Dates", "Days", "Status", "Action"])
    await screen.findByText("7.5")
    expect(screen.queryByRole("combobox", { name: "Employee" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add Leave" })).not.toBeInTheDocument()
    await user.click(within(table).getByRole("button", { name: "View Recorded leave" }))
    const dialog = await screen.findByRole("dialog", { name: "Leave details" })
    expect(await within(dialog).findByText("Recorded leave")).toBeVisible()
    expect(within(dialog).queryByText(/Note|Email status|Cancellation reason/)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /resend|cancel|delete|issue|edit/i })).not.toBeInTheDocument()
    expect(requests.every(request => request.employeeId === employeeId)).toBe(true)
  })
  it("combines all filters without affecting balance queries and refresh only reads", async () => {
    const user = userEvent.setup(); renderPage(); await screen.findByRole("table", { name: "Leave records" }); await screen.findByText("7.5")
    const year = screen.getByRole("spinbutton", { name: "Year" }); await user.clear(year); await user.type(year, "2025")
    await user.type(screen.getByRole("searchbox", { name: "Search record name" }), "Own")
    await user.click(screen.getByRole("button", { name: "Apply filters" }))
    await waitFor(() => expect(requests.some(r => r.command === "myLeaves" && r.year === 2025 && r.search === "Own")).toBe(true))
    for (const [name, option] of [["Status", "Issued"], ["Leave type", "SL"], ["Benefit", "Unpaid"]]) {
      await user.click(screen.getByRole("combobox", { name })); await user.click(screen.getByRole("option", { name: option }))
    }
    await waitFor(() => expect(requests.some(r => r.status === "749910000" && r.leaveType === 749910001 && r.benefit === 749910001 && r.year === 2025 && r.search === "Own")).toBe(true))
    const before = requests.filter(r => r.command === "myCredits").length
    await user.click(await screen.findByRole("button", { name: "Refresh balances" }))
    await waitFor(() => expect(requests.filter(r => r.command === "myCredits")).toHaveLength(before + 1))
    expect(requests.filter(r => r.command === "myCredits").every(r => r.search === undefined && r.status === undefined)).toBe(true)
    expect(requests.every(r => ["myLeaves", "myCredits"].includes(String(r.command)))).toBe(true)
  })
  it("does not mount leave reads before the employee lookup finishes", () => {
    vi.mocked(employeeService.getBySystemUserId).mockReturnValue(new Promise(() => {}))
    renderPage(); expect(screen.getByRole("status", { name: "Loading employee profile" })).toBeVisible()
    expect(A365_LeaveCommandService.a365_LeaveCommand).not.toHaveBeenCalled()
  })
  it("explains a missing employee profile without querying leave", async () => {
    vi.mocked(employeeService.getBySystemUserId).mockResolvedValue(null); renderPage()
    expect(await screen.findByText("No employee profile linked")).toBeVisible()
    expect(A365_LeaveCommandService.a365_LeaveCommand).not.toHaveBeenCalled()
  })
  it("retries a failed employee lookup without exposing the backend error", async () => {
    vi.mocked(employeeService.getBySystemUserId).mockRejectedValueOnce(new Error("PRIVATE ERROR"))
    const user = userEvent.setup(); renderPage()
    await user.click(await screen.findByRole("button", { name: "Retry employee profile" }))
    expect(await screen.findByRole("table", { name: "Leave records" })).toBeVisible()
    expect(screen.queryByText("PRIVATE ERROR")).not.toBeInTheDocument()
  })
  it("distinguishes empty history and no filter matches", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ employeeId, employeeName: employee.a365_name, rows: [] }) } })
    const user = userEvent.setup(); renderPage()
    expect(await screen.findByText(/No leave recorded for/)).toBeVisible()
    await user.type(screen.getByRole("searchbox", { name: "Search record name" }), "Absent")
    await user.click(screen.getByRole("button", { name: "Apply filters" }))
    expect(await screen.findByText(/No leave records match these filters/)).toBeVisible()
    expect(screen.getByText(/No recorded credit movements/)).toBeVisible()
  })
  it("shows retryable read errors rather than zero balances", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: false, data: {}, error: { message: "PRIVATE ERROR" } })
    renderPage()
    expect(await screen.findByRole("button", { name: "Retry records" })).toBeVisible()
    expect(await screen.findByRole("button", { name: "Retry balances" })).toBeVisible()
    expect(screen.queryByText("PRIVATE ERROR")).not.toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })
})
