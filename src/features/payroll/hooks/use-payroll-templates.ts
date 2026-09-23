import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { payrollTemplateService } from "../services/payroll-template-service"
import { calculatePeriod } from "../services/payroll-service"
import { payrollKeys } from "./use-payroll-periods"

export const templateKeys = {
  all: ["payroll-templates"] as const,
  lines: (id: string) => ["payroll-templates", id, "lines"] as const,
}

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: () => payrollTemplateService.listTemplates(),
  })
}

export function useTemplateLines(id: string) {
  return useQuery({
    queryKey: templateKeys.lines(id),
    queryFn: () => payrollTemplateService.getTemplateLines(id),
    enabled: Boolean(id),
  })
}

export function useSaveTemplate(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string | null }) =>
      payrollTemplateService.saveTemplateFromPeriod(periodId, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
  })
}

export function useRenameTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string | null }) =>
      payrollTemplateService.renameTemplate(id, { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => payrollTemplateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
  })
}

export function useApplyTemplate(periodId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Apply the template's saved inputs, then recalculate only when something
    // actually changed (mirrors useCopyPreviousCutoff's composition).
    mutationFn: async ({
      templateId,
      periodEndDate,
      calculatedByUserId,
    }: {
      templateId: string
      periodEndDate: string
      calculatedByUserId: string
    }) => {
      const result = await payrollTemplateService.applyTemplateToPeriod(templateId, periodId)
      if (result.created > 0 || result.updated > 0) {
        await calculatePeriod(periodId, periodEndDate, calculatedByUserId)
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}
