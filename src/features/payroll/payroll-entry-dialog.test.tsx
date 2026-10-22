import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { employeeService } from "@/features/employees/employee-service"
import type { Employee } from "@/features/employees/types"
import { WhoAmIService } from "@/generated/services/WhoAmIService"
import { getStatutoryConfig } from "./services/statutory-config-service"
import { saveAndCalculateEntry } from "./services/payroll-service"
import type { StatutoryConfig } from "./services/payroll-calculation"
import { PayrollEntryDialog } from "./payroll-entry-dialog"
import type { PayrollEntry } from "./types"
import { payrollUnpaidLeaveService } from "@/features/leave/payroll-unpaid-leave"
vi.mock("@/features/leave/payroll-unpaid-leave", () => ({ payrollUnpaidLeaveService: { daysForEmployees: vi.fn() } }))

vi.mock("@/features/employees/employee-service", () => ({ employeeService: { get: vi.fn() } }))
vi.mock("./services/statutory-config-service", () => ({ getStatutoryConfig: vi.fn() }))
vi.mock("./services/payroll-service", () => ({ saveAndCalculateEntry: vi.fn() }))
vi.mock("@/generated/services/WhoAmIService", () => ({ WhoAmIService: { WhoAmI: vi.fn() } }))

const config: StatutoryConfig = {
  sss: [{ compensationFrom: 0, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3500, ecAmount: 30 }],
  philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 },
  hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 },
  taxBrackets: [],
}

const entry: PayrollEntry = {
  a365_payrollentryid: "entry-1", a365_name: "Test payroll", a365_employeename: "Test Employee",
  a365_isincluded: true, _a365_employee_value: "employee-1",
  a365_basicpay: 40000, a365_allowances: 1000, a365_otherearnings: 0,
  a365_otherdeductions: 5000, a365_unpaidleavedays: 0, a365_withholdingtax: 0,
  a365_grosspay: 41000, a365_sss: 875, a365_philhealth: 625, a365_hdmf: 100,
  a365_unpaidleave: 0, a365_totaldeductions: 6600, a365_netpay: 34400,
  a365_calculatedon: "2026-10-20T00:00:00Z", a365_comment: "Late",
}

function renderDialog(selectedEntry = entry, open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const onOpenChange = vi.fn()
  const result = render(
    <QueryClientProvider client={client}>
      <PayrollEntryDialog open={open} onOpenChange={onOpenChange} entry={selectedEntry}
        periodId="period-1" periodStartDate="2026-10-01" periodEndDate="2026-10-15" editable />
    </QueryClientProvider>,
  )
  return { ...result, onOpenChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockResolvedValue(new Map([["employee-1", 0]]))
  vi.mocked(employeeService.get).mockResolvedValue({ a365_employeeid: "employee-1", a365_basicmonthlysalary: 50000 } as Employee)
  vi.mocked(getStatutoryConfig).mockResolvedValue(config)
  vi.mocked(WhoAmIService.WhoAmI).mockResolvedValue({ success: true, data: { UserId: "admin-1" } })
  vi.mocked(saveAndCalculateEntry).mockResolvedValue(undefined)
})

describe("PayrollEntryDialog live calculation", () => {
  it("loads 2 unpaid days into the editor and calculation, without writing until Save", async () => {
    vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockResolvedValue(new Map([["employee-1", 2]]))
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Unpaid Leave (days)" })).toHaveValue(2))
    await screen.findByText(/2.00 unpaid leave days recorded/)
    expect(saveAndCalculateEntry).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(saveAndCalculateEntry).toHaveBeenCalledWith("entry-1", "period-1", "2026-10-15", "admin-1", expect.objectContaining({ a365_unpaidleavedays: "2" })))
  })

  it("preserves a manual adjustment after automatic Leave loading", async () => {
    vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockResolvedValue(new Map([["employee-1", 2]]))
    const user = userEvent.setup()
    renderDialog()
    const input = screen.getByRole("spinbutton", { name: "Unpaid Leave (days)" })
    await waitFor(() => expect(input).toHaveValue(2))
    await user.clear(input)
    await user.type(input, "1.5")
    expect(input).toHaveValue(1.5)
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(saveAndCalculateEntry).toHaveBeenCalledWith("entry-1", "period-1", "2026-10-15", "admin-1", expect.objectContaining({ a365_unpaidleavedays: "1.5" })))
  })

  it("blocks saving on Leave read failure and allows retry", async () => {
    vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue(new Map([["employee-1", 2]]))
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText(/Unable to load unpaid leave/)
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Retry unpaid leave" }))
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Unpaid Leave (days)" })).toHaveValue(2))
    expect(saveAndCalculateEntry).not.toHaveBeenCalled()
  })
  it("updates deductions and net pay before saving, without writing or reloading on each keystroke", async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("₱34,400.00")
    const deductions = screen.getByRole("spinbutton", { name: "Other Deductions" })
    await user.clear(deductions)
    await user.type(deductions, "2000")
    expect(screen.getByText("₱3,600.00")).toBeInTheDocument()
    expect(screen.getByText("₱37,400.00")).toBeInTheDocument()
    expect(saveAndCalculateEntry).not.toHaveBeenCalled()
    expect(employeeService.get).toHaveBeenCalledTimes(1)
    expect(getStatutoryConfig).toHaveBeenCalledTimes(1)
    expect(getStatutoryConfig).toHaveBeenCalledWith("2026-10-15")
  })

  it.each([
    ["Basic Pay", "42000", "₱36,400.00"],
    ["Allowances", "2000", "₱35,400.00"],
    ["Other Earnings", "500", "₱34,900.00"],
    ["Withholding Tax", "1000", "₱33,400.00"],
    ["Unpaid Leave (days)", "0.5", "₱33,263.63"],
  ])("previews changes to %s using the existing calculation rules", async (label, value, expected) => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("₱34,400.00")
    const input = screen.getByRole("spinbutton", { name: label })
    await user.clear(input)
    await user.type(input, value)
    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(saveAndCalculateEntry).not.toHaveBeenCalled()
  })

  it("previews the current reason and hides its row when deductions are cleared", async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("₱34,400.00")
    await user.clear(screen.getByRole("textbox", { name: "Comment" }))
    await user.type(screen.getByRole("textbox", { name: "Comment" }), "Adjustment")
    expect(screen.getByText("Reason: Adjustment")).toBeInTheDocument()
    expect(screen.queryByText("Reason: Late")).not.toBeInTheDocument()
    await user.clear(screen.getByRole("spinbutton", { name: "Other Deductions" }))
    expect(screen.getByText("₱39,400.00")).toBeInTheDocument()
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Comment" })).not.toBeInTheDocument()
  })

  it("saves the edited inputs only on Save changes", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await screen.findByText("₱34,400.00")
    await user.clear(screen.getByRole("spinbutton", { name: "Other Deductions" }))
    await user.type(screen.getByRole("spinbutton", { name: "Other Deductions" }), "2000")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(saveAndCalculateEntry).toHaveBeenCalledWith(
      "entry-1", "period-1", "2026-10-15", "admin-1",
      expect.objectContaining({ a365_otherdeductions: "2000", a365_basicpay: "40000" }),
    ))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(entry.a365_otherdeductions).toBe(5000)
    expect(entry.a365_netpay).toBe(34400)
  })

  it("discards edits on Cancel and starts with saved inputs when reopened", async () => {
    const user = userEvent.setup()
    const { onOpenChange, unmount } = renderDialog()
    await screen.findByText("₱34,400.00")
    await user.clear(screen.getByRole("spinbutton", { name: "Other Deductions" }))
    await user.type(screen.getByRole("spinbutton", { name: "Other Deductions" }), "2000")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(saveAndCalculateEntry).not.toHaveBeenCalled()
    unmount()
    renderDialog()
    await screen.findByText("₱34,400.00")
    expect(screen.getByRole("spinbutton", { name: "Other Deductions" })).toHaveValue(5000)
  })

  it("shows a loading message instead of saved totals until dependencies arrive", async () => {
    let resolveConfig!: (value: StatutoryConfig) => void
    vi.mocked(getStatutoryConfig).mockReturnValue(new Promise((resolve) => { resolveConfig = resolve }))
    renderDialog()
    expect(screen.getByRole("status")).toHaveTextContent("Loading payroll preview")
    expect(screen.queryByText("₱34,400.00")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
    await waitFor(() => expect(getStatutoryConfig).toHaveBeenCalledTimes(1))
    resolveConfig(config)
    await screen.findByText("₱34,400.00")
  })

  it("allows retry after unavailable configuration without displaying backend details", async () => {
    const user = userEvent.setup()
    vi.mocked(getStatutoryConfig).mockRejectedValueOnce(new Error("Sensitive backend details"))
    renderDialog()
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load")
    expect(screen.queryByText(/Sensitive backend/)).not.toBeInTheDocument()
    expect(screen.queryByText("₱34,400.00")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Retry preview" }))
    await screen.findByText("₱34,400.00")
  })

  it("previews entries whose calculated fields have not been saved yet", async () => {
    renderDialog({ ...entry, a365_netpay: null, a365_totaldeductions: null, a365_grosspay: null })
    await screen.findByText("₱34,400.00")
    expect(screen.getByText("₱41,000.00")).toBeInTheDocument()
  })

  it("keeps edited values after a failed save", async () => {
    const user = userEvent.setup()
    vi.mocked(saveAndCalculateEntry).mockRejectedValueOnce(new Error("Unable to save"))
    const { onOpenChange } = renderDialog()
    await screen.findByText("₱34,400.00")
    await user.clear(screen.getByRole("spinbutton", { name: "Other Deductions" }))
    await user.type(screen.getByRole("spinbutton", { name: "Other Deductions" }), "2000")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled())
    expect(screen.getByText("₱37,400.00")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Other Deductions" })).toHaveValue(2000)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("hides totals for invalid negative inputs", async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("₱34,400.00")
    const input = screen.getByRole("spinbutton", { name: "Other Deductions" })
    await user.clear(input)
    await user.type(input, "-1")
    expect(screen.getByRole("alert")).toHaveTextContent("non-negative")
    expect(screen.queryByText("₱34,400.00")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("does not fetch preview data while closed", () => {
    renderDialog(entry, false)
    expect(employeeService.get).not.toHaveBeenCalled()
    expect(getStatutoryConfig).not.toHaveBeenCalled()
  })

  it("shows a useful error for an entry without a linked employee", async () => {
    renderDialog({ ...entry, _a365_employee_value: null })
    expect(await screen.findByRole("alert")).toHaveTextContent("A linked employee is required")
    expect(employeeService.get).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })
})
