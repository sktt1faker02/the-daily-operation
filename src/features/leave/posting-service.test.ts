import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { LeavePostingError, postingService } from "./posting-service"
import { A365_leavecredittransactionsService } from "@/generated/services/A365_leavecredittransactionsService"
import type { A365_leavecredittransactions } from "@/generated/models/A365_leavecredittransactionsModel"
import type { LeaveRecord } from "./types"

vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
vi.mock("@/generated/services/Office365OutlookService", () => ({ Office365OutlookService: { SharedMailboxSendEmailV2: vi.fn() } }))
vi.mock("@/generated/services/A365_leavecredittransactionsService", () => ({ A365_leavecredittransactionsService: { getAll: vi.fn() } }))
const employeeId = "10000000-0000-0000-0000-000000000001"
const operationId = "20000000-0000-0000-0000-000000000002"
const values = { employee: { a365_employeeid: employeeId, a365_name: "Test Employee" }, leaveType: "749910002", benefit: "749910000", startDate: "2026-10-22", endDate: "2026-10-22", note: "Internal note" }
const saved: LeaveRecord = { a365_leaveid: operationId, a365_name: "Test leave", _a365_employee_value: employeeId, a365_leavetype: 749910002, a365_benefit: 749910001, a365_startdate: values.startDate, a365_enddate: values.endDate, a365_days: 1, a365_leavestatus: 749910000, a365_issuedon: "2026-10-22T00:00:00Z" }
const success = (data: unknown) => ({ success: true, data: { Response: JSON.stringify(data) } })
const readRequest = (index: number) => JSON.parse(vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mock.calls[index][0]) as Record<string, unknown>

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(A365_leavecredittransactionsService.getAll).mockResolvedValue({ success: true, data: [] })
})

describe("Transactional Leave client boundary", () => {
  it("verifies a read-only deletion impact before a confirmed delete", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success({ deleted: false, recordId: operationId, employeeId, restoredDays: 0, pool: "VL", creditPeriod: "2026-04-01", year: 2026 }))
      .mockResolvedValueOnce(success({ deleted: true, recordId: operationId, employeeId, restoredDays: 0 }))
    expect(await postingService.deletionPreview(saved)).toMatchObject({ restoredDays: 0, pool: "VL" })
    expect(readRequest(0)).toEqual({ command: "deletePreview", operationId, employeeId })
    await postingService.deleteLeave(saved, 0)
    expect(readRequest(1)).toEqual({ command: "delete", operationId, employeeId, expectedRestoredDays: 0 })
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("rejects unverifiable deletion impacts and preserves uncertain delete outcomes for retry", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValueOnce(success({ deleted: false, recordId: operationId, employeeId, restoredDays: -1 }))
    await expect(postingService.deletionPreview(saved)).rejects.toMatchObject({ uncertain: false })
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValueOnce(success({ deleted: true, recordId: "another-record", employeeId, restoredDays: 0 }))
    await expect(postingService.deleteLeave(saved, 0)).rejects.toMatchObject({ uncertain: true })
  })
  it("reads the complete post-commit balance through the Leave page's service and refreshes it on resend", async () => {
    const movement = (id: string, days: number) => ({ a365_leavecredittransactionid: id,
      _a365_employee_value: employeeId, a365_year: 2026, a365_creditpool: 749910000, a365_days: days } as A365_leavecredittransactions)
    vi.mocked(A365_leavecredittransactionsService.getAll)
      .mockResolvedValueOnce({ success: true, data: [movement("grant", 10)], skipToken: "next" })
      .mockResolvedValueOnce({ success: true, data: [movement("debit", -1)] })
      .mockResolvedValueOnce({ success: true, data: [movement("current", 7.5)] })
    const ready = { attempt: "attempt-1", record: saved, employee: {
      a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success(ready))
      .mockResolvedValueOnce(success({ outcome: "accepted" }))
      .mockResolvedValueOnce(success({ ...ready, attempt: "attempt-2" }))
      .mockResolvedValueOnce(success({ outcome: "accepted" }))
    vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mockImplementation(async () => {
      expect(A365_leavecredittransactionsService.getAll).toHaveBeenCalled()
      return { success: true, data: undefined }
    })
    await postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })
    expect(vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mock.calls[0][0].Body).toContain("Remaining VL balance: 9.00 days")
    expect(A365_leavecredittransactionsService.getAll).toHaveBeenNthCalledWith(2, expect.objectContaining({ skipToken: "next" }))
    await postingService.notify(operationId, true)
    expect(vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mock.calls.map(([message]) => message.MailboxAddress))
      .toEqual(["thedailyoperation@automations365.com", "thedailyoperation@automations365.com"])
    expect(vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mock.calls[1][0].Body).toContain("Remaining VL balance: 7.50 days")
    expect(A365_leavecredittransactionsService.getAll).toHaveBeenCalledWith(expect.objectContaining({ filter: `_a365_employee_value eq ${employeeId} and a365_year eq 2026` }))
  })

  it("still sends when balances fail, omits the balance and logs no sensitive details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      vi.mocked(A365_leavecredittransactionsService.getAll).mockRejectedValue(new Error("Sensitive backend details"))
      vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
        .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: {
          a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }))
        .mockResolvedValueOnce(success({ outcome: "accepted" }))
      vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mockResolvedValue({ success: true, data: undefined })
      expect(await postingService.notify(operationId)).toBe("accepted")
      expect(vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mock.calls[0][0].Body).not.toContain("Remaining")
      expect(warn).toHaveBeenCalledExactlyOnceWith("Leave email balance unavailable; sending without a balance.")
    } finally { warn.mockRestore() }
  })

  it("requests a read-only server preview and verifies complete period values", async () => {
    const preview = { policyVersion: "2026-10-22.1", periodStart: "2026-04-01", periodEnd: "2027-03-31", VL: 5, SL: 5, pendingVL: 5, pendingSL: 5, days: 1, benefit: 749910000, pool: "VL", allocationVersion: 1, paidDays: 1, unpaidDays: 0, allocation: [{ date: values.startDate, paidDays: 1, unpaidDays: 0 }] }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success(preview))
    expect(await postingService.preview(values)).toEqual(preview)
    expect(readRequest(0)).toMatchObject({ command: "preview", employeeId, startDate: values.startDate })
    expect(readRequest(0)).not.toHaveProperty("note")
  })
  it("blocks older servers and incomplete split previews", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ days: 5, benefit: 749910001 }))
    await expect(postingService.preview(values)).rejects.toMatchObject({ uncertain: false, message: expect.stringContaining("server update") })
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ allocationVersion: 1, periodStart: "2026-04-01", periodEnd: "2027-01-04", VL: 4, SL: 5, pendingVL: 0, pendingSL: 0, days: 5, benefit: 749910002, paidDays: 4, unpaidDays: 1, allocation: [] }))
    await expect(postingService.preview(values)).rejects.toMatchObject({ uncertain: false, message: expect.stringContaining("preview could not be verified") })
  })
  it("submits the reviewed breakdown so changed credits cannot silently change it", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error("LEAVE: The paid/unpaid breakdown changed. Refresh the credit preview."))
    await expect(postingService.submit(values, operationId, { paidDays: 4, unpaidDays: 1 })).rejects.toMatchObject({ uncertain: false })
    expect(readRequest(0)).toMatchObject({ allocationVersion: 1, expectedPaidDays: 4, expectedUnpaidDays: 1 })
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("does not send email when source commit is unconfirmed", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error("Network timeout"))
    await expect(postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })).rejects.toMatchObject({ uncertain: true })
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("uses the same operation identity on an uncertain retry", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ alreadySent: true, outcome: "accepted" }))
    await expect(postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })).rejects.toBeInstanceOf(LeavePostingError)
    const done = await postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })
    expect(done.record.a365_leaveid).toBe(operationId)
    expect(readRequest(0)).toEqual(readRequest(1))
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("keeps a malformed committed-source response uncertain so the form preserves its operation identity", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ ...saved, a365_leaveid: "invalid" }))
    await expect(postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })).rejects.toMatchObject({ uncertain: true })
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("distinguishes server validation from unknown outcomes without exposing raw details", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error('LEAVE: These dates overlap an Issued leave record.'))
    await expect(postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })).rejects.toMatchObject({ uncertain: false, message: "These dates overlap an Issued leave record." })
  })
  it("sends only after confirmed commit and after acquiring a notification attempt", async () => {
    const committed = vi.fn()
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }))
      .mockResolvedValueOnce(success({ outcome: "accepted" }))
    vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mockImplementation(async () => {
      expect(committed).toHaveBeenCalledOnce()
      expect(readRequest(1).command).toBe("prepareEmail")
      return { success: true, data: undefined }
    })
    expect((await postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 }, committed)).notification).toBe("accepted")
    expect(Office365OutlookService.SharedMailboxSendEmailV2).toHaveBeenCalledWith(expect.objectContaining({ MailboxAddress: "thedailyoperation@automations365.com", To: "test@example.invalid", Subject: "Your leave has been recorded" }))
    expect(vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mock.calls[0][0].Body).not.toContain("Internal note")
    expect(readRequest(2)).toMatchObject({ command: "completeEmail", operationId, attempt: "attempt-1", outcome: "accepted" })
  })
  it("preserves the source and marks missing stored email as Failed", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee" } }))
      .mockResolvedValueOnce(success({ outcome: "failed" }))
    const result = await postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })
    expect(result.record.a365_leaveid).toBe(operationId)
    expect(result.notification).toBe("failed")
    expect(readRequest(2).outcome).toBe("failed")
    expect(Office365OutlookService.SharedMailboxSendEmailV2).not.toHaveBeenCalled()
  })
  it("records an uncertain send instead of blindly resending or failing the source", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }))
      .mockResolvedValueOnce(success({ outcome: "unknown" }))
    vi.mocked(Office365OutlookService.SharedMailboxSendEmailV2).mockRejectedValue(new Error("Timeout after send"))
    expect((await postingService.submit(values, operationId, { paidDays: 0, unpaidDays: 1 })).notification).toBe("unknown")
    expect(readRequest(2).outcome).toBe("unknown")
    expect(Office365OutlookService.SharedMailboxSendEmailV2).toHaveBeenCalledOnce()
  })
  it("notification-only retry never invokes the issue command", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ alreadySent: true, outcome: "accepted" }))
    expect(await postingService.notify(operationId, true)).toBe("accepted")
    expect(readRequest(0)).toEqual({ command: "prepareEmail", operationId, reviewedUnknown: true })
    expect(A365_LeaveCommandService.a365_LeaveCommand).toHaveBeenCalledOnce()
  })
})
