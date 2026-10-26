import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PayrollEntryDialog } from "./payroll-entry-dialog"
import { employeeService } from "@/features/employees/employee-service"
import { getStatutoryConfig } from "./services/statutory-config-service"
import { dataClient } from "@/lib/power/data-client"
import type { StatutoryConfig } from "./services/payroll-calculation"
import type { PayrollEntry } from "./types"

vi.mock("@/features/employees/employee-service", () => ({ employeeService: { get: vi.fn() } }))
vi.mock("./services/statutory-config-service", () => ({ getStatutoryConfig: vi.fn() }))
vi.mock("@/lib/power/data-client", () => ({ dataClient: { updateRecordAsync: vi.fn() } }))
vi.mock("@/generated/services/WhoAmIService", () => ({ WhoAmIService: { WhoAmI: vi.fn().mockResolvedValue({ success: true, data: { UserId: "admin" } }) } }))

const config: StatutoryConfig = {
  sss: [{ compensationFrom: 34750, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3500, ecAmount: 30 }],
  philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 },
  hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 }, taxBrackets: [],
}
const entry: PayrollEntry = {
  a365_payrollentryid: "entry-1", a365_name: "Test User", a365_isincluded: true,
  a365_basicpay: 20000, a365_allowances: 0, a365_otherearnings: 0,
  a365_otherdeductions: 0, a365_unpaidleavedays: 2, a365_unpaidleave: 3636.36,
  a365_sss: 875, a365_philhealth: 500, a365_hdmf: 100, a365_withholdingtax: 0,
  a365_grosspay: 16363.64, a365_totaldeductions: 1475, a365_netpay: 14888.64,
  a365_calculatedon: "2026-10-19T00:00:00Z", a365_comment: null,
  _a365_employee_value: "employee-1",
}

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={queryClient}>
    <PayrollEntryDialog open onOpenChange={vi.fn()} entry={entry} periodId="period-1" periodEndDate="2026-10-31" />
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(employeeService.get).mockResolvedValue({ a365_basicmonthlysalary: 40000 } as never)
  vi.mocked(getStatutoryConfig).mockResolvedValue(config)
})

describe("PayrollEntryDialog calculation preview", () => {
  it("previews corrected totals and live edited inputs without persisting anything", async () => {
    const user = userEvent.setup()
    renderEditor()
    expect(await screen.findByText("₱5,111.36")).toBeInTheDocument()
    expect(screen.getByText("₱14,888.64")).toBeInTheDocument()
    const earnings = screen.getByRole("heading", { name: "Earnings" }).parentElement!
    expect(within(earnings).getByText("Other Earnings")).toBeInTheDocument()
    expect(within(earnings).queryByText("Unpaid Leave")).not.toBeInTheDocument()
    const deductions = screen.getByRole("heading", { name: "Deductions" }).parentElement!
    expect(within(deductions).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Unpaid Leave", "SSS", "PhilHealth", "HDMF / Pag-IBIG", "Withholding Tax", "Other Deductions", "Total Deductions",
    ])
    await user.clear(screen.getByLabelText("Other Earnings"))
    await user.type(screen.getByLabelText("Other Earnings"), "750")
    await user.clear(screen.getByLabelText("Withholding Tax"))
    await user.type(screen.getByLabelText("Withholding Tax"), "123.45")
    expect(within(earnings).getByText("₱20,750.00")).toBeInTheDocument()
    expect(within(deductions).getByText("₱5,234.81")).toBeInTheDocument()
    expect(screen.getByText("₱15,515.19")).toBeInTheDocument()
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
    expect(getStatutoryConfig).toHaveBeenCalledTimes(1)
  })

  it("shows a loading state while the read-only context is loading", () => {
    vi.mocked(getStatutoryConfig).mockReturnValue(new Promise(() => {}))
    renderEditor()
    expect(screen.getByRole("status")).toHaveTextContent("Loading calculation preview")
  })

  it("shows a useful error when the preview cannot load", async () => {
    vi.mocked(getStatutoryConfig).mockRejectedValue(new Error("Configuration unavailable"))
    renderEditor()
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the calculation preview")
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  })
})
