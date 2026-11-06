import { expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { leaveService } from "./leave-service"
import { LeaveBalances } from "./leave-balances"

vi.mock("./leave-service", () => ({ leaveService: { balances: vi.fn() } }))
it("shows neither balances nor sync actions for a stale inactive selection", async () => {
  const employee = { a365_employeeid: "10000000-0000-0000-0000-000000000001", a365_name: "Support User" }
  vi.mocked(leaveService.balances).mockResolvedValue({ VL: 0, SL: 0, movements: 0, inactive: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><LeaveBalances employeeId={employee.a365_employeeid} employee={employee} year={2026} /></QueryClientProvider>)
  expect(await screen.findByText(/This employee is inactive/)).toBeVisible()
  expect(screen.queryByRole("region", { name: "Leave balances" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Sync leave credits" })).not.toBeInTheDocument()
  expect(screen.queryByText("0.00")).not.toBeInTheDocument()
})
