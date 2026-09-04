import { Outlet, NavLink } from "react-router-dom"
import { Wallet } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

type LayoutProps = { showHeader?: boolean }

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`

export default function Layout({ showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      {showHeader && (
        <header className="h-14 border-b">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="flex items-center gap-2 font-semibold">
                <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
                  <Wallet className="size-4" aria-hidden />
                </span>
                The Daily Operation
              </NavLink>
              <nav className="flex items-center gap-4">
                <NavLink to="/" end className={navLinkClass}>
                  Home
                </NavLink>
                <NavLink to="/employees" className={navLinkClass}>
                  Employees
                </NavLink>
              </nav>
            </div>
            <ModeToggle />
          </div>
        </header>
      )}

      <main className="flex-1 flex">
        <div className="flex-1 mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
