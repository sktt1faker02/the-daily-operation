import { useQuery, useQueryClient } from "@tanstack/react-query"
import { postingService } from "./posting-service"
import type { LeaveRecord } from "./types"

export function useLeaveDeletion(record: LeaveRecord, allowed: boolean) {
  const client = useQueryClient()
  const employee = record._a365_employee_value
  const preview = useQuery({
    queryKey: ["leave", "delete-preview", employee, record.a365_leaveid],
    queryFn: () => postingService.deletionPreview(record), enabled: allowed,
    staleTime: 0, retry: false,
  })
  async function deleteRecord() {
    if (!allowed || !preview.data || preview.isFetching || preview.isError) throw new Error("Review the deletion impact before continuing.")
    try { await postingService.deleteLeave(record, preview.data.restoredDays) }
    catch (error) {
      // Keep an uncertain outcome's reviewed count for an idempotent retry.
      if (!(error instanceof Error) || !("uncertain" in error) || error.uncertain !== true) void preview.refetch()
      throw error
    }
    client.removeQueries({ queryKey: ["leave", "detail", { kind: "leave", id: record.a365_leaveid }], exact: true })
    client.removeQueries({ queryKey: ["leave", "personal-detail", employee, record.a365_leaveid], exact: true })
    await Promise.all([
      client.invalidateQueries({ queryKey: ["leave", "list"] }),
      client.invalidateQueries({ queryKey: ["leave", "balances", employee] }),
      client.invalidateQueries({ queryKey: ["leave", "posting-preview", employee] }),
      client.invalidateQueries({ queryKey: ["leave", "payroll-days", employee] }),
      client.invalidateQueries({ queryKey: ["leave", "conversion-employees"] }),
    ])
  }
  return { preview, deleteRecord }
}
