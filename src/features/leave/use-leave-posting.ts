import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { postingService } from "./posting-service"
import type { LeaveEntryValues } from "./entry-rules"

export function useLeavePostingPreview(values: LeaveEntryValues) {
  return useQuery({
    queryKey: ["leave", "posting-preview", values.employee?.a365_employeeid, values.leaveType, values.benefit, values.startDate, values.endDate],
    queryFn: () => postingService.preview(values), enabled: Boolean(values.employee), retry: false, staleTime: 0,
  })
}

export function useIssueLeave() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ values, operationId, onCommitted }: { values: LeaveEntryValues; operationId: string; onCommitted?: () => void }) => postingService.submit(values, operationId, onCommitted),
    retry: false,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["leave", "list"] }),
        client.invalidateQueries({ queryKey: ["leave", "balances", variables.values.employee?.a365_employeeid] }),
        client.invalidateQueries({ queryKey: ["leave", "posting-preview", variables.values.employee?.a365_employeeid] }),
      ])
    },
  })
}
