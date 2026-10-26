import { beforeEach, describe, expect, it, vi } from "vitest"
import { dataClient } from "@/lib/power/data-client"
import { employeeService } from "@/features/employees/employee-service"
import { payrollUnpaidLeaveService } from "@/features/leave/payroll-unpaid-leave"
import { payrollPeriodService } from "./payroll-period-service"
import { payrollTemplateService, type PayrollTemplateLine } from "./payroll-template-service"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import { PayrollStatus } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

vi.mock("@/lib/power/data-client", () => ({ dataClient: { createRecordAsync: vi.fn(), updateRecordAsync: vi.fn(), retrieveRecordAsync: vi.fn(), retrieveMultipleRecordsAsync: vi.fn() } }))
vi.mock("@/features/employees/employee-service", () => ({ employeeService: { list: vi.fn() } }))
vi.mock("@/features/employees/user-service", () => ({ userService: { getNamesByIds: vi.fn() } }))
vi.mock("@/features/leave/payroll-unpaid-leave", () => ({ payrollUnpaidLeaveService: { daysForEmployees: vi.fn() } }))
const employeeId = "10000000-0000-0000-0000-000000000001"
const target: PayrollPeriod = { a365_payrollperiodid: "target", a365_name: "Oct 16–31", a365_periodstart: "2026-10-16", a365_periodend: "2026-10-31", a365_paydate: null, a365_payrollstatus: PayrollStatus.Processing }
const employee = { a365_employeeid: employeeId, a365_name: "Test Employee", a365_employmentstatus: EmploymentStatus.Active, a365_basicmonthlysalary: 50000 } as Employee
const previous = { _a365_employee_value: employeeId, a365_unpaidleavedays: 9, a365_basicpay: 25000 } as PayrollEntry
const copied = { basicPay: 25000, allowances: 0, otherEarnings: 0, otherDeductions: 0, withholdingTax: 0, unpaidLeaveDays: 9, comment: "Recurring input" }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.mocked(employeeService.list).mockResolvedValue([employee])
  vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockResolvedValue(new Map([[employeeId, 2]]))
  vi.mocked(dataClient.createRecordAsync).mockResolvedValue({ success: true, data: {} })
  vi.mocked(dataClient.updateRecordAsync).mockResolvedValue({ success: true, data: {} })
  vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValue({ success: true, data: { a365_name: "Template" } })
  vi.spyOn(payrollPeriodService, "getPeriod").mockResolvedValue(target)
  vi.spyOn(payrollPeriodService, "listEntries").mockImplementation(async id => id === "previous" ? [previous] : [])
  vi.spyOn(payrollPeriodService, "listPeriods").mockResolvedValue([target, { ...target, a365_payrollperiodid: "previous", a365_periodstart: "2026-10-01", a365_payrollstatus: PayrollStatus.Locked }])
  vi.spyOn(payrollTemplateService, "getTemplateLines").mockResolvedValue([{ employeeId, inputs: copied } as PayrollTemplateLine])
})

async function populate(path: string) {
  if (path === "load employees") return payrollPeriodService.loadActiveEmployees("target", target.a365_name)
  if (path === "copy previous") return payrollPeriodService.copyFromPreviousCutoff("target", target.a365_name)
  return payrollTemplateService.applyTemplateToPeriod("template", "target")
}
describe.each(["load employees", "copy previous", "load template"])("unpaid Leave: %s", path => {
  it("writes 2 cutoff days in the same new-entry create, replacing stale copied days", async () => {
    await populate(path)
    expect(dataClient.createRecordAsync).toHaveBeenCalledWith("a365_payrollentries", expect.objectContaining({ a365_unpaidleavedays: 2, a365_basicpay: 25000 }))
    expect(payrollUnpaidLeaveService.daysForEmployees).toHaveBeenCalledWith(expect.arrayContaining([employeeId]), "2026-10-16", "2026-10-31")
    expect(payrollUnpaidLeaveService.daysForEmployees).toHaveBeenCalledTimes(1)
  })
  it("uses zero rather than stale copied days when no leave matches", async () => {
    vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockResolvedValue(new Map([[employeeId, 0]]))
    await populate(path)
    expect(dataClient.createRecordAsync).toHaveBeenCalledWith("a365_payrollentries", expect.objectContaining({ a365_unpaidleavedays: 0 }))
  })
  it("writes nothing if the Leave lookup fails", async () => {
    vi.mocked(payrollUnpaidLeaveService.daysForEmployees).mockRejectedValue(new Error("Unavailable"))
    await expect(populate(path)).rejects.toThrow("Unavailable")
    expect(dataClient.createRecordAsync).not.toHaveBeenCalled()
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  })
  it("never populates a Ready period", async () => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({ ...target, a365_payrollstatus: PayrollStatus.Ready })
    await expect(populate(path)).rejects.toThrow("Processing")
    expect(dataClient.createRecordAsync).not.toHaveBeenCalled()
    expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  })
})
it("Load employees leaves existing entries untouched", async () => {
  vi.mocked(payrollPeriodService.listEntries).mockResolvedValue([previous])
  await payrollPeriodService.loadActiveEmployees("target", target.a365_name)
  expect(dataClient.createRecordAsync).not.toHaveBeenCalled()
  expect(dataClient.updateRecordAsync).not.toHaveBeenCalled()
  expect(payrollUnpaidLeaveService.daysForEmployees).not.toHaveBeenCalled()
})
