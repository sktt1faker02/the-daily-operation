import { describe, expect, it } from "vitest"
import { conversionAmount, validateConversionDraft } from "./conversion-types"

describe("conversion row rules", () => {
  it.each([
    ["10.00", "5.00", true], ["0.00", "0.00", true], ["2.25", "2.25", true],
    ["-1", "0", false], ["10", "-1", false], ["3", "3.5", false], ["10", "5.01", false],
    ["", "2", false], ["10", "NaN", false], ["Infinity", "1", false], ["10", "1.001", false],
  ])("validates available %s and conversion %s", (availableVL, days, valid) => {
    expect(Object.keys(validateConversionDraft({ availableVL, days })).length === 0).toBe(valid)
  })
  it("calculates from the saved rounded rate, including quarter-day decimal inputs", () => {
    expect(conversionAmount(2272.73, 5)).toBe(11363.65)
    expect(conversionAmount(863.64, 0.83)).toBe(716.82)
    expect(conversionAmount(0.01, 0.5)).toBe(0.01)
  })
})
