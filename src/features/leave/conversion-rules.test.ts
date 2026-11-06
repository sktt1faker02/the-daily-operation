import { afterEach, expect, it, vi } from "vitest"
import { currentLeaveYear } from "./conversion-rules"

afterEach(() => vi.useRealTimers())

it.each([
  ["2025-03-31T12:00:00Z", 2024],
  ["2025-04-01T00:00:00Z", 2025],
  ["2025-12-31T15:59:59Z", 2025],
  ["2025-12-31T16:00:00Z", 2026],
  ["2026-03-31T12:00:00Z", 2026],
  ["2026-12-31T15:59:59Z", 2026],
  ["2026-12-31T16:00:00Z", 2027],
])("uses the Philippine calendar-year boundary at %s", (instant, year) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(instant))
  expect(currentLeaveYear()).toBe(year)
})
