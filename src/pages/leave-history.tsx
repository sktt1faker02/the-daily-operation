import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentEmployee } from "@/features/payroll/hooks/use-current-employee"
import { ChoiceFilter } from "@/features/leave/choice-filter"
import { LeaveBalances } from "@/features/leave/leave-balances"
import { LeaveRecords } from "@/features/leave/leave-records"
import { PersonalLeaveDetail } from "@/features/leave/personal-leave-detail"
import { validYear } from "@/features/leave/rules"
import { benefitLabels, leaveStatusLabels, leaveTypeLabels } from "@/features/leave/types"
import type { LeaveEmployee, LeaveFilters } from "@/features/leave/types"

function PersonalHistory({ employee }: { employee: Pick<LeaveEmployee, "a365_employeeid" | "a365_name"> }) {
  const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Manila" }).format(new Date()))
  const [filters, setFilters] = useState<LeaveFilters>({ section: "leave", year: currentYear, employeeId: employee.a365_employeeid, search: "", status: "all", type: "all", benefit: "all" })
  const [year, setYear] = useState(String(currentYear))
  const [search, setSearch] = useState("")
  const [validation, setValidation] = useState("")
  const [recordId, setRecordId] = useState<string | null>(null)
  return <>
    <p className="rounded-md border bg-muted/30 p-4 text-sm" role="note">Leave is recorded by your administrator. This page is read-only.</p>
    <form className="flex flex-wrap items-end gap-4" onSubmit={event => {
      event.preventDefault()
      if (!validYear(Number(year))) { setValidation("Enter a whole year from 1900 to 9998."); return }
      setValidation(""); setFilters(previous => ({ ...previous, year: Number(year), search: search.trim() }))
    }}>
      <div className="min-w-48 space-y-2"><p className="text-sm font-medium">Employee</p><p className="py-2 text-sm">{employee.a365_name}</p></div>
      <div className="w-28 space-y-2"><Label htmlFor="history-year">Year</Label><Input id="history-year" type="number" min={1900} max={9998} step={1} required value={year} onChange={event => setYear(event.target.value)} aria-invalid={Boolean(validation)} aria-describedby={validation ? "history-filter-error" : undefined} /></div>
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="history-search">Search record name</Label><Input id="history-search" type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…" /></div>
      <Button type="submit" variant="outline">Apply filters</Button>
      {validation && <p id="history-filter-error" role="alert" className="w-full text-sm text-destructive">{validation}</p>}
    </form>
    <LeaveBalances employeeId={employee.a365_employeeid} year={filters.year} personal />
    <div className="flex flex-wrap gap-4">
      <ChoiceFilter label="Status" value={filters.status} labels={leaveStatusLabels} onChange={status => setFilters(previous => ({ ...previous, status }))} />
      <ChoiceFilter label="Leave type" value={filters.type} labels={leaveTypeLabels} onChange={type => setFilters(previous => ({ ...previous, type }))} />
      <ChoiceFilter label="Benefit" value={filters.benefit} labels={benefitLabels} onChange={benefit => setFilters(previous => ({ ...previous, benefit }))} />
    </div>
    <LeaveRecords key={JSON.stringify(filters)} filters={filters} personal onOpen={source => { if (source.kind === "leave") setRecordId(source.id) }} />
    <PersonalLeaveDetail employeeId={employee.a365_employeeid} recordId={recordId} onClose={() => setRecordId(null)} />
  </>
}

export default function LeaveHistoryPage() {
  const employee = useCurrentEmployee()
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarDays className="size-6 text-primary" aria-hidden />Leave History</h1><p className="text-sm text-muted-foreground">View your leave records and remaining balances.</p></header>
    {employee.isPending ? <div role="status" aria-label="Loading employee profile" aria-busy="true"><Skeleton className="h-48 w-full" /></div>
      : employee.isError ? <div role="alert" className="space-y-3 rounded-md border p-5"><p>Unable to load your employee profile. Please try again or contact your payroll administrator.</p><Button variant="outline" onClick={() => void employee.refetch()}>Retry employee profile</Button></div>
      : !employee.data ? <div className="space-y-2 rounded-md border border-dashed p-5"><p className="font-medium">No employee profile linked</p><p>Your account is not linked to an employee record. Contact your payroll administrator to view your leave history.</p></div>
      : <PersonalHistory key={employee.data.a365_employeeid} employee={employee.data} />}
  </div>
}
