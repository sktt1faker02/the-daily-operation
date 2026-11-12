import { SonnerProvider } from "@/providers/sonner-provider"
import { QueryProvider } from "./providers/query-provider"
import { RouterProvider } from "react-router-dom"
import { router } from "@/router"
import { RoleGate } from "@/components/RoleGate"

export default function App() {
  return (
    <SonnerProvider>
      <QueryProvider>
        <RoleGate>
          <RouterProvider router={router} />
        </RoleGate>
      </QueryProvider>
    </SonnerProvider>
  )
}
