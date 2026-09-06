import { describe, it, expect } from "vitest"
import { round2 } from "./payroll-calculation"

describe("round2", () => {
  it("rounds half up to 2 decimals", () => {
    expect(round2(537.505)).toBe(537.51)
    expect(round2(100)).toBe(100)
    expect(round2(1750 / 2)).toBe(875)
    expect(round2(1075 / 2)).toBe(537.5)
  })
})
