import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import LedgerPage from "./ledger"
import { LedgerOnly } from "@/features/accounting/ledger/ledger-access"
import { ledgerService, LedgerError } from "@/features/accounting/ledger/ledger-service"
import { categoryLabels } from "@/features/accounting/ledger/rules"
import type { LedgerPage as PageData } from "@/features/accounting/ledger/types"
vi.mock("@/features/accounting/ledger/ledger-service", async original => ({ ...await original<typeof import("@/features/accounting/ledger/ledger-service")>(), ledgerService: { list: vi.fn(), jobs: vi.fn(), save: vi.fn(), delete: vi.fn(), preview: vi.fn(), export: vi.fn() } }))
const access = vi.hoisted(() => ({ roleSettled: true, roleError: false, roleNames: ["A365 - Payroll Admin"] }))
vi.mock("@/features/payroll/hooks/use-access-profile", () => ({ useAccessProfile: () => access }))
const page: PageData = { rows: [{ id: "row1", date: "2026-11-03", receipt: "0001", reference: "", direction: "debit", amount: 100, category: 0, description: "Internet", version: "1", periodId: null, employeeId: null, entryId: null, periodName: null, reopened: false, postedOn: null, postedBy: null }], totals: { count: 100, debit: 1000, credit: 2000, net: 1000 }, balance: 9000, next: "page2", revision: "1", categories: categoryLabels.map((label, value) => ({ label, value })) }
function mount(gated = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/ledger"]}><Routes><Route path="/ledger" element={gated ? <LedgerOnly><LedgerPage /></LedgerOnly> : <LedgerPage />} /><Route path="/my-payroll" element={<p>Employee portal</p>} /></Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks(); Object.assign(access, { roleSettled: true, roleError: false, roleNames: ["A365 - Payroll Admin"] })
  vi.mocked(ledgerService.list).mockResolvedValue(page)
  vi.mocked(ledgerService.jobs).mockResolvedValue({ jobs: [] })
  vi.mocked(ledgerService.preview).mockResolvedValue({ periods: [], manual: [], missing: 0, revision: "1" })
})
describe("Ledger", () => {
  it("keeps the record fields and company balance while simplifying the view", async () => {
    const user = userEvent.setup(); mount()
    const table = await screen.findByRole("table", { name: "Ledger records" })
    for (const name of ["Date", "OR Number", "Reference", "Debit (Money out)", "Credit (Money in)", "Chart of Account", "Description", "Action"]) expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument()
    expect(within(table).getByText("0001")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Ledger" })).toBeVisible()
    expect(screen.queryByText(/Filtered Money|Filtered net movement|Company balance covers/)).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Direction" })).not.toBeInTheDocument()
    expect(screen.getByText(/9,000\.00/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Next" }))
    await waitFor(() => expect(ledgerService.list).toHaveBeenCalledWith(expect.anything(), "page2"))
    expect(screen.getByText("Company balance")).toBeInTheDocument()
    await user.type(screen.getByRole("textbox", { name: "Search" }), "Internet")
    await user.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() => expect(ledgerService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Internet", direction: "" }), undefined))
    expect(screen.getByText(/9,000\.00/)).toBeVisible()
  })
  it("opens HTTPS references in a new tab with keyboard access", async () => {
    const reference = "https://example.com/receipt?id=0001&year=2026"
    vi.mocked(ledgerService.list).mockResolvedValue({ ...page, rows: [{ ...page.rows[0], reference }] })
    const user = userEvent.setup(); mount()
    const link = await screen.findByRole("link")
    expect(link).toHaveAccessibleName(reference + " (opens in a new tab)")
    expect(link).toHaveAttribute("href", reference)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    link.focus(); await user.tab({ shift: true }); await user.tab()
    expect(link).toHaveFocus()
  })
  it.each(["Invoice 0001", "javascript:alert(1)", "data:text/html,test", "http://example.com", "https://", "https://bad host", "//example.com", ""])("keeps non-HTTPS or invalid references as text: %s", async reference => {
    vi.mocked(ledgerService.list).mockResolvedValue({ ...page, rows: [{ ...page.rows[0], reference }] })
    mount()
    const table = await screen.findByRole("table", { name: "Ledger records" })
    expect(within(table).queryByRole("link")).not.toBeInTheDocument()
    const row = within(table).getAllByRole("row")[1]
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent(reference || "\u2014")
  })
  it("shows loading, empty and filtered-empty states", async () => {
    vi.mocked(ledgerService.list).mockResolvedValue({ ...page, rows: [], next: null }); const user = userEvent.setup(); mount()
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading ledger")
    await screen.findByText(/No ledger records yet/)
    await user.type(screen.getByRole("textbox", { name: "Search" }), "none"); await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(await screen.findByText(/No records match/)).toBeInTheDocument()
  })
  it("retains form values after a failed save and requires a confirmation before deleting", async () => {
    vi.mocked(ledgerService.save).mockRejectedValueOnce(new LedgerError("Review the amount."))
    const user = userEvent.setup(); mount(); await screen.findByRole("table")
    await user.click(screen.getByRole("button", { name: "Edit Internet" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Save record" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Review the amount")
    expect(within(dialog).getByLabelText("OR Number (optional)")).toHaveValue("0001")
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Internet")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Delete Internet" }))
    expect(ledgerService.delete).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toHaveTextContent("changes the recorded company balance")
  })
  it("shows errors and retries without displaying raw backend details", async () => {
    vi.mocked(ledgerService.list).mockRejectedValueOnce(new LedgerError("Unable to load records."))
    const user = userEvent.setup(); mount(); expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load records")
    await user.click(screen.getByRole("button", { name: "Retry ledger" })); expect(await screen.findByRole("table")).toBeInTheDocument()
  })
  it.each([[], ["A365 - Payroll Employee"], ["System Administrator"]])("rejects an unauthorized route before data requests: %s", async (...roles) => {
    access.roleNames = roles.flat(); mount(true)
    expect(await screen.findByText("Employee portal")).toBeInTheDocument(); expect(ledgerService.list).not.toHaveBeenCalled()
  })
  it("hides the completed historical-posting indicator", async () => {
    mount(); await screen.findByRole("table", { name: "Ledger records" })
    await waitFor(() => expect(screen.queryByRole("button", { name: "Post previous paid payroll" })).not.toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "All previous paid payroll has been posted" })).not.toBeInTheDocument()
  })
  it("keeps historical posting available when missing work remains", async () => {
    vi.mocked(ledgerService.preview).mockResolvedValue({ periods: [{ id: "period1", name: "Missing period", employees: 1, missing: 1, total: 100, error: null }], manual: [], missing: 1, revision: "1" })
    mount()
    expect(await screen.findByRole("button", { name: "Post previous paid payroll" })).toBeEnabled()
  })
})
