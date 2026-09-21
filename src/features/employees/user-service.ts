/**
 * Environment users (Dataverse `systemuser`) for the employee form's "Entra
 * User" picker. Lists real interactive people only — application/system users
 * (`applicationid` set) and disabled users are excluded. Kept behind this
 * service like all Dataverse access (CLAUDE.md "Dataverse Rules").
 */
import { dataClient } from "@/lib/power/data-client"

const SYSTEMUSER_TABLE = "systemusers"

export interface EnvironmentUser {
  systemuserid: string
  fullname: string | null
  firstname: string | null
  lastname: string | null
  middlename: string | null
  internalemailaddress: string | null
  domainname: string | null
}

const USER_SELECT: (keyof EnvironmentUser)[] = [
  "systemuserid",
  "fullname",
  "firstname",
  "lastname",
  "middlename",
  "internalemailaddress",
  "domainname",
]

export const userService = {
  /** Active, non-application users, ordered by display name. */
  async listEnvironmentUsers(): Promise<EnvironmentUser[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<EnvironmentUser>(SYSTEMUSER_TABLE, {
      select: USER_SELECT as string[],
      filter: "applicationid eq null and isdisabled eq false",
      orderBy: ["fullname asc"],
    })
    if (!result.success) throw result.error ?? new Error("Unable to load environment users.")
    return result.data ?? []
  },
}

/** The identity fields prefilled onto the employee form when a user is picked. */
export interface IdentityPrefill {
  a365_firstname: string
  a365_lastname: string
  a365_middlename: string
  a365_workemail: string
}

/** Map a selected environment user to the employee form's identity fields. */
export function userToIdentityPrefill(user: EnvironmentUser): IdentityPrefill {
  return {
    a365_firstname: user.firstname ?? "",
    a365_lastname: user.lastname ?? "",
    a365_middlename: user.middlename ?? "",
    a365_workemail: user.internalemailaddress ?? user.domainname ?? "",
  }
}
