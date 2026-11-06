import { Navigate } from "react-router-dom"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { ledgerAccess } from "./rules"

export function LedgerOnly({ children }: { children: React.ReactNode }) {
  const state = ledgerAccess(useAccessProfile())
  if (state === "loading") return <p role="status" className="p-6">Checking Ledger access…</p>
  if (state === "denied") return <Navigate to="/my-payroll" replace />
  return <>{children}</>
}
