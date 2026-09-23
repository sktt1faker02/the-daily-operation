import { describe, it, expect } from "vitest"
import { deriveAccess } from "./access"

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
