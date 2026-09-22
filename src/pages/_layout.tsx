import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, Wallet, Users, FileText, type LucideIcon } from "lucide-react";
import { usePowerContext } from "@/hooks/use-power-context";
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile";

const logoUrl = `${import.meta.env.BASE_URL}a365-dark-logo.png`;

interface NavItem {
  to?: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Future milestone — shown but not yet navigable. */
  soon?: boolean;
}
interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Admin menu mirrors the payroll mockup. Our single `/payroll` page is the
// dashboard + periods list, so "Overview" points at it (no duplicate items).
// Reports and Documents are later milestones — shown disabled for layout parity.
const ADMIN_GROUPS: NavGroup[] = [
  { items: [{ to: "/overview", label: "Overview", icon: LayoutGrid }] },
  {
    label: "Payroll",
    items: [
      { to: "/payroll", label: "Payroll Periods", icon: Wallet },
      { to: "/employees", label: "Employees", icon: Users },
    ],
  },
];

const MY_PAYROLL_ITEM: NavItem = { to: "/my-payroll", label: "My Payroll", icon: FileText };

const EMPLOYEE_GROUPS: NavGroup[] = [{ items: [MY_PAYROLL_ITEM] }];

/** "My Portal" group appended for an admin who is also a payrolled employee. */
const MY_PORTAL_GROUP: NavGroup = { label: "My Portal", items: [MY_PAYROLL_ITEM] };

function useNav() {
  const { isAdmin, showMyPayroll, ready } = useAccessProfile();
  const brandTo = isAdmin ? "/overview" : "/my-payroll";
  if (!ready) return { groups: [] as NavGroup[], brandTo };
  if (isAdmin) {
    // Admins who are also on payroll get their own portal alongside admin tools.
    const groups = showMyPayroll ? [...ADMIN_GROUPS, MY_PORTAL_GROUP] : ADMIN_GROUPS;
    return { groups, brandTo };
  }
  return { groups: showMyPayroll ? EMPLOYEE_GROUPS : [], brandTo };
}

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

const itemClass = ({ isActive }: { isActive: boolean }) => ["flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"].join(" ");

function NavItems({ groups }: { groups: NavGroup[] }) {
  return (
    <nav className="flex flex-col gap-1">
      {groups.map((group, i) => (
        <div key={group.label ?? `g${i}`} className="flex flex-col gap-1">
          {group.label && <p className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{group.label}</p>}
          {group.items.map(({ to, label, icon: Icon, end, soon }) =>
            soon || !to ? (
              <span key={label} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/50" aria-disabled>
                <Icon className="size-4" aria-hidden />
                {label}
                <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Soon</span>
              </span>
            ) : (
              <NavLink key={label} to={to} end={end} className={itemClass}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { groups, brandTo } = useNav();
  const { isAdmin } = useAccessProfile();
  const { data: context } = usePowerContext();
  const { pathname } = useLocation();

  // The welcome screen ("/") stands alone — no app sidebar/top bar.
  if (pathname === "/") {
    return (
      <div className="min-h-dvh bg-background">
        <Outlet />
      </div>
    );
  }

  const userName = context?.user.fullName ?? context?.user.userPrincipalName;
  const mobileItems = groups.flatMap((g) => g.items).filter((i) => i.to && !i.soon);

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <NavLink to={brandTo} className="mb-4 block px-2">
          <img src={logoUrl} alt="Automations 365" className="max-w-37.5" />
        </NavLink>

        <NavItems groups={groups} />

        {userName && (
          <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border px-2 pt-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initialsOf(userName)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{isAdmin ? "Payroll Admin" : "Employee"}</p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (sidebar hidden < md) */}
        <header className="flex items-center gap-4 border-b border-border px-4 py-3 md:hidden">
          <NavLink to={brandTo} className="flex items-center">
            <img src={logoUrl} alt="Automations 365" className="h-6 w-auto" />
          </NavLink>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            {mobileItems.map(({ to, label, end }) => (
              <NavLink key={label} to={to as string} end={end} className={({ isActive }) => (isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
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
  );
}
