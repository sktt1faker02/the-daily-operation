import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDays } from "./rules"
import { useLeaveBalances } from "./use-leave"

export function LeaveBalances({ employeeId, year, personal = false }: { employeeId: string; year: number; personal?: boolean }) {
  const query = useLeaveBalances(employeeId, year, personal)
  if (!employeeId) return <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Select an employee to view their VL and SL balances for {year}.</p>
  if (query.isPending || query.isFetching) return <div role="status" aria-label="Loading balances" aria-busy="true"><p className="mb-2 text-sm">Loading complete credit history…</p><Skeleton className="h-28 w-full" /></div>
  // An error wins over stale cached data; an unreadable balance is never zero.
  if (query.isError) return <div role="alert" className="space-y-2 rounded-md border p-4"><p>Balances unavailable. The complete credit history could not be verified.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry balances</Button></div>
  return <section aria-label="Leave balances" className="space-y-3">
    <div className="grid gap-4 sm:grid-cols-2">{(["VL", "SL"] as const).map(pool => <Card key={pool}><CardHeader><CardTitle className="text-sm text-muted-foreground">{pool} balance · {year}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{formatDays(query.data[pool])} <span className="text-sm font-normal text-muted-foreground">days</span></p></CardContent></Card>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{query.data.movements === 0 ? "No recorded credit movements for this employee and year. No entitlement has been assumed." : `Based on all ${query.data.movements} recorded movements for this employee and year.`}</p><Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Refresh balances</Button></div>
  </section>
}
