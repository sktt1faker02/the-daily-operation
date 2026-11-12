import { describe, expect, it } from "vitest"
import {
  ACTION_TARGET,
  canTransition,
  isFinalized,
  isPeriodEditable,
  isVisibleToEmployee,
  LEGACY_LOCKED_STATUS,
  LEGACY_PROCESSING_STATUS,
  nextActions,
  normalizePayrollStatus,
  PayrollStatus,
  payrollStatusBadgeTone,
  payrollStatusLabel,
} from "./period-status"

describe("payroll period status rules", () => {
  it("allows only the forward flow and the retained Unlock path", () => {
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Ready)).toBe(true)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Locked)).toBe(true)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Locked)).toBe(false)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Ready)).toBe(false)
  })

  it("offers Mark Ready, Mark as Paid, and Unlock without a separate Lock action", () => {
    expect(nextActions(PayrollStatus.Processing)).toEqual(["markReady"])
    expect(nextActions(PayrollStatus.Ready)).toEqual(["markPaid", "unlock"])
    expect(nextActions(PayrollStatus.Locked)).toEqual(["unlock"])
    expect(ACTION_TARGET.markPaid).toBe(PayrollStatus.Locked)
    expect(ACTION_TARGET.unlock).toBe(PayrollStatus.Processing)
  })

  it("releases payslips at Ready and Locked, and edits only in Processing", () => {
    expect(isVisibleToEmployee(PayrollStatus.Processing)).toBe(false)
    expect(isVisibleToEmployee(PayrollStatus.Ready)).toBe(true)
    expect(isVisibleToEmployee(PayrollStatus.Locked)).toBe(true)
    expect(isPeriodEditable(PayrollStatus.Processing)).toBe(true)
    expect(isPeriodEditable(PayrollStatus.Ready)).toBe(false)
    expect(isPeriodEditable(PayrollStatus.Locked)).toBe(false)
    expect(isFinalized(PayrollStatus.Locked)).toBe(true)
    expect(isFinalized(PayrollStatus.Ready)).toBe(false)
  })

  it("normalizes unmigrated Dataverse values to the new flow", () => {
    expect(normalizePayrollStatus(LEGACY_PROCESSING_STATUS)).toBe(PayrollStatus.Processing)
    expect(normalizePayrollStatus(LEGACY_LOCKED_STATUS)).toBe(PayrollStatus.Locked)
    expect(payrollStatusLabel(LEGACY_PROCESSING_STATUS)).toBe("Processing")
    expect(payrollStatusLabel(LEGACY_LOCKED_STATUS)).toBe("Paid")
    expect(payrollStatusLabel(PayrollStatus.Locked)).toBe("Paid")
    expect(payrollStatusBadgeTone(LEGACY_PROCESSING_STATUS)).toBe("processing")
    expect(payrollStatusBadgeTone(LEGACY_LOCKED_STATUS)).toBe("locked")
    expect(isVisibleToEmployee(LEGACY_PROCESSING_STATUS)).toBe(false)
    expect(isVisibleToEmployee(LEGACY_LOCKED_STATUS)).toBe(true)
    expect(isPeriodEditable(LEGACY_PROCESSING_STATUS)).toBe(true)
    expect(isFinalized(LEGACY_LOCKED_STATUS)).toBe(true)
  })
})
