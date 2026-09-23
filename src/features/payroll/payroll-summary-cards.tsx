/**
 * Period roll-up metric cards (Gross, Total Deductions, Net Pay). Net gets
 * stronger emphasis. Tabular numerals per DESIGN.md.
 */
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

function Metric({
  label,
  amount,
  emphasis,
}: {
  label: string
  amount: number
  emphasis?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 tabular-nums ${
            emphasis ? "text-2xl font-semibold text-foreground" : "text-xl font-medium text-foreground"
          }`}
        >
          {formatCurrency(amount)}
        </p>
      </CardContent>
    </Card>
  )
}

export function PayrollSummaryCards({
  gross,
  deductions,
  net,
}: {
  gross: number
  deductions: number
  net: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Gross Pay" amount={gross} />
      <Metric label="Total Deductions" amount={deductions} />
      <Metric label="Net Pay" amount={net} emphasis />
    </div>
  )
}
