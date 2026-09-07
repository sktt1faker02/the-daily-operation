import * as React from "react"
import { Toaster } from "sonner"

type SonnerProviderProps = { children: React.ReactNode }

// The app is light-only (theme toggle removed); Sonner is pinned to the
// light theme regardless of OS/browser color-scheme preference.
export function SonnerProvider({ children }: SonnerProviderProps) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        theme="light"
        richColors
        expand
        duration={3000}
        visibleToasts={3}
      />
    </>
  )
}