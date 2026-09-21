/**
 * Employee domain model. Logical names and choice option values were verified
 * against Dataverse (`The Daily Operation - Dev`) and must stay in sync with
 * `docs/data-model.md`. Do not guess Dataverse schema names (CLAUDE.md #5).
 */

/**
 * Registered data-source name for the Employee table. This is the entity set
 * name (`a365_employees`) — the key under which `pac code add-data-source
 * --apiId dataverse` registered the table in `.power/schemas` — not the logical
 * name. The data client resolves records by this name.
 */
export const EMPLOYEE_TABLE = "a365_employees"

// --- Global choice option sets (values follow publisher prefix 74991) --------

// Declared as `const object + union type` (not `enum`) because the project's
// tsconfig enables `erasableSyntaxOnly`. Each name is both a value
// (`EmploymentStatus.Active`) and a type (`EmploymentStatus`).

export const EmploymentStatus = {
  Active: 749910000,
  Inactive: 749910001,
  OnLeave: 749910002,
  Resigned: 749910003,
  Terminated: 749910004,
} as const
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus]

export const EmploymentType = {
  Regular: 749910100,
  Probationary: 749910101,
  Contractual: 749910102,
  ProjectBased: 749910103,
  PartTime: 749910104,
  Consultant: 749910105,
} as const
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType]

export const PayrollFrequency = {
  Monthly: 749910200,
  SemiMonthly: 749910201,
} as const
export type PayrollFrequency = (typeof PayrollFrequency)[keyof typeof PayrollFrequency]

export const PaymentMethod = {
  BankTransfer: 749910300,
  Cash: 749910301,
  Check: 749910302,
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export interface ChoiceOption<T extends number> {
  value: T
  label: string
}

export const EMPLOYMENT_STATUS_OPTIONS: ChoiceOption<EmploymentStatus>[] = [
  { value: EmploymentStatus.Active, label: "Active" },
  { value: EmploymentStatus.Inactive, label: "Inactive" },
  { value: EmploymentStatus.OnLeave, label: "On Leave" },
  { value: EmploymentStatus.Resigned, label: "Resigned" },
  { value: EmploymentStatus.Terminated, label: "Terminated" },
]

export const EMPLOYMENT_TYPE_OPTIONS: ChoiceOption<EmploymentType>[] = [
  { value: EmploymentType.Regular, label: "Regular" },
  { value: EmploymentType.Probationary, label: "Probationary" },
  { value: EmploymentType.Contractual, label: "Contractual" },
  { value: EmploymentType.ProjectBased, label: "Project-based" },
  { value: EmploymentType.PartTime, label: "Part-time" },
  { value: EmploymentType.Consultant, label: "Consultant" },
]

export const PAYROLL_FREQUENCY_OPTIONS: ChoiceOption<PayrollFrequency>[] = [
  { value: PayrollFrequency.Monthly, label: "Monthly" },
  { value: PayrollFrequency.SemiMonthly, label: "Semi-monthly" },
]

export const PAYMENT_METHOD_OPTIONS: ChoiceOption<PaymentMethod>[] = [
  { value: PaymentMethod.BankTransfer, label: "Bank Transfer" },
  { value: PaymentMethod.Cash, label: "Cash" },
  { value: PaymentMethod.Check, label: "Check" },
]

function labelLookup<T extends number>(options: ChoiceOption<T>[]) {
  const map = new Map<number, string>(options.map((o) => [o.value, o.label]))
  return (value: number | null | undefined): string =>
    value === null || value === undefined ? "—" : map.get(value) ?? "—"
}

export const employmentStatusLabel = labelLookup(EMPLOYMENT_STATUS_OPTIONS)
export const employmentTypeLabel = labelLookup(EMPLOYMENT_TYPE_OPTIONS)
export const payrollFrequencyLabel = labelLookup(PAYROLL_FREQUENCY_OPTIONS)
export const paymentMethodLabel = labelLookup(PAYMENT_METHOD_OPTIONS)

/** A record with an Active employment status is eligible to be payrolled. */
export function isActiveEmployee(employee: Employee): boolean {
  return employee.a365_employmentstatus === EmploymentStatus.Active
}

// --- Read model (shape returned by the Dataverse Web API) --------------------

export interface Employee {
  a365_employeeid: string
  a365_employeenumber: string | null
  a365_name: string
  a365_firstname: string | null
  a365_lastname: string | null
  a365_middlename: string | null
  a365_workemail: string | null
  /** Lookup → a365_department (read as the `_value` form). */
  _a365_department_value: string | null
  /** Lookup → a365_position (read as the `_value` form). */
  _a365_position_value: string | null
  a365_employmentstatus: EmploymentStatus | null
  a365_employmenttype: EmploymentType | null
  a365_datehired: string | null
  a365_enddate: string | null
  a365_basicmonthlysalary: number | null
  a365_payrollfrequency: PayrollFrequency | null
  a365_sssnumber: string | null
  a365_philhealthnumber: string | null
  a365_hdmfnumber: string | null
  a365_tin: string | null
  a365_paymentmethod: PaymentMethod | null
  a365_bankname: string | null
  a365_bankaccountnumber: string | null
  /** Lookup to the person's Entra `systemuser` (owner-based access link). */
  _a365_systemuser_value: string | null
}

// --- Form model (controlled string state for the create/edit form) -----------

export interface EmployeeFormValues {
  /** Linked Entra `systemuser` id (the "Entra User" lookup); "" when unlinked. */
  a365_systemuserid: string
  a365_firstname: string
  a365_lastname: string
  a365_middlename: string
  a365_workemail: string
  /** Selected a365_department record id (lookup). */
  a365_departmentid: string
  /** Selected a365_position record id (lookup). */
  a365_positionid: string
  a365_employmentstatus: EmploymentStatus | ""
  a365_employmenttype: EmploymentType | ""
  a365_datehired: string
  a365_enddate: string
  a365_basicmonthlysalary: string
  a365_payrollfrequency: PayrollFrequency | ""
  a365_sssnumber: string
  a365_philhealthnumber: string
  a365_hdmfnumber: string
  a365_tin: string
  a365_paymentmethod: PaymentMethod | ""
  a365_bankname: string
  a365_bankaccountnumber: string
}

export const emptyEmployeeForm: EmployeeFormValues = {
  a365_systemuserid: "",
  a365_firstname: "",
  a365_lastname: "",
  a365_middlename: "",
  a365_workemail: "",
  a365_departmentid: "",
  a365_positionid: "",
  a365_employmentstatus: EmploymentStatus.Active,
  a365_employmenttype: "",
  a365_datehired: "",
  a365_enddate: "",
  a365_basicmonthlysalary: "",
  a365_payrollfrequency: "",
  a365_sssnumber: "",
  a365_philhealthnumber: "",
  a365_hdmfnumber: "",
  a365_tin: "",
  a365_paymentmethod: "",
  a365_bankname: "",
  a365_bankaccountnumber: "",
}

/** Build the editable form values from an existing employee record. */
export function toFormValues(employee: Employee): EmployeeFormValues {
  return {
    a365_systemuserid: employee._a365_systemuser_value ?? "",
    a365_firstname: employee.a365_firstname ?? "",
    a365_lastname: employee.a365_lastname ?? "",
    a365_middlename: employee.a365_middlename ?? "",
    a365_workemail: employee.a365_workemail ?? "",
    a365_departmentid: employee._a365_department_value ?? "",
    a365_positionid: employee._a365_position_value ?? "",
    a365_employmentstatus: employee.a365_employmentstatus ?? "",
    a365_employmenttype: employee.a365_employmenttype ?? "",
    a365_datehired: employee.a365_datehired ?? "",
    a365_enddate: employee.a365_enddate ?? "",
    a365_basicmonthlysalary:
      employee.a365_basicmonthlysalary === null ? "" : String(employee.a365_basicmonthlysalary),
    a365_payrollfrequency: employee.a365_payrollfrequency ?? "",
    a365_sssnumber: employee.a365_sssnumber ?? "",
    a365_philhealthnumber: employee.a365_philhealthnumber ?? "",
    a365_hdmfnumber: employee.a365_hdmfnumber ?? "",
    a365_tin: employee.a365_tin ?? "",
    a365_paymentmethod: employee.a365_paymentmethod ?? "",
    a365_bankname: employee.a365_bankname ?? "",
    a365_bankaccountnumber: employee.a365_bankaccountnumber ?? "",
  }
}
