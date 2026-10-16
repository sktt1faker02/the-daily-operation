/**
 * Payroll entry grid. Editable inputs and calculated columns share a row;
 * calculated columns render on the subtle "Auto" surface to distinguish them
 * from editable values (DESIGN.md "Editable vs Automatic"). Presentation only —
 * actions arrive via props.
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
import { FileText, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import type { PayrollEntry } from "./types"

function money(value: number | null) {
  return <span className="tabular-nums">{formatCurrency(value)}</span>
}

export function PayrollEntryTable({
  entries,
  onEdit,
  editable,
  onViewPayslip,
  viewingId,
}: {
  entries: PayrollEntry[]
  onEdit: (entry: PayrollEntry) => void
  editable: boolean
  /** When provided, a "View Payslip" action is shown (finalized periods only). */
  onViewPayslip?: (entry: PayrollEntry) => void
  /** Id of the entry whose payslip is currently being prepared. */
  viewingId?: string | null
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<PayrollEntry>[]>(
    () => [
      {
        accessorKey: "a365_employeename",
        header: "Employee",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.a365_employeename ?? "—"}</span>
        ),
      },
      {
        accessorKey: "a365_basicpay",
        header: () => <div className="text-right">Basic Pay</div>,
        cell: ({ row }) => <div className="text-right">{money(row.original.a365_basicpay)}</div>,
      },
      {
        accessorKey: "a365_allowances",
        header: () => <div className="text-right">Allowances</div>,
        cell: ({ row }) => <div className="text-right">{money(row.original.a365_allowances)}</div>,
      },
      {
        accessorKey: "a365_grosspay",
        header: () => <div className="text-right">Gross</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right">{money(row.original.a365_grosspay)}</div>
        ),
      },
      {
        accessorKey: "a365_totaldeductions",
        header: () => <div className="text-right">Deductions</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right">
            {money(row.original.a365_totaldeductions)}
          </div>
        ),
      },
      {
        accessorKey: "a365_netpay",
        header: () => <div className="text-right">Net Pay</div>,
        cell: ({ row }) => (
          <div className="bg-surface-subtle text-right font-medium">
            {money(row.original.a365_netpay)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const entry = row.original
          if (!editable) {
            if (!onViewPayslip) return null
            const isViewing = viewingId === entry.a365_payrollentryid
            return (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewPayslip(entry)}
                  disabled={isViewing}
                  aria-label={`View payslip for ${entry.a365_employeename ?? "employee"}`}
                >
                  {isViewing ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="size-3.5" aria-hidden />
                  )}
                  View Payslip
                </Button>
              </div>
            )
          }
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                aria-label={`Edit ${entry.a365_employeename ?? "entry"}`}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
            </div>
          )
        },
      },
    ],
    [onEdit, editable, onViewPayslip, viewingId],
  )

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
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
