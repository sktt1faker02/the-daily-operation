import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_LeaveCommandService } from "@/generated/services/A365_LeaveCommandService"
import { ConversionError, conversionService } from "./conversion-service"

vi.mock("@/generated/services/A365_LeaveCommandService", () => ({ A365_LeaveCommandService: { a365_LeaveCommand: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

describe("Leave Conversion server compatibility", () => {
  it("marks only the verified year paid through the existing generated action", async () => {
    const year = { id: "10000000-0000-0000-0000-000000000001", year: 2026, version: "1", paid: false }
    const result = { ...year, version: "2", paid: true }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: true, data: { Response: JSON.stringify(result) } })
    await expect(conversionService.markPaid(year)).resolves.toEqual(result)
    expect(A365_LeaveCommandService.a365_LeaveCommand).toHaveBeenCalledWith(JSON.stringify({ command: "conversionMarkPaid", year: 2026, operationId: year.id, version: "1" }))
  })
  it("does not claim payment succeeded without a confirmed paid response", async () => {
    const year = { id: "10000000-0000-0000-0000-000000000001", year: 2026, version: "1" }
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: true, data: { Response: JSON.stringify(year) } })
    await expect(conversionService.markPaid(year)).rejects.toMatchObject({ uncertain: true })
  })
  it("identifies the undeployed server reported by Dev and explains the repair", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error("LEAVE: Unknown Leave command. (correlation ID: synthetic)"))
    await expect(conversionService.years()).rejects.toMatchObject({
      name: "ConversionError", uncertain: false,
      message: expect.stringContaining("server update has not been deployed"),
    })
  })
  it("loads actual stored years and automatic next year from the updated server", async () => {
    const years = [{ id: "10000000-0000-0000-0000-000000000001", year: 2026, version: "1" }]
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockResolvedValue({ success: true, data: { Response: JSON.stringify({ years, nextYear: 2027 }) } })
    await expect(conversionService.years()).resolves.toEqual({ years, nextYear: 2027 })
    expect(A365_LeaveCommandService.a365_LeaveCommand).toHaveBeenCalledWith(JSON.stringify({ command: "conversionYears" }))
  })
  it("keeps uncertain network failures retryable without exposing backend details", async () => {
    vi.mocked(A365_LeaveCommandService.a365_LeaveCommand).mockRejectedValue(new Error("private backend diagnostic"))
    const error: unknown = await conversionService.years().catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(ConversionError)
    expect(error).toMatchObject({ uncertain: true })
    expect((error as Error).message).not.toContain("private backend diagnostic")
  })
})
