import { useState } from "react"
import { CalendarDays, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LeaveAccess } from "@/features/leave/leave-access"
import { LeaveEmployeePicker } from "@/features/leave/employee-picker"
import { LeaveBalances } from "@/features/leave/leave-balances"
import { LeaveRecords } from "@/features/leave/leave-records"
import { LeaveDetail } from "@/features/leave/leave-detail"
import { AddLeaveDialog } from "@/features/leave/add-leave-dialog"
import { validYear } from "@/features/leave/rules"
import { benefitLabels, conversionStatusLabels, leaveStatusLabels, leaveTypeLabels, poolLabels, transactionTypeLabels } from "@/features/leave/types"
import type { LeaveEmployee, LeaveFilters, LeaveSection, SourceReference } from "@/features/leave/types"

function ChoiceFilter({ label, value, labels, onChange }: { label: string; value: string; labels: Readonly<Record<number, string>>; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(labels).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
}

function LeaveWorkspace() {
  const currentYear = new Date().getFullYear()
  const [employee, setEmployee] = useState<LeaveEmployee | null>(null)
  const [filters, setFilters] = useState<LeaveFilters>({ section: "leave", year: currentYear, employeeId: "", search: "", status: "all", type: "all", benefit: "all" })
  const [year, setYear] = useState(String(currentYear))
  const [search, setSearch] = useState("")
  const [validation, setValidation] = useState("")
  const [source, setSource] = useState<SourceReference | null>(null)
  const [addLeaveOpen, setAddLeaveOpen] = useState(false)
  const section = filters.section
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarDays className="size-6 text-primary" aria-hidden />Leave Management</h1><p className="text-sm text-muted-foreground">Employee leave, VL and SL credits, and cash conversion history.</p></div><Button onClick={() => setAddLeaveOpen(true)}><Plus className="size-4" aria-hidden />Add Leave</Button></header>
    <div className="rounded-md border bg-muted/30 p-4 text-sm" role="note"><p className="font-medium">Admins record leave directly.</p><p className="mt-1 text-muted-foreground">Use Add Leave to review the current April–March credits and workdays. The history below preserves recorded ledger years. Cash conversion and cancellation are handled separately.</p></div>
    <form className="flex flex-wrap items-end gap-4" onSubmit={event => {
      event.preventDefault()
      if (!validYear(Number(year))) { setValidation("Enter a whole year from 1900 to 9998."); return }
      setValidation(""); setFilters(previous => ({ ...previous, year: Number(year), search: search.trim() }))
    }}>
      <div className="space-y-2"><Label>Employee</Label><div><LeaveEmployeePicker value={employee} onSelect={selected => { setEmployee(selected); setFilters(previous => ({ ...previous, employeeId: selected?.a365_employeeid ?? "" })) }} /></div></div>
      <div className="w-28 space-y-2"><Label htmlFor="leave-year">Year</Label><Input id="leave-year" type="number" min={1900} max={9998} step={1} required value={year} onChange={event => setYear(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={validation ? "leave-filter-error" : undefined} /></div>
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="leave-search">Search record name</Label><Input id="leave-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…" /></div>
      <Button type="submit" variant="outline">Apply filters</Button>
      {validation && <p id="leave-filter-error" role="alert" className="w-full text-sm text-destructive">{validation}</p>}
    </form>
    <LeaveBalances employeeId={filters.employeeId} year={filters.year} />
    <Tabs value={section} onValueChange={value => setFilters(previous => ({ ...previous, section: value as LeaveSection, status: "all", type: "all", benefit: "all" }))} className="space-y-4">
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="leave">Leave</TabsTrigger><TabsTrigger value="credits">Credit History</TabsTrigger><TabsTrigger value="conversions">Cash Conversions</TabsTrigger></TabsList>
      <div className="flex flex-wrap gap-4">
        <ChoiceFilter label={section === "credits" ? "Movement" : "Status"} value={filters.status} labels={section === "leave" ? leaveStatusLabels : section === "credits" ? transactionTypeLabels : conversionStatusLabels} onChange={status => setFilters(previous => ({ ...previous, status }))} />
        {section !== "conversions" && <ChoiceFilter label={section === "credits" ? "Credit pool" : "Leave type"} value={filters.type} labels={section === "credits" ? poolLabels : leaveTypeLabels} onChange={type => setFilters(previous => ({ ...previous, type }))} />}
        {section === "leave" && <ChoiceFilter label="Benefit" value={filters.benefit} labels={benefitLabels} onChange={benefit => setFilters(previous => ({ ...previous, benefit }))} />}
      </div>
      <TabsContent value={section}><LeaveRecords key={JSON.stringify(filters)} filters={filters} onOpen={setSource} /></TabsContent>
    </Tabs>
    <LeaveDetail source={source} onClose={() => setSource(null)} />
    <AddLeaveDialog open={addLeaveOpen} onOpenChange={setAddLeaveOpen} />
  </div>
}

export default function LeavePage() {
  return <LeaveAccess><LeaveWorkspace /></LeaveAccess>
}
