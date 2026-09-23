import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/power/data-client", () => ({
  dataClient: {
    createRecordAsync: vi.fn(),
    retrieveMultipleRecordsAsync: vi.fn(),
    retrieveRecordAsync: vi.fn(),
    deleteRecordAsync: vi.fn(),
    updateRecordAsync: vi.fn(),
  },
}))
vi.mock("./payroll-period-service", () => ({
  payrollPeriodService: {
    getPeriod: vi.fn(),
    listEntries: vi.fn(),
    createEntriesFromPlans: vi.fn(),
  },
}))

import { dataClient } from "@/lib/power/data-client"
import { payrollPeriodService } from "./payroll-period-service"
import { payrollTemplateService } from "./payroll-template-service"
import { PayrollStatus } from "../types"

beforeEach(() => vi.clearAllMocks())

describe("saveTemplateFromPeriod", () => {
  it("rejects a non-finalized period", async () => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({
      a365_payrollperiodid: "p1",
      a365_name: "Mar 1–15",
      a365_payrollstatus: PayrollStatus.Processing,
    } as never)
    await expect(payrollTemplateService.saveTemplateFromPeriod("p1", "T", null)).rejects.toThrow()
    expect(dataClient.createRecordAsync).not.toHaveBeenCalled()
  })

  it("creates a header then one line per entry, mapping inputs", async () => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({
      a365_payrollperiodid: "p1",
      a365_name: "Feb 1–15",
      a365_payrollstatus: PayrollStatus.Paid,
    } as never)
    vi.mocked(payrollPeriodService.listEntries).mockResolvedValue([
      {
        _a365_employee_value: "A",
        a365_name: "Camila — Feb 1–15",
        a365_employeename: "Camila Santos",
        a365_basicpay: 9500,
        a365_allowances: 100,
        a365_otherearnings: 0,
        a365_otherdeductions: 0,
        a365_unpaidleavedays: 0,
        a365_withholdingtax: 0,
        a365_comment: "x",
      },
    ] as never)
    vi.mocked(dataClient.createRecordAsync)
      .mockResolvedValueOnce({ success: true, data: { a365_payrolltemplateid: "t1" } } as never) // header
      .mockResolvedValue({ success: true, data: { a365_payrolltemplatelineid: "l1" } } as never) // line

    const res = await payrollTemplateService.saveTemplateFromPeriod("p1", "Standard", "note")
    expect(res).toEqual({ templateId: "t1", lineCount: 1 })
    expect(dataClient.createRecordAsync).toHaveBeenCalledTimes(2)

    // The line payload must use the plain employee name (a365_employeename),
    // not the composite entry label (a365_name = "Camila — Feb 1–15"), so a
    // template applied to a future period doesn't bake in the save period.
    const linePayload = vi.mocked(dataClient.createRecordAsync).mock.calls[1][1] as Record<string, unknown>
    expect(linePayload.a365_name).toBe("Camila Santos")
    expect(linePayload.a365_basicpay).toBe(9500)
    expect(linePayload["a365_Template@odata.bind"]).toBe("/a365_payrolltemplates(t1)")
    expect(linePayload["a365_Employee@odata.bind"]).toBe("/a365_employees(A)")
  })
})
