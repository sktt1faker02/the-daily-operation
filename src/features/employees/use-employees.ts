/**
 * TanStack Query hooks for employee data. Presentation components use these
 * hooks; they never call the service or Dataverse directly.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { employeeService } from "./employee-service"
import { EmploymentStatus, type EmployeeFormValues } from "./types"

export type EmployeeStatusFilter = "all" | "active" | "inactive"

export const employeeKeys = {
  all: ["employees"] as const,
  lists: () => [...employeeKeys.all, "list"] as const,
  list: (filter: EmployeeStatusFilter) => [...employeeKeys.lists(), filter] as const,
  detail: (id: string) => [...employeeKeys.all, "detail", id] as const,
}

function filterToOData(filter: EmployeeStatusFilter): string | undefined {
  switch (filter) {
    case "active":
      return `a365_employmentstatus eq ${EmploymentStatus.Active}`
    case "inactive":
      return `a365_employmentstatus ne ${EmploymentStatus.Active}`
    case "all":
    default:
      return undefined
  }
}

export function useEmployees(filter: EmployeeStatusFilter = "all") {
  return useQuery({
    queryKey: employeeKeys.list(filter),
    queryFn: () => employeeService.list({ filter: filterToOData(filter) }),
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: EmployeeFormValues) => employeeService.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: EmployeeFormValues }) =>
      employeeService.update(id, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() })
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(variables.id) })
    },
  })
}
