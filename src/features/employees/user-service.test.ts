import { describe, it, expect } from "vitest"
import { userToIdentityPrefill, type EnvironmentUser } from "./user-service"

const base: EnvironmentUser = {
  systemuserid: "u1",
  fullname: "Jane Q Public",
  firstname: "Jane",
  lastname: "Public",
  middlename: "Q",
  internalemailaddress: "jane@contoso.com",
  domainname: "jane@contoso.com",
}

describe("userToIdentityPrefill", () => {
  it("maps user identity fields to the form", () => {
    expect(userToIdentityPrefill(base)).toEqual({
      a365_firstname: "Jane",
      a365_lastname: "Public",
      a365_middlename: "Q",
      a365_workemail: "jane@contoso.com",
    })
  })

  it("falls back to domainname for email and blanks missing names", () => {
    const u: EnvironmentUser = {
      ...base,
      firstname: null,
      middlename: null,
      internalemailaddress: null,
      domainname: "login@contoso.com",
    }
    const p = userToIdentityPrefill(u)
    expect(p.a365_firstname).toBe("")
    expect(p.a365_middlename).toBe("")
    expect(p.a365_workemail).toBe("login@contoso.com")
  })
})
