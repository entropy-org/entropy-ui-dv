import type { TimelineDependency } from "../types.js"

/**
 * Dependency path utilities — SVG `d` attribute computation.
 *
 * Computes finish-to-start connector paths from the source bar's right edge
 * to the target bar's left edge.
 *
 * Paths use horizontal → vertical → horizontal routing to avoid diagonals.
 */

/** Rect describing a bar's position in the timeline grid */
export interface BarRect {
  /** Left edge x-coordinate */
  left: number
  /** Top edge y-coordinate */
  top: number
  /** Width of the bar */
  width: number
  /** Height of the bar */
  height: number
}

export interface DependencyRouteOptions {
  channelOffset?: number
  sourcePortOffsetY?: number
  targetPortOffsetY?: number
}

type DependencyEndpoint = "source" | "target"

type PortUse = {
  dependencyId: string
  endpoint: DependencyEndpoint
}

export interface PathPoint {
  x: number
  y: number
}

const CORNER_RADIUS = 6
const EDGE_GAP = 12
const CHANNEL_SPACING = 8
const MAX_PORT_SPREAD = 12

function getChannelOffset(index: number): number {
  if (index === 0) return 0
  const distance = Math.ceil(index / 2) * CHANNEL_SPACING
  return index % 2 === 1 ? distance : -distance
}

function getPortKey(
  dependency: TimelineDependency,
  endpoint: DependencyEndpoint
): string {
  if (endpoint === "source") {
    return `${dependency.fromItemId}:right`
  }

  return `${dependency.toItemId}:left`
}

/**
 * Assign stable channels and attachment ports so adjacent dependencies fan out
 * instead of rendering as indistinguishable paths.
 */
export function computeDependencyRouteOptions(
  dependencies: readonly TimelineDependency[]
): Map<string, DependencyRouteOptions> {
  const sortedDependencies = [...dependencies].sort((a, b) =>
    a.id.localeCompare(b.id)
  )
  const routes = new Map<string, DependencyRouteOptions>()
  const portUses = new Map<string, PortUse[]>()

  sortedDependencies.forEach((dependency, index) => {
    routes.set(dependency.id, {
      channelOffset: getChannelOffset(index),
    })

    for (const endpoint of ["source", "target"] as const) {
      const key = getPortKey(dependency, endpoint)
      const uses = portUses.get(key) ?? []
      uses.push({ dependencyId: dependency.id, endpoint })
      portUses.set(key, uses)
    }
  })

  for (const uses of portUses.values()) {
    const step =
      uses.length > 1 ? Math.min(4, MAX_PORT_SPREAD / (uses.length - 1)) : 0

    uses.forEach((use, index) => {
      const offset = (index - (uses.length - 1) / 2) * step
      const route = routes.get(use.dependencyId)
      if (!route) return

      if (use.endpoint === "source") {
        route.sourcePortOffsetY = offset
      } else {
        route.targetPortOffsetY = offset
      }
    })
  }

  return routes
}

function distance(a: PathPoint, b: PathPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function formatPoint(point: PathPoint): string {
  return `${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`
}

function removeDuplicatePoints(points: PathPoint[]): PathPoint[] {
  return points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y
  )
}

/** Build a compact SVG path with rounded corners through orthogonal points. */
export function computeRoundedOrthogonalPath(
  inputPoints: PathPoint[],
  cornerRadius = CORNER_RADIUS
): string {
  const points = removeDuplicatePoints(inputPoints)
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${formatPoint(points[0])}`

  const commands = [`M ${formatPoint(points[0])}`]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const previousLength = distance(previous, current)
    const nextLength = distance(current, next)
    const radius = Math.min(cornerRadius, previousLength / 2, nextLength / 2)

    if (radius <= 0) {
      commands.push(`L ${formatPoint(current)}`)
      continue
    }

    const entry = {
      x: current.x + ((previous.x - current.x) / previousLength) * radius,
      y: current.y + ((previous.y - current.y) / previousLength) * radius,
    }
    const exit = {
      x: current.x + ((next.x - current.x) / nextLength) * radius,
      y: current.y + ((next.y - current.y) / nextLength) * radius,
    }

    commands.push(
      `L ${formatPoint(entry)}`,
      `Q ${formatPoint(current)} ${formatPoint(exit)}`
    )
  }

  commands.push(`L ${formatPoint(points[points.length - 1])}`)
  return commands.join(" ")
}

/**
 * Compute an SVG path `d` attribute for a finish-to-start dependency.
 *
 * Route: source right-center → midpoint X → target left-center
 *
 * @param source - Source bar rect
 * @param target - Target bar rect
 * @returns SVG path `d` string
 */
export function computeFSPath(
  source: BarRect,
  target: BarRect,
  options: DependencyRouteOptions = {}
): string {
  const startX = source.left + source.width
  const startY =
    source.top + source.height / 2 + (options.sourcePortOffsetY ?? 0)
  const endX = target.left
  const endY = target.top + target.height / 2 + (options.targetPortOffsetY ?? 0)

  if (startY === endY) {
    const channelOffset = options.channelOffset ?? 0
    if (channelOffset !== 0) {
      const direction = endX >= startX ? 1 : -1
      const sourceExitX = startX + EDGE_GAP * direction
      const targetEntryX = endX - EDGE_GAP * direction
      const channelY = startY + channelOffset

      return computeRoundedOrthogonalPath([
        { x: startX, y: startY },
        { x: sourceExitX, y: startY },
        { x: sourceExitX, y: channelY },
        { x: targetEntryX, y: channelY },
        { x: targetEntryX, y: endY },
        { x: endX, y: endY },
      ])
    }

    return computeRoundedOrthogonalPath([
      { x: startX, y: startY },
      { x: endX, y: endY },
    ])
  }

  if (endX - startX >= EDGE_GAP * 2) {
    const midpoint = startX + (endX - startX) / 2
    const maximumOffset = Math.max(0, (endX - startX) / 2 - EDGE_GAP)
    const channelOffset = Math.max(
      -maximumOffset,
      Math.min(maximumOffset, options.channelOffset ?? 0)
    )
    const midX = midpoint + channelOffset
    return computeRoundedOrthogonalPath([
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: endY },
      { x: endX, y: endY },
    ])
  }

  const sourceExitX = startX + EDGE_GAP
  const targetEntryX = endX - EDGE_GAP
  const channelY = startY + (endY - startY) / 2 + (options.channelOffset ?? 0)

  return computeRoundedOrthogonalPath([
    { x: startX, y: startY },
    { x: sourceExitX, y: startY },
    { x: sourceExitX, y: channelY },
    { x: targetEntryX, y: channelY },
    { x: targetEntryX, y: endY },
    { x: endX, y: endY },
  ])
}

/**
 * Compute the supported finish-to-start dependency path.
 *
 * @param source - Source bar rect
 * @param target - Target bar rect
 * @returns SVG path `d` string
 */
export function computeDependencyPath(
  source: BarRect,
  target: BarRect,
  options: DependencyRouteOptions = {}
): string {
  return computeFSPath(source, target, options)
}

/**
 * Compute the smooth hand-drawn-style curve used by editable dependencies.
 * Route offsets keep repeated relationships visually distinct without
 * reintroducing the rigid full-width elbow channels.
 */
export function computeDependencyCurvePath(
  source: BarRect,
  target: BarRect,
  options: DependencyRouteOptions = {}
): string {
  const sourcePoint = {
    x: source.left + source.width,
    y: source.top + source.height / 2 + (options.sourcePortOffsetY ?? 0),
  }
  const targetPoint = {
    x: target.left,
    y: target.top + target.height / 2 + (options.targetPortOffsetY ?? 0),
  }
  const horizontalDistance = targetPoint.x - sourcePoint.x
  const direction = horizontalDistance >= 0 ? 1 : -1
  const handleLength = Math.max(
    48,
    Math.min(180, Math.abs(horizontalDistance) * 0.5)
  )
  const bend = options.channelOffset ?? 0

  return [
    `M ${formatPoint(sourcePoint)}`,
    `C ${formatCoordinate(sourcePoint.x + handleLength * direction)} ${formatCoordinate(sourcePoint.y + bend)}`,
    `${formatCoordinate(targetPoint.x - handleLength * direction)} ${formatCoordinate(targetPoint.y + bend)}`,
    `${formatPoint(targetPoint)}`,
  ].join(" ")
}

/**
 * Build the live, free-form path shown while a dependency is being created.
 * A cubic curve keeps pointer tracking visually continuous in every direction
 * and requires only one SVG attribute update per animation frame.
 */
export function computeDependencyDraftPath(
  source: PathPoint,
  target: PathPoint
): string {
  const horizontalDistance = target.x - source.x
  const direction = horizontalDistance >= 0 ? 1 : -1
  const handleLength = Math.max(
    48,
    Math.min(180, Math.abs(horizontalDistance) * 0.5)
  )
  const sourceControlX = source.x + handleLength * direction
  const targetControlX = target.x - handleLength * direction

  return [
    `M ${formatPoint(source)}`,
    `C ${formatCoordinate(sourceControlX)} ${formatCoordinate(source.y)}`,
    `${formatCoordinate(targetControlX)} ${formatCoordinate(target.y)}`,
    `${formatPoint(target)}`,
  ].join(" ")
}
