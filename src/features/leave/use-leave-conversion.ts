import { useCallback, useState } from "react"
import { useBeforeUnload, useBlocker } from "react-router-dom"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { InfiniteData } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAccessProfile } from "@/features/payroll/hooks/use-access-profile"
import { leaveAccessState } from "./rules"
import { conversionService } from "./conversion-service"
import { conversionDraft, validateConversionDraft } from "./conversion-types"
import type { ConversionDraft, ConversionPage, ConversionRow } from "./conversion-types"

export function useLeaveConversion(year: number) {
  const access = useAccessProfile({ loadEmployee: false })
  const allowed = leaveAccessState(access) === "allowed"
  const client = useQueryClient()
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, { row: ConversionRow; values: ConversionDraft }>>({})
  const [editing, setEditing] = useState<{ row: ConversionRow; values: ConversionDraft } | null>(null)
  const query = useInfiniteQuery({ queryKey: ["leave", "conversion", "rows", year], queryFn: ({ pageParam }) => conversionService.rows(year, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.next, retry: false, enabled: allowed, refetchOnWindowFocus: false })
  const transaction = query.data?.pages[0].transaction
  const paid = transaction?.paid === true
  const page = query.data?.pages[index]
  const editingChanged = editing && JSON.stringify(editing.values) !== JSON.stringify(drafts[editing.row.id]?.values ?? conversionDraft(editing.row))
  const dirty = Object.keys(drafts).length > 0 || Boolean(editingChanged)
  const blocker = useBlocker(dirty)
  useBeforeUnload(useCallback(event => { if (dirty) { event.preventDefault(); event.returnValue = "" } }, [dirty]))
  const markPaid = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error("Payroll Admin access is required.")
      if (!transaction || transaction.paid === undefined || query.isFetching) throw new Error("Reload the year to verify its payment status.")
      if (dirty || editing) throw new Error("Save or cancel your edits before marking this year as paid.")
      return conversionService.markPaid(transaction)
    }, retry: false,
    onSuccess: value => {
      client.setQueryData<InfiniteData<ConversionPage>>(["leave", "conversion", "rows", year], previous => previous && ({ ...previous, pages: previous.pages.map(page => ({ ...page, transaction: value })) }))
      void client.invalidateQueries({ queryKey: ["leave", "conversion", "rows", year] })
      void client.invalidateQueries({ queryKey: ["leave", "conversion", "years"] })
      toast.success(`Leave conversion for ${year} marked as paid.`)
    }, onError: error => toast.error(error.message),
  })
  const save = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error("Payroll Admin access is required.")
      if (paid || markPaid.isPending) throw new Error("This leave conversion is paid or being marked as paid and cannot be edited.")
      if (!transaction || editing) throw new Error("Finish editing the row before saving.")
      const changes = Object.values(drafts).map(({ row, values }) => {
        if (Object.keys(validateConversionDraft(values)).length) throw new Error("Correct the conversion values before saving.")
        return { id: row.id, employeeId: row.employeeId, availableVL: Number(values.availableVL), days: Number(values.days) }
      })
      if (!changes.length) throw new Error("There are no unsaved changes.")
      return conversionService.save(transaction, changes)
    }, retry: false,
    onSuccess: () => {
      setDrafts({}); setEditing(null)
      void client.invalidateQueries({ queryKey: ["leave", "conversion", "rows", year] })
      void client.invalidateQueries({ queryKey: ["leave", "conversion", "years"] })
      toast.success(`Leave conversion for ${year} saved.`)
    }, onError: error => toast.error(error.message),
  })
  function edit(row: ConversionRow) {
    if (!allowed || paid || editing || save.isPending || markPaid.isPending) return
    setEditing({ row, values: drafts[row.id]?.values ?? conversionDraft(row) })
  }
  function done() {
    if (!editing || !allowed || Object.keys(validateConversionDraft(editing.values)).length) return
    const { row, values } = editing
    setDrafts(previous => {
      const next = { ...previous }
      if (Number(values.availableVL) === row.availableVL && Number(values.days) === row.days) delete next[row.id]
      else next[row.id] = { row, values: { availableVL: Number(values.availableVL).toFixed(2), days: Number(values.days).toFixed(2) } }
      return next
    }); setEditing(null)
  }
  async function next() {
    if (query.data && index < query.data.pages.length - 1) { setIndex(index + 1); return }
    const result = await query.fetchNextPage()
    if (!result.isError && result.data && result.data.pages.length > index + 1) setIndex(index + 1)
  }
  return { query, page, index, setIndex, next, drafts, editing, setEditing, edit, done, dirty, blocker, save, allowed, paid, markPaid, transaction }
}
