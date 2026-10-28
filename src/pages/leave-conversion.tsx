import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Coins } from "lucide-react"
import { LeaveAccess } from "@/features/leave/leave-access"
import { validYear } from "@/features/leave/rules"
import { ConversionEmployees } from "@/features/leave/conversion-employees"
import { YearList } from "@/features/leave/conversion-year-list"

function YearDetail() {
  const { year: yearParam } = useParams()
  const year = Number(yearParam)
  const isDetail = yearParam !== undefined
  const heading = <header className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Coins className="size-6 text-primary" aria-hidden />Leave Conversion{isDetail && validYear(year) ? ` — ${year}` : ""}</h1><p className="text-sm text-muted-foreground">Annual vacation leave conversion. Maximum of 5 VL days per employee per year.</p></header>
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    {isDetail && <Link to="/leave-conversion" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Leave Conversion</Link>}
    {isDetail && heading}
    {!isDetail ? <YearList heading={heading} /> : !validYear(year) ? <p role="alert">Select a whole year from 1900 to 9998.</p> : <>
      <p role="note" className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">Daily rate is monthly basic salary ÷ 22, rounded to two decimals and saved with the transaction. Saving records the conversion values; it does not deduct leave credits or make payments. New transactions start with 10.00 Available VL and 5.00 VL to convert for each Active employee.</p>
      <ConversionEmployees key={year} year={year} />
    </>}
  </div>
}

export default function LeaveConversionPage() {
  return <LeaveAccess><YearDetail /></LeaveAccess>
}
