import { describe, it, expect } from "vitest"
import { buildOverview } from "./overview-service"
import { LEGACY_LOCKED_STATUS, LEGACY_PROCESSING_STATUS, PayrollStatus } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

function period(
  id: string,
  start: string,
  status: PayrollPeriod["a365_payrollstatus"] = PayrollStatus.Locked,
): PayrollPeriod {
  return {
    a365_payrollperiodid: id,
    a365_name: id,
    a365_periodstart: start,
    a365_periodend: start,
    a365_paydate: start,
    a365_payrollstatus: status,
  }
}

function entry(periodId: string, net: number, included = true): PayrollEntry {
  return {
    a365_payrollentryid: `${periodId}-${net}`,
    a365_name: "",
    a365_isincluded: included,
    a365_basicpay: 0,
    a365_allowances: 0,
    a365_otherearnings: 0,
    a365_otherdeductions: 0,
    a365_unpaidleavedays: 0,
    a365_grosspay: net + 100,
    a365_sss: 0,
    a365_philhealth: 0,
    a365_hdmf: 0,
    a365_unpaidleave: 0,
    a365_withholdingtax: 0,
    a365_totaldeductions: 100,
    a365_netpay: net,
    a365_calculatedon: null,
    a365_comment: null,
    _a365_employee_value: "e",
    _a365_payrollperiod_value: periodId,
  }
}

describe("buildOverview", () => {
  // newest first, as listPeriods returns
  const periods = [period("sep", "2026-09-16"), period("aug", "2026-08-16"), period("jul", "2026-07-01")]

  it("cutoff totals come from the latest period's included entries", () => {
    const entries = [entry("sep", 1000), entry("sep", 2000), entry("aug", 500)]
    const o = buildOverview(periods, entries, 28)
    expect(o.activeEmployees).toBe(28)
    expect(o.cutoffPeriod?.a365_payrollperiodid).toBe("sep")
    expect(o.cutoff.net).toBe(3000)
    expect(o.cutoff.gross).toBe(3200) // 2 entries × 100 over net
  })

  it("cards use the latest FINALIZED cutoff, skipping newer in-progress periods", () => {
    const mixed = [
      period("sep", "2026-09-16", PayrollStatus.Processing),
      period("aug", "2026-08-16", LEGACY_LOCKED_STATUS),
      period("jul", "2026-07-01", PayrollStatus.Locked),
    ]
    const entries = [entry("sep", 1000), entry("aug", 500), entry("jul", 700)]
    const o = buildOverview(mixed, entries, 2)
    // sep is newest but Processing → cards fall to aug (latest Locked)
    expect(o.cutoffPeriod?.a365_payrollperiodid).toBe("aug")
    expect(o.cutoff.net).toBe(500)
  })

  it("cutoffPeriod is null when nothing is Locked", () => {
    const inProgress = [
      period("sep", "2026-09-16", LEGACY_PROCESSING_STATUS),
      period("aug", "2026-08-16", PayrollStatus.Processing),
    ]
    const o = buildOverview(inProgress, [entry("sep", 1000)], 2)
    expect(o.cutoffPeriod).toBeNull()
    expect(o.cutoff).toEqual({ gross: 0, deductions: 0, net: 0 })
  })

  it("recent rows carry per-period employee count and net, newest first", () => {
    const entries = [entry("sep", 1000), entry("sep", 2000), entry("aug", 500), entry("jul", 700)]
    const o = buildOverview(periods, entries, 3)
    expect(o.recent.map((r) => [r.period.a365_payrollperiodid, r.employees, r.net])).toEqual([
      ["sep", 2, 3000],
      ["aug", 1, 500],
      ["jul", 1, 700],
    ])
  })

  it("excludes entries not marked included", () => {
    const entries = [entry("sep", 1000), entry("sep", 9999, false)]
    const o = buildOverview(periods, entries, 1)
    expect(o.cutoff.net).toBe(1000)
    expect(o.recent[0].employees).toBe(1)
  })

  it("honors the recent limit", () => {
    const o = buildOverview(periods, [], 0, 2)
    expect(o.recent).toHaveLength(2)
  })

  it("handles no periods", () => {
    const o = buildOverview([], [], 0)
    expect(o.cutoffPeriod).toBeNull()
    expect(o.cutoff).toEqual({ gross: 0, deductions: 0, net: 0 })
    expect(o.recent).toEqual([])
  })
})
