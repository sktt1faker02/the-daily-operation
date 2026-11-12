import { beforeEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RefreshLeaveDialog } from "./reset-leave-dialog"
import { LeavePostingError, postingService, type LeaveRefreshPreview, type LeaveRefreshResult } from "./posting-service"

vi.mock("./posting-service", async original => ({
  ...await original<typeof import("./posting-service")>(),
  postingService: { refreshPreview: vi.fn(), refreshBalances: vi.fn() },
}))
const preview: LeaveRefreshPreview = { refreshVersion: 1, year: 2026, periodStart: "2026-01-01", employeeCount: 3, canApply: true, employees: Array.from({ length: 3 }, (_, index) => ({ employeeId: "10000000-0000-0000-0000-00000000000" + (index + 1), employeeName: `Employee ${index + 1}`, beforeVL: 17.83, beforeSL: 9, earnedVL: 8.33, usedVL: 2, usedSL: 1, convertedVL: 1, VL: 5.33, SL: 4, issue: null })), version: "a".repeat(64) }
const result: LeaveRefreshResult = { refreshVersion: 1, completed: true, operationId: "", year: 2026, periodStart: "2026-01-01", employeeCount: 3 }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(postingService.refreshPreview).mockResolvedValue(preview)
  vi.mocked(postingService.refreshBalances).mockImplementation(async (_preview, id) => ({ ...result, operationId: id }))
})
function setup() {
  const close = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><RefreshLeaveDialog onClose={close} /></QueryClientProvider>)
  return { close, invalidate, user: userEvent.setup() }
}
it("previews all active employees and cancelling makes no financial writes", async () => {
  const { user, close } = setup()
  expect(await screen.findByText("3 active employees")).toBeVisible()
  expect(screen.getByText(/earned VL and 5 SL/)).toBeVisible()
  expect(screen.getByText(/Saved conversion limits, rates and paid amounts stay unchanged/)).toBeVisible()
  expect(screen.getByText(/Employee and list filters do not restrict/)).toBeVisible()
  expect(screen.getByRole("table", { name: "Balance refresh preview" })).toBeVisible()
  expect(screen.getAllByText("17.83 / 5.33")).toHaveLength(3)
  expect(screen.getAllByText("9.00 / 4.00")).toHaveLength(3)
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(close).toHaveBeenCalledOnce()
  expect(postingService.refreshBalances).not.toHaveBeenCalled()
})
it("blocks all changes when an employee's usage exceeds entitlement", async () => {
  vi.mocked(postingService.refreshPreview).mockResolvedValue({ ...preview, canApply: false, employees: preview.employees.map((row, index) => index ? row : { ...row, usedSL: 6, SL: -1, issue: "Recorded usage exceeds entitlement." }) })
  const { user } = setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Resolve the flagged records")
  expect(screen.getByText("Recorded usage exceeds entitlement.")).toBeVisible()
  expect(screen.getByRole("button", { name: "Refresh balance" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Refresh balance" }))
  expect(postingService.refreshBalances).not.toHaveBeenCalled()
})
it("confirms once, sends the reviewed impact and refreshes balance/preview caches", async () => {
  const { user, close, invalidate } = setup()
  await screen.findByText("3 active employees")
  await user.dblClick(screen.getByRole("button", { name: "Refresh balance" }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(postingService.refreshBalances).toHaveBeenCalledExactlyOnceWith(preview, expect.any(String))
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "balances"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "posting-preview"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "conversion", "rows"] })
})
it("blocks confirmation while loading or with no active employees", async () => {
  vi.mocked(postingService.refreshPreview).mockResolvedValue({ ...preview, employeeCount: 0, employees: [], canApply: false })
  setup()
  expect(screen.getByRole("status")).toHaveTextContent("Checking active employees")
  expect(screen.getByRole("button", { name: "Refresh balance" })).toBeDisabled()
  expect(await screen.findByText("No active employees to refresh.")).toBeVisible()
  expect(screen.getByRole("button", { name: "Refresh balance" })).toBeDisabled()
})
it("offers preview retry without resetting on a failed read", async () => {
  vi.mocked(postingService.refreshPreview).mockRejectedValueOnce(new Error("Private backend details"))
  const { user } = setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to check active employees")
  expect(screen.queryByText("Private backend details")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Retry preview" }))
  expect(await screen.findByText("3 active employees")).toBeVisible()
  expect(postingService.refreshBalances).not.toHaveBeenCalled()
})
it("requires a fresh preview after a server-confirmed rejection", async () => {
  vi.mocked(postingService.refreshBalances).mockRejectedValueOnce(new LeavePostingError("Employee balances changed. Review again.", false))
  const { user } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Refresh balance" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Employee balances changed")
  expect(screen.getByRole("button", { name: "Refresh balance" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Refresh preview" }))
  await waitFor(() => expect(postingService.refreshPreview).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole("button", { name: "Refresh balance" })).toBeEnabled()
})
it("keeps the same operation and reviewed values after an uncertain outcome", async () => {
  vi.mocked(postingService.refreshBalances).mockRejectedValueOnce(new LeavePostingError("Could not confirm outcome.", true))
  const { user, close } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Refresh balance" }))
  const retry = await screen.findByRole("button", { name: "Retry same refresh" })
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(close).not.toHaveBeenCalled()
  await user.click(retry)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const calls = vi.mocked(postingService.refreshBalances).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
})
it("prevents close and duplicate submission while the reset is pending", async () => {
  let finish!: (value: LeaveRefreshResult) => void
  vi.mocked(postingService.refreshBalances).mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { user, close } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Refresh balance" }))
  expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(close).not.toHaveBeenCalled()
  finish(result)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(postingService.refreshBalances).toHaveBeenCalledOnce()
})
