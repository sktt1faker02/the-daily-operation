/**
 * Employee data service. Wraps the Dataverse data client with business-oriented
 * operations and keeps all Dataverse access behind this layer (CLAUDE.md
 * "Dataverse Rules"). Presentation code depends on the hooks, not this module.
 */
import { dataClient } from "@/lib/power/data-client"
import {
  EMPLOYEE_TABLE,
  type Employee,
  type EmployeeFormValues,
} from "./types"

const SELECT_COLUMNS: (keyof Employee)[] = [
  "a365_employeeid",
  "a365_employeenumber",
  "a365_name",
  "a365_firstname",
  "a365_lastname",
  "a365_middlename",
  "a365_workemail",
  "_a365_department_value",
  "_a365_position_value",
  "a365_employmentstatus",
  "a365_employmenttype",
  "a365_datehired",
  "a365_enddate",
  "a365_basicmonthlysalary",
  "a365_payrollfrequency",
  "a365_sssnumber",
  "a365_philhealthnumber",
  "a365_hdmfnumber",
  "a365_tin",
  "a365_paymentmethod",
  "a365_bankname",
  "a365_bankaccountnumber",
  "_a365_systemuser_value",
]

export interface EmployeeListOptions {
  /** OData filter, e.g. `a365_employmentstatus eq 749910000`. */
  filter?: string
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function fullName(values: EmployeeFormValues): string {
  return [values.a365_firstname, values.a365_middlename, values.a365_lastname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}

/** Map controlled form values to the Dataverse write payload. */
function toWritePayload(values: EmployeeFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    a365_name: fullName(values),
    a365_firstname: trimmedOrNull(values.a365_firstname),
    a365_lastname: trimmedOrNull(values.a365_lastname),
    a365_middlename: trimmedOrNull(values.a365_middlename),
    a365_workemail: trimmedOrNull(values.a365_workemail),
    a365_employmentstatus: values.a365_employmentstatus === "" ? null : values.a365_employmentstatus,
    a365_employmenttype: values.a365_employmenttype === "" ? null : values.a365_employmenttype,
    a365_datehired: values.a365_datehired || null,
    a365_enddate: values.a365_enddate || null,
    a365_basicmonthlysalary:
      values.a365_basicmonthlysalary.trim() === ""
        ? null
        : Number(values.a365_basicmonthlysalary),
    a365_payrollfrequency: values.a365_payrollfrequency === "" ? null : values.a365_payrollfrequency,
    a365_sssnumber: trimmedOrNull(values.a365_sssnumber),
    a365_philhealthnumber: trimmedOrNull(values.a365_philhealthnumber),
    a365_hdmfnumber: trimmedOrNull(values.a365_hdmfnumber),
    a365_tin: trimmedOrNull(values.a365_tin),
    a365_paymentmethod: values.a365_paymentmethod === "" ? null : values.a365_paymentmethod,
    a365_bankname: trimmedOrNull(values.a365_bankname),
    a365_bankaccountnumber: trimmedOrNull(values.a365_bankaccountnumber),
  }
  // Lookups are written via @odata.bind. Only set when chosen; omitting on update
  // leaves the existing value unchanged.
  if (values.a365_departmentid) {
    payload["a365_Department@odata.bind"] = `/a365_departments(${values.a365_departmentid})`
  }
  if (values.a365_positionid) {
    payload["a365_Position@odata.bind"] = `/a365_positions(${values.a365_positionid})`
  }
  // Entra User link: bind when chosen, explicitly null to unlink. This is the
  // identity link the app uses to tie a login to its payroll (see security-model §4).
  payload["a365_SystemUser@odata.bind"] = values.a365_systemuserid
    ? `/systemusers(${values.a365_systemuserid})`
    : null
  // Own the employee record as its linked user so the person can read their own
  // record at User level (ownership-based access). Only when a user is linked.
  if (values.a365_systemuserid) {
    payload["ownerid@odata.bind"] = `/systemusers(${values.a365_systemuserid})`
  }
  return payload
}

export const employeeService = {
  async list(options: EmployeeListOptions = {}): Promise<Employee[]> {
    const result = await dataClient.retrieveMultipleRecordsAsync<Employee>(EMPLOYEE_TABLE, {
      select: SELECT_COLUMNS as string[],
      orderBy: ["a365_name asc"],
      filter: options.filter,
    })
    if (!result.success) {
      throw result.error ?? new Error("Unable to load employees.")
    }
    return result.data ?? []
  },

  /**
   * The Employee record linked to a signed-in user's Entra `systemuser`, or null
   * if none. Drives the employee portal and the employee/admin nav gate. Read
   * access is still Dataverse-enforced; this only resolves the current person's
   * own record.
   */
  async getBySystemUserId(systemUserId: string): Promise<Employee | null> {
    const result = await dataClient.retrieveMultipleRecordsAsync<Employee>(EMPLOYEE_TABLE, {
      select: SELECT_COLUMNS as string[],
      filter: `_a365_systemuser_value eq ${systemUserId}`,
    })
    if (!result.success) throw result.error ?? new Error("Unable to resolve your employee record.")
    return result.data?.[0] ?? null
  },

  async get(id: string): Promise<Employee> {
    const result = await dataClient.retrieveRecordAsync<Employee>(EMPLOYEE_TABLE, id, {
      select: SELECT_COLUMNS as string[],
    })
    if (!result.success) {
      throw result.error ?? new Error("Unable to load the employee record.")
    }
    return result.data
  },

  async create(values: EmployeeFormValues): Promise<Employee> {
    const result = await dataClient.createRecordAsync<Record<string, unknown>, Employee>(
      EMPLOYEE_TABLE,
      toWritePayload(values),
    )
    if (!result.success) {
      throw result.error ?? new Error("Unable to create the employee.")
    }
    return result.data
  },

  async update(id: string, values: EmployeeFormValues): Promise<void> {
    const result = await dataClient.updateRecordAsync<Record<string, unknown>, Employee>(
      EMPLOYEE_TABLE,
      id,
      toWritePayload(values),
    )
    if (!result.success) {
      throw result.error ?? new Error("Unable to save the employee.")
    }
  },
}
