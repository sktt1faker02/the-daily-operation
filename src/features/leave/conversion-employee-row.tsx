import { Pencil } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { conversionAmount, validateConversionDraft } from "./conversion-types"
import type { ConversionDraft, ConversionRow } from "./conversion-types"

export function EmployeeRow({ row, draft, editing, disabled, onEdit, onChange, onDone, onCancel }: {
  row: ConversionRow; draft?: ConversionDraft; editing: boolean; disabled: boolean
  onEdit: () => void; onChange: (draft: ConversionDraft) => void; onDone: () => void; onCancel: () => void
}) {
  const errors = draft ? validateConversionDraft(draft) : {}
  const editButton = useRef<HTMLButtonElement>(null)
  const finish = (action: () => void) => { action(); requestAnimationFrame(() => editButton.current?.focus()) }
  const valid = !Object.keys(errors).length
  const amount = draft && valid ? conversionAmount(row.dailyRate, Number(draft.days)) : draft ? null : row.amount
  return <TableRow>
    <TableCell className="font-medium">{row.employeeName}<p className="text-xs font-normal text-muted-foreground">{row.employeeNumber || row.employeeId}</p></TableCell>
    <TableCell className="text-right tabular-nums">{formatCurrency(row.dailyRate)}</TableCell>
    {(["availableVL", "days"] as const).map(key => <TableCell key={key} className="text-right tabular-nums">{editing && draft ? <div className="ml-auto max-w-44 space-y-1">
      <Input autoFocus={key === "availableVL"} type="number" inputMode="decimal" min="0" step="0.5" max={key === "days" ? 5 : 1000000000} aria-label={`${key === "days" ? "VL to convert" : "Available VL"} for ${row.employeeName}`} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${row.id}-${key}-error` : undefined} value={draft[key]} disabled={disabled} onChange={event => onChange({ ...draft, [key]: event.target.value })} onKeyDown={event => { if (event.key === "Escape") finish(onCancel); if (event.key === "Enter" && valid) finish(onDone) }} />
      {errors[key] && <p id={`${row.id}-${key}-error`} role="alert" className="text-left text-xs text-destructive">{errors[key]}</p>}
    </div> : Number(draft?.[key] ?? row[key]).toFixed(2)}</TableCell>)}
    <TableCell className="text-right tabular-nums">{amount === null ? "—" : formatCurrency(amount)}</TableCell>
    <TableCell><div className="flex gap-2">{editing ? <><Button size="sm" disabled={disabled || !valid} onClick={() => finish(onDone)}>Done</Button><Button size="sm" variant="outline" disabled={disabled} onClick={() => finish(onCancel)}>Cancel</Button></> : <Button ref={editButton} size="sm" variant="secondary" disabled={disabled} onClick={onEdit} aria-label={`Edit ${row.employeeName}`}><Pencil className="size-4" aria-hidden />Edit</Button>}</div></TableCell>
  </TableRow>
}
