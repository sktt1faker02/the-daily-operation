import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/power/data-client", () => ({
  dataClient: {
    createRecordAsync: vi.fn(),
    retrieveRecordAsync: vi.fn(),
    retrieveMultipleRecordsAsync: vi.fn(),
    updateRecordAsync: vi.fn(),
  },
}))
vi.mock("@/features/employees/user-service", () => ({
  userService: { getNamesByIds: vi.fn().mockResolvedValue(new Map()) },
}))
vi.mock("@/features/employees/employee-service", () => ({
  employeeService: { list: vi.fn() },
}))

import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { payrollPeriodService } from "./payroll-period-service"
import { PayrollStatus } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

const period = (status: PayrollPeriod["a365_payrollstatus"]): PayrollPeriod => ({
  a365_payrollperiodid: "period-1",
  a365_name: "Oct cutoff",
  a365_periodstart: "2026-10-01",
  a365_periodend: "2026-10-15",
  a365_paydate: "2026-10-15",
  a365_payrollstatus: status,
})

beforeEach(() => vi.clearAllMocks())

describe("payrollPeriodService.listEntries", () => {
  it("attaches employee number and department name from the linked records", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync)
      .mockResolvedValueOnce({
        success: true,
        data: [{
          a365_payrollentryid: "entry-1",
          a365_name: "Ada Employee — Oct cutoff",
          a365_isincluded: true,
          a365_basicpay: 100,
          a365_allowances: 0,
          a365_otherearnings: 0,
          a365_otherdeductions: 0,
          a365_unpaidleavedays: 0,
          a365_grosspay: 100,
          a365_sss: 0,
          a365_philhealth: 0,
          a365_hdmf: 0,
          a365_unpaidleave: 0,
          a365_withholdingtax: 0,
          a365_totaldeductions: 0,
          a365_netpay: 100,
          a365_calculatedon: null,
          a365_comment: null,
          _a365_employee_value: "employee-1",
          _a365_payrollperiod_value: "period-1",
        } as PayrollEntry],
      } as never)
      .mockResolvedValueOnce({
        success: true,
        data: [{ a365_departmentid: "department-1", a365_name: "Operations" }],
      } as never)
    vi.mocked(employeeService.list).mockResolvedValue([{
      a365_employeeid: "employee-1",
      a365_employeenumber: "EMP-001",
      a365_name: "Ada Employee",
      _a365_department_value: "department-1",
      a365_bankname: "Test Bank",
      a365_bankaccountnumber: "1234567890",
    } as never])

    const entries = await payrollPeriodService.listEntries("period-1")

    expect(entries[0]).toMatchObject({
      a365_employeename: "Ada Employee",
      a365_employeenumber: "EMP-001",
      a365_departmentname: "Operations",
      a365_bankname: "Test Bank",
      a365_bankaccountnumber: "1234567890",
    })
    expect(dataClient.retrieveMultipleRecordsAsync).toHaveBeenNthCalledWith(
      2,
      "a365_departments",
      expect.objectContaining({ select: ["a365_departmentid", "a365_name"] }),
    )
  })
})

describe("payrollPeriodService.createPeriod", () => {
  it("sets the initial status explicitly to Processing", async () => {
    vi.mocked(dataClient.createRecordAsync).mockResolvedValue({
      success: true,
      data: period(PayrollStatus.Processing),
    } as never)

    await payrollPeriodService.createPeriod({
      start: "2026-10-01",
      end: "2026-10-15",
      payDate: "2026-10-15",
      name: "Oct 1-15",
    })

    const payload = vi.mocked(dataClient.createRecordAsync).mock.calls[0][1] as Record<string, unknown>
    expect(payload.a365_payrollstatus).toBe(PayrollStatus.Processing)
  })
})

describe("payrollPeriodService.transitionStatus", () => {
  it("sets Paid and Locked stamps with Locked status in one Dataverse update", async () => {
    vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({
      success: true,
      data: period(PayrollStatus.Ready),
    } as never)
    vi.mocked(dataClient.updateRecordAsync).mockResolvedValue({ success: true } as never)

    await payrollPeriodService.transitionStatus("period-1", PayrollStatus.Locked, "user-1")

    expect(dataClient.updateRecordAsync).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(dataClient.updateRecordAsync).mock.calls[0][2] as Record<string, unknown>
    expect(payload).toMatchObject({
      a365_payrollstatus: PayrollStatus.Locked,
      "a365_PaidBy@odata.bind": "/systemusers(user-1)",
      "a365_LockedBy@odata.bind": "/systemusers(user-1)",
    })
    expect(payload.a365_paidon).toBe(payload.a365_lockedon)
    expect(typeof payload.a365_paidon).toBe("string")
  })

  it("does not update status when an included entry has not been calculated", async () => {
    vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({
      success: true,
      data: period(PayrollStatus.Processing),
    } as never)
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({
      success: true,
      data: [{
        a365_payrollentryid: "entry-1",
        a365_isincluded: true,
        a365_calculatedon: null,
        _a365_employee_value: null,
      }],
    } as never)

    await expect(
      payrollPeriodService.transitionStatus("period-1", PayrollStatus.Ready, "user-1"),
    ).rejects.toThrow("Calculate all included payroll entries")
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  })

  it("allows Mark Ready without requiring employee-user links or entry ownership checks", async () => {
    vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({
      success: true,
      data: period(PayrollStatus.Processing),
    } as never)
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({
      success: true,
      data: [{
        a365_payrollentryid: "entry-1",
        a365_isincluded: true,
        a365_calculatedon: "2026-10-19T00:00:00Z",
        _a365_employee_value: null,
        a365_grosspay: 1000,
        a365_sss: 0,
        a365_philhealth: 0,
        a365_hdmf: 0,
        a365_unpaidleave: 0,
        a365_withholdingtax: 0,
        a365_totaldeductions: 0,
        a365_netpay: 1000,
      }],
    } as never)
    vi.mocked(dataClient.updateRecordAsync).mockResolvedValue({ success: true } as never)

    await payrollPeriodService.transitionStatus("period-1", PayrollStatus.Ready, "admin-user")

    expect(dataClient.updateRecordAsync).toHaveBeenCalledWith(
      expect.any(String),
      "period-1",
      expect.objectContaining({ a365_payrollstatus: PayrollStatus.Ready }),
    )
  })

  it("leaves the period unchanged when the single status update fails", async () => {
    vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({
      success: true,
      data: period(PayrollStatus.Ready),
    } as never)
    vi.mocked(dataClient.updateRecordAsync).mockResolvedValue({
      success: false,
      error: new Error("Dataverse update failed"),
    } as never)

    await expect(
      payrollPeriodService.transitionStatus("period-1", PayrollStatus.Locked, "user-1"),
    ).rejects.toThrow("Dataverse update failed")
    expect(dataClient.updateRecordAsync).toHaveBeenCalledTimes(1)
  })
})
