import { beforeEach, describe, expect, it, vi } from "vitest"
import { dataClient } from "@/lib/power/data-client"
import { WhoAmIService } from "@/generated/services/WhoAmIService"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { getCurrentUserRoles } from "./security-service"
import { payrollPeriodService } from "./payroll-period-service"
import { PayrollStatus } from "../period-status"
import { sendPayslipReadyNotifications } from "./payslip-ready-notification-service"

vi.mock("@/lib/power/data-client", () => ({ dataClient: { retrieveMultipleRecordsAsync: vi.fn(), retrieveRecordAsync: vi.fn() } }))
vi.mock("@/generated/services/WhoAmIService", () => ({ WhoAmIService: { WhoAmI: vi.fn() } }))
vi.mock("@/generated/services/Office365OutlookService", () => ({ Office365OutlookService: { SendEmailV2: vi.fn() } }))
vi.mock("./security-service", () => ({ getCurrentUserRoles: vi.fn() }))
vi.mock("./payroll-period-service", () => ({ payrollPeriodService: { getPeriod: vi.fn() } }))
const periodId = "10000000-0000-0000-0000-000000000001"
const adminId = "10000000-0000-0000-0000-000000000002"
const a = "20000000-0000-0000-0000-000000000001"
const b = "20000000-0000-0000-0000-000000000002"
const entry = (number: number, employeeId: string | null = a, included = true) => ({
  a365_payrollentryid: `30000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
  a365_name: `Employee ${number}`, a365_isincluded: included,
  _a365_employee_value: employeeId, _a365_payrollperiod_value: periodId,
})
const period = { a365_payrollperiodid: periodId, a365_name: "October cutoff", a365_periodstart: "2026-10-16",
  a365_periodend: "2026-10-31", a365_paydate: "2026-10-31", a365_payrollstatus: PayrollStatus.Ready,
  a365_readyon: "2026-10-26T08:00:00Z" }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(WhoAmIService.WhoAmI).mockResolvedValue({ success: true, data: { UserId: adminId } })
  vi.mocked(getCurrentUserRoles).mockResolvedValue({ isAdmin: true, roleNames: ["A365 - Payroll Admin"] })
  vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue(period)
  vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [entry(1)] } as never)
  vi.mocked(dataClient.retrieveRecordAsync).mockImplementation(async (_table, id) => ({ success: true,
    data: { a365_employeeid: id, a365_name: id === a ? "Employee A" : "Employee B", a365_workemail: `${id === a ? "a" : "b"}@example.invalid` } }) as never)
  vi.mocked(Office365OutlookService.SendEmailV2).mockResolvedValue({ success: true, data: undefined })
})

describe("Payslip-ready notifications", () => {
  it("reads all pages first, excludes omitted employees and deduplicates included employees", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync)
      .mockResolvedValueOnce({ success: true, data: [entry(1), entry(2, b, false)], skipToken: "next" } as never)
      .mockResolvedValueOnce({ success: true, data: [entry(3, b), entry(4, a)] } as never)
    vi.mocked(Office365OutlookService.SendEmailV2).mockImplementation(async () => {
      expect(dataClient.retrieveMultipleRecordsAsync).toHaveBeenCalledTimes(2)
      return { success: true, data: undefined }
    })
    const result = await sendPayslipReadyNotifications({ periodId })
    expect(result.recipients.map(row => row.status)).toEqual(["accepted", "accepted"])
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledTimes(2)
    expect(vi.mocked(Office365OutlookService.SendEmailV2).mock.calls.map(([message]) => message.To)).toEqual(["a@example.invalid", "b@example.invalid"])
    expect(dataClient.retrieveMultipleRecordsAsync).toHaveBeenNthCalledWith(2, "a365_payrollentries", expect.objectContaining({
      filter: `_a365_payrollperiod_value eq ${periodId} and a365_isincluded eq true`, skipToken: "next",
    }))
  })
  it("continues sending after an employee has no Work Email", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [entry(1), entry(2, b)] } as never)
    vi.mocked(dataClient.retrieveRecordAsync).mockResolvedValueOnce({ success: true, data: { a365_employeeid: a, a365_name: "Employee A" } } as never)
    const result = await sendPayslipReadyNotifications({ periodId })
    expect(result.recipients.map(row => row.status)).toEqual(["missing-email", "accepted"])
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledOnce()
  })
  it("reports missing employee links and failed employee reads without exposing backend details", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [entry(1, null), entry(2, b)] } as never)
    vi.mocked(dataClient.retrieveRecordAsync).mockRejectedValue(new Error("Sensitive backend details"))
    const result = await sendPayslipReadyNotifications({ periodId })
    expect(result.recipients.map(row => row.status)).toEqual(["unavailable", "unavailable"])
    expect(JSON.stringify(result)).not.toContain("Sensitive")
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("keeps failures uncertain and continues to other employees", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [entry(1), entry(2, b)] } as never)
    vi.mocked(Office365OutlookService.SendEmailV2).mockRejectedValueOnce(new Error("Response lost"))
    const result = await sendPayslipReadyNotifications({ periodId })
    expect(result.recipients.map(row => row.status)).toEqual(["unknown", "accepted"])
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledTimes(2)
  })
  it("does not assume a rejected connector response means no email was sent", async () => {
    vi.mocked(Office365OutlookService.SendEmailV2).mockResolvedValue({ success: false, data: undefined })
    expect((await sendPayslipReadyNotifications({ periodId })).recipients[0].status).toBe("unknown")
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledOnce()
  })
  it("retries only the selected remaining entries", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [entry(1), entry(2, b)] } as never)
    const result = await sendPayslipReadyNotifications({ periodId, expectedReadyOn: period.a365_readyon, entryIds: [entry(2).a365_payrollentryid] })
    expect(result.recipients).toHaveLength(1)
    expect(result.recipients[0].employeeId).toBe(b)
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ To: "b@example.invalid" }))
  })
  it.each([PayrollStatus.Processing, PayrollStatus.Ready])("blocks an unavailable release (%s)", async status => {
    vi.mocked(payrollPeriodService.getPeriod).mockResolvedValue({ ...period, a365_payrollstatus: status })
    const result = await sendPayslipReadyNotifications({ periodId, expectedReadyOn: "older-release" })
    expect(result.error).toBeDefined()
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("blocks ordinary employees before reading recipients or sending mail", async () => {
    vi.mocked(getCurrentUserRoles).mockResolvedValue({ isAdmin: false, roleNames: [] })
    expect((await sendPayslipReadyNotifications({ periodId })).error).toContain("Payroll Admin")
    expect(dataClient.retrieveMultipleRecordsAsync).not.toHaveBeenCalled()
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("sends nothing if a later page fails or a paging token repeats", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync)
      .mockResolvedValueOnce({ success: true, data: [entry(1)], skipToken: "again" } as never)
      .mockResolvedValueOnce({ success: false, data: [] } as never)
    expect((await sendPayslipReadyNotifications({ periodId })).error).toBeDefined()
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
    vi.mocked(dataClient.retrieveMultipleRecordsAsync)
      .mockResolvedValueOnce({ success: true, data: [], skipToken: "again" } as never)
      .mockResolvedValueOnce({ success: true, data: [], skipToken: "again" } as never)
    expect((await sendPayslipReadyNotifications({ periodId })).error).toBeDefined()
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("handles a verified empty included list without sending mail", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [] } as never)
    expect(await sendPayslipReadyNotifications({ periodId })).toMatchObject({ recipients: [], readyOn: period.a365_readyon })
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
})
