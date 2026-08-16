import type {
  TimelineDependency,
  TimelineItem,
} from "../types.js"

export type TimelineValidationIssue = {
  code:
    | "duplicate-item-id"
    | "invalid-date"
    | "invalid-range"
    | "missing-parent"
    | "hierarchy-cycle"
    | "duplicate-dependency-id"
    | "missing-dependency-endpoint"
    | "self-dependency"
    | "duplicate-dependency"
    | "dependency-cycle"
  message: string
  itemId?: string
  dependencyId?: string
}

function hasHierarchyCycle(
  item: TimelineItem,
  items: Map<string, TimelineItem>
) {
  const visited = new Set<string>([item.id])
  let parentId = item.parentId
  while (parentId) {
    if (visited.has(parentId)) return true
    visited.add(parentId)
    parentId = items.get(parentId)?.parentId
  }
  return false
}

export function validateTimelineItems(
  items: readonly TimelineItem[]
): TimelineValidationIssue[] {
  const issues: TimelineValidationIssue[] = []
  const byId = new Map<string, TimelineItem>()

  for (const item of items) {
    if (byId.has(item.id)) {
      issues.push({
        code: "duplicate-item-id",
        itemId: item.id,
        message: `Duplicate timeline item id: ${item.id}`,
      })
      continue
    }
    byId.set(item.id, item)
    if (
      Number.isNaN(item.startDate.getTime()) ||
      Number.isNaN(item.endDate.getTime())
    ) {
      issues.push({
        code: "invalid-date",
        itemId: item.id,
        message: `Timeline item ${item.id} has an invalid date`,
      })
    } else if (item.endDate <= item.startDate) {
      issues.push({
        code: "invalid-range",
        itemId: item.id,
        message: `Timeline item ${item.id} must end after it starts`,
      })
    }
  }

  for (const item of byId.values()) {
    if (item.parentId && !byId.has(item.parentId)) {
      issues.push({
        code: "missing-parent",
        itemId: item.id,
        message: `Timeline item ${item.id} references missing parent ${item.parentId}`,
      })
    } else if (hasHierarchyCycle(item, byId)) {
      issues.push({
        code: "hierarchy-cycle",
        itemId: item.id,
        message: `Timeline hierarchy contains a cycle at ${item.id}`,
      })
    }
  }

  return issues
}

function dependencyCreatesCycle(
  candidate: TimelineDependency,
  dependencies: readonly TimelineDependency[]
) {
  const outgoing = new Map<string, string[]>()
  for (const dependency of [...dependencies, candidate]) {
    const targets = outgoing.get(dependency.fromItemId) ?? []
    targets.push(dependency.toItemId)
    outgoing.set(dependency.fromItemId, targets)
  }

  const stack = [candidate.toItemId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === candidate.fromItemId) return true
    visited.add(current)
    stack.push(...(outgoing.get(current) ?? []))
  }
  return false
}

export function validateTimelineDependencies(
  dependencies: readonly TimelineDependency[],
  items: readonly TimelineItem[]
): TimelineValidationIssue[] {
  const issues: TimelineValidationIssue[] = []
  const itemIds = new Set(items.map((item) => item.id))
  const dependencyIds = new Set<string>()
  const pairs = new Set<string>()
  const accepted: TimelineDependency[] = []

  for (const dependency of dependencies) {
    const pair = `${dependency.fromItemId}\u0000${dependency.toItemId}`
    if (dependencyIds.has(dependency.id)) {
      issues.push({
        code: "duplicate-dependency-id",
        dependencyId: dependency.id,
        message: `Duplicate timeline dependency id: ${dependency.id}`,
      })
      continue
    }
    dependencyIds.add(dependency.id)

    if (
      !itemIds.has(dependency.fromItemId) ||
      !itemIds.has(dependency.toItemId)
    ) {
      issues.push({
        code: "missing-dependency-endpoint",
        dependencyId: dependency.id,
        message: `Dependency ${dependency.id} references an unloaded or missing item`,
      })
    } else if (dependency.fromItemId === dependency.toItemId) {
      issues.push({
        code: "self-dependency",
        dependencyId: dependency.id,
        message: `Dependency ${dependency.id} cannot target its source`,
      })
    } else if (pairs.has(pair)) {
      issues.push({
        code: "duplicate-dependency",
        dependencyId: dependency.id,
        message: `Dependency ${dependency.id} duplicates an existing link`,
      })
    } else if (dependencyCreatesCycle(dependency, accepted)) {
      issues.push({
        code: "dependency-cycle",
        dependencyId: dependency.id,
        message: `Dependency ${dependency.id} would create a cycle`,
      })
    } else {
      pairs.add(pair)
      accepted.push(dependency)
    }
  }

  return issues
}

export function canAddTimelineDependency(
  dependency: TimelineDependency,
  dependencies: readonly TimelineDependency[],
  items: readonly TimelineItem[]
) {
  return (
    validateTimelineDependencies([...dependencies, dependency], items).filter(
      (issue) => issue.dependencyId === dependency.id
    ).length === 0
  )
}
