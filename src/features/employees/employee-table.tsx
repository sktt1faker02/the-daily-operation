/**
 * Employee data grid (TanStack Table + shadcn Table). Presentation only —
 * data and mutations arrive via props from the page.
 */
import { useMemo, useState } from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import {
  EmploymentStatus,
  employmentStatusLabel,
  employmentTypeLabel,
  type Employee,
} from "./types"

function StatusBadge({ status }: { status: EmploymentStatus | null }) {
  const label = employmentStatusLabel(status)
  const variant =
    status === EmploymentStatus.Active
      ? "default"
      : status === EmploymentStatus.OnLeave
        ? "secondary"
        : "outline"
  return <Badge variant={variant}>{label}</Badge>
}

function SortableHeader({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 data-[state=open]:bg-accent"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown className="ml-1.5 size-3.5" aria-hidden />
    </Button>
  )
}

export function EmployeeTable({
  employees,
  onEdit,
  departmentNames,
  positionNames,
}: {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  /** Map of a365_department id → name, for resolving the lookup. */
  departmentNames: Map<string, string>
  /** Map of a365_position id → name, for resolving the lookup. */
  positionNames: Map<string, string>
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "a365_employeenumber",
        header: ({ column }) => (
          <SortableHeader
            label="Employee #"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.a365_employeenumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "a365_name",
        header: ({ column }) => (
          <SortableHeader
            label="Name"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.a365_name}</span>
            {row.original.a365_workemail && (
              <span className="text-xs text-muted-foreground">
                {row.original.a365_workemail}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "department",
        header: "Department",
        cell: ({ row }) => {
          const id = row.original._a365_department_value
          return (id && departmentNames.get(id)) || "—"
        },
      },
      {
        id: "position",
        header: "Position",
        cell: ({ row }) => {
          const id = row.original._a365_position_value
          return (id && positionNames.get(id)) || "—"
        },
      },
      {
        accessorKey: "a365_employmentstatus",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.a365_employmentstatus} />,
      },
      {
        accessorKey: "a365_employmenttype",
        header: "Type",
        cell: ({ row }) => employmentTypeLabel(row.original.a365_employmenttype),
      },
      {
        accessorKey: "a365_basicmonthlysalary",
        header: () => <div className="text-right">Basic Salary</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.a365_basicmonthlysalary)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row.original)}
              aria-label={`Edit ${row.original.a365_name}`}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, departmentNames, positionNames],
  )

  const table = useReactTable({
    data: employees,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
