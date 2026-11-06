import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { deriveGate } from "@/features/payroll/access"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { NoAccess } from "./NoAccess"

export function RoleGate({ children }: { children: ReactNode }) {
  const access = useAccessProfile({ loadEmployee: false })
  const state = deriveGate(access)

  if (state === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6" aria-busy="true" aria-label="Checking access">
        <Skeleton className="h-48 w-full max-w-5xl rounded-md" />
      </main>
    )
  }
  if (state === "denied") {
    return <NoAccess roleNames={access.roleNames} roleError={access.roleError} />
  }
  return <>{children}</>
}
