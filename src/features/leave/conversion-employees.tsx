import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/format"
import { leaveService } from "./leave-service"

export function ConversionEmployees({ year }: { year: number }) {
  const [index, setIndex] = useState(0)
  const query = useInfiniteQuery({
    queryKey: ["leave", "conversion-employees", year],
    queryFn: ({ pageParam }) => leaveService.conversionEmployees(year, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.next, retry: false,
  })
  const page = query.data?.pages[index]
  async function next() {
    if (query.data && index < query.data.pages.length - 1) { setIndex(index + 1); return }
    const result = await query.fetchNextPage()
    if (!result.isError && result.data && result.data.pages.length > index + 1) setIndex(index + 1)
  }
  if (query.isPending) return <div role="status" aria-label="Loading employee conversions"><Skeleton className="h-48 w-full" /></div>
  if (query.isError || !page) return <div role="alert" className="space-y-3"><p>Unable to load employee conversion previews.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
  return <section aria-label="Employee conversion previews" className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Employees</h2><Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh balances</Button></div>
    <div className="rounded-md border"><Table aria-label="Employee conversion previews"><TableHeader><TableRow><TableHead>Employee name</TableHead><TableHead className="text-right">Daily rate</TableHead><TableHead className="text-right">Available VL</TableHead><TableHead className="text-right">Already converted</TableHead><TableHead className="text-right">VL to convert (max. 5)</TableHead><TableHead className="text-right">Total amount to be paid</TableHead></TableRow></TableHeader><TableBody>
      {page.rows.map(({ employee, preview, error }) => <TableRow key={employee.a365_employeeid}><TableCell className="font-medium">{employee.a365_name}<p className="text-xs font-normal text-muted-foreground">{employee.a365_employeenumber}</p></TableCell>{preview ? <><TableCell className="text-right tabular-nums">{formatCurrency(preview.dailyRate)}</TableCell><TableCell className="text-right tabular-nums">{preview.availableVL.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{preview.converted.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{preview.days.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(preview.amount)}</TableCell></> : <TableCell colSpan={5} className="text-sm text-destructive">{error}</TableCell>}</TableRow>)}
      {!page.rows.length && <TableRow><TableCell colSpan={6} className="h-16 text-muted-foreground">No employees found. Add employees in the Employees module.</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">Page {index + 1}{query.isFetching ? " · Refreshing…" : ""}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={query.isFetching || index === 0} onClick={() => setIndex(index - 1)}>Previous page</Button><Button size="sm" variant="outline" disabled={query.isFetching || (!query.hasNextPage && index >= query.data!.pages.length - 1)} onClick={() => void next()}>Next page</Button></div></div>
  </section>
}
