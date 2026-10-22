import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeaveAccess } from "@/features/leave/leave-access"
import { LeaveRecords } from "@/features/leave/leave-records"
import { LeaveDetail } from "@/features/leave/leave-detail"
import { leaveService } from "@/features/leave/leave-service"
import { validYear } from "@/features/leave/rules"
import type { SourceReference } from "@/features/leave/types"
import { ConversionEmployees } from "@/features/leave/conversion-employees"
import { currentLeaveYear } from "@/features/leave/conversion-rules"

function ConversionYears() {
  const navigate = useNavigate()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const query = useQuery({ queryKey: ["leave", "conversion-years"], queryFn: leaveService.conversionYears, retry: false })
  return <>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (validYear(Number(year))) navigate(`/leave-conversion/${Number(year)}`) }}>
      <div className="space-y-2"><Label htmlFor="conversion-year">Year</Label><Input id="conversion-year" className="w-32" type="number" required min={1900} max={9998} step={1} value={year} onChange={event => setYear(event.target.value)} /></div>
      <Button type="submit">Open year</Button>
    </form>
    {query.isPending ? <div role="status" aria-label="Loading conversion years"><Skeleton className="h-40 w-full" /></div>
      : query.isError ? <div role="alert" className="space-y-3 rounded-md border p-4"><p>Unable to load conversion years.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
        : <div className="rounded-md border"><Table aria-label="Leave conversion years"><TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{query.data.map(value => <TableRow key={value}><TableCell><Link className="font-medium text-primary hover:underline" to={`/leave-conversion/${value}`}>{value}</Link></TableCell><TableCell><Button asChild variant="ghost" size="sm"><Link to={`/leave-conversion/${value}`}>View employees</Link></Button></TableCell></TableRow>)}</TableBody></Table></div>}
  </>
}

function ConversionWorkspace() {
  const { year: yearParam } = useParams()
  const year = Number(yearParam)
  const [source, setSource] = useState<SourceReference | null>(null)
  const isDetail = yearParam !== undefined
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    {isDetail && <Link to="/leave-conversion" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Leave Conversion</Link>}
    <header className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Coins className="size-6 text-primary" aria-hidden />Leave Conversion{isDetail && validYear(year) ? ` — ${year}` : ""}</h1><p className="text-sm text-muted-foreground">Annual vacation leave conversion. Maximum of 5 VL days per employee per year.</p></header>
    {!isDetail ? <ConversionYears /> : !validYear(year) ? <p role="alert">Select a whole year from 1900 to 9998.</p> : <>
      <p role="note" className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">Daily rate is current monthly basic salary ÷ 22, rounded to two decimals. Convertible VL is limited to the available balance and the unused portion of the annual five-day limit. Amounts are previews; no credits are deducted or payments made.{year < currentLeaveYear() ? " Past years use their posted ledger balances; current salary is not a historical rate." : " Current-year balances include credits due to post, matching Add Leave."}</p>
      <ConversionEmployees key={year} year={year} />
      <h2 className="text-lg font-semibold">Recorded conversions</h2>
      <LeaveRecords key={year} filters={{ section: "conversions", year, employeeId: "", search: "", status: "all", type: "all", benefit: "all" }} onOpen={setSource} />
    </>}
    <LeaveDetail source={source} onClose={() => setSource(null)} />
  </div>
}

export default function LeaveConversionPage() {
  return <LeaveAccess><ConversionWorkspace /></LeaveAccess>
}
