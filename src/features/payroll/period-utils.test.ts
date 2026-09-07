import { describe, it, expect } from "vitest"
import { PayrollStatus, payrollStatusLabel, payrollStatusBadgeTone } from "./types"

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
