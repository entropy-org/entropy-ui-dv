import type { TimelineStore } from "../store/create-store.js"
import type {
  TimelineConfig,
  TimelineItem,
} from "../types.js"
import type {
  TimelineMutationDraft,
  TimelineMutationIntent,
  TimelineMutationOutcome,
} from "../production-types.js"
import {
  canAddTimelineDependency,
  validateTimelineItems,
} from "./data-validation.js"

type OptimisticRecord = {
  intent: TimelineMutationIntent
  state: "pending" | "accepted"
  sequence: number
  affectedIds: string[]
}

let operationSequence = 0

function createOperationId() {
  operationSequence += 1
  return `timeline-${Date.now().toString(36)}-${operationSequence.toString(36)}`
}

function affectedIds(intent: TimelineMutationIntent): string[] {
  switch (intent.type) {
    case "create":
      return intent.item ? [intent.item.id] : []
    case "update":
    case "resize":
    case "hierarchy":
      return [intent.itemId]
    case "delete":
    case "bulk":
      return intent.itemIds
    case "move":
      return intent.changes.map((change) => change.itemId)
    case "dependency-add":
    case "dependency-remove":
      return [intent.dependency.fromItemId, intent.dependency.toItemId]
  }
}

function applyIntent(items: TimelineItem[], intent: TimelineMutationIntent) {
  const byId = new Map(items.map((item) => [item.id, item]))
  const order = items.map((item) => item.id)

  switch (intent.type) {
    case "create":
      if (intent.item && !byId.has(intent.item.id)) {
        byId.set(intent.item.id, intent.item)
        order.push(intent.item.id)
      }
      break
    case "update": {
      const item = byId.get(intent.itemId)
      if (item) byId.set(item.id, { ...item, ...intent.changes, id: item.id })
      break
    }
    case "delete":
      for (const id of intent.itemIds) byId.delete(id)
      break
    case "move":
      for (const change of intent.changes) {
        const item = byId.get(change.itemId)
        if (item) {
          byId.set(item.id, {
            ...item,
            startDate: change.startDate,
            endDate: change.endDate,
          })
        }
      }
      break
    case "resize": {
      const item = byId.get(intent.itemId)
      if (item) {
        byId.set(item.id, {
          ...item,
          startDate: intent.startDate,
          endDate: intent.endDate,
        })
      }
      break
    }
    case "hierarchy": {
      const item = byId.get(intent.itemId)
      if (item) {
        const next = { ...item }
        if (intent.parentId === undefined) delete next.parentId
        else next.parentId = intent.parentId
        byId.set(item.id, next)
      }
      break
    }
    case "bulk":
    case "dependency-add":
    case "dependency-remove":
      break
  }

  return order.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
}

function rejected(reason: string, code: string): TimelineMutationOutcome {
  return { status: "rejected", reason, code }
}

export class TimelineMutationCoordinator {
  private readonly store: TimelineStore
  private config: TimelineConfig
  private baseItems: TimelineItem[]
  private records = new Map<string, OptimisticRecord>()
  private latestSequenceByItem = new Map<string, number>()
  private sequence = 0
  private disposed = false

  constructor(store: TimelineStore, config: TimelineConfig) {
    this.store = store
    this.config = config
    this.baseItems = [...config.items]
  }

  updateConfig(config: TimelineConfig) {
    this.config = config
  }

  syncExternalItems(items: TimelineItem[]) {
    if (this.disposed) return
    this.baseItems = [...items]
    for (const [id, record] of this.records) {
      if (record.state === "accepted") this.records.delete(id)
    }
    this.publishProjection(false)
  }

  cancelPending(reason = "Timeline provider unmounted") {
    if (this.records.size === 0) return
    const records = [...this.records.values()]
    this.records.clear()
    this.publishProjection(true)
    for (const record of records) {
      this.config.onMutationResult?.({
        intent: record.intent,
        outcome: { status: "rejected", reason, code: "cancelled" },
        isLatestForAffectedItems: this.isLatest(record),
      })
    }
  }

  dispose() {
    this.disposed = true
    this.records.clear()
  }

  private projection() {
    return [...this.records.values()]
      .sort((a, b) => a.sequence - b.sequence)
      .reduce(
        (items, record) => applyIntent(items, record.intent),
        this.baseItems
      )
  }

  private publishProjection(notify: boolean) {
    const projected = this.projection()
    this.store.getState().actions.syncItems(projected)
    if (notify) this.config.onItemsChange?.(projected)
  }

  private isLatest(record: OptimisticRecord) {
    return record.affectedIds.every(
      (id) => this.latestSequenceByItem.get(id) === record.sequence
    )
  }

  private validate(
    intent: TimelineMutationIntent
  ): TimelineMutationOutcome | null {
    const config = this.config
    if (config.readOnly) return rejected("Timeline is read-only", "read-only")
    const projected = this.projection()
    const byId = new Map(projected.map((item) => [item.id, item]))
    const permission = (id: string) => {
      const item = byId.get(id)
      return item ? (config.getItemPermissions?.(item) ?? {}) : null
    }

    switch (intent.type) {
      case "create":
        if (intent.item && byId.has(intent.item.id)) {
          return rejected(
            `Item ${intent.item.id} already exists`,
            "duplicate-id"
          )
        }
        break
      case "move":
        if (
          intent.changes.some(
            (change) => permission(change.itemId)?.move === false
          )
        )
          return rejected(
            "Moving one or more items is not permitted",
            "forbidden"
          )
        break
      case "resize":
        if (permission(intent.itemId)?.resize === false)
          return rejected("Resizing this item is not permitted", "forbidden")
        break
      case "update":
        if (permission(intent.itemId)?.update === false)
          return rejected("Updating this item is not permitted", "forbidden")
        break
      case "delete":
        if (intent.itemIds.some((id) => permission(id)?.delete === false))
          return rejected(
            "Deleting one or more items is not permitted",
            "forbidden"
          )
        break
      case "hierarchy":
        if (permission(intent.itemId)?.changeParent === false)
          return rejected(
            "Changing this item's parent is not permitted",
            "forbidden"
          )
        break
      case "dependency-add": {
        if (
          permission(intent.dependency.fromItemId)?.dependencies === false ||
          permission(intent.dependency.toItemId)?.dependencies === false
        )
          return rejected("Editing dependencies is not permitted", "forbidden")
        if (
          !canAddTimelineDependency(
            intent.dependency,
            config.dependenciesList ?? [],
            projected
          )
        )
          return rejected(
            "The dependency is invalid or creates a cycle",
            "invalid-dependency"
          )
        break
      }
      case "dependency-remove":
        if (
          permission(intent.dependency.fromItemId)?.dependencies === false ||
          permission(intent.dependency.toItemId)?.dependencies === false
        )
          return rejected("Editing dependencies is not permitted", "forbidden")
        break
      case "bulk":
        break
    }

    const projectedAfter = applyIntent(projected, intent)
    const itemIssue = validateTimelineItems(projectedAfter)[0]
    return itemIssue ? rejected(itemIssue.message, itemIssue.code) : null
  }

  private invokeLegacy(
    intent: TimelineMutationIntent,
    projected: TimelineItem[]
  ) {
    const config = this.config
    switch (intent.type) {
      case "create":
        config.onItemAdd?.(
          intent.requestedRange.startDate,
          intent.requestedRange.endDate,
          intent.requestedRange.rowIndex
        )
        break
      case "delete":
        config.onItemsDelete?.(intent.itemIds)
        config.onItemsChange?.(projected)
        break
      case "dependency-add":
        config.onDependencyAdd?.(intent.dependency)
        break
      case "dependency-remove":
        config.onDependencyRemove?.(intent.dependency)
        break
      default:
        config.onItemsChange?.(projected)
    }
  }

  async dispatch(
    draft: TimelineMutationDraft
  ): Promise<TimelineMutationOutcome> {
    if (this.disposed) return rejected("Timeline is unmounted", "disposed")
    const config = this.config
    const intent = {
      ...draft,
      operationId: createOperationId(),
      issuedAt: Date.now(),
      baseDataVersion: config.dataVersion,
    } as TimelineMutationIntent
    const validation = this.validate(intent)
    if (validation) {
      config.onMutationResult?.({
        intent,
        outcome: validation,
        isLatestForAffectedItems: true,
      })
      return validation
    }

    this.sequence += 1
    const record: OptimisticRecord = {
      intent,
      state: "pending",
      sequence: this.sequence,
      affectedIds: affectedIds(intent),
    }
    for (const id of record.affectedIds) {
      this.latestSequenceByItem.set(id, record.sequence)
    }
    this.records.set(intent.operationId, record)
    if (config.optimisticUpdates !== false) {
      this.publishProjection(Boolean(config.onMutation))
    }

    let outcome: TimelineMutationOutcome
    try {
      if (config.onMutation) {
        const returned = await config.onMutation(intent)
        outcome = returned ?? { status: "accepted" }
      } else {
        this.invokeLegacy(intent, this.projection())
        outcome = { status: "accepted" }
      }
    } catch (error) {
      outcome = {
        status: "rejected",
        reason: error instanceof Error ? error.message : "Mutation failed",
        code: "mutation-error",
      }
    }

    const current = this.records.get(intent.operationId)
    const canonicalOutcome = { ...outcome, operationId: intent.operationId }
    if (!current) {
      config.onMutationResult?.({
        intent,
        outcome: canonicalOutcome,
        isLatestForAffectedItems: false,
      })
      return canonicalOutcome
    }

    if (outcome.items) {
      this.baseItems = [...outcome.items]
      const affected = new Set(current.affectedIds)
      for (const [id, record] of this.records) {
        if (
          record.sequence <= current.sequence &&
          record.affectedIds.some((itemId) => affected.has(itemId))
        ) this.records.delete(id)
      }
    }
    if (outcome.status === "rejected" || outcome.items) {
      this.records.delete(intent.operationId)
    } else {
      current.state = "accepted"
    }
    this.publishProjection(outcome.status === "rejected")
    config.onMutationResult?.({
      intent,
      outcome: canonicalOutcome,
      isLatestForAffectedItems: this.isLatest(current),
    })
    return canonicalOutcome
  }
}
