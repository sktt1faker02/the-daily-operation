/**
 * Route gating for admin-only sections. Admin status comes from Dataverse
 * security-role membership (see `hooks/use-access-profile.ts`); non-admins are
 * redirected to their own portal. Cosmetic — Dataverse is the real boundary
 * (CLAUDE.md "Security").
 */
import { Navigate } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccessProfile } from "./hooks/use-access-profile"

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, ready } = useAccessProfile()
  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 p-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!isAdmin) return <Navigate to="/my-payroll" replace />
  return <>{children}</>
}
