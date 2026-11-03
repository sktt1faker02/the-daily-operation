import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { postingService, type LeaveResetPreview } from "./posting-service"

export function useLeaveReset() {
  const client = useQueryClient()
  const preview = useQuery({ queryKey: ["leave", "reset-preview"], queryFn: () => postingService.resetPreview(), retry: false, staleTime: 0, gcTime: 0 })
  const reset = useMutation({
    mutationFn: ({ reviewed, operationId }: { reviewed: LeaveResetPreview; operationId: string }) => postingService.resetBalances(reviewed, operationId),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["leave", "balances"] }),
        client.invalidateQueries({ queryKey: ["leave", "posting-preview"] }),
        client.invalidateQueries({ queryKey: ["leave", "conversion-employees"] }),
      ])
    },
  })
  return { preview, reset }
}
