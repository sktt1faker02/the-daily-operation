import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LeavePage from "./leave"
import { leaveService } from "@/features/leave/leave-service"
import type { LeavePage as PageData, LeaveRecord } from "@/features/leave/types"
import { AddLeaveDialog } from "@/features/leave/add-leave-dialog"
import { LeavePostingError, postingService } from "@/features/leave/posting-service"

vi.mock("@/features/leave/posting-service", async importOriginal => ({
  ...await importOriginal<typeof import("@/features/leave/posting-service")>(),
  postingService: { preview: vi.fn(), submit: vi.fn(), notify: vi.fn() },
}))

const access = vi.hoisted(() => ({ isAdmin: true, roleSettled: true, roleError: false }))
vi.mock("@/features/payroll/hooks/use-access-profile", () => ({ useAccessProfile: () => access }))
vi.mock("@/features/leave/leave-service", () => ({ leaveService: { list: vi.fn(), balances: vi.fn(), detail: vi.fn(), searchEmployees: vi.fn() } }))

const employeeId = "10000000-0000-0000-0000-000000000001"
const recordId = "20000000-0000-0000-0000-000000000002"
const employee = { a365_employeeid: employeeId, a365_name: "Test Employee", a365_employeenumber: "TEST-01" }
const record: LeaveRecord = {
  a365_leaveid: recordId, a365_name: "Test leave", _a365_employee_value: employeeId,
  a365_leavetype: 749910002, a365_benefit: 749910000, a365_startdate: "2026-01-01T00:00:00+14:00", a365_enddate: "2026-01-01",
  a365_days: 1, a365_leavestatus: 749910001, a365_issuedon: "2026-01-01T00:00:00Z", a365_note: "Test note", a365_cancellationreason: "Test cancellation",
}
const emptyPage: PageData = { leaves: [], credits: [], conversions: [], employees: [] }
const originalScrollIntoView = Element.prototype.scrollIntoView
const originalHasPointerCapture = Element.prototype.hasPointerCapture
const originalSetPointerCapture = Element.prototype.setPointerCapture
const originalReleasePointerCapture = Element.prototype.releasePointerCapture

beforeAll(() => {
  // Browser APIs used by cmdk/Radix but absent from jsdom.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
afterAll(() => {
  vi.unstubAllGlobals()
  Element.prototype.scrollIntoView = originalScrollIntoView
  Element.prototype.hasPointerCapture = originalHasPointerCapture
  Element.prototype.setPointerCapture = originalSetPointerCapture
  Element.prototype.releasePointerCapture = originalReleasePointerCapture
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><LeavePage /></QueryClientProvider>)
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(access, { isAdmin: true, roleSettled: true, roleError: false })
  vi.mocked(leaveService.list).mockResolvedValue(emptyPage)
  vi.mocked(leaveService.searchEmployees).mockResolvedValue({ rows: [employee], next: undefined })
  vi.mocked(leaveService.balances).mockResolvedValue({ VL: 7.5, SL: 5, movements: 5 })
  vi.mocked(leaveService.detail).mockResolvedValue({ record, employees: [employee], actors: new Map() })
  vi.mocked(postingService.preview).mockImplementation(async values => {
    const balances = await leaveService.balances(values.employee?.a365_employeeid ?? "", 2026)
    const complete = Boolean(values.startDate && values.endDate && values.leaveType && values.benefit)
    return { policyVersion: "2026-10-22.1", periodStart: "2026-04-01", periodEnd: "2027-03-31", ...balances, pendingVL: 0, pendingSL: 0,
      days: complete ? 1 : null, benefit: complete ? Number(values.benefit) : null, pool: complete ? "VL" : null }
  })
  vi.mocked(postingService.submit).mockResolvedValue({ record: { ...record, a365_leavestatus: 749910000 }, notification: "accepted" })
})

describe("Leave access boundary", () => {
  it.each([
    { isAdmin: false, roleSettled: true, roleError: false, message: "Leave access denied" },
    { isAdmin: true, roleSettled: true, roleError: true, message: "Unable to verify Leave access" },
    { isAdmin: true, roleSettled: false, roleError: false, message: "Checking Leave access…" },
  ])("does not mount data-dependent screens for $message", state => {
    Object.assign(access, state)
    renderPage()
    expect(screen.getByText(state.message)).toBeVisible()
    expect(leaveService.list).not.toHaveBeenCalled()
    expect(leaveService.balances).not.toHaveBeenCalled()
    expect(leaveService.searchEmployees).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Add Leave" })).not.toBeInTheDocument()
  })
})

describe("Add Leave modal", () => {
  async function openModal() {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add Leave" }))
    return { user, dialog: screen.getByRole("dialog", { name: "Add Leave" }) }
  }

  async function completeForm(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Test Employee/ }))
    await user.type(within(dialog).getByLabelText("Start Date"), "2026-10-23")
    await user.type(within(dialog).getByLabelText("End Date"), "2026-10-23")
    await user.click(within(dialog).getByRole("combobox", { name: "Leave Type" }))
    await user.click(screen.getByRole("option", { name: "Emergency" }))
    await user.click(within(dialog).getByRole("combobox", { name: "Benefit" }))
    await user.click(screen.getByRole("option", { name: "Paid" }))
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Submit" })).toBeEnabled())
  }

  it("posts only after valid server preview, refreshes the list and closes on confirmed commit even when email fails", async () => {
    vi.mocked(postingService.submit).mockResolvedValue({ record: { ...record, a365_leavestatus: 749910000 }, notification: "failed" })
    const { user, dialog } = await openModal()
    await completeForm(user, dialog)
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add Leave" })).not.toBeInTheDocument())
    expect(postingService.submit).toHaveBeenCalledOnce()
    expect(leaveService.list).toHaveBeenCalledTimes(2)
  })

  it("keeps an uncertain request unchanged and reuses its operation identity on retry", async () => {
    vi.mocked(postingService.submit).mockRejectedValueOnce(new LeavePostingError("The save outcome is uncertain.", true))
    const { user, dialog } = await openModal()
    await completeForm(user, dialog)
    await user.click(within(dialog).getByRole("button", { name: "Submit" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The save outcome is uncertain")
    expect(within(dialog).getByLabelText("Note (optional)")).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(dialog).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Retry Submit" }))
    await waitFor(() => expect(postingService.submit).toHaveBeenCalledTimes(2))
    expect(vi.mocked(postingService.submit).mock.calls[0][1]).toBe(vi.mocked(postingService.submit).mock.calls[1][1])
  })

  it("opens labelled fields and an employee-specific picker without an All employees option", async () => {
    const { user, dialog } = await openModal()
    for (const name of ["Leave Type", "Benefit"]) expect(within(dialog).getByRole("combobox", { name })).toBeVisible()
    expect(within(dialog).getByLabelText("Start Date")).toBeVisible()
    expect(within(dialog).getByLabelText("End Date")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Submit" })).toBeDisabled()
    expect(within(dialog).getByText(/Full Monday–Friday workdays/)).toBeVisible()
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    expect(await screen.findByRole("option", { name: /Test Employee/ })).toBeVisible()
    expect(screen.queryByRole("option", { name: "All employees" })).not.toBeInTheDocument()
  })

  it("Cancel closes without submitting and reopening creates a fresh form", async () => {
    const { user, dialog } = await openModal()
    await user.type(within(dialog).getByLabelText("Note (optional)"), "Unsaved note")
    await user.type(within(dialog).getByLabelText("Start Date"), "2026-10-23")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Add Leave" })).not.toBeInTheDocument()
    expect(leaveService.balances).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Add Leave" }))
    const reopened = screen.getByRole("dialog", { name: "Add Leave" })
    expect(within(reopened).getByLabelText("Note (optional)")).toHaveValue("")
    expect(within(reopened).getByLabelText("Start Date")).toHaveValue("")
  })

  it("shows complete stored balances with two decimal places and a truthful period label", async () => {
    const { user, dialog } = await openModal()
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Test Employee/ }))
    expect(await within(dialog).findByText("7.50 days")).toBeVisible()
    expect(within(dialog).getByText("5.00 days")).toBeVisible()
    expect(within(dialog).getByText(/Balance period: Apr 1, 2026/)).toBeVisible()
    await user.type(within(dialog).getByLabelText("Start Date"), "2026-10-23")
    await user.type(within(dialog).getByLabelText("End Date"), "2026-10-23")
    await user.click(within(dialog).getByRole("combobox", { name: "Leave Type" }))
    await user.click(screen.getByRole("option", { name: "Emergency" }))
    await user.click(within(dialog).getByRole("combobox", { name: "Benefit" }))
    await user.click(screen.getByRole("option", { name: "Paid" }))
    expect(await within(dialog).findByText("1.00 days will be deducted from VL.")).toBeVisible()
    await user.click(within(dialog).getByRole("combobox", { name: "Benefit" }))
    await user.click(screen.getByRole("option", { name: "Unpaid" }))
    expect(await within(dialog).findByText("This request will be Unpaid; no credits will be deducted.")).toBeVisible()
  })

  it("retains entries and blocks submission when balance reads fail", async () => {
    vi.mocked(leaveService.balances).mockRejectedValueOnce(new Error("Sensitive response"))
    const { user, dialog } = await openModal()
    await user.type(within(dialog).getByLabelText("Note (optional)"), "Keep this note")
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Test Employee/ }))
    expect(await within(dialog).findByText(/Employee credits are unavailable/)).toBeVisible()
    expect(within(dialog).queryByText("0.00 days")).not.toBeInTheDocument()
    expect(within(dialog).queryByText("Sensitive response")).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText("Note (optional)")).toHaveValue("Keep this note")
    expect(within(dialog).getByRole("button", { name: "Submit" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Retry employee credits" }))
    expect(await within(dialog).findByText("7.50 days")).toBeVisible()
  })

  it("shows a reversed-date error without clearing the form", async () => {
    const { user, dialog } = await openModal()
    await user.type(within(dialog).getByLabelText("Start Date"), "2026-10-23")
    await user.type(within(dialog).getByLabelText("End Date"), "2026-10-22")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("End Date cannot precede Start Date.")
    expect(within(dialog).getByLabelText("Start Date")).toHaveValue("2026-10-23")
    expect(within(dialog).getByRole("button", { name: "Submit" })).toBeDisabled()
  })

  it("does not replace the selected employee's credits with an older employee response", async () => {
    let completeFirst!: (value: { VL: number; SL: number; movements: number }) => void
    const pending = new Promise<{ VL: number; SL: number; movements: number }>(resolve => { completeFirst = resolve })
    const second = { ...employee, a365_employeeid: "30000000-0000-0000-0000-000000000003", a365_name: "Second Employee" }
    vi.mocked(leaveService.searchEmployees).mockResolvedValue({ rows: [employee, second], next: undefined })
    vi.mocked(leaveService.balances).mockImplementation(id => id === employeeId ? pending : Promise.resolve({ VL: 2, SL: 3, movements: 2 }))
    const { user, dialog } = await openModal()
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Test Employee/ }))
    expect(within(dialog).getByRole("status", { name: "Loading employee credits" })).toBeVisible()
    await user.click(within(dialog).getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Second Employee/ }))
    expect(await within(dialog).findByText("2.00 days")).toBeVisible()
    await act(async () => completeFirst({ VL: 99, SL: 99, movements: 1 }))
    expect(within(dialog).queryByText("99.00 days")).not.toBeInTheDocument()
    expect(within(dialog).getByText("2.00 days")).toBeVisible()
  })

  it("rechecks access on a programmatic submit and retains entered values", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><AddLeaveDialog open onOpenChange={vi.fn()} /></QueryClientProvider>)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Note (optional)"), "Keep this")
    Object.assign(access, { roleError: true })
    // Exercise the native submit event even though the UI button is disabled.
    act(() => (screen.getByRole("form", { name: "Add Leave form" }) as HTMLFormElement).requestSubmit())
    expect(screen.getByRole("alert")).toHaveTextContent("Your Leave access could not be verified")
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Keep this")
  })
})

describe("Leave workspace", () => {
  it("shows loading and verified empty states with clearly unavailable posting actions", async () => {
    vi.mocked(leaveService.list).mockReturnValue(new Promise(() => {}))
    const view = renderPage()
    expect(screen.getByRole("status", { name: "Loading leave records" })).toBeVisible()
    expect(screen.getByText("Admins record leave directly.")).toBeVisible()
    expect(screen.queryByRole("button", { name: /issue leave/i })).not.toBeInTheDocument()
    view.unmount()
    vi.mocked(leaveService.list).mockResolvedValue(emptyPage)
    renderPage()
    expect(await screen.findByText(/No leave records match/)).toBeVisible()
    expect(screen.getByText(/Select an employee to view/)).toBeVisible()
    expect(leaveService.balances).not.toHaveBeenCalled()
  })
  it("shows a safe retryable error without backend details", async () => {
    vi.mocked(leaveService.list).mockRejectedValueOnce(new Error("Sensitive backend response"))
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load leave records")
    expect(screen.queryByText("Sensitive backend response")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Retry records" }))
    expect(await screen.findByText(/No leave records match/)).toBeVisible()
  })
  it("applies year/search on the server and no longer offers a Credit History tab", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table", { name: "Leave records" })
    await user.clear(screen.getByRole("spinbutton", { name: "Year" }))
    await user.type(screen.getByRole("spinbutton", { name: "Year" }), "2025")
    await user.type(screen.getByRole("searchbox", { name: "Search record name" }), "Test")
    await user.click(screen.getByRole("button", { name: "Apply filters" }))
    await waitFor(() => expect(leaveService.list).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2025, search: "Test" }), undefined))
    expect(screen.queryByRole("tab", { name: "Credit History" })).not.toBeInTheDocument()
    expect(leaveService.list).toHaveBeenLastCalledWith(expect.objectContaining({ section: "leave" }), undefined)
  })
  it("loads next/previous pages and opens an accessible historical details dialog", async () => {
    const user = userEvent.setup()
    vi.mocked(leaveService.list).mockImplementation(async (_filters, cursor) => cursor
      ? { ...emptyPage, leaves: [{ ...record, a365_leaveid: "30000000-0000-0000-0000-000000000003", a365_name: "Second record" }], employees: [employee] }
      : { ...emptyPage, leaves: [record], employees: [employee], next: "second" })
    renderPage()
    await user.click(await screen.findByRole("button", { name: "View Test leave" }))
    const dialog = await screen.findByRole("dialog", { name: "Leave details" })
    expect(await within(dialog).findByText("Test note")).toBeVisible()
    expect(within(dialog).getByText("Test cancellation")).toBeVisible()
    expect(within(dialog).getAllByText("Jan 1, 2026")).toHaveLength(2)
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("Second record")).toBeVisible()
    expect(leaveService.list).toHaveBeenLastCalledWith(expect.anything(), "second")
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(await screen.findByText("Test leave")).toBeVisible()
  })
  it("shows unavailable balances after a read error, and only shows zero for verified empty history", async () => {
    const user = userEvent.setup()
    vi.mocked(leaveService.balances).mockRejectedValueOnce(new Error("Permission denied"))
    renderPage()
    await user.click(screen.getByRole("combobox", { name: "Employee" }))
    await user.click(await screen.findByRole("option", { name: /Test Employee/ }))
    expect(await screen.findByText(/Balances unavailable/)).toBeVisible()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    vi.mocked(leaveService.balances).mockResolvedValueOnce({ VL: 0, SL: 0, movements: 0 })
    await user.click(screen.getByRole("button", { name: "Retry balances" }))
    expect(await screen.findByText(/No recorded credit movements/)).toBeVisible()
    expect(screen.getByRole("region", { name: "Leave balances" })).toBeVisible()
  })
})
