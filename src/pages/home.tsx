/**
 * Welcome / landing screen. This is NOT a login page — a Power Apps Code App is
 * already authenticated by the Microsoft Entra host before this renders, so
 * there are no credentials to collect. Instead we confirm the signed-in identity
 * and route the person on by role (admin → Payroll, employee → My Payroll).
 * Handles the three real states: resolving, host-unavailable, and signed in.
 */
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { usePowerContext } from "@/hooks/use-power-context";
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile";
import { Button } from "@/components/ui/button";

const logoUrl = `${import.meta.env.BASE_URL}a365-logo.png`;

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function HomePage() {
  const { data: context, isPending, isError } = usePowerContext();
  const { isAdmin, ready } = useAccessProfile();
  const destination = isAdmin ? "/overview" : "/my-payroll";
  const destinationLabel = isAdmin ? "Continue to Dashboard" : "Continue to My Payroll";

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
      <div className="grid w-full max-w-[1200px] overflow-hidden rounded-2xl border border-border shadow-sm md:min-h-[600px] md:grid-cols-2">
        {/* Brand panel */}
        <div className="flex flex-col justify-center items-center gap-10 bg-primary p-8 text-primary-foreground">
          <img src={logoUrl} alt="Automations 365" className="max-w-[350px] w-full mx-auto object-contain" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Daily Operation Hub</h2>
            <p className="max-w-xs text-sm text-primary-foreground/80">Streamline Payroll, Leave Management, and Accounting.</p>
          </div>
        </div>

        {/* Auth-status panel */}
        <div className="flex flex-col justify-center gap-6 bg-card p-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">The Daily Operation</h1>
          </div>

          {isPending ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-busy>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Connecting to Power Platform…
            </div>
          ) : isError ? (
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>Power Apps host context is unavailable. This is expected when running outside the Power Apps host; deploy or run via the CLI to connect.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initialsOf(context.user.fullName)}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{context.user.fullName ?? context.user.userPrincipalName ?? "Current user"}</p>
                  {context.user.userPrincipalName && <p className="truncate text-xs text-muted-foreground">{context.user.userPrincipalName}</p>}
                </div>
              </div>

              <Button asChild size="lg" disabled={!ready}>
                <Link to={destination} aria-disabled={!ready} tabIndex={ready ? undefined : -1}>
                  {ready ? (
                    <>
                      {destinationLabel}
                      <ArrowRight className="size-4" aria-hidden />
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Preparing your workspace…
                    </>
                  )}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
