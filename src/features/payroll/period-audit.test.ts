import { describe, it, expect } from "vitest"
import { buildAuditTrail } from "./period-audit"
import { PayrollStatus, type PayrollPeriod } from "./types"

function period(overrides: Partial<PayrollPeriod>): PayrollPeriod {
  return {
    a365_payrollperiodid: "p1",
    a365_name: "Sep 1–15",
    a365_periodstart: "2026-09-01",
    a365_periodend: "2026-09-15",
    a365_paydate: "2026-09-20",
    a365_payrollstatus: PayrollStatus.Draft,
    createdon: "2026-09-01T08:00:00Z",
    createdbyname: "Admin User",
    ...overrides,
  }
}

describe("buildAuditTrail", () => {
  it("emits only Created for a fresh period", () => {
    const events = buildAuditTrail(period({}))
    expect(events.map((e) => e.key)).toEqual(["created"])
    expect(events[0]).toMatchObject({ actor: "Admin User", at: "2026-09-01T08:00:00Z" })
  })

  it("appends lifecycle events in order as stamps appear", () => {
    const events = buildAuditTrail(
      period({
        a365_readyon: "2026-09-16T09:00:00Z",
        a365_readybyname: "Admin User",
        a365_paidon: "2026-09-20T10:00:00Z",
        a365_paidbyname: "Admin User",
        a365_lockedon: "2026-09-21T11:00:00Z",
        a365_lockedbyname: "Admin User",
      }),
    )
    expect(events.map((e) => e.key)).toEqual(["created", "ready", "paid", "locked"])
  })

  it("skips lifecycle events whose stamp is absent", () => {
    const events = buildAuditTrail(period({ a365_paidon: "2026-09-20T10:00:00Z", a365_paidbyname: "Admin User" }))
    expect(events.map((e) => e.key)).toEqual(["created", "paid"])
  })

  it("falls back to an em dash when the actor name is missing", () => {
    const events = buildAuditTrail(period({ createdbyname: undefined }))
    expect(events[0].actor).toBe("—")
  })
})
