import { usePowerContext } from "@/hooks/use-power-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ModeToggle } from "@/components/mode-toggle"
import { AlertCircle, CheckCircle2, Wallet } from "lucide-react"

export default function HomePage() {
  const { data: context, isPending, isError } = usePowerContext()

  return (
    <div className="h-full grid place-items-center p-6">
      <div className="w-full max-w-xl flex flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-3 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">The Daily Operation</h1>
            <p className="text-muted-foreground">
              Automations 365 — Payroll · Leave Management · Accounting
            </p>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Platform connection</CardTitle>
            <CardDescription>Microsoft Power Platform · Dataverse</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2" aria-busy>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : isError ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <p>
                  Power Apps host context is unavailable. This is expected when running
                  outside the Power Apps host; deploy or run via the CLI to connect.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {context.user.fullName ?? context.user.userPrincipalName ?? "current user"}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Milestone 1: Payroll</Badge>
                  <Badge variant="outline">Environment connected</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ModeToggle />
      </div>
    </div>
  )
}
