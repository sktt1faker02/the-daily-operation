import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { choiceLabel, formatDays, formatLeaveDate } from "./rules"
import { benefitLabels, conversionStatusLabels, leaveStatusLabels, leaveTypeLabels, poolLabels, transactionTypeLabels } from "./types"
import type { LeaveFilters, SourceReference } from "./types"
import { useLeavePage } from "./use-leave"

export function LeaveRecords({ filters, onOpen, personal = false }: { filters: LeaveFilters; onOpen: (source: SourceReference) => void; personal?: boolean }) {
  const query = useLeavePage(filters, personal)
  const [index, setIndex] = useState(0)
  const page = query.data?.pages[index]
  const title = filters.section === "leave" ? "Leave records" : filters.section === "credits" ? "Credit history" : "Cash conversions"
  const names = new Map(page?.employees.map(employee => [employee.a365_employeeid.toLowerCase(), employee.a365_name]))
  const employeeName = (id?: string) => id ? names.get(id.toLowerCase()) ?? "Employee name unavailable" : "Employee unavailable"
  async function next() {
    if (query.data && index < query.data.pages.length - 1) { setIndex(index + 1); return }
    const result = await query.fetchNextPage()
    if (!result.isError && result.data && result.data.pages.length > index + 1) setIndex(index + 1)
  }
  if (query.isPending) return <div role="status" aria-label={`Loading ${title.toLowerCase()}`} aria-busy="true"><Skeleton className="h-48 w-full" /></div>
  if (query.isError || !page) return <div role="alert" className="space-y-3 rounded-md border p-5"><p>Unable to load {title.toLowerCase()}. Check your access and try again.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry records</Button></div>
  const count = page.leaves.length + page.credits.length + page.conversions.length
  const headers = filters.section === "leave" ? ["Record", "Employee", "Type", "Benefit", "Dates", "Days", "Status", "Action"]
    : filters.section === "credits" ? ["Date", "Employee", "Year", "Pool", "Movement", "Days", "Source", "Note"]
      : ["Record", "Employee", "Year", "Days", "Daily rate used", "Amount", "Status", "Action"]
  return <section aria-label={title} className="space-y-3">
    <div className="rounded-md border"><Table aria-label={title}>
      <TableHeader><TableRow>{headers.map(header => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {page.leaves.map(row => <TableRow key={row.a365_leaveid}>
          <TableCell className="font-medium">{row.a365_name}</TableCell><TableCell>{employeeName(row._a365_employee_value)}</TableCell>
          <TableCell>{choiceLabel(leaveTypeLabels, row.a365_leavetype)}</TableCell><TableCell>{choiceLabel(benefitLabels, row.a365_benefit)}</TableCell>
          <TableCell className="whitespace-nowrap">{formatLeaveDate(row.a365_startdate)} – {formatLeaveDate(row.a365_enddate)}</TableCell><TableCell className="tabular-nums">{formatDays(row.a365_days)}</TableCell>
          <TableCell><Badge variant="outline">{choiceLabel(leaveStatusLabels, row.a365_leavestatus)}</Badge></TableCell>
          <TableCell><Button variant="ghost" size="sm" aria-label={`View ${row.a365_name}`} onClick={() => onOpen({ kind: "leave", id: row.a365_leaveid })}>Details</Button></TableCell>
        </TableRow>)}
        {page.conversions.map(row => <TableRow key={row.a365_leavecashconversionid}>
          <TableCell className="font-medium">{row.a365_name}</TableCell><TableCell>{employeeName(row._a365_employee_value)}</TableCell><TableCell>{row.a365_year}</TableCell>
          <TableCell className="tabular-nums">{formatDays(row.a365_days)}</TableCell><TableCell className="tabular-nums">{formatCurrency(row.a365_dailyrateused)}</TableCell><TableCell className="tabular-nums">{formatCurrency(row.a365_amount)}</TableCell>
          <TableCell><Badge variant="outline">{choiceLabel(conversionStatusLabels, row.a365_conversionstatus)}</Badge></TableCell><TableCell><Button variant="ghost" size="sm" aria-label={`View ${row.a365_name}`} onClick={() => onOpen({ kind: "conversion", id: row.a365_leavecashconversionid })}>Details</Button></TableCell>
        </TableRow>)}
        {page.credits.map(row => <TableRow key={row.a365_leavecredittransactionid}>
          <TableCell className="whitespace-nowrap">{formatDateTime(row.createdon)}</TableCell><TableCell>{employeeName(row._a365_employee_value)}</TableCell><TableCell>{row.a365_year}</TableCell><TableCell>{choiceLabel(poolLabels, row.a365_creditpool)}</TableCell>
          <TableCell>{choiceLabel(transactionTypeLabels, row.a365_transactiontype)}</TableCell><TableCell className="tabular-nums">{row.a365_days > 0 ? "+" : ""}{formatDays(row.a365_days)}</TableCell>
          <TableCell>{row._a365_leave_value ? <Button variant="link" size="sm" onClick={() => onOpen({ kind: "leave", id: row._a365_leave_value! })}>View leave</Button> : row._a365_cashconversion_value ? <Button variant="link" size="sm" onClick={() => onOpen({ kind: "conversion", id: row._a365_cashconversion_value! })}>View conversion</Button> : row.a365_name}</TableCell>
          <TableCell className="min-w-48 whitespace-pre-wrap break-words">{row.a365_note ?? "—"}</TableCell>
        </TableRow>)}
        {!count && <TableRow><TableCell colSpan={headers.length} className="h-16 text-muted-foreground">No records.</TableCell></TableRow>}
      </TableBody>
    </Table></div>
    {!count && <p role="status" className="text-sm text-muted-foreground">{personal ? (filters.search || [filters.status, filters.type, filters.benefit].some(value => value !== "all") ? "No leave records match these filters. Try changing your filters." : `No leave recorded for ${filters.year}. Leave recorded by your administrator will appear here.`) : `No ${title.toLowerCase()} match these filters. Try another year, employee or search.`}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">Page {index + 1} · {count} records{query.isFetchingNextPage ? " · Loading next page…" : ""}</p><div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={query.isFetching || index === 0} onClick={() => setIndex(index - 1)}>Previous page</Button>
      <Button variant="outline" size="sm" disabled={query.isFetching || (!query.hasNextPage && index >= query.data!.pages.length - 1)} onClick={() => void next()}>Next page</Button>
    </div></div>
  </section>
}
