import { describe, expect, it } from "vitest"
import { leaveAllocation, leaveAllocationDisplay } from "./allocation"

const days = [26, 27, 28, 29, 30].map((date, index) => ({ date: `2026-10-${date}`, paidDays: index < 4 ? 1 : 0, unpaidDays: index < 4 ? 0 : 1 }))
const record = { a365_days: 5, a365_benefit: 749910002, a365_startdate: "2026-10-26", a365_enddate: "2026-10-30", a365_paiddays: 4, a365_unpaiddays: 1, a365_allocationjson: JSON.stringify({ version: 1, days }) }
describe("immutable leave allocation", () => {
  it.each([0, 0.25, 0.5])("reads a half-day snapshot with %s paid days", paidDays => {
    const unpaidDays = 0.5 - paidDays
    const halfDays = [{ date: "2026-10-26", paidDays, unpaidDays }]
    const half = { ...record, a365_days: 0.5, a365_enddate: "2026-10-26", a365_benefit: paidDays === 0 ? 749910001 : unpaidDays === 0 ? 749910000 : 749910002,
      a365_paiddays: paidDays, a365_unpaiddays: unpaidDays, a365_allocationjson: JSON.stringify({ version: 1, days: halfDays }) }
    expect(leaveAllocation(half)).toEqual({ paidDays, unpaidDays, days: halfDays })
    expect(() => leaveAllocation({ ...half, a365_enddate: "2026-10-27" })).toThrow()
  })
  it("reads four paid and one unpaid day with an exact unpaid date", () => {
    expect(leaveAllocation(record)).toEqual({ paidDays: 4, unpaidDays: 1, days })
    expect(leaveAllocationDisplay(record).unpaidDates).toContain("Oct 30, 2026 (1 day)")
  })
  it.each([749910000, 749910001])("preserves legacy benefit %s without fabricating dates", benefit => {
    expect(leaveAllocation({ ...record, a365_benefit: benefit, a365_paiddays: null, a365_unpaiddays: undefined, a365_allocationjson: null }))
      .toEqual({ paidDays: benefit === 749910000 ? 5 : 0, unpaidDays: benefit === 749910001 ? 5 : 0, days: null })
  })
  it.each([
    { a365_allocationjson: null }, { a365_paiddays: undefined }, { a365_unpaiddays: 2 },
    { a365_allocationjson: "bad json" }, { a365_benefit: 749910001 },
    { a365_allocationjson: JSON.stringify({ version: 2, days }) },
    { a365_allocationjson: JSON.stringify({ version: 1, days: [...days.slice(0, 4), days[0]] }) },
    { a365_allocationjson: JSON.stringify({ version: 1, days: days.slice(1) }) },
    { a365_allocationjson: JSON.stringify({ version: 1, days: [...days.slice(0, 4), { ...days[4], date: "2026-10-31" }] }) },
    { a365_allocationjson: JSON.stringify({ version: 1, days: [days[4], ...days.slice(0, 4)] }) },
  ])("rejects incomplete or inconsistent snapshots: %j", override => {
    expect(() => leaveAllocation({ ...record, ...override })).toThrow()
    expect(leaveAllocationDisplay({ ...record, ...override }).unpaid).toContain("review required")
  })
  it("rejects partially paid records without any snapshot", () => {
    expect(() => leaveAllocation({ ...record, a365_paiddays: null, a365_unpaiddays: null, a365_allocationjson: null })).toThrow()
  })
})
