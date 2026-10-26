import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { leaveAccessState } from "./rules"
import { LeavePostingError, postingService } from "./posting-service"

export function RetryLeaveEmail({ leaveId }: { leaveId: string }) {
  const access = useAccessProfile({ loadEmployee: false })
  const [reviewed, setReviewed] = useState(false)
  const [message, setMessage] = useState("")
  const client = useQueryClient()
  const retry = useMutation({
    mutationFn: async () => {
      if (leaveAccessState(access) !== "allowed") throw new LeavePostingError("Payroll Admin access is required.", false)
      return postingService.notify(leaveId, reviewed)
    },
    retry: false,
    onSuccess: outcome => {
      setMessage(outcome === "accepted" ? "The sending service accepted the email. This does not confirm inbox delivery." : outcome === "failed" ? "Leave recorded, but the email notification could not be sent." : "Email outcome is uncertain. Check the sending account before confirming another attempt.")
      void client.invalidateQueries({ queryKey: ["leave", "detail"] })
      if (outcome === "accepted") toast.success("Email accepted by the sending service.")
    },
    onError: error => setMessage(error instanceof LeavePostingError ? error.message : "Unable to confirm the email status. Check before retrying."),
  })
  if (leaveAccessState(access) !== "allowed") return null
  return <section aria-label="Leave email" className="space-y-3 rounded-md border p-4 text-sm">
    <p>Send or retry the employee confirmation for this existing Leave. Credits and the Leave record will not be recreated.</p>
    <div className="flex items-start gap-2"><Checkbox id="review-leave-email" checked={reviewed} disabled={retry.isPending} onCheckedChange={checked => setReviewed(checked === true)} /><Label htmlFor="review-leave-email" className="leading-normal">If the earlier send outcome was uncertain, I checked the sending account and accept that retrying may send a duplicate email.</Label></div>
    <Button type="button" variant="outline" disabled={retry.isPending} onClick={() => { setMessage(""); retry.mutate() }}>{retry.isPending ? "Checking email…" : "Send or retry email"}</Button>
    {message && <p role="status">{message}</p>}
  </section>
}
