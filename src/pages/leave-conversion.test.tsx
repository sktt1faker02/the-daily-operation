import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LeaveConversionPage from "./leave-conversion"
import { conversionService } from "@/features/leave/conversion-service"
import type { ConversionPage } from "@/features/leave/conversion-types"

const access = vi.hoisted(() => ({ isAdmin: true, roleSettled: true, roleError: false }))
vi.mock("@/features/payroll/hooks/use-access-profile", () => ({ useAccessProfile: () => access }))
vi.mock("@/features/leave/conversion-service", async original => ({ ...await original<typeof import("@/features/leave/conversion-service")>(), conversionService: { years: vi.fn(), create: vi.fn(), rows: vi.fn(), save: vi.fn(), markPaid: vi.fn() } }))
const transaction = { id: "10000000-0000-0000-0000-000000000001", year: 2026, version: "1", paid: false }
const row = { id: "20000000-0000-0000-0000-000000000002", employeeId: "30000000-0000-0000-0000-000000000003", employeeName: "Test Employee", employeeNumber: "EMP-01", dailyRate: 2272.73, availableVL: 10, days: 5, amount: 11363.65 }
const page: ConversionPage = { transaction, rows: [row] }
const NativeRequest = Request
beforeAll(() => {
  // Node's Request rejects jsdom's AbortSignal. No network requests are made
  // by this memory router; keep request construction compatible at the boundary.
  vi.stubGlobal("Request", class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }) }
  })
})
afterAll(() => vi.unstubAllGlobals())
function renderPage(path = "/leave-conversion/2026") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createMemoryRouter([{ path: "/leave-conversion", element: <LeaveConversionPage /> }, { path: "/leave-conversion/:year", element: <LeaveConversionPage /> }], { initialEntries: [path] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(access, { isAdmin: true, roleSettled: true, roleError: false })
  vi.spyOn(window, "confirm").mockReturnValue(true)
  vi.mocked(conversionService.years).mockResolvedValue({ years: [transaction], nextYear: 2027 })
  vi.mocked(conversionService.create).mockResolvedValue({ ...transaction, year: 2027 })
  vi.mocked(conversionService.rows).mockResolvedValue(page)
  vi.mocked(conversionService.save).mockResolvedValue({ ...transaction, version: "2" })
})
async function edit() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "Edit Test Employee" }))
  return user
}
describe("Leave Conversion", () => {
  it("confirms marking the whole year paid and locks editing after success", async () => {
    const paidTransaction = { ...transaction, paid: true, version: "2" }
    vi.mocked(conversionService.markPaid).mockImplementation(async () => {
      vi.mocked(conversionService.rows).mockResolvedValue({ ...page, transaction: paidTransaction })
      return paidTransaction
    })
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Mark as paid" }))
    const dialog = await screen.findByRole("dialog", { name: "Mark this leave conversion Paid?" })
    expect(dialog).toHaveTextContent("2026 leave conversion has been paid out")
    expect(conversionService.markPaid).not.toHaveBeenCalled()
    expect(window.confirm).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Paid" }))
    expect(conversionService.markPaid).toHaveBeenCalledWith(transaction)
    expect(await screen.findByRole("button", { name: "Paid (locked)" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Edit Test Employee" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
  })
  it("retains an unpaid year on failure and allows retry; cancellation writes nothing", async () => {
    vi.mocked(conversionService.markPaid).mockRejectedValue(new Error("Payment status could not be saved."))
    renderPage()
    const button = await screen.findByRole("button", { name: "Mark as paid" })
    await userEvent.click(button)
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    expect(conversionService.markPaid).not.toHaveBeenCalled()
    await userEvent.click(button)
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Paid" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Payment status could not be saved")
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(button).toBeEnabled()
    expect(screen.getByRole("button", { name: "Edit Test Employee" })).toBeEnabled()
  })
  it("keeps the confirmation open and prevents duplicate submits or dismissal while saving", async () => {
    let rejectPayment: (error: Error) => void = () => {}
    vi.mocked(conversionService.markPaid).mockImplementation(() => new Promise((_resolve, reject) => { rejectPayment = reject }))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Mark as paid" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Paid" }))
    expect(within(dialog).getByRole("button", { name: "Marking as paid…" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    await userEvent.keyboard("{Escape}")
    expect(dialog).toBeVisible()
    expect(conversionService.markPaid).toHaveBeenCalledTimes(1)
    rejectPayment(new Error("Try again."))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Try again")
  })
  it("blocks payment while a row is being edited or has unsaved changes", async () => {
    renderPage(); const user = await edit()
    expect(screen.getByRole("button", { name: "Mark as paid" })).toBeDisabled()
    const days = screen.getByRole("spinbutton", { name: "VL to convert for Test Employee" })
    await user.clear(days); await user.type(days, "3"); await user.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.getByRole("button", { name: "Mark as paid" })).toBeDisabled()
    expect(conversionService.markPaid).not.toHaveBeenCalled()
  })
  it("explains a failed year load and enables creation after Retry succeeds", async () => {
    vi.mocked(conversionService.years).mockRejectedValueOnce(new Error("Leave Conversion server update has not been deployed."))
    renderPage("/leave-conversion")
    expect(await screen.findByRole("alert")).toHaveTextContent("server update has not been deployed")
    expect(screen.getByRole("button", { name: "Add new transaction" })).toBeDisabled()
    expect(conversionService.create).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("table", { name: "Leave conversion years" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Add new transaction" })).toBeEnabled()
  })
  it("opens a stored year and recovers its employee records after a failed load", async () => {
    vi.mocked(conversionService.rows).mockRejectedValueOnce(new Error("Leave Conversion server update has not been deployed."))
    const router = renderPage("/leave-conversion")
    await userEvent.click(await screen.findByRole("link", { name: "View employees" }))
    expect(router.state.location.pathname).toBe("/leave-conversion/2026")
    expect(await screen.findByRole("alert")).toHaveTextContent("server update has not been deployed")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("button", { name: "Edit Test Employee" })).toBeEnabled()
    expect(conversionService.rows).toHaveBeenLastCalledWith(2026, undefined)
  })
  it("uses automatic next year, confirms creation and navigates after the service succeeds", async () => {
    const router = renderPage("/leave-conversion")
    expect(await screen.findByRole("table", { name: "Leave conversion years" })).toBeVisible()
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open year" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Add new transaction" }))
    const dialog = await screen.findByRole("dialog", { name: "Add new leave conversion?" })
    expect(dialog).toHaveTextContent("2027 transaction")
    expect(conversionService.create).not.toHaveBeenCalled()
    expect(window.confirm).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Add new transaction" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/leave-conversion/2027"))
    expect(conversionService.create).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/), 2027)
  })
  it("cancels new conversion creation without writing and keeps failures retryable in the dialog", async () => {
    vi.mocked(conversionService.create).mockRejectedValueOnce(new Error("Creation failed."))
    renderPage("/leave-conversion")
    await screen.findByRole("table", { name: "Leave conversion years" })
    await userEvent.click(screen.getByRole("button", { name: "Add new transaction" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    expect(conversionService.create).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Add new transaction" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Add new transaction" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Creation failed")
    await userEvent.click(within(dialog).getByRole("button", { name: "Add new transaction" }))
    expect(await screen.findByRole("table", { name: "Employee conversions" })).toBeVisible()
    expect(vi.mocked(conversionService.create).mock.calls[0]).toEqual(vi.mocked(conversionService.create).mock.calls[1])
  })
  it("edits only the two VL inputs, validates and recalculates, and Cancel restores the row", async () => {
    renderPage()
    const user = await edit()
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Refresh balances" })).not.toBeInTheDocument()
    const days = screen.getByRole("spinbutton", { name: "VL to convert for Test Employee" })
    await user.clear(days); await user.type(days, "6")
    expect(screen.getByRole("alert")).toHaveTextContent("cannot exceed 5.00")
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    await user.clear(days); await user.type(days, "2.5")
    expect(screen.getByText("₱5,681.83")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("₱11,363.65")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })
  it("retains edits after failure and saves again without losing them", async () => {
    vi.mocked(conversionService.save).mockRejectedValueOnce(new Error("Save failed. Retry."))
    renderPage(); const user = await edit()
    const days = screen.getByRole("spinbutton", { name: "VL to convert for Test Employee" })
    await user.clear(days); await user.type(days, "3"); await user.click(screen.getByRole("button", { name: "Done" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed")
    expect(screen.getByText("Unsaved changes")).toBeVisible()
    expect(screen.getByText("3.00")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument())
    expect(conversionService.save).toHaveBeenLastCalledWith(transaction, [{ id: row.id, employeeId: row.employeeId, availableVL: 10, days: 3 }])
  })
  it("prompts on internal navigation and keeps edits when navigation is cancelled", async () => {
    const router = renderPage(); const user = await edit()
    const available = screen.getByRole("spinbutton", { name: "Available VL for Test Employee" })
    await user.clear(available); await user.type(available, "9"); await user.click(screen.getByRole("button", { name: "Done" }))
    await user.click(screen.getByRole("link", { name: "Leave Conversion" }))
    const dialog = await screen.findByRole("dialog", { name: "Leave without saving?" })
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }))
    expect(router.state.location.pathname).toBe("/leave-conversion/2026")
    expect(screen.getByText("9.00")).toBeVisible()
  })
  it("retains confirmed row edits while paging", async () => {
    vi.mocked(conversionService.rows).mockImplementation(async (_year, cursor) => cursor ? { transaction, rows: [{ ...row, id: "40000000-0000-0000-0000-000000000004", employeeName: "Second Employee" }] } : { ...page, next: "page2" })
    renderPage(); const user = await edit(); const days = screen.getByRole("spinbutton", { name: "VL to convert for Test Employee" })
    await user.clear(days); await user.type(days, "1"); await user.click(screen.getByRole("button", { name: "Done" }))
    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("Second Employee")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(screen.getByText("1.00")).toBeVisible()
  })
  it("does not mount data queries for non-admins", () => {
    access.isAdmin = false; renderPage()
    expect(screen.getByRole("alert")).toHaveTextContent("Leave access denied")
    expect(conversionService.rows).not.toHaveBeenCalled()
    expect(conversionService.years).not.toHaveBeenCalled()
  })
})
