import { describe, expect, it } from "vitest"
import {
  getColumnIndexAtX,
  getColumnSpanPosition,
  getDateAtX,
} from "./position.js"

describe("calendar position utilities", () => {
  it("maps and clamps pointer positions into columns", () => {
    expect(getColumnIndexAtX(100, 100, 700, 7)).toBe(0)
    expect(getColumnIndexAtX(250, 100, 700, 7)).toBe(1)
    expect(getColumnIndexAtX(900, 100, 700, 7)).toBe(6)
    expect(getColumnIndexAtX(100, 100, 0, 7)).toBe(-1)
  })

  it("returns percentage geometry for inclusive column spans", () => {
    expect(getColumnSpanPosition(1, 2, 5)).toEqual({
      leftPercent: 20,
      widthPercent: 40,
    })
    expect(getColumnSpanPosition(3, 2, 5)).toBeNull()
  })

  it("maps visible-only columns to their dates", () => {
    const dates = [
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
    ]
    expect(getDateAtX(dates, 499, 0, 500)).toBe("2026-07-31")
    expect(getDateAtX([], 10, 0, 100)).toBeNull()
  })
})
