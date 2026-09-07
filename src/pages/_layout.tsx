import { Outlet, NavLink } from "react-router-dom"
import { Wallet, Home, Users } from "lucide-react"

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/employees", label: "Employees", icon: Users, end: false },
  { to: "/payroll", label: "Payroll", icon: Wallet, end: false },
]

const itemClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  ].join(" ")

export default function Layout() {
  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2 px-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Wallet className="size-4" aria-hidden />
          </span>
          The Daily Operation
        </NavLink>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={itemClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with the same nav (sidebar hidden < md) */}
        <header className="flex items-center gap-4 border-b border-border px-4 py-3 md:hidden">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Wallet className="size-4" aria-hidden />
            </span>
            The Daily Operation
          </NavLink>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
