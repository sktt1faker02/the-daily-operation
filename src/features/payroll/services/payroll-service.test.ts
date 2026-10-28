import { beforeEach, describe, expect, it, vi } from "vitest"
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { getStatutoryConfig } from "./statutory-config-service"
import { calculateAndPersistEntry, saveAndCalculateEntry } from "./payroll-service"
import { emptyEntryInputValues } from "../types"
import { PayrollStatus } from "../period-status"
import { payrollPeriodService } from "./payroll-period-service"

vi.mock("@/lib/power/data-client", () => ({ dataClient: {
  retrieveRecordAsync: vi.fn(), updateRecordAsync: vi.fn(),
} }))
vi.mock("@/features/employees/employee-service", () => ({ employeeService: { get: vi.fn() } }))
vi.mock("./statutory-config-service", () => ({ getStatutoryConfig: vi.fn() }))
vi.mock("./payroll-period-service", () => ({ payrollPeriodService: {
  getPeriod: vi.fn(),
} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({ a365_payrollstatus: PayrollStatus.Processing } as never)
  vi.mocked(employeeService.get).mockResolvedValue({ a365_basicmonthlysalary: 40000 } as never)
  vi.mocked(getStatutoryConfig).mockResolvedValue({
    sss: [{ compensationFrom: 34750, compensationTo: null, msc: 35000, employeeAmount: 1750, employerAmount: 3500, ecAmount: 30 }],
    philhealth: { premiumRate: 0.05, employeeShare: 0.5, incomeFloor: 10000, incomeCeiling: 100000 },
    hdmf: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 }, taxBrackets: [],
  })
  vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({ success: true, data: {
    a365_payrollentryid: "entry-1", _a365_employee_value: "employee-1", _a365_payrollperiod_value: "period-1",
    a365_basicpay: 20000, a365_allowances: 0, a365_otherearnings: 0, a365_unpaidleavedays: 2,
    a365_withholdingtax: 123.45, a365_otherdeductions: 0,
  } } as never)
  vi.mocked(dataClient.updateRecordAsync).mockResolvedValue({ success: true } as never)
})

describe("payroll calculation persistence", () => {
  it("writes corrected totals in one update and never overwrites manual tax on recalculate", async () => {
    await calculateAndPersistEntry("entry-1", "2026-10-31", "admin")
    expect(dataClient.updateRecordAsync).toHaveBeenCalledExactlyOnceWith("a365_payrollentries", "entry-1", {
      a365_grosspay: 20000, a365_totaldeductions: 5234.81, a365_netpay: 14765.19,
      a365_unpaidleave: 3636.36, a365_sss: 875, a365_philhealth: 500, a365_hdmf: 100,
      a365_calculatedon: expect.any(String), "a365_CalculatedBy@odata.bind": "/systemusers(admin)",
    })
  })

  it("saves edited inputs and corrected results together, including explicitly entered zero tax", async () => {
    await saveAndCalculateEntry("entry-1", "period-1", "2026-10-31", "admin", {
      ...emptyEntryInputValues, a365_basicpay: "20000", a365_otherearnings: "750",
      a365_unpaidleavedays: "2", a365_withholdingtax: "0", a365_comment: " note ",
    })
    expect(dataClient.updateRecordAsync).toHaveBeenCalledTimes(1)
    expect(dataClient.updateRecordAsync).toHaveBeenCalledWith("a365_payrollentries", "entry-1", expect.objectContaining({
      a365_basicpay: 20000, a365_otherearnings: 750, a365_withholdingtax: 0, a365_comment: "note",
      a365_grosspay: 20750, a365_totaldeductions: 5111.36, a365_netpay: 15638.64,
      a365_sss: 875, a365_philhealth: 500, a365_hdmf: 100, a365_unpaidleave: 3636.36,
    }))
  })

  it("does not persist anything when configuration loading fails", async () => {
    vi.mocked(getStatutoryConfig).mockRejectedValue(new Error("Missing configuration"))
    await expect(calculateAndPersistEntry("entry-1", "2026-10-31", "admin")).rejects.toThrow("Missing configuration")
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  })
})
