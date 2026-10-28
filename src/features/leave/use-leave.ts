import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { leaveService } from "./leave-service"
import { personalLeaveService } from "./personal-leave-service"
import type { LeaveFilters, SourceReference } from "./types"

export function useLeavePage(filters: LeaveFilters, personal = false) {
  return useInfiniteQuery({
    queryKey: ["leave", "list", filters, ...(personal ? ["personal"] : [])],
    queryFn: ({ pageParam }) => personal ? personalLeaveService.list(filters, pageParam) : leaveService.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.next,
    retry: false,
  })
}

export function useLeaveBalances(employeeId: string, year: number, personal = false) {
  return useQuery({
    queryKey: ["leave", "balances", employeeId, year, ...(personal ? ["personal"] : [])],
    queryFn: () => personal ? personalLeaveService.balances(employeeId, year) : leaveService.balances(employeeId, year),
    enabled: Boolean(employeeId), retry: false,
  })
}

export function useLeaveDetail(source: SourceReference | null) {
  return useQuery({
    queryKey: ["leave", "detail", source],
    queryFn: () => {
      if (!source) throw new Error("Select a record.")
      return leaveService.detail(source)
    },
    enabled: source !== null, retry: false,
  })
}
