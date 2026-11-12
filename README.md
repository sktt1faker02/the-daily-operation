# Power Apps Template - starter

An opinionated **Vite + TypeScript + React** starter template for building Power Apps code apps.

Designed for common app scenarios, easy extensibility, and minimal setup.

---

## Highlights
- **Modern tooling** - Vite, TypeScript, and React
- **Out-of-box styling** - Tailwind, shadcn/ui components, and theming out of the box
- **Batteries included** - Curated libraries pre-wired for common scenarios
- **Standard patterns** - Industry standard patterns and practices
- **Agent friendly** - Optimized for use with coding agents
---

## Pre-installed libraries
- [Tailwind CSS](https://tailwindcss.com/) - utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - pre-installed UI components
- [React Router](https://reactrouter.com/) - pages, routing
- [Zustand](https://zustand.docs.pmnd.rs/) - state management
- [Tanstack Query](https://tanstack.com/query/latest) - data fetching, state management
- [Tanstack Table](https://tanstack.com/table/latest) - interactive tables, datagrids
- [Lucide](https://lucide.dev/) - icons

## Notification sender

Leave and payslip-ready emails, including manual retries, send through the
Office 365 Outlook connector's shared-mailbox operation from
`thedailyoperation@automations365.com`. The sender address is defined once in
`src/lib/notification-email.ts`.

The user account authenticating the Outlook connection needs Full Access and
Send As permissions for that shared mailbox. The shared mailbox is the visible
sender; the connector still authenticates with the user account. Verify the From
address after deployment. Connector acceptance does not confirm inbox delivery.

