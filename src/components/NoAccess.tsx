import { Wallet } from "lucide-react"
import { NO_ACCESS } from "@/features/payroll/access"

interface NoAccessProps {
  roleNames: string[]
  roleError: boolean
}

export function NoAccess({ roleNames, roleError }: NoAccessProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section
        role="alert"
        className="flex w-full max-w-4xl flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-12 text-center"
      >
        <Wallet className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">{NO_ACCESS.title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{NO_ACCESS.message}</p>
        <div className="mt-2 max-w-sm text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Roles detected</p>
          {roleError ? (
            <p>Unable to retrieve your roles from Dataverse.</p>
          ) : roleNames.length > 0 ? (
            <ul className="mt-1">
              {roleNames.map((roleName) => <li key={roleName}>{roleName}</li>)}
            </ul>
          ) : (
            <p>No roles were returned for this account.</p>
          )}
        </div>
      </section>
    </main>
  )
}
