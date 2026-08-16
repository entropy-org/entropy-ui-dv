/**
 * Tests for dependency-path — SVG path computation.
 *
 * Verifies finish-to-start path generation.
 */
import { describe, it, expect } from "vitest"
import {
  computeFSPath,
  computeDependencyPath,
  computeDependencyCurvePath,
  computeDependencyRouteOptions,
  computeRoundedOrthogonalPath,
  type BarRect,
} from "./dependency-path.js"
import type { TimelineDependency } from "../types.js"

const sourceBar: BarRect = { left: 100, top: 40, width: 120, height: 36 }
const targetBar: BarRect = { left: 300, top: 120, width: 80, height: 36 }

describe("computeFSPath", () => {
  it("routes through a rounded midpoint channel", () => {
    const d = computeFSPath(sourceBar, targetBar)

    expect(d).toBe(
      "M 220 58 L 254 58 Q 260 58 260 64 L 260 132 Q 260 138 266 138 L 300 138"
    )
  })

  it("handles same-row items", () => {
    const sameRowTarget: BarRect = { left: 300, top: 40, width: 80, height: 36 }
    const d = computeFSPath(sourceBar, sameRowTarget)

    expect(d).toBe("M 220 58 L 300 58")
  })

  it("separates same-row items when assigned a channel", () => {
    const sameRowTarget: BarRect = {
      left: 300,
      top: 40,
      width: 80,
      height: 36,
    }
    const d = computeFSPath(sourceBar, sameRowTarget, { channelOffset: 8 })

    expect(d).toContain("M 220 58")
    expect(d).toContain("Q 232 66")
    expect(d).toContain("L 300 58")
  })

  it("uses a flexible channel for backward links", () => {
    const backwardTarget: BarRect = {
      left: 180,
      top: 120,
      width: 80,
      height: 36,
    }
    const d = computeFSPath(sourceBar, backwardTarget)

    expect(d).toContain("M 220 58")
    expect(d).toContain("Q 232 58 232 64")
    expect(d).toContain("L 180 138")
  })
})

describe("computeRoundedOrthogonalPath", () => {
  it("clamps corner radii on short segments", () => {
    const d = computeRoundedOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 20 },
      ],
      8
    )

    expect(d).toBe("M 0 0 L 2 0 Q 4 0 4 2 L 4 20")
  })
})

describe("computeDependencyPath", () => {
  it("delegates to FS path for finish-to-start", () => {
    const d = computeDependencyPath(sourceBar, targetBar)
    expect(d).toBe(computeFSPath(sourceBar, targetBar))
  })
})

describe("computeDependencyRouteOptions", () => {
  it("fans shared endpoints into stable ports and separate channels", () => {
    const dependencies: TimelineDependency[] = [
      {
        id: "dep-b",
        fromItemId: "source",
        toItemId: "target",
        type: "finish-to-start",
      },
      {
        id: "dep-a",
        fromItemId: "source",
        toItemId: "target",
        type: "finish-to-start",
      },
    ]

    const routes = computeDependencyRouteOptions(dependencies)

    expect(routes.get("dep-a")).toEqual({
      channelOffset: 0,
      sourcePortOffsetY: -2,
      targetPortOffsetY: -2,
    })
    expect(routes.get("dep-b")).toEqual({
      channelOffset: 8,
      sourcePortOffsetY: 2,
      targetPortOffsetY: 2,
    })
  })
})

describe("computeDependencyCurvePath", () => {
  it("uses the same smooth cubic shape as the live dependency draft", () => {
    const d = computeDependencyCurvePath(sourceBar, targetBar)

    expect(d).toMatch(/^M 220 58 C /)
    expect(d).toContain(" 300 138")
    expect(d).not.toContain(" L ")
  })

  it("bends duplicate routes without changing their endpoints", () => {
    const first = computeDependencyCurvePath(sourceBar, targetBar, {
      channelOffset: 0,
    })
    const second = computeDependencyCurvePath(sourceBar, targetBar, {
      channelOffset: 8,
    })

    expect(first).not.toBe(second)
    expect(first.split(" ").slice(-2)).toEqual(second.split(" ").slice(-2))
  })
})
