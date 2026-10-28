import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAll } = vi.hoisted(() => ({ getAll: vi.fn() }))

vi.mock("@/lib/power/data-client", () => ({ dataClient: {} }))
vi.mock("@/generated/services/A365_payrollperiodsService", () => ({
  A365_payrollperiodsService: { getAll },
}))

import { canReadPayrollData, isPrivilegeDenied } from "./security-service"

describe("isPrivilegeDenied", () => {
  it("recognizes an SDK 403 with an encoded Dataverse error message", () => {
    const error = {
      status: 403,
      message: JSON.stringify({ error: { code: "0x80040220", message: "PrivilegeDenied" } }),
    }
    expect(isPrivilegeDenied(error)).toBe(true)
  })

  it("recognizes a nested 403 response", () => {
    expect(isPrivilegeDenied({ response: { status: "403" } })).toBe(true)
  })

  it("does not classify other failures as privilege denied", () => {
    expect(isPrivilegeDenied({ status: 500, message: "Server error" })).toBe(false)
    expect(isPrivilegeDenied(new Error("Network unavailable"))).toBe(false)
  })
})

describe("canReadPayrollData", () => {
  beforeEach(() => getAll.mockReset())

  it("probes one payroll-period id only", async () => {
    getAll.mockResolvedValue({ success: true, data: [] })
    await expect(canReadPayrollData()).resolves.toBe(true)
    expect(getAll).toHaveBeenCalledWith({
      select: ["a365_payrollperiodid"],
      top: 1,
    })
  })

  it("propagates a failed payroll-period read", async () => {
    const error = new Error("Forbidden")
    getAll.mockResolvedValue({ success: false, error })
    await expect(canReadPayrollData()).rejects.toBe(error)
  })
})
