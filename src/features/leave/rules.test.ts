import { describe, expect, it } from "vitest"
import { calculateBalances, dateOnly, formatLeaveDate, leaveAccessState, requireGuid } from "./rules"
import type { CreditRecord } from "./types"

const employee = "10000000-0000-0000-0000-000000000001"
function credit(id: string, days: number, pool: CreditRecord["a365_creditpool"] = 749910000): CreditRecord {
  return { a365_leavecredittransactionid: id, a365_name: "Test movement", _a365_employee_value: employee, a365_year: 2026, a365_creditpool: pool, a365_days: days, a365_transactiontype: 749910001, a365_transactionkey: id }
}

describe("Leave balances", () => {
  it("sums signed movements including original deductions and cancellation restorations", () => {
    const rows = [credit("grant", 10), credit("leave", -2), credit("cancel", 2), credit("cash", -3), credit("sick", 5, 749910001)]
    expect(calculateBalances(rows, employee, 2026)).toEqual({ VL: 7, SL: 5, movements: 5 })
  })
  it("avoids cumulative binary rounding and does not invent entitlements", () => {
    expect(calculateBalances([credit("a", 0.1), credit("b", 0.2)], employee, 2026).VL).toBe(0.3)
    expect(calculateBalances([], employee, 2026)).toEqual({ VL: 0, SL: 0, movements: 0 })
  })
  it("shows negative stored balances without silently enforcing an unapproved policy", () => {
    expect(calculateBalances([credit("a", -1.5)], employee, 2026).VL).toBe(-1.5)
  })
  it.each([
    [{ ...credit("a", 1), a365_year: 2025 }],
    [{ ...credit("a", 1), _a365_employee_value: "20000000-0000-0000-0000-000000000002" }],
    [credit("a", 1), credit("a", 1)],
    [credit("a", Number.NaN)],
    [credit("a", Number.POSITIVE_INFINITY)],
    [credit("a", 0.125)],
  ].map(rows => ({ rows })))("rejects inconsistent, duplicate or invalid ledger data (%#)", ({ rows }) => {
    expect(() => calculateBalances(rows, employee, 2026)).toThrow()
  })
})

describe("Leave Date Only", () => {
  it.each(["2026-01-01", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00+14:00", "2026-01-01T00:00:00-12:00"])("preserves the calendar date of %s", value => {
    expect(dateOnly(value)).toBe("2026-01-01")
    expect(formatLeaveDate(value)).toBe("Jan 1, 2026")
  })
  it.each(["2026-02-30", "2026-13-01", "yesterday", "2026-01-01-invalid"])("rejects invalid calendar dates %s", value => {
    expect(() => dateOnly(value)).toThrow()
    expect(formatLeaveDate(value)).toBe("Date unavailable")
  })
})

describe("Leave access", () => {
  it("does not use a missing Employee record or a failed role lookup to grant access", () => {
    expect(leaveAccessState({ roleSettled: false, roleError: false, isAdmin: true })).toBe("loading")
    expect(leaveAccessState({ roleSettled: true, roleError: true, isAdmin: true })).toBe("error")
    expect(leaveAccessState({ roleSettled: true, roleError: false, isAdmin: false })).toBe("denied")
    expect(leaveAccessState({ roleSettled: true, roleError: false, isAdmin: true })).toBe("allowed")
  })
  it("rejects query injection through record ids", () => {
    expect(() => requireGuid(`${employee} or statecode eq 0`)).toThrow()
  })
})
