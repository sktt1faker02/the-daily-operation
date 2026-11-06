import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { currentCreditYear, employeeLeaveService } from "./employee-leave-service"
import type { LeaveEmployee } from "./types"

export function SyncEmployeeLeave({ employee, year }: { employee: LeaveEmployee; year: number }) {
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const sync = useMutation({
    mutationFn: () => employeeLeaveService.sync(employee.a365_employeeid, year), retry: false,
    onSuccess: async result => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["leave", "balances", employee.a365_employeeid, year] }),
        client.invalidateQueries({ queryKey: ["leave", "posting-preview", employee.a365_employeeid] }),
        client.invalidateQueries({ queryKey: ["leave", "conversion", "rows", year] }),
        client.invalidateQueries({ queryKey: ["leave", "conversion", "years"] }),
      ])
      toast.success(result.eligible ? "Leave credits synchronized." : "No credits are due: the employee is outside eligible employment dates or status.")
      setOpen(false)
    },
  })
  return <>
    <Button variant="outline" disabled={year !== currentCreditYear()} onClick={() => { sync.reset(); setOpen(true) }}>Sync leave credits</Button>
    <Dialog open={open} onOpenChange={value => { if (!sync.isPending) setOpen(value) }}>
      <DialogContent showCloseButton={!sync.isPending} onEscapeKeyDown={event => { if (sync.isPending) event.preventDefault() }} onInteractOutside={event => { if (sync.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>Sync leave credits for {employee.a365_name}?</DialogTitle><DialogDescription>Post any missing SL grant and completed monthly VL accrual for {year}. Add this Active employee to the existing unpaid conversion for {year} if missing. Existing leave deductions, manual limits and paid conversions are retained. This does not reset balances or make a payment.</DialogDescription></DialogHeader>
        {sync.isError && <p role="alert">{sync.error.message}</p>}
        <DialogFooter><Button variant="outline" disabled={sync.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? "Syncing…" : "Confirm sync"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
