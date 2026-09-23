import { describe, it, expect } from "vitest"
import { PayrollStatus, payrollStatusLabel, payrollStatusBadgeTone } from "./types"
import {
  basicPayForCutoff,
  suggestSemiMonthlyPeriod,
  formatPeriodName,
  planLoadEntries,
  planCopyEntries,
  selectPreviousCutoff,
  sumEntryTotals,
  type CopiedInputs,
} from "./period-utils"
import { EmploymentStatus, type Employee } from "@/features/employees/types"
import type { PayrollEntry } from "./types"

describe("payrollStatusLabel", () => {
  it("maps each status value to its label", () => {
    expect(payrollStatusLabel(PayrollStatus.Draft)).toBe("Draft")
    expect(payrollStatusLabel(PayrollStatus.Processing)).toBe("Processing")
    expect(payrollStatusLabel(PayrollStatus.Ready)).toBe("Ready")
    expect(payrollStatusLabel(PayrollStatus.Paid)).toBe("Paid")
    expect(payrollStatusLabel(PayrollStatus.Locked)).toBe("Locked")
  })
  it("returns an em dash for null/undefined", () => {
    expect(payrollStatusLabel(null)).toBe("—")
    expect(payrollStatusLabel(undefined)).toBe("—")
  })
})

describe("payrollStatusBadgeTone", () => {
  it("maps status to a semantic tone", () => {
    expect(payrollStatusBadgeTone(PayrollStatus.Draft)).toBe("draft")
    expect(payrollStatusBadgeTone(PayrollStatus.Processing)).toBe("processing")
    expect(payrollStatusBadgeTone(PayrollStatus.Ready)).toBe("ready")
    expect(payrollStatusBadgeTone(PayrollStatus.Paid)).toBe("paid")
    expect(payrollStatusBadgeTone(PayrollStatus.Locked)).toBe("locked")
    expect(payrollStatusBadgeTone(null)).toBe("unknown")
  })
})

describe("selectPreviousCutoff", () => {
  // Periods as listPeriods returns them: a365_periodstart descending.
  const period = (id: string, start: string, status: PayrollStatus) => ({
    a365_payrollperiodid: id,
    a365_periodstart: start,
    a365_payrollstatus: status,
  })

  it("skips an in-progress previous period and copies the last finalized cutoff", () => {
    // Repro of the reported bug: target Mar 1-15; Feb 1-15 is still Processing,
    // so the source must be the Paid Jan 16-31, not Feb.
    const periods = [
      period("mar1", "2027-03-01", PayrollStatus.Processing), // target
      period("feb1", "2027-02-01", PayrollStatus.Processing),
      period("jan16", "2027-01-16", PayrollStatus.Paid),
      period("jan1", "2027-01-01", PayrollStatus.Locked),
    ]
    expect(selectPreviousCutoff(periods, "mar1")?.a365_payrollperiodid).toBe("jan16")
  })

  it("never selects the target itself or a later finalized period", () => {
    const periods = [
      period("apr1", "2027-04-01", PayrollStatus.Paid), // later than target
      period("mar1", "2027-03-01", PayrollStatus.Processing), // target
      period("jan16", "2027-01-16", PayrollStatus.Locked),
    ]
    expect(selectPreviousCutoff(periods, "mar1")?.a365_payrollperiodid).toBe("jan16")
  })

  it("returns null when no earlier period is finalized", () => {
    const periods = [
      period("mar1", "2027-03-01", PayrollStatus.Processing),
      period("feb1", "2027-02-01", PayrollStatus.Draft),
    ]
    expect(selectPreviousCutoff(periods, "mar1")).toBeNull()
  })
})

function emp(id: string, salary: number | null, status: EmploymentStatus = EmploymentStatus.Active): Employee {
  return {
    a365_employeeid: id,
    a365_employeenumber: null,
    a365_name: `Emp ${id}`,
    a365_firstname: null,
    a365_lastname: null,
    a365_middlename: null,
    a365_workemail: null,
    _a365_department_value: null,
    _a365_position_value: null,
    a365_employmentstatus: status,
    a365_employmenttype: null,
    a365_datehired: null,
    a365_enddate: null,
    a365_basicmonthlysalary: salary,
    a365_payrollfrequency: null,
    a365_sssnumber: null,
    a365_philhealthnumber: null,
    a365_hdmfnumber: null,
    a365_tin: null,
    a365_paymentmethod: null,
    a365_bankname: null,
    a365_bankaccountnumber: null,
    _a365_systemuser_value: null,
  }
}

describe("basicPayForCutoff", () => {
  it("halves the monthly salary, rounded to 2dp", () => {
    expect(basicPayForCutoff(25000)).toBe(12500)
    expect(basicPayForCutoff(25001)).toBe(12500.5)
  })
  it("returns 0 for null, undefined, or non-positive", () => {
    expect(basicPayForCutoff(null)).toBe(0)
    expect(basicPayForCutoff(undefined)).toBe(0)
    expect(basicPayForCutoff(0)).toBe(0)
    expect(basicPayForCutoff(-100)).toBe(0)
  })
})

describe("suggestSemiMonthlyPeriod", () => {
  it("suggests the 1–15 cutoff for an early-month date", () => {
    const s = suggestSemiMonthlyPeriod("2026-09-07")
    expect(s.start).toBe("2026-09-01")
    expect(s.end).toBe("2026-09-15")
  })
  it("suggests the 16–end cutoff for a late-month date", () => {
    const s = suggestSemiMonthlyPeriod("2026-09-20")
    expect(s.start).toBe("2026-09-16")
    expect(s.end).toBe("2026-09-30")
  })
  it("defaults the end to the 31st in a 31-day month", () => {
    const s = suggestSemiMonthlyPeriod("2026-10-20")
    expect(s.start).toBe("2026-10-16")
    expect(s.end).toBe("2026-10-31")
    expect(suggestSemiMonthlyPeriod("2026-01-25").end).toBe("2026-01-31")
  })
  it("handles February end-of-month", () => {
    const s = suggestSemiMonthlyPeriod("2026-02-18")
    expect(s.start).toBe("2026-02-16")
    expect(s.end).toBe("2026-02-28")
  })
})

describe("formatPeriodName", () => {
  it("formats a same-month range compactly", () => {
    expect(formatPeriodName("2026-09-01", "2026-09-15")).toBe("Sep 1–15, 2026")
  })
})

describe("planLoadEntries", () => {
  const period = { id: "P1", name: "Sep 1–15, 2026" }
  it("creates one plan per active employee not already present, basic pay = salary/2", () => {
    const active = [emp("A", 25000), emp("B", 30000)]
    const plans = planLoadEntries(active, new Set<string>(), period)
    expect(plans).toHaveLength(2)
    expect(plans[0]).toMatchObject({
      employeeId: "A",
      name: "Emp A — Sep 1–15, 2026",
      basicPay: 12500,
      allowances: 0,
      otherEarnings: 0,
      otherDeductions: 0,
      unpaidLeaveDays: 0,
    })
  })
  it("skips employees already present in the period", () => {
    const active = [emp("A", 25000), emp("B", 30000)]
    const plans = planLoadEntries(active, new Set(["A"]), period)
    expect(plans.map((p) => p.employeeId)).toEqual(["B"])
  })
  it("returns an empty plan when all active employees are already present", () => {
    const active = [emp("A", 25000)]
    expect(planLoadEntries(active, new Set(["A"]), period)).toEqual([])
  })
  it("carries the employee's linked user (for entry ownership), null when unlinked", () => {
    const linked = { ...emp("A", 25000), _a365_systemuser_value: "user-1" }
    const [plan] = planLoadEntries([linked, emp("B", 30000)], new Set<string>(), period)
    expect(plan.systemUserId).toBe("user-1")
    expect(planLoadEntries([emp("B", 30000)], new Set<string>(), period)[0].systemUserId).toBeNull()
  })
})

describe("planCopyEntries", () => {
  const period = { id: "P2", name: "Sep 16–30, 2026" }
  const source = new Map<string, CopiedInputs>([
    [
      "A",
      {
        basicPay: 13000,
        allowances: 2000,
        otherEarnings: 500,
        otherDeductions: 300,
        unpaidLeaveDays: 1,
        withholdingTax: 1325,
      },
    ],
  ])

  it("carries ALL of the source cutoff's inputs for a returning employee", () => {
    const [plan] = planCopyEntries([emp("A", 25000)], new Set<string>(), period, source)
    expect(plan).toMatchObject({
      employeeId: "A",
      basicPay: 13000,
      allowances: 2000,
      otherEarnings: 500,
      otherDeductions: 300,
      unpaidLeaveDays: 1,
      withholdingTax: 1325,
    })
  })

  it("uses defaults for an employee hired since the source period", () => {
    // "B" isn't in the source map → basic pay salary/2, everything else 0.
    const [plan] = planCopyEntries([emp("B", 30000)], new Set<string>(), period, source)
    expect(plan).toMatchObject({
      employeeId: "B",
      basicPay: 15000,
      allowances: 0,
      otherEarnings: 0,
      otherDeductions: 0,
      unpaidLeaveDays: 0,
      withholdingTax: 0,
    })
  })

  it("excludes terminated employees and skips those already present", () => {
    const active = [emp("A", 25000), emp("B", 30000), emp("C", 20000, EmploymentStatus.Inactive)]
    const plans = planCopyEntries(active, new Set(["B"]), period, source)
    expect(plans.map((p) => p.employeeId)).toEqual(["A"]) // C inactive, B already present
  })
})

describe("sumEntryTotals", () => {
  it("sums gross, deductions, and net over entries, treating nulls as 0", () => {
    const entries = [
      { a365_grosspay: 12500, a365_totaldeductions: 1500, a365_netpay: 11000 },
      { a365_grosspay: 15000, a365_totaldeductions: null, a365_netpay: 15000 },
    ] as unknown as PayrollEntry[]
    expect(sumEntryTotals(entries)).toEqual({ gross: 27500, deductions: 1500, net: 26000 })
  })
})
