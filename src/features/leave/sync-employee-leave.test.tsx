import { beforeEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SyncEmployeeLeave } from "./sync-employee-leave"
import { currentCreditYear, employeeLeaveService } from "./employee-leave-service"

vi.mock("./employee-leave-service", async original => ({ ...await original<typeof import("./employee-leave-service")>(), employeeLeaveService: { sync: vi.fn() } }))
const employee = { a365_employeeid: "10000000-0000-0000-0000-000000000001", a365_name: "Support User" }
const year = currentCreditYear()
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(employeeLeaveService.sync).mockResolvedValue({ employeeId: employee.a365_employeeid, year, eligible: true, VL: 8.33, SL: 5, conversionAdded: true })
})
function setup(selectedYear = year) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><SyncEmployeeLeave employee={employee} year={selectedYear} /></QueryClientProvider>)
  return { user: userEvent.setup(), invalidate }
}
it("requires confirmation and cancelling makes no writes", async () => {
  const { user } = setup()
  await user.click(screen.getByRole("button", { name: "Sync leave credits" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("Support User")
  expect(screen.getByRole("dialog")).toHaveTextContent("paid conversions are retained")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(employeeLeaveService.sync).not.toHaveBeenCalled()
})
it("posts once and refreshes the selected employee and conversion year", async () => {
  const { user, invalidate } = setup()
  await user.click(screen.getByRole("button", { name: "Sync leave credits" }))
  await user.dblClick(screen.getByRole("button", { name: "Confirm sync" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(employeeLeaveService.sync).toHaveBeenCalledExactlyOnceWith(employee.a365_employeeid, year)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "balances", employee.a365_employeeid, year] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "conversion", "rows", year] })
})
it("retains a failed sync for a safe retry", async () => {
  vi.mocked(employeeLeaveService.sync).mockRejectedValueOnce(new Error("Leave setup could not be confirmed."))
  const { user } = setup()
  await user.click(screen.getByRole("button", { name: "Sync leave credits" }))
  await user.click(screen.getByRole("button", { name: "Confirm sync" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed")
  await user.click(screen.getByRole("button", { name: "Confirm sync" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(employeeLeaveService.sync).toHaveBeenCalledTimes(2)
})
it("disables syncing historical years", () => {
  setup(year - 1)
  expect(screen.getByRole("button", { name: "Sync leave credits" })).toBeDisabled()
})
