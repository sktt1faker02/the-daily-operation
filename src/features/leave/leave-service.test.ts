import { beforeEach, describe, expect, it, vi } from "vitest"
import { A365_leavecredittransactionsService } from "@/generated/services/A365_leavecredittransactionsService"
import { A365_leavesService } from "@/generated/services/A365_leavesService"
import { A365_leavecashconversionsService } from "@/generated/services/A365_leavecashconversionsService"
import type { A365_leavecredittransactions } from "@/generated/models/A365_leavecredittransactionsModel"
import { dataClient } from "@/lib/power/data-client"
import { buildLeaveFilter, leaveService } from "./leave-service"
import type { LeaveFilters } from "./types"

vi.mock("@/generated/services/A365_leavecredittransactionsService", () => ({ A365_leavecredittransactionsService: { getAll: vi.fn() } }))
vi.mock("@/generated/services/A365_leavesService", () => ({ A365_leavesService: { getAll: vi.fn(), get: vi.fn() } }))
vi.mock("@/generated/services/A365_leavecashconversionsService", () => ({ A365_leavecashconversionsService: { getAll: vi.fn() } }))
vi.mock("@/lib/power/data-client", () => ({ dataClient: { retrieveMultipleRecordsAsync: vi.fn() } }))
vi.mock("@/features/employees/user-service", () => ({ userService: { getNamesByIds: vi.fn() } }))

const id = "10000000-0000-0000-0000-000000000001"
const filters: LeaveFilters = { section: "leave", year: 2026, employeeId: id, search: "", status: "all", type: "all", benefit: "all" }
const movement = (key: string, days: number) => ({ a365_leavecredittransactionid: key, _a365_employee_value: id, a365_year: 2026, a365_creditpool: 749910000, a365_days: days }) as A365_leavecredittransactions

beforeEach(() => vi.resetAllMocks())

describe("Leave read service", () => {
  it("reads every scoped ledger page before calculating balances", async () => {
    vi.mocked(A365_leavecredittransactionsService.getAll)
      .mockResolvedValueOnce({ success: true, data: [movement("grant", 10)], skipToken: "second" })
      .mockResolvedValueOnce({ success: true, data: [movement("deduction", -2.5)] })
    expect(await leaveService.balances(id, 2026)).toEqual({ VL: 7.5, SL: 0, movements: 2 })
    expect(A365_leavecredittransactionsService.getAll).toHaveBeenNthCalledWith(2, expect.objectContaining({ filter: `_a365_employee_value eq ${id} and a365_year eq 2026`, skipToken: "second", maxPageSize: 500 }))
    expect(A365_leavecredittransactionsService.getAll).not.toHaveBeenCalledWith(expect.objectContaining({ top: expect.anything() }))
  })
  it("rejects a later-page failure without returning a partial balance or backend details", async () => {
    vi.mocked(A365_leavecredittransactionsService.getAll)
      .mockResolvedValueOnce({ success: true, data: [movement("grant", 10)], skipToken: "second" })
      .mockResolvedValueOnce({ success: false, data: [], error: new Error("Sensitive backend payload") })
    await expect(leaveService.balances(id, 2026)).rejects.toThrow("Unable to read Leave data")
  })
  it("rejects repeated continuation tokens instead of silently repeating credits", async () => {
    vi.mocked(A365_leavecredittransactionsService.getAll).mockResolvedValue({ success: true, data: [], skipToken: "repeat" })
    await expect(leaveService.balances(id, 2026)).rejects.toThrow("complete credit history")
    expect(A365_leavecredittransactionsService.getAll).toHaveBeenCalledTimes(2)
  })
  it("distinguishes a verified empty history from a malformed success response", async () => {
    vi.mocked(A365_leavecredittransactionsService.getAll).mockResolvedValueOnce({ success: true, data: [] })
    expect((await leaveService.balances(id, 2026)).movements).toBe(0)
    vi.mocked(A365_leavecredittransactionsService.getAll).mockResolvedValueOnce({ success: true, data: undefined! })
    await expect(leaveService.balances(id, 2026)).rejects.toThrow()
  })
  it("paginates lists on the server and does not select virtual lookup names", async () => {
    vi.mocked(A365_leavesService.getAll).mockResolvedValue({ success: true, data: [], skipToken: "third" })
    expect((await leaveService.list(filters, "second")).next).toBe("third")
    expect(A365_leavesService.getAll).toHaveBeenCalledWith(expect.objectContaining({ maxPageSize: 20, skipToken: "second", orderBy: ["a365_startdate desc", "a365_leaveid asc"] }))
    expect(vi.mocked(A365_leavesService.getAll).mock.calls[0][0]?.select).not.toContain("a365_employeename")
  })
  it("uses the existing generated conversion and ledger sources", async () => {
    vi.mocked(A365_leavecashconversionsService.getAll).mockResolvedValue({ success: true, data: [] })
    vi.mocked(A365_leavecredittransactionsService.getAll).mockResolvedValue({ success: true, data: [] })
    await leaveService.list({ ...filters, section: "conversions" })
    await leaveService.list({ ...filters, section: "credits" })
    expect(A365_leavecashconversionsService.getAll).toHaveBeenCalledOnce()
    expect(A365_leavecredittransactionsService.getAll).toHaveBeenCalledOnce()
  })
  it("uses a paged employee search without reading salary or account numbers", async () => {
    vi.mocked(dataClient.retrieveMultipleRecordsAsync).mockResolvedValue({ success: true, data: [], skipToken: "next" })
    expect((await leaveService.searchEmployees("O'Brien", "second")).next).toBe("next")
    expect(dataClient.retrieveMultipleRecordsAsync).toHaveBeenCalledWith("a365_employees", expect.objectContaining({
      select: ["a365_employeeid", "a365_name", "a365_employeenumber"], skipToken: "second", maxPageSize: 20,
      filter: "(contains(a365_name,'O''Brien') or contains(a365_employeenumber,'O''Brien'))",
    }))
  })
})

describe("Leave server filters", () => {
  it("includes leave crossing a year boundary and filters numeric choices", () => {
    expect(buildLeaveFilter({ ...filters, search: "O'Brien", status: "749910000", type: "749910002", benefit: "749910001" }))
      .toBe(`a365_startdate lt 2027-01-01 and a365_enddate ge 2026-01-01 and _a365_employee_value eq ${id} and contains(a365_name,'O''Brien') and a365_leavestatus eq 749910000 and a365_leavetype eq 749910002 and a365_benefit eq 749910001`)
  })
  it("rejects unknown choices, invalid years and injected ids before any request", () => {
    expect(() => buildLeaveFilter({ ...filters, status: "Pending" })).toThrow()
    expect(() => buildLeaveFilter({ ...filters, year: 2026.5 })).toThrow()
    expect(() => buildLeaveFilter({ ...filters, employeeId: "anything or true" })).toThrow()
  })
})
