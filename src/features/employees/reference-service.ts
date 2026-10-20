/**
 * Reference-data service for admin-managed lookup tables (Department, Position).
 * These are ordinary Dataverse tables the Payroll Admin can maintain at runtime,
 * so they are modelled as lookups rather than fixed choices. Access stays behind
 * this service (CLAUDE.md "Dataverse Rules").
 */
import { dataClient } from "@/lib/power/data-client"

export interface Department {
  a365_departmentid: string
  a365_name: string
}

export interface Position {
  a365_positionid: string
  a365_name: string
}

export const referenceService = {
  async departments(): Promise<Department[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<Department>("a365_departments", {
      select: ["a365_departmentid", "a365_name"],
      orderBy: ["a365_name asc"],
    })
    if (!result.success) throw result.error ?? new Error("Unable to load departments.")
    return result.data ?? []
  },

  async getDepartmentNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (uniqueIds.length === 0) return new Map()

    const filter = uniqueIds.map((id) => `a365_departmentid eq ${id}`).join(" or ")
    const result = await dataClient.retrieveMultipleRecordsAsync<Department>("a365_departments", {
      select: ["a365_departmentid", "a365_name"],
      filter,
    })
    if (!result.success) throw result.error ?? new Error("Unable to load employee departments.")
    return new Map((result.data ?? []).map((department) => [department.a365_departmentid, department.a365_name]))
  },

  async positions(): Promise<Position[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<Position>("a365_positions", {
      select: ["a365_positionid", "a365_name"],
      orderBy: ["a365_name asc"],
    })
    if (!result.success) throw result.error ?? new Error("Unable to load positions.")
    return result.data ?? []
  },
}
