import { describe, expect, it } from "vitest"
import { PayrollStatus } from "./types"
import { canTransition, nextActions, ACTION_TARGET } from "./payroll-status-machine"

describe("canTransition", () => {
  it("allows the forward lifecycle", () => {
    expect(canTransition(PayrollStatus.Draft, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Ready)).toBe(true)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Paid)).toBe(true)
    expect(canTransition(PayrollStatus.Paid, PayrollStatus.Locked)).toBe(true)
  })
  it("allows Unlock from any finalized state back to Processing", () => {
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Paid, PayrollStatus.Processing)).toBe(true)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Processing)).toBe(true)
  })
  it("rejects illegal jumps", () => {
    expect(canTransition(PayrollStatus.Draft, PayrollStatus.Locked)).toBe(false)
    expect(canTransition(PayrollStatus.Processing, PayrollStatus.Paid)).toBe(false)
    expect(canTransition(PayrollStatus.Ready, PayrollStatus.Draft)).toBe(false)
    expect(canTransition(PayrollStatus.Locked, PayrollStatus.Paid)).toBe(false)
  })
})

describe("nextActions", () => {
  it("returns the actions available per state", () => {
    expect(nextActions(PayrollStatus.Draft)).toEqual([])
    expect(nextActions(PayrollStatus.Processing)).toEqual(["markReady"])
    expect(nextActions(PayrollStatus.Ready)).toEqual(["markPaid", "unlock"])
    expect(nextActions(PayrollStatus.Paid)).toEqual(["lock", "unlock"])
    expect(nextActions(PayrollStatus.Locked)).toEqual(["unlock"])
  })
  it("every action target is a legal transition from a state that offers it", () => {
    expect(ACTION_TARGET.markReady).toBe(PayrollStatus.Ready)
    expect(canTransition(PayrollStatus.Ready, ACTION_TARGET.markPaid)).toBe(true)
    expect(canTransition(PayrollStatus.Locked, ACTION_TARGET.unlock)).toBe(true)
  })
})
