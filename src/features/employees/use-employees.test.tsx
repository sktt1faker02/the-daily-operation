import type { PropsWithChildren } from "react"
import { beforeEach, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { toast } from "sonner"
import { employeeService } from "./employee-service"
import { employeeLeaveService } from "@/features/leave/employee-leave-service"
import { useCreateEmployee, useUpdateEmployee } from "./use-employees"
import type { Employee, EmployeeFormValues } from "./types"

vi.mock("./employee-service", () => ({ employeeService: { create: vi.fn(), update: vi.fn() } }))
vi.mock("@/features/leave/employee-leave-service", () => ({ employeeLeaveService: { sync: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
const employee = { a365_employeeid: "10000000-0000-0000-0000-000000000001" } as Employee
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(employeeService.create).mockResolvedValue(employee)
  vi.mocked(employeeLeaveService.sync).mockResolvedValue({ employeeId: employee.a365_employeeid, year: 2026, eligible: true, VL: 8.33, SL: 5, conversionAdded: true })
})
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { ...renderHook(() => useCreateEmployee(), { wrapper }), invalidate }
}
it("initializes leave after employee creation and refreshes affected caches", async () => {
  const { result, invalidate } = setup()
  await act(async () => { await result.current.mutateAsync({} as EmployeeFormValues) })
  expect(employeeLeaveService.sync).toHaveBeenCalledExactlyOnceWith(employee.a365_employeeid)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "conversion", "rows", 2026] })
})
it("keeps a committed employee successful when setup fails and explains repair", async () => {
  vi.mocked(employeeLeaveService.sync).mockRejectedValueOnce(new Error("Retry Sync leave credits."))
  const { result } = setup()
  await act(async () => { await expect(result.current.mutateAsync({} as EmployeeFormValues)).resolves.toEqual(employee) })
  expect(employeeService.create).toHaveBeenCalledOnce()
  expect(toast.error).toHaveBeenCalledWith("Employee created; leave setup needs retry.", { description: "Retry Sync leave credits." })
})
it("never posts credits if employee creation fails", async () => {
  vi.mocked(employeeService.create).mockRejectedValueOnce(new Error("Create failed"))
  const { result } = setup()
  await act(async () => { await expect(result.current.mutateAsync({} as EmployeeFormValues)).rejects.toThrow("Create failed") })
  expect(employeeLeaveService.sync).not.toHaveBeenCalled()
})
it("refreshes leave visibility after changing employee status", async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useUpdateEmployee(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ id: employee.a365_employeeid, values: { a365_employmentstatus: 749910001 } as EmployeeFormValues }) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "employee-picker"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "balances", employee.a365_employeeid] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "list"] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leave", "conversion", "rows"] })
})
