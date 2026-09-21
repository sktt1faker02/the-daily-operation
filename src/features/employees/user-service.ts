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

  /**
   * Resolve `systemuser` display names by id → Map(id → fullname). Used to put
   * actor names on audit stamps, since the Code Apps data client can't `$expand`
   * lookups or return formatted-value annotations (only the `_value` GUID). One
   * bounded query; blank/duplicate ids are dropped.
   */
  async getNamesByIds(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
    if (unique.length === 0) return new Map()
    const filter = unique.map((id) => `systemuserid eq ${id}`).join(" or ")
    const result = await dataClient.retrieveMultipleRecordsAsync<EnvironmentUser>(SYSTEMUSER_TABLE, {
      select: ["systemuserid", "fullname"],
      filter,
    })
    if (!result.success) throw result.error ?? new Error("Unable to load user names.")
    return new Map((result.data ?? []).map((u) => [u.systemuserid, u.fullname ?? ""]))
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
