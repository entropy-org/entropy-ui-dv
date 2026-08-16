import { describe, expect, it } from "vitest"
import { computeVirtualRowRange } from "./use-virtual-rows.js"

describe("computeVirtualRowRange", () => {
  it("returns the visible rows with a buffer and spacer heights", () => {
    const range = computeVirtualRowRange({
      scrollTop: 400,
      viewportHeight: 200,
      rowHeight: 40,
      itemCount: 100,
      buffer: 5,
    })

    expect(range).toEqual({
      startIndex: 5,
      endIndex: 19,
      topSpacerHeight: 200,
      bottomSpacerHeight: 3200,
    })
  })

  it("clamps the buffer at the beginning and end of the row list", () => {
    expect(
      computeVirtualRowRange({
        scrollTop: 0,
        viewportHeight: 80,
        rowHeight: 40,
        itemCount: 8,
        buffer: 5,
      })
    ).toEqual({
      startIndex: 0,
      endIndex: 6,
      topSpacerHeight: 0,
      bottomSpacerHeight: 40,
    })

    expect(
      computeVirtualRowRange({
        scrollTop: 280,
        viewportHeight: 80,
        rowHeight: 40,
        itemCount: 8,
        buffer: 5,
      })
    ).toEqual({
      startIndex: 2,
      endIndex: 7,
      topSpacerHeight: 80,
      bottomSpacerHeight: 0,
    })
  })

  it("returns an empty range when there are no rows", () => {
    expect(
      computeVirtualRowRange({
        scrollTop: 0,
        viewportHeight: 200,
        rowHeight: 40,
        itemCount: 0,
      })
    ).toEqual({
      startIndex: 0,
      endIndex: -1,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    })
  })
})
