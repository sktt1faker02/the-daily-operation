import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { sendPayslipReadyNotifications, type PayslipNotificationReport, type PayslipNotificationStatus } from "./services/payslip-ready-notification-service"

const labels: Record<PayslipNotificationStatus, string> = {
  accepted: "Accepted", "missing-email": "Work Email needed", unavailable: "Not sent", unknown: "Outcome uncertain",
}

/** Transient results for this release; accepted recipients are excluded from retries. */
export function PayslipReadyNotifications({ initial, onSendingChange }: {
  initial: PayslipNotificationReport
  onSendingChange: (sending: boolean) => void
}) {
  const [report, setReport] = useState(initial)
  const [reviewed, setReviewed] = useState(false)
  const remaining = report.recipients.filter(row => row.status !== "accepted")
  const uncertain = remaining.some(row => row.status === "unknown")
  const accepted = report.recipients.length - remaining.length
  const retry = useMutation({
    mutationFn: () => sendPayslipReadyNotifications({ periodId: report.periodId,
      expectedReadyOn: report.readyOn,
      ...(remaining.length ? { entryIds: remaining.map(row => row.entryId) } : {}),
    }),
    retry: false,
    onMutate: () => onSendingChange(true),
    onSuccess: next => {
      const updates = new Map(next.recipients.map(row => [row.entryId, row]))
      setReport(previous => ({ ...next, readyOn: previous.readyOn ?? next.readyOn, recipients: previous.recipients.length
        ? previous.recipients.map(row => updates.get(row.entryId) ?? row) : next.recipients }))
      setReviewed(false)
    },
    onSettled: () => onSendingChange(false),
  })
  return <section aria-label="Payslip email notifications" className="space-y-3 rounded-md border p-4 text-sm">
    <h2 className="font-semibold">Payslip email notifications</h2>
    <p role="status" aria-live="polite">{retry.isPending ? "Sending notifications. Keep this page open…" :
      `${accepted} accepted by the sending service${remaining.length ? `; ${remaining.length} need attention` : ""}.`}</p>
    <p className="text-xs text-muted-foreground">Acceptance does not confirm inbox delivery. Keep this report open until notification issues are resolved.</p>
    {report.error && <p role="alert" className="text-destructive">{report.error}</p>}
    {retry.isError && <p role="alert" className="text-destructive">Unable to retry notifications. Check the sending account before trying again.</p>}
    {!report.error && report.recipients.length === 0 && <p>No included employees to notify.</p>}
    {report.recipients.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left">
      <caption className="sr-only">Notification results for included payroll employees</caption>
      <thead><tr className="border-b"><th scope="col" className="p-2">Employee</th><th scope="col" className="p-2">Status</th><th scope="col" className="p-2">Details</th></tr></thead>
      <tbody>{report.recipients.map(row => <tr key={row.entryId} className="border-b last:border-0">
        <th scope="row" className="p-2 font-normal">{row.name}</th><td className="p-2">{labels[row.status]}</td><td className="p-2">{row.detail}</td>
      </tr>)}</tbody>
    </table></div>}
    {uncertain && <div className="flex items-start gap-2">
      <Checkbox id="review-payslip-notifications" checked={reviewed} disabled={retry.isPending} onCheckedChange={value => setReviewed(value === true)} />
      <Label htmlFor="review-payslip-notifications" className="leading-normal">I checked the sending account and accept that retrying an uncertain outcome may send a duplicate email.</Label>
    </div>}
    {(remaining.length > 0 || report.error) && <Button type="button" variant="outline" disabled={retry.isPending || (uncertain && !reviewed)} onClick={() => retry.mutate()}>
      {retry.isPending ? "Sending…" : "Retry remaining notifications"}
    </Button>}
  </section>
}
