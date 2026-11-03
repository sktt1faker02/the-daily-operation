import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ledgerService } from "./ledger-service"
import type { LedgerFilters } from "./types"

export const ledgerKeys = { all: ["accounting", "ledger"] as const }
export function useLedger(filters: LedgerFilters, cursor?: string) {
  return useQuery({ queryKey: [...ledgerKeys.all, "list", filters, cursor], queryFn: () => ledgerService.list(filters, cursor), retry: false })
}
export function useLedgerHistory(enabled: boolean) {
  return useQuery({ queryKey: [...ledgerKeys.all, "history"], queryFn: () => ledgerService.preview(), enabled, retry: false })
}
export function useLedgerJobs() {
  return useQuery({ queryKey: [...ledgerKeys.all, "jobs"], queryFn: () => ledgerService.jobs(), retry: false, refetchInterval: query => query.state.data?.jobs.some(job => job.status === "queued" || job.status === "running") ? 5000 : false })
}
export function useLedgerWrite<T>(action: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: action, retry: false, onSettled: () => { void client.invalidateQueries({ queryKey: ledgerKeys.all }) } })
}
