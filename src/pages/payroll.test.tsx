import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import PayrollDashboardPage from "./payroll"
import { payrollPeriodService } from "@/features/payroll/services/payroll-period-service"
import { createPayrollWorkbook, downloadBlob } from "@/features/payroll/payroll-export"
import { PayrollStatus } from "@/features/payroll/period-status"
import type { PayrollEntry, PayrollPeriod } from "@/features/payroll/types"

vi.mock("@/features/payroll/services/payroll-period-service", () => ({
  payrollPeriodService: {
    listPeriods: vi.fn(), listArchivedPeriods: vi.fn(), listEntriesForExport: vi.fn(),
    archivePeriod: vi.fn(), unarchivePeriod: vi.fn(),
  },
}))
vi.mock("@/hooks/use-power-context", () => ({
  usePowerContext: () => ({ data: { user: { fullName: "Test Admin" } } }),
}))
vi.mock("@/features/payroll/hooks/use-access-profile", () => ({
  useAccessProfile: () => ({ isAdmin: true }),
}))
vi.mock("@/features/payroll/payroll-export", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/payroll/payroll-export")>(),
  createPayrollWorkbook: vi.fn(), downloadBlob: vi.fn(),
}))

function period(id: string, archived = false): PayrollPeriod {
  return {
    a365_payrollperiodid: id, a365_name: id,
    a365_periodstart: "2026-10-01", a365_periodend: "2026-10-15", a365_paydate: "2026-10-15",
    a365_payrollstatus: PayrollStatus.Locked, statecode: archived ? 1 : 0,
  }
}

const active = period("Active cutoff")
const archived = Array.from({ length: 7 }, (_, index) => period(`Archived cutoff ${index + 1}`, true))
const entry: PayrollEntry = {
  a365_payrollentryid: "entry-1", a365_name: "Test entry", a365_isincluded: true,
  a365_employeename: "Test Employee", _a365_employee_value: "employee-1",
  a365_basicpay: 1000, a365_allowances: 0, a365_otherearnings: 0,
  a365_otherdeductions: 0, a365_unpaidleavedays: 0, a365_withholdingtax: 0,
  a365_grosspay: 1000, a365_sss: 0, a365_philhealth: 0, a365_hdmf: 0,
  a365_unpaidleave: 0, a365_totaldeductions: 0, a365_netpay: 1000,
  a365_calculatedon: null, a365_comment: null,
}

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><MemoryRouter><PayrollDashboardPage /></MemoryRouter></QueryClientProvider>)
  await screen.findByRole("table", { name: "Archived payroll periods" })
  await screen.findByRole("table", { name: "Active payroll periods" })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(payrollPeriodService.listPeriods).mockResolvedValue([active])
  vi.mocked(payrollPeriodService.listArchivedPeriods).mockResolvedValue(archived)
  vi.mocked(payrollPeriodService.listEntriesForExport).mockImplementation(async (ids) => new Map(ids.map((id) => [id, [entry]])))
  vi.mocked(createPayrollWorkbook).mockResolvedValue(new Blob(["workbook"]))
  vi.mocked(payrollPeriodService.unarchivePeriod).mockResolvedValue(undefined)
})

describe("Archived payroll export", () => {
  it("offers Delete only for Processing periods in active and archived lists", async () => {
    vi.mocked(payrollPeriodService.listPeriods).mockResolvedValue([active, { ...period("Processing cutoff"), a365_payrollstatus: PayrollStatus.Processing }])
    vi.mocked(payrollPeriodService.listArchivedPeriods).mockResolvedValue([archived[0], { ...period("Archived processing", true), a365_payrollstatus: PayrollStatus.Processing }])
    await renderPage()
    expect(screen.getByRole("button", { name: "Delete Processing cutoff" })).toHaveAttribute("title", "Delete")
    expect(screen.getByRole("button", { name: "Delete Archived processing" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Delete Active cutoff" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete Archived cutoff 1" })).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Delete Processing cutoff" }))
    expect(screen.getByRole("dialog", { name: "Delete this payroll period?" })).toHaveTextContent("Processing cutoff")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("uses icon-only Archive and Unarchive actions with hover and accessible labels", async () => {
    await renderPage()
    const archive = screen.getByRole("button", { name: "Archive Active cutoff" })
    const unarchive = screen.getByRole("button", { name: "Unarchive Archived cutoff 1" })
    expect(archive).toHaveAttribute("title", "Archive")
    expect(unarchive).toHaveAttribute("title", "Unarchive")
    expect(archive.textContent).toBe("")
    expect(unarchive.textContent).toBe("")
  })
  it("places export beside Unarchive under the Action header", async () => {
    await renderPage()
    for (const name of ["Active payroll periods", "Archived payroll periods"]) {
      expect(within(screen.getByRole("table", { name })).getByRole("columnheader", { name: "Action" })).toBeVisible()
    }
    const actionCell = within(screen.getByRole("table", { name: "Archived payroll periods" }))
      .getAllByRole("cell")
      .find((cell) => within(cell).queryByRole("button", { name: "Export Archived cutoff 1 to Excel" }))!
    expect(within(actionCell).getByRole("button", { name: "Export Archived cutoff 1 to Excel" })).toBeInTheDocument()
    expect(within(actionCell).getByRole("button", { name: "Unarchive Archived cutoff 1" })).toBeInTheDocument()
  })

  it("exports exactly the checked archived periods independently of active selections", async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole("checkbox", { name: "Select Active cutoff" }))
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 1" }))
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 3" }))
    const selection = screen.getByRole("region", { name: "Archived payroll selection" })
    expect(within(selection).getByText("2 archived periods selected")).toBeInTheDocument()
    await user.click(within(selection).getByRole("button", { name: "Export to Excel" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    expect(payrollPeriodService.listEntriesForExport).toHaveBeenCalledWith(
      ["Archived cutoff 1", "Archived cutoff 3"], expect.any(Function),
    )
    expect(createPayrollWorkbook).toHaveBeenCalledWith(
      [archived[0], archived[2]], expect.arrayContaining([
        expect.objectContaining({ periodId: "Archived cutoff 1", netPay: 1000 }),
        expect.objectContaining({ periodId: "Archived cutoff 3", netPay: 1000 }),
      ]), expect.any(Array), "Test Admin",
    )
    expect(payrollPeriodService.unarchivePeriod).not.toHaveBeenCalled()
  })

  it("selects only the current page and preserves choices on other pages", async () => {
    const user = userEvent.setup()
    await renderPage()
    const selectAll = () => screen.getByRole("checkbox", { name: "Select all archived periods on this page" })
    await user.click(selectAll())
    expect(selectAll()).toBeChecked()
    expect(screen.getByText("6 archived periods selected")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(selectAll()).not.toBeChecked()
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 7" }))
    expect(screen.getByText("7 archived periods selected")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(selectAll()).toBeChecked()
    await user.click(selectAll())
    expect(screen.getByText("1 archived periods selected")).toBeInTheDocument()
    const selection = screen.getByRole("region", { name: "Archived payroll selection" })
    await user.click(within(selection).getByRole("button", { name: "Export to Excel" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    expect(payrollPeriodService.listEntriesForExport).toHaveBeenCalledWith(["Archived cutoff 7"], expect.any(Function))
  })

  it("shows partial selection and clears archived choices without clearing active choices", async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole("checkbox", { name: "Select Active cutoff" }))
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 1" }))
    expect(screen.getByRole("checkbox", { name: "Select all archived periods on this page" })).toHaveAttribute("aria-checked", "mixed")
    await user.click(within(screen.getByRole("region", { name: "Archived payroll selection" })).getByRole("button", { name: "Clear" }))
    expect(screen.queryByRole("region", { name: "Archived payroll selection" })).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 1" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Active cutoff" })).toBeChecked()
  })

  it("keeps row export scoped to that row even when other archived periods are checked", async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 1" }))
    await user.click(screen.getByRole("button", { name: "Export Archived cutoff 2 to Excel" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
    expect(payrollPeriodService.listEntriesForExport).toHaveBeenCalledWith(["Archived cutoff 2"], expect.any(Function))
  })

  it("removes a restored period from the archived selection", async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole("checkbox", { name: "Select archived Archived cutoff 1" }))
    await user.click(screen.getByRole("button", { name: "Unarchive Archived cutoff 1" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unarchive" }))
    await waitFor(() => expect(payrollPeriodService.unarchivePeriod).toHaveBeenCalledWith("Archived cutoff 1"))
    await waitFor(() => expect(screen.queryByRole("region", { name: "Archived payroll selection" })).not.toBeInTheDocument())
  })
})
