import { useState } from "react"
import { CalendarDays, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChoiceFilter } from "@/features/leave/choice-filter"
import { LeaveAccess } from "@/features/leave/leave-access"
import { LeaveEmployeePicker } from "@/features/leave/employee-picker"
import { LeaveBalances } from "@/features/leave/leave-balances"
import { LeaveRecords } from "@/features/leave/leave-records"
import { LeaveDetail } from "@/features/leave/leave-detail"
import { AddLeaveDialog } from "@/features/leave/add-leave-dialog"
import { RefreshLeaveDialog } from "@/features/leave/reset-leave-dialog"
import { validYear } from "@/features/leave/rules"
import { benefitLabels, leaveTypeLabels } from "@/features/leave/types"
import type { LeaveEmployee, LeaveFilters, SourceReference } from "@/features/leave/types"

function LeaveWorkspace() {
  const currentYear = new Date().getFullYear()
  const [employee, setEmployee] = useState<LeaveEmployee | null>(null)
  const [filters, setFilters] = useState<LeaveFilters>({ section: "leave", year: currentYear, employeeId: "", search: "", status: "all", type: "all", benefit: "all" })
  const [year, setYear] = useState(String(currentYear))
  const [validation, setValidation] = useState("")
  const [source, setSource] = useState<SourceReference | null>(null)
  const [addLeaveOpen, setAddLeaveOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarDays className="size-6 text-primary" aria-hidden />Leave Management</h1><p className="text-sm text-muted-foreground">Employee leave records.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setResetOpen(true)}>Refresh balance</Button><Button onClick={() => setAddLeaveOpen(true)}><Plus className="size-4" aria-hidden />Add Leave</Button></div></header>
    <div className="rounded-md border bg-muted/30 p-4 text-sm" role="note"><p className="font-medium">Admins record leave directly.</p><p className="mt-1 text-muted-foreground">Use Add Leave to review current credits and workdays. View annual conversions in Leave Conversion.</p></div>
    <form className="flex flex-wrap items-end gap-4" onSubmit={event => {
      event.preventDefault()
      if (!validYear(Number(year))) { setValidation("Enter a whole year from 1900 to 9998."); return }
      setValidation(""); setFilters(previous => ({ ...previous, year: Number(year) }))
    }}>
      <div className="space-y-2"><Label>Employee</Label><div><LeaveEmployeePicker value={employee} onSelect={selected => { setEmployee(selected); setFilters(previous => ({ ...previous, employeeId: selected?.a365_employeeid ?? "" })) }} /></div></div>
      <div className="w-28 space-y-2"><Label htmlFor="leave-year">Year</Label><Input id="leave-year" type="number" min={1900} max={9998} step={1} required value={year} onChange={event => setYear(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={validation ? "leave-filter-error" : undefined} /></div>
      <Button type="submit" variant="outline">Apply filters</Button>
      {validation && <p id="leave-filter-error" role="alert" className="w-full text-sm text-destructive">{validation}</p>}
    </form>
    <LeaveBalances key={`${filters.employeeId}-${filters.year}`} employeeId={filters.employeeId} year={filters.year} employee={employee ?? undefined} />
    <div className="flex flex-wrap gap-4">
      <ChoiceFilter label="Leave type" value={filters.type} labels={leaveTypeLabels} onChange={type => setFilters(previous => ({ ...previous, type }))} />
      <ChoiceFilter label="Benefit" value={filters.benefit} labels={benefitLabels} onChange={benefit => setFilters(previous => ({ ...previous, benefit }))} />
    </div>
    <LeaveRecords key={JSON.stringify(filters)} filters={filters} onOpen={setSource} />
    <LeaveDetail source={source} onClose={() => setSource(null)} />
    {resetOpen && <RefreshLeaveDialog onClose={() => setResetOpen(false)} />}
    <AddLeaveDialog open={addLeaveOpen} onOpenChange={setAddLeaveOpen} />
  </div>
}

export default function LeavePage() {
  return <LeaveAccess><LeaveWorkspace /></LeaveAccess>
}
