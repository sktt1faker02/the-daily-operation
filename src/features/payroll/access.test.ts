import { describe, it, expect } from "vitest"
import { deriveAccess, deriveGate, type GateInputs } from "./access"

const gate = (overrides: Partial<GateInputs> = {}) => deriveGate({
  roleSettled: true,
  roleError: false,
  roleNames: [],
  roleLookupBlocked: false,
  probeSettled: true,
  probeAllowed: false,
  ...overrides,
})

describe("deriveAccess", () => {
  it("role query says admin → admin, regardless of employee link", () => {
    const a = deriveAccess({ roleResolved: true, isAdminRole: true, employeeResolved: true, hasEmployeeRecord: true })
    expect(a).toEqual({ isAdmin: true, showMyPayroll: true, ready: true })
  })

  it("pure employee (role says not admin, has employee record)", () => {
    const a = deriveAccess({ roleResolved: true, isAdminRole: false, employeeResolved: true, hasEmployeeRecord: true })
    expect(a).toEqual({ isAdmin: false, showMyPayroll: true, ready: true })
  })

  it("admin not on payroll → admin nav, no My Payroll", () => {
    const a = deriveAccess({ roleResolved: true, isAdminRole: true, employeeResolved: true, hasEmployeeRecord: false })
    expect(a).toEqual({ isAdmin: true, showMyPayroll: false, ready: true })
  })

  it("role query failed → falls back to link rule (linked employee = not admin)", () => {
    const a = deriveAccess({ roleResolved: false, isAdminRole: false, employeeResolved: true, hasEmployeeRecord: true })
    expect(a.isAdmin).toBe(false)
    expect(a.showMyPayroll).toBe(true)
  })

  it("role query failed, no employee record → falls back to admin", () => {
    const a = deriveAccess({ roleResolved: false, isAdminRole: false, employeeResolved: true, hasEmployeeRecord: false })
    expect(a.isAdmin).toBe(true)
    expect(a.showMyPayroll).toBe(false)
  })

  it("nothing resolved yet → not ready, defaults closed", () => {
    const a = deriveAccess({ roleResolved: false, isAdminRole: false, employeeResolved: false, hasEmployeeRecord: false })
    expect(a).toEqual({ isAdmin: false, showMyPayroll: false, ready: false })
  })
})

describe("deriveGate", () => {
  it("remains loading until the role lookup settles", () => {
    expect(gate({ roleSettled: false })).toBe("loading")
  })

  it("denies a role lookup error other than 403", () => {
    expect(gate({ roleError: true, probeAllowed: true })).toBe("denied")
  })

  it("denies a successful lookup with no roles", () => {
    expect(gate()).toBe("denied")
  })

  it("allows either configured role when the role lookup succeeds", () => {
    expect(gate({ roleNames: ["A365 - Payroll Admin"] })).toBe("allowed")
    expect(gate({ roleNames: ["A365 - Payroll Employee"] })).toBe("allowed")
  })

  it("allows a user with both configured roles", () => {
    expect(gate({ roleNames: ["A365 - Payroll Admin", "A365 - Payroll Employee"] })).toBe("allowed")
  })

  it("allows an allowed team-inherited role returned by the lookup", () => {
    expect(gate({ roleNames: ["A365 - Payroll Employee"] })).toBe("allowed")
  })

  it("matches role names case-insensitively and trims whitespace", () => {
    expect(gate({ roleNames: ["  a365 - payroll employee  "] })).toBe("allowed")
  })

  it("denies a non-allowed role only", () => {
    expect(gate({ roleNames: ["Agent Viewer"] })).toBe("denied")
  })

  it("waits for the payroll access probe after a 403 role lookup", () => {
    expect(gate({ roleError: true, roleLookupBlocked: true, probeSettled: false })).toBe("loading")
  })

  it("allows a 403 role lookup only when the payroll access probe succeeds", () => {
    expect(gate({ roleError: true, roleLookupBlocked: true, probeAllowed: true })).toBe("allowed")
  })

  it("denies a 403 role lookup when the payroll access probe fails", () => {
    expect(gate({ roleError: true, roleLookupBlocked: true, probeAllowed: false })).toBe("denied")
  })

  it("denies when the system-user id could not be resolved", () => {
    expect(gate({ roleError: true })).toBe("denied")
  })
})
