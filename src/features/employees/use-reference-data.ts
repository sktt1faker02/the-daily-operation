/**
 * TanStack Query hooks for the Department / Position reference lists used by the
 * employee form dropdowns and the employee list. Reference data is small and
 * changes rarely, so it caches well.
 */
import { useQuery } from "@tanstack/react-query"
import { referenceService } from "./reference-service"

export const referenceKeys = {
  departments: ["departments"] as const,
  positions: ["positions"] as const,
}

export function useDepartments() {
  return useQuery({
    queryKey: referenceKeys.departments,
    queryFn: () => referenceService.departments(),
  })
}

export function usePositions() {
  return useQuery({
    queryKey: referenceKeys.positions,
    queryFn: () => referenceService.positions(),
  })
}
