import type { ReactNode } from "react"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { leaveAccessState } from "./rules"

export function LeaveAccess({ children }: { children: ReactNode }) {
  const access = useAccessProfile({ loadEmployee: false })
  const state = leaveAccessState(access)
  if (state === "loading") return <div role="status" aria-label="Checking Leave access" aria-busy="true" className="space-y-4 p-6"><p>Checking Leave access…</p><Skeleton className="h-64 w-full" /></div>
  if (state === "error") return <div role="alert" className="space-y-3 p-6"><h1 className="text-xl font-semibold">Unable to verify Leave access</h1><p>Your role lookup did not complete. Reload to try again, or contact your administrator.</p><Button variant="outline" onClick={() => window.location.reload()}>Reload</Button></div>
  if (state === "denied") return <div role="alert" className="space-y-3 p-6"><h1 className="text-xl font-semibold">Leave access denied</h1><p>Leave Management is available to Payroll Admins. Contact your administrator if you need access.</p></div>
  return children
}
