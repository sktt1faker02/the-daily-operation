import { describe, it, expect } from "vitest"
import { selectVisiblePayslips } from "./my-payroll"
import { LEGACY_LOCKED_STATUS, LEGACY_PROCESSING_STATUS, PayrollStatus } from "../period-status"
import type { PayrollEntry, PayrollPeriod } from "../types"

function period(id: string, start: string, status: PayrollPeriod["a365_payrollstatus"]): PayrollPeriod {
  return {
    a365_payrollperiodid: id,
    a365_name: id,
    a365_periodstart: start,
    a365_periodend: start,
    a365_paydate: start,
    a365_payrollstatus: status,
  }
}

function entry(id: string, periodId: string): PayrollEntry {
  return {
    a365_payrollentryid: id,
    a365_name: id,
    a365_isincluded: true,
    a365_basicpay: 0,
    a365_allowances: 0,
    a365_otherearnings: 0,
    a365_otherdeductions: 0,
    a365_unpaidleavedays: 0,
    a365_grosspay: 0,
    a365_sss: 0,
    a365_philhealth: 0,
    a365_hdmf: 0,
    a365_unpaidleave: 0,
    a365_withholdingtax: 0,
    a365_totaldeductions: 0,
    a365_netpay: 0,
    a365_calculatedon: null,
    a365_comment: null,
    _a365_employee_value: "emp",
    _a365_payrollperiod_value: periodId,
  }
}

describe("selectVisiblePayslips", () => {
  it("shows Ready and Locked periods, hides Processing, and normalizes unmigrated values", () => {
    const periods = [
      period("p-pre-flow", "2026-01-01", LEGACY_PROCESSING_STATUS),
      period("p-proc", "2026-02-01", PayrollStatus.Processing),
      period("p-ready", "2026-03-01", PayrollStatus.Ready),
      period("p-legacy-locked", "2026-04-01", LEGACY_LOCKED_STATUS),
      period("p-locked", "2026-05-01", PayrollStatus.Locked),
    ]
    const entries = periods.map((p) => entry(`e-${p.a365_payrollperiodid}`, p.a365_payrollperiodid))
    const visible = selectVisiblePayslips(entries, periods)
    expect(visible.map((s) => s.period.a365_payrollperiodid)).toEqual([
      "p-locked",
      "p-legacy-locked",
      "p-ready",
    ])
  })

  it("sorts newest cutoff first by period start", () => {
    const periods = [
      period("older", "2026-04-01", LEGACY_LOCKED_STATUS),
      period("newer", "2026-05-01", LEGACY_LOCKED_STATUS),
    ]
    const entries = [entry("e1", "older"), entry("e2", "newer")]
    expect(selectVisiblePayslips(entries, periods).map((s) => s.period.a365_payrollperiodid)).toEqual([
      "newer",
      "older",
    ])
  })

  it("drops entries whose period is missing or unlinked", () => {
    const periods = [period("p-ready", "2026-04-01", PayrollStatus.Ready)]
    const entries = [entry("e1", "does-not-exist"), { ...entry("e2", "p-locked"), _a365_payrollperiod_value: null }]
    expect(selectVisiblePayslips(entries, periods)).toEqual([])
  })
})
