/**
 * Create / edit employee form. Controlled state with inline validation; the
 * form is not cleared until the mutation succeeds, submission is disabled while
 * saving, and Dataverse errors surface via toast (CLAUDE.md "Forms").
 */
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateEmployee, useUpdateEmployee } from "./use-employees"
import { useEnvironmentUsers } from "./use-users"
import { UserPicker } from "./user-picker"
import { userToIdentityPrefill, type EnvironmentUser } from "./user-service"
import {
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYROLL_FREQUENCY_OPTIONS,
  type ChoiceOption,
  type Employee,
  type EmployeeFormValues,
  emptyEmployeeForm,
  toFormValues,
} from "./types"
import { useDepartments, usePositions } from "./use-reference-data"

const NONE = "__none__"

type FormErrors = Partial<Record<keyof EmployeeFormValues, string>>

function validate(values: EmployeeFormValues): FormErrors {
  const errors: FormErrors = {}
  if (!values.a365_firstname.trim()) errors.a365_firstname = "First name is required."
  if (!values.a365_lastname.trim()) errors.a365_lastname = "Last name is required."
  if (!values.a365_datehired) errors.a365_datehired = "Date hired is required."
  if (values.a365_employmentstatus === "") errors.a365_employmentstatus = "Status is required."
  if (values.a365_employmenttype === "") errors.a365_employmenttype = "Type is required."
  if (values.a365_workemail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.a365_workemail.trim())) {
    errors.a365_workemail = "Enter a valid email address."
  }
  if (values.a365_basicmonthlysalary.trim()) {
    const amount = Number(values.a365_basicmonthlysalary)
    if (Number.isNaN(amount) || amount < 0) {
      errors.a365_basicmonthlysalary = "Enter a valid amount."
    }
  }
  return errors
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
}: {
  id: keyof EmployeeFormValues
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function DateField({
  id,
  label,
  value,
  onChange,
  error,
  required,
}: {
  id: keyof EmployeeFormValues
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <DatePicker id={id} value={value} onChange={onChange} invalid={!!error} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ChoiceField<T extends number>({
  id,
  label,
  value,
  options,
  onChange,
  error,
  required,
  allowClear,
}: {
  id: string
  label: string
  value: T | ""
  options: ChoiceOption<T>[]
  onChange: (value: T | "") => void
  error?: string
  required?: boolean
  allowClear?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Select
        value={value === "" ? undefined : String(value)}
        onValueChange={(next) => onChange(next === NONE ? "" : (Number(next) as T))}
      >
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {allowClear && <SelectItem value={NONE}>— None —</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function LookupField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium text-muted-foreground">{children}</h3>
  )
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this record; otherwise it creates one. */
  employee: Employee | null
}) {
  const isEdit = employee !== null
  const initialValues = useMemo(
    () => (employee ? toFormValues(employee) : emptyEmployeeForm),
    [employee],
  )
  const [values, setValues] = useState<EmployeeFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})

  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const { data: users, isLoading: usersLoading } = useEnvironmentUsers()

  // Picking an environment user links the employee and prefills their identity
  // fields (still editable). Clearing unlinks without wiping the typed values.
  const handleUserSelect = (user: EnvironmentUser | null) => {
    setValues((prev) =>
      user
        ? { ...prev, a365_systemuserid: user.systemuserid, ...userToIdentityPrefill(user) }
        : { ...prev, a365_systemuserid: "" },
    )
  }

  // Reset the form whenever the dialog opens for a different record.
  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setErrors({})
    }
  }, [open, initialValues])

  // For a new employee, default Department → IT and Position → Power Apps Developer
  // once the reference lists load (record ids are environment-specific, so match by name).
  useEffect(() => {
    if (!open || isEdit) return
    setValues((prev) => {
      let changed = false
      const next = { ...prev }
      if (!next.a365_departmentid && departments) {
        const it = departments.find((d) => d.a365_name === "IT")
        if (it) {
          next.a365_departmentid = it.a365_departmentid
          changed = true
        }
      }
      if (!next.a365_positionid && positions) {
        const dev = positions.find((p) => p.a365_name === "Power Apps Developer")
        if (dev) {
          next.a365_positionid = dev.a365_positionid
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [open, isEdit, departments, positions])

  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const isSaving = createEmployee.isPending || updateEmployee.isPending

  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (isEdit && employee) {
      updateEmployee.mutate(
        { id: employee.a365_employeeid, values },
        {
          onSuccess: () => {
            toast.success("Employee updated.")
            onOpenChange(false)
          },
          onError: (error) =>
            toast.error("Unable to save employee.", { description: error.message }),
        },
      )
    } else {
      createEmployee.mutate(values, {
        onSuccess: () => {
          toast.success("Employee created.")
          onOpenChange(false)
        },
        onError: (error) =>
          toast.error("Unable to create employee.", { description: error.message }),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "New employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this employee's master data."
              : "Add an employee. The employee number is generated automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <SectionTitle>Personal</SectionTitle>
            <div className="space-y-1.5">
              <Label htmlFor="a365_systemuserid">Entra User</Label>
              <UserPicker
                users={users ?? []}
                value={values.a365_systemuserid}
                onSelect={handleUserSelect}
                isLoading={usersLoading}
              />
              <p className="text-xs text-muted-foreground">
                Link this employee to their sign-in account. Picking a user fills in the name and
                work email below (you can still edit them), so their payslip portal works.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="a365_firstname" label="First name" required
                value={values.a365_firstname} error={errors.a365_firstname}
                onChange={(v) => set("a365_firstname", v)} />
              <TextField id="a365_lastname" label="Last name" required
                value={values.a365_lastname} error={errors.a365_lastname}
                onChange={(v) => set("a365_lastname", v)} />
              <TextField id="a365_middlename" label="Middle name"
                value={values.a365_middlename}
                onChange={(v) => set("a365_middlename", v)} />
              <TextField id="a365_workemail" label="Work email" type="email"
                value={values.a365_workemail} error={errors.a365_workemail}
                onChange={(v) => set("a365_workemail", v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Employment</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <LookupField id="a365_departmentid" label="Department"
                value={values.a365_departmentid}
                options={(departments ?? []).map((d) => ({ id: d.a365_departmentid, name: d.a365_name }))}
                onChange={(v) => set("a365_departmentid", v)} />
              <LookupField id="a365_positionid" label="Position"
                value={values.a365_positionid}
                options={(positions ?? []).map((p) => ({ id: p.a365_positionid, name: p.a365_name }))}
                onChange={(v) => set("a365_positionid", v)} />
              <ChoiceField id="a365_employmentstatus" label="Employment status" required
                value={values.a365_employmentstatus} options={EMPLOYMENT_STATUS_OPTIONS}
                error={errors.a365_employmentstatus}
                onChange={(v) => set("a365_employmentstatus", v)} />
              <ChoiceField id="a365_employmenttype" label="Employment type" required
                value={values.a365_employmenttype} options={EMPLOYMENT_TYPE_OPTIONS}
                error={errors.a365_employmenttype}
                onChange={(v) => set("a365_employmenttype", v)} />
              <DateField id="a365_datehired" label="Date hired" required
                value={values.a365_datehired} error={errors.a365_datehired}
                onChange={(v) => set("a365_datehired", v)} />
              <DateField id="a365_enddate" label="End date"
                value={values.a365_enddate}
                onChange={(v) => set("a365_enddate", v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Compensation</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="a365_basicmonthlysalary" label="Basic monthly salary" type="number"
                placeholder="0.00" value={values.a365_basicmonthlysalary}
                error={errors.a365_basicmonthlysalary}
                onChange={(v) => set("a365_basicmonthlysalary", v)} />
              <ChoiceField id="a365_payrollfrequency" label="Payroll frequency" allowClear
                value={values.a365_payrollfrequency} options={PAYROLL_FREQUENCY_OPTIONS}
                onChange={(v) => set("a365_payrollfrequency", v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Statutory IDs</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="a365_sssnumber" label="SSS number"
                value={values.a365_sssnumber} onChange={(v) => set("a365_sssnumber", v)} />
              <TextField id="a365_philhealthnumber" label="PhilHealth number"
                value={values.a365_philhealthnumber} onChange={(v) => set("a365_philhealthnumber", v)} />
              <TextField id="a365_hdmfnumber" label="Pag-IBIG / HDMF number"
                value={values.a365_hdmfnumber} onChange={(v) => set("a365_hdmfnumber", v)} />
              <TextField id="a365_tin" label="TIN"
                value={values.a365_tin} onChange={(v) => set("a365_tin", v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Payment</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceField id="a365_paymentmethod" label="Payment method" allowClear
                value={values.a365_paymentmethod} options={PAYMENT_METHOD_OPTIONS}
                onChange={(v) => set("a365_paymentmethod", v)} />
              <TextField id="a365_bankname" label="Bank name"
                value={values.a365_bankname} onChange={(v) => set("a365_bankname", v)} />
              <TextField id="a365_bankaccountnumber" label="Bank account number"
                value={values.a365_bankaccountnumber}
                onChange={(v) => set("a365_bankaccountnumber", v)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
