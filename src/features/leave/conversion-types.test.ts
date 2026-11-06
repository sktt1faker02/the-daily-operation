import { describe, expect, it } from "vitest"
import { conversionAmount, conversionDraft, effectiveConversion, validateConversionDraft } from "./conversion-types"

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
  it("keeps chosen limits but caps unpaid days and amount at recorded VL", () => {
    const row = { id: "row", employeeId: "employee", employeeName: "Employee", employeeNumber: "1", dailyRate: 100, availableVL: 4, days: 4, amount: 400, limitAvailableVL: 10, limitDays: 5, liveVL: 4 }
    expect(conversionDraft(row)).toEqual({ availableVL: "10.00", days: "5.00" })
    expect(effectiveConversion(row)).toEqual({ availableVL: 4, days: 4, amount: 400 })
    expect(effectiveConversion({ ...row, liveVL: 9 })).toEqual({ availableVL: 9, days: 5, amount: 500 })
    expect(effectiveConversion(row, { availableVL: "8.00", days: "3.00" })).toEqual({ availableVL: 4, days: 3, amount: 300 })
    expect(effectiveConversion({ ...row, liveVL: 2 }, { availableVL: "8.00", days: "3.00" })).toEqual({ availableVL: 2, days: 2, amount: 200 })
  })
})
