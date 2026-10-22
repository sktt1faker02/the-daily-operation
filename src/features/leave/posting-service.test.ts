import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { Office365OutlookService } from "@/generated/services/Office365OutlookService"
import { LeavePostingError, postingService } from "./posting-service"

vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
vi.mock("@/generated/services/Office365OutlookService", () => ({ Office365OutlookService: { SendEmailV2: vi.fn() } }))
const employeeId = "10000000-0000-0000-0000-000000000001"
const operationId = "20000000-0000-0000-0000-000000000002"
const values = { employee: { a365_employeeid: employeeId, a365_name: "Test Employee" }, leaveType: "749910002", benefit: "749910000", startDate: "2026-10-22", endDate: "2026-10-22", note: "Internal note" }
const saved = { a365_leaveid: operationId, a365_name: "Test leave", _a365_employee_value: employeeId, a365_leavetype: 749910002, a365_benefit: 749910001, a365_startdate: values.startDate, a365_enddate: values.endDate, a365_days: 1, a365_leavestatus: 749910000, a365_issuedon: "2026-10-22T00:00:00Z" }
const success = (data: unknown) => ({ success: true, data: { Response: JSON.stringify(data) } })
const readRequest = (index: number) => JSON.parse(vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mock.calls[index][0]) as Record<string, unknown>

beforeEach(() => vi.resetAllMocks())

describe("Transactional Leave client boundary", () => {
  it("requests a read-only server preview and verifies complete period values", async () => {
    const preview = { policyVersion: "2026-10-22.1", periodStart: "2026-04-01", periodEnd: "2027-03-31", VL: 5, SL: 5, pendingVL: 5, pendingSL: 5, days: 1, benefit: 749910000, pool: "VL" }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success(preview))
    expect(await postingService.preview(values)).toEqual(preview)
    expect(readRequest(0)).toMatchObject({ command: "preview", employeeId, startDate: values.startDate })
    expect(readRequest(0)).not.toHaveProperty("note")
  })
  it("does not send email when source commit is unconfirmed", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error("Network timeout"))
    await expect(postingService.submit(values, operationId)).rejects.toMatchObject({ uncertain: true })
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("uses the same operation identity on an uncertain retry", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ alreadySent: true, outcome: "accepted" }))
    await expect(postingService.submit(values, operationId)).rejects.toBeInstanceOf(LeavePostingError)
    const done = await postingService.submit(values, operationId)
    expect(done.record.a365_leaveid).toBe(operationId)
    expect(readRequest(0)).toEqual(readRequest(1))
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("keeps a malformed committed-source response uncertain so the form preserves its operation identity", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ ...saved, a365_leaveid: "invalid" }))
    await expect(postingService.submit(values, operationId)).rejects.toMatchObject({ uncertain: true })
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("distinguishes server validation from unknown outcomes without exposing raw details", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error('LEAVE: These dates overlap an Issued leave record.'))
    await expect(postingService.submit(values, operationId)).rejects.toMatchObject({ uncertain: false, message: "These dates overlap an Issued leave record." })
  })
  it("sends only after confirmed commit and after acquiring a notification attempt", async () => {
    const committed = vi.fn()
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }))
      .mockResolvedValueOnce(success({ outcome: "accepted" }))
    vi.mocked(Office365OutlookService.SendEmailV2).mockImplementation(async () => {
      expect(committed).toHaveBeenCalledOnce()
      expect(readRequest(1).command).toBe("prepareEmail")
      return { success: true, data: undefined }
    })
    expect((await postingService.submit(values, operationId, committed)).notification).toBe("accepted")
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledWith(expect.objectContaining({ To: "test@example.invalid", Subject: "Your leave has been recorded" }))
    expect(vi.mocked(Office365OutlookService.SendEmailV2).mock.calls[0][0].Body).not.toContain("Internal note")
    expect(readRequest(2)).toMatchObject({ command: "completeEmail", operationId, attempt: "attempt-1", outcome: "accepted" })
  })
  it("preserves the source and marks missing stored email as Failed", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee" } }))
      .mockResolvedValueOnce(success({ outcome: "failed" }))
    const result = await postingService.submit(values, operationId)
    expect(result.record.a365_leaveid).toBe(operationId)
    expect(result.notification).toBe("failed")
    expect(readRequest(2).outcome).toBe("failed")
    expect(Office365OutlookService.SendEmailV2).not.toHaveBeenCalled()
  })
  it("records an uncertain send instead of blindly resending or failing the source", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand)
      .mockResolvedValueOnce(success(saved))
      .mockResolvedValueOnce(success({ attempt: "attempt-1", record: saved, employee: { a365_employeeid: employeeId, a365_name: "Test Employee", a365_workemail: "test@example.invalid" } }))
      .mockResolvedValueOnce(success({ outcome: "unknown" }))
    vi.mocked(Office365OutlookService.SendEmailV2).mockRejectedValue(new Error("Timeout after send"))
    expect((await postingService.submit(values, operationId)).notification).toBe("unknown")
    expect(readRequest(2).outcome).toBe("unknown")
    expect(Office365OutlookService.SendEmailV2).toHaveBeenCalledOnce()
  })
  it("notification-only retry never invokes the issue command", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue(success({ alreadySent: true, outcome: "accepted" }))
    expect(await postingService.notify(operationId, true)).toBe("accepted")
    expect(readRequest(0)).toEqual({ command: "prepareEmail", operationId, reviewedUnknown: true })
    expect(A365_LeaveCommandService.a365_LeaveCommand).toHaveBeenCalledOnce()
  })
})
