import { useRef, type ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Confirmation state only. Authorization and deletion rules belong to the server. */
export function ConfirmedDeleteDialog({ title, description, allowed, configured, confirmLabel, onConfirm, onClose, onDeleted }: {
  title: string
  description: ReactNode
  allowed: boolean
  configured: boolean
  confirmLabel: string
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
  onDeleted: () => void
}) {
  const operationId = useRef(crypto.randomUUID())
  const busy = useRef(false)
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!allowed) throw new Error("You do not have permission to delete this record in its current state.")
      await onConfirm(operationId.current)
    },
    onSuccess: onDeleted,
    onSettled: () => { busy.current = false },
  })
  return <Dialog open onOpenChange={(open) => { if (!open && !busy.current) onClose() }}>
    <DialogContent className="sm:max-w-md" onEscapeKeyDown={(event) => { if (busy.current) event.preventDefault() }} onPointerDownOutside={(event) => { if (busy.current) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {!configured && <p role="alert" className="text-sm text-destructive">Deletion requires the Dataverse server setup before it can be used.</p>}
      {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      <DialogFooter>
        <Button variant="outline" autoFocus disabled={mutation.isPending} onClick={() => { if (!busy.current) onClose() }}>Cancel</Button>
        <Button variant="destructive" disabled={!configured || !allowed || mutation.isPending} onClick={() => {
          if (busy.current) return
          busy.current = true
          mutation.mutate()
        }}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {mutation.isPending ? "Deleting…" : confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
