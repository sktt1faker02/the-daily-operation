import { useDeferredValue, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { leaveService } from "./leave-service"
import type { LeaveEmployee } from "./types"

export function LeaveEmployeePicker({ value, onSelect, allowAll = true, disabled = false, label = "Employee" }: {
  value: LeaveEmployee | null
  onSelect: (employee: LeaveEmployee | null) => void
  allowAll?: boolean
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const query = useInfiniteQuery({
    queryKey: ["leave", "employee-picker", deferredSearch],
    queryFn: ({ pageParam }) => leaveService.searchEmployees(deferredSearch, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.next,
    enabled: open && !disabled, retry: false,
  })
  const employees = query.data?.pages.flatMap(page => page.rows) ?? []
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" disabled={disabled} variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="w-full justify-between font-normal sm:w-72"><span className="truncate">{value?.a365_name ?? (allowAll ? "All employees" : "Select an employee…")}</span><ChevronsUpDown className="size-4 shrink-0" aria-hidden /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-w-[90vw] p-0">
      <Command shouldFilter={false}>
        <CommandInput aria-label="Search employees" placeholder="Search name or employee number…" value={search} onValueChange={setSearch} />
        <CommandList>
          {allowAll && <CommandItem value="all" onSelect={() => { onSelect(null); setOpen(false) }}>All employees</CommandItem>}
          {query.isPending && <p role="status" className="p-3 text-sm">Loading employees…</p>}
          {query.isError && <div role="alert" className="space-y-2 p-3 text-sm"><p>Unable to load employees.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry employees</Button></div>}
          {!query.isError && employees.map(employee => <CommandItem key={employee.a365_employeeid} value={employee.a365_employeeid} onSelect={() => { onSelect(employee); setOpen(false) }}>
            <Check className={`size-4 ${value?.a365_employeeid === employee.a365_employeeid ? "opacity-100" : "opacity-0"}`} aria-hidden />
            <span>{employee.a365_name}{employee.a365_employeenumber && <span className="ml-2 text-xs text-muted-foreground">{employee.a365_employeenumber}</span>}</span>
          </CommandItem>)}
          {query.isSuccess && !employees.length && <p className="p-3 text-sm text-muted-foreground">No matching employees.</p>}
        </CommandList>
      </Command>
      {query.hasNextPage && <Button variant="ghost" className="w-full" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "More employees"}</Button>}
    </PopoverContent>
  </Popover>
}
