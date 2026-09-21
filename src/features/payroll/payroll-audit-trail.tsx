/**
 * Read-only lifecycle audit trail for a payroll period (Phase 9). Surfaces the
 * audit stamps already stored on the period — who created, marked Ready, marked
 * Paid, and locked it, and when. Business logic (which events to show) lives in
 * the pure `buildAuditTrail`; this only renders.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, CircleDollarSign, FilePlus2, Lock, type LucideIcon } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { buildAuditTrail, type AuditEvent } from "./period-audit"
import type { PayrollPeriod } from "./types"

const ICONS: Record<AuditEvent["key"], LucideIcon> = {
  created: FilePlus2,
  ready: CheckCircle2,
  paid: CircleDollarSign,
  locked: Lock,
}

export function PayrollAuditTrail({ period }: { period: PayrollPeriod }) {
  const events = buildAuditTrail(period)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit trail</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {events.map((event) => {
            const Icon = ICONS[event.key]
            return (
              <li key={event.key} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-surface-subtle text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {event.label} <span className="font-normal text-muted-foreground">by {event.actor}</span>
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatDateTime(event.at)}</p>
                </div>
              </li>
            )
          })}
        </ol>
        {period.modifiedon && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Last modified by {period.modifiedbyname?.trim() || "—"} on {formatDateTime(period.modifiedon)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
