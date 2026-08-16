export interface KanbanOptimisticMutation<TData> {
  readonly clientMutationId: string
  /** Must be pure and deterministic. It may implement create, update, delete, move, or reorder. */
  readonly apply: (data: TData) => TData
}

export interface KanbanOptimisticLedger<TData> {
  /** Adds one idempotent optimistic layer and returns the complete projected value. */
  readonly begin: (
    data: TData,
    mutation: KanbanOptimisticMutation<TData>
  ) => TData
  /** Marks a server-accepted layer and preserves newer pending layers during out-of-order responses. */
  readonly confirm: (clientMutationId: string) => TData | undefined
  /** Removes a rejected layer, then reapplies every newer layer over the saved base snapshot. */
  readonly rollback: (clientMutationId: string) => TData | undefined
  /** Replaces the confirmed base with a live/refetched snapshot and reapplies unresolved layers. */
  readonly rebase: (authoritativeData: TData) => TData
  readonly has: (clientMutationId: string) => boolean
  readonly pendingIds: () => readonly string[]
  readonly clear: () => void
}

type Layer<TData> = KanbanOptimisticMutation<TData> & {
  readonly status: "pending" | "confirmed"
}

/**
 * Creates a consumer-owned optimistic mutation ledger suitable for a TanStack
 * Query cache. It deliberately lives outside the Kanban Zustand store: query
 * records and rollback snapshots remain owned by the data layer.
 */
export function createKanbanOptimisticLedger<
  TData,
>(): KanbanOptimisticLedger<TData> {
  let base: TData | undefined
  let layers: Layer<TData>[] = []

  const project = (): TData | undefined => {
    const confirmedBase = base
    if (confirmedBase === undefined) return undefined
    return layers.reduce<TData>(
      (data, layer) => layer.apply(data),
      confirmedBase
    )
  }

  const compactConfirmedPrefix = () => {
    while (base !== undefined && layers[0]?.status === "confirmed") {
      base = layers[0].apply(base)
      layers = layers.slice(1)
    }
  }

  return {
    begin(data, mutation) {
      if (base === undefined || layers.length === 0) base = data
      if (
        !layers.some(
          ({ clientMutationId }) =>
            clientMutationId === mutation.clientMutationId
        )
      ) {
        layers = [...layers, { ...mutation, status: "pending" }]
      }
      return project() ?? data
    },
    confirm(clientMutationId) {
      layers = layers.map((layer) =>
        layer.clientMutationId === clientMutationId
          ? { ...layer, status: "confirmed" }
          : layer
      )
      compactConfirmedPrefix()
      return project()
    },
    rollback(clientMutationId) {
      layers = layers.filter(
        (layer) => layer.clientMutationId !== clientMutationId
      )
      compactConfirmedPrefix()
      return project()
    },
    rebase(authoritativeData) {
      base = authoritativeData
      return project() ?? authoritativeData
    },
    has(clientMutationId) {
      return layers.some((layer) => layer.clientMutationId === clientMutationId)
    },
    pendingIds() {
      return layers
        .filter(({ status }) => status === "pending")
        .map(({ clientMutationId }) => clientMutationId)
    },
    clear() {
      base = undefined
      layers = []
    },
  }
}
