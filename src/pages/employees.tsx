/**
 * Employees list page (Payroll Admin). Shows Loading / Success / Empty / Error
 * states, a status filter, and the create/edit form. Authorization is enforced
 * in Dataverse (security roles), not by this UI (CLAUDE.md "Security").
 */
import { useMemo, useState } from "react"
import { AlertCircle, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeeTable } from "@/features/employees/employee-table"
import { EmployeeFormDialog } from "@/features/employees/employee-form-dialog"
import { DeleteEmployeeDialog } from "@/features/employees/delete-employee-dialog"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import {
  useEmployees,
  type EmployeeStatusFilter,
} from "@/features/employees/use-employees"
import {
  useDepartments,
  usePositions,
} from "@/features/employees/use-reference-data"
import type { Employee } from "@/features/employees/types"

export default function EmployeesPage() {
  const [filter, setFilter] = useState<EmployeeStatusFilter>("active")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const { isAdmin } = useAccessProfile({ loadEmployee: false })

  const { data: employees, isPending, isError, error, refetch, isFetching } =
    useEmployees(filter)
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()

  const departmentNames = useMemo(
    () => new Map((departments ?? []).map((d) => [d.a365_departmentid, d.a365_name])),
    [departments],
  )
  const positionNames = useMemo(
    () => new Map((positions ?? []).map((p) => [p.a365_positionid, p.a365_name])),
    [positions],
  )

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (employee: Employee) => {
    setEditing(employee)
    setDialogOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
            <p className="text-sm text-muted-foreground">
              Employee master data for payroll.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New employee
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as EmployeeStatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        {isFetching && !isPending && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>

      {isPending ? (
        <div className="space-y-2 rounded-md border p-4" aria-busy>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Unable to load employees</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <Users className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No employees found</p>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Add your first employee to get started."
                : `No ${filter} employees. Try a different filter or add an employee.`}
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New employee
          </Button>
        </div>
      ) : (
        <EmployeeTable
          employees={employees}
          onEdit={openEdit}
          onDelete={isAdmin ? setDeleting : undefined}
          departmentNames={departmentNames}
          positionNames={positionNames}
        />
      )}

      {deleting && <DeleteEmployeeDialog key={deleting.a365_employeeid} employee={deleting} isAdmin={isAdmin} onClose={() => setDeleting(null)} onDeleted={() => setDeleting(null)} />}
      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
      />
    </div>
  )
}
