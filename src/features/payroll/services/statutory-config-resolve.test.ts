import { describe, it, expect } from "vitest"
import { resolveEffective } from "./statutory-config-resolve"

const rows = [
  { effectiveFrom: "2024-01-01", effectiveUntil: "2024-12-31", v: "2024" },
  { effectiveFrom: "2025-01-01", effectiveUntil: null, v: "2025" },
]

describe("resolveEffective", () => {
  it("picks the row in force at the as-of date", () => {
    expect(resolveEffective(rows, "2026-03-31").map((r) => r.v)).toEqual(["2025"])
    expect(resolveEffective(rows, "2024-06-30").map((r) => r.v)).toEqual(["2024"])
  })
  it("returns empty when nothing is in force yet", () => {
    expect(resolveEffective(rows, "2023-06-30")).toEqual([])
  })
})
