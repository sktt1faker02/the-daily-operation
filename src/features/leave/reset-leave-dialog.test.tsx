import { beforeEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ResetLeaveDialog } from "./reset-leave-dialog"
import { LeavePostingError, postingService, type LeaveResetPreview, type LeaveResetResult } from "./posting-service"

vi.mock("./posting-service", async original => ({
  ...await original<typeof import("./posting-service")>(),
  postingService: { resetPreview: vi.fn(), resetBalances: vi.fn() },
}))
const preview: LeaveResetPreview = { resetVersion: 1, year: 2026, periodStart: "2026-04-01", employeeCount: 3, VL: 10, SL: 5, version: "a".repeat(64) }
const result: LeaveResetResult = { resetVersion: 1, completed: true, operationId: "", year: 2026, periodStart: "2026-04-01", employeeCount: 3, VL: 10, SL: 5 }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(postingService.resetPreview).mockResolvedValue(preview)
  vi.mocked(postingService.resetBalances).mockImplementation(async (_preview, id) => ({ ...result, operationId: id }))
})
function setup() {
  const close = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(<QueryClientProvider client={client}><ResetLeaveDialog onClose={close} /></QueryClientProvider>)
  return { close, invalidate, user: userEvent.setup() }
}
it("previews all active employees and cancelling makes no financial writes", async () => {
  const { user, close } = setup()
  expect(await screen.findByText("3 active employees")).toBeVisible()
  expect(screen.getByText(/even when leave has already been used/)).toBeVisible()
  expect(screen.getByText(/Unpaid leave conversions for this year also return/)).toBeVisible()
  expect(screen.getByText(/Employee and list filters do not restrict/)).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(close).toHaveBeenCalledOnce()
  expect(postingService.resetBalances).not.toHaveBeenCalled()
})
it("confirms once, sends the reviewed impact and refreshes balance/preview caches", async () => {
  const { user, close, invalidate } = setup()
  await screen.findByText("3 active employees")
  await user.dblClick(screen.getByRole("button", { name: "Reset balances" }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(postingService.resetBalances).toHaveBeenCalledExactlyOnceWith(preview, expect.any(String))
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "balances"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "posting-preview"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "conversion", "rows"] })
})
it("blocks confirmation while loading or with no active employees", async () => {
  vi.mocked(postingService.resetPreview).mockResolvedValue({ ...preview, employeeCount: 0 })
  setup()
  expect(screen.getByRole("status")).toHaveTextContent("Checking active employees")
  expect(screen.getByRole("button", { name: "Reset balances" })).toBeDisabled()
  expect(await screen.findByText("No active employees need resetting.")).toBeVisible()
  expect(screen.getByRole("button", { name: "Reset balances" })).toBeDisabled()
})
it("offers preview retry without resetting on a failed read", async () => {
  vi.mocked(postingService.resetPreview).mockRejectedValueOnce(new Error("Private backend details"))
  const { user } = setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to check active employees")
  expect(screen.queryByText("Private backend details")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Retry preview" }))
  expect(await screen.findByText("3 active employees")).toBeVisible()
  expect(postingService.resetBalances).not.toHaveBeenCalled()
})
it("requires a fresh preview after a server-confirmed rejection", async () => {
  vi.mocked(postingService.resetBalances).mockRejectedValueOnce(new LeavePostingError("Employee balances changed. Review again.", false))
  const { user } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Reset balances" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Employee balances changed")
  expect(screen.getByRole("button", { name: "Reset balances" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Refresh preview" }))
  await waitFor(() => expect(postingService.resetPreview).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole("button", { name: "Reset balances" })).toBeEnabled()
})
it("keeps the same operation and reviewed values after an uncertain outcome", async () => {
  vi.mocked(postingService.resetBalances).mockRejectedValueOnce(new LeavePostingError("Could not confirm outcome.", true))
  const { user, close } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Reset balances" }))
  const retry = await screen.findByRole("button", { name: "Retry same reset" })
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(close).not.toHaveBeenCalled()
  await user.click(retry)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const calls = vi.mocked(postingService.resetBalances).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
})
it("prevents close and duplicate submission while the reset is pending", async () => {
  let finish!: (value: LeaveResetResult) => void
  vi.mocked(postingService.resetBalances).mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { user, close } = setup()
  await screen.findByText("3 active employees")
  await user.click(screen.getByRole("button", { name: "Reset balances" }))
  expect(screen.getByRole("button", { name: "Resetting..." })).toBeDisabled()
  await user.keyboard("{Escape}")
  expect(close).not.toHaveBeenCalled()
  finish(result)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(postingService.resetBalances).toHaveBeenCalledOnce()
})
