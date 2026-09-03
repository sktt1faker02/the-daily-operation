import { getContext } from "@microsoft/power-apps/app"
import type { IContext } from "@microsoft/power-apps/app"

/**
 * Context returned by the Power Apps host: app metadata, host session, and the
 * signed-in user (from Microsoft Entra). See {@link IContext}.
 */
export type PowerContext = IContext

/**
 * Retrieves the Power Apps host context (app, host, and signed-in user).
 *
 * As of the Power Apps client library v1.0+ there is no `initialize()` step —
 * the SDK talks to the host directly and memoizes the context internally, so
 * calling this repeatedly is cheap. When the app runs outside a Power Apps host
 * (e.g. a plain `vite` dev server without `pac code run`), the underlying
 * handshake may not resolve; callers should handle the pending/error states.
 *
 * This is the platform integration seam the rest of the app depends on to know
 * *who* the current user is — used for audit attribution and for the
 * client-side "view my own payroll" UX check. It is never the security
 * boundary; record access is enforced by Dataverse.
 */
export async function getPowerContext(): Promise<PowerContext> {
  return getContext()
}
