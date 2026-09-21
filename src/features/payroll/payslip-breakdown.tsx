/**
 * Itemized payslip breakdown shared by the admin entry dialog and the employee
 * payslip. Earnings roll up to Gross; the employee-share statutory deductions
 * (SSS, PhilHealth, HDMF/Pag-IBIG, Withholding Tax) are shown as their own lines
 * — the "government benefits" detail — rather than a single lumped total.
 * Presentation only; amounts come already calculated on the entry.
 */
import { formatCurrency } from "@/lib/format"
import type { PayrollEntry } from "./types"

function Row({
  label,
  amount,
  subtotal,
  emphasis,
}: {
  label: string
  amount: number | null
  subtotal?: boolean
  emphasis?: boolean
}) {
  return (
    <div
      className={[
        "flex items-baseline justify-between gap-4 py-1",
        subtotal ? "border-t border-border mt-1 pt-2 font-medium text-foreground" : "",
      ].join(" ")}
    >
      <dt className={subtotal ? "" : "text-muted-foreground"}>{label}</dt>
      <dd
        className={[
          "tabular-nums",
          emphasis ? "text-lg font-semibold text-foreground" : subtotal ? "font-medium" : "",
        ].join(" ")}
      >
        {formatCurrency(amount)}
      </dd>
    </div>
  )
}

/** True when an optional line carries a value worth showing. */
function has(value: number | null): boolean {
  return value !== null && value !== 0
}

export function PayslipBreakdown({ entry }: { entry: PayrollEntry }) {
  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Earnings
        </h3>
        <dl>
          <Row label="Basic Pay" amount={entry.a365_basicpay} />
          <Row label="Allowances" amount={entry.a365_allowances} />
          {has(entry.a365_otherearnings) && (
            <Row label="Other Earnings" amount={entry.a365_otherearnings} />
          )}
          <Row label="Gross Pay" amount={entry.a365_grosspay} subtotal />
        </dl>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Deductions
        </h3>
        <dl>
          {has(entry.a365_unpaidleave) && (
            <Row label="Unpaid Leave" amount={entry.a365_unpaidleave} />
          )}
          <Row label="SSS" amount={entry.a365_sss} />
          <Row label="PhilHealth" amount={entry.a365_philhealth} />
          <Row label="HDMF / Pag-IBIG" amount={entry.a365_hdmf} />
          <Row label="Withholding Tax" amount={entry.a365_withholdingtax} />
          {has(entry.a365_otherdeductions) && (
            <Row label="Other Deductions" amount={entry.a365_otherdeductions} />
          )}
          <Row label="Total Deductions" amount={entry.a365_totaldeductions} subtotal />
        </dl>
      </section>

      <dl className="border-t border-border pt-3">
        <Row label="Net Pay" amount={entry.a365_netpay} emphasis />
      </dl>
    </div>
  )
}
