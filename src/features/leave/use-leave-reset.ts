import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { postingService, type LeaveRefreshPreview } from "./posting-service"

export function useLeaveRefresh() {
  const client = useQueryClient()
  const preview = useQuery({ queryKey: ["leave", "refresh-preview"], queryFn: () => postingService.refreshPreview(), retry: false, staleTime: 0, gcTime: 0 })
  const reset = useMutation({
    mutationFn: ({ reviewed, operationId }: { reviewed: LeaveRefreshPreview; operationId: string }) => postingService.refreshBalances(reviewed, operationId),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["leave", "balances"] }),
        client.invalidateQueries({ queryKey: ["leave", "posting-preview"] }),
        client.invalidateQueries({ queryKey: ["leave", "conversion", "rows"] }),
        client.invalidateQueries({ queryKey: ["leave", "list"] }),
      ])
    },
  })
  return { preview, reset }
}
