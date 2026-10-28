/** Preview only. Existing conversions retain their stored rate and amount. */
export function calculateConversion(monthlySalary: number | undefined, availableVL: number, alreadyConverted: number) {
  if (monthlySalary === undefined || !Number.isFinite(monthlySalary) || monthlySalary < 0) throw new Error("Monthly basic salary is missing or invalid.")
  if (!Number.isFinite(availableVL) || !Number.isFinite(alreadyConverted) || alreadyConverted < 0) throw new Error("Conversion balance could not be verified.")
  const dailyRateCents = Math.round((monthlySalary * 100) / 22)
  const days = Math.max(0, Math.min(Math.round(availableVL * 100), 500 - Math.round(alreadyConverted * 100))) / 100
  const amountCents = Math.round(dailyRateCents * days)
  if (!Number.isSafeInteger(dailyRateCents) || !Number.isSafeInteger(amountCents)) throw new Error("Conversion amount exceeds the supported precision.")
  return { dailyRate: dailyRateCents / 100, days, amount: amountCents / 100 }
}

export function currentLeaveYear() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  const [year, month, day] = today.split("-").map(Number)
  return year >= 2027 ? year - (month === 1 && day < 5 ? 1 : 0) : year - (month < 4 ? 1 : 0)
}
