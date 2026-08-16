# TanStack Query production integration

The board is controlled. TanStack Query owns records, optimistic snapshots, retries, caching, and invalidation. The
per-provider Zustand store owns only selection, focus, search input, drag previews, announcements, and bounded command
metadata.

## Query and mutation shape

The following is a complete integration pattern. Domain-specific helpers (`toKanbanCards`, `applyIntent`, and the API
calls) are application code because only the application knows its record schema and rank format.

```tsx
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Kanban,
  KanbanProvider,
  createKanbanOptimisticLedger,
  type KanbanCommand,
  type KanbanCommandResult,
  type KanbanConfig,
} from "@/components/kanban"

type ProjectSnapshot = {
  readonly tasks: readonly Task[]
  readonly statuses: readonly Status[]
  readonly revision: number
  readonly totalByStatus: Readonly<Record<string, number>>
}

type ProjectIntent =
  | { readonly type: "board"; readonly clientMutationId: string; readonly command: KanbanCommand }
  | { readonly type: "create"; readonly clientMutationId: string; readonly task: Task }
  | { readonly type: "update"; readonly clientMutationId: string; readonly taskId: string; readonly patch: Partial<Task> }

const projectKey = (projectId: string) => ["project-board", projectId] as const

// This pure function updates the cached domain snapshot. For move/reorder it
// calculates a temporary rank from command.neighbors; the server remains the
// authority and may return compacted ranks in the next snapshot.
function applyIntent(snapshot: ProjectSnapshot, intent: ProjectIntent): ProjectSnapshot {
  if (intent.type === "create") return { ...snapshot, tasks: [...snapshot.tasks, intent.task] }
  if (intent.type === "update") return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => task.id === intent.taskId ? { ...task, ...intent.patch } : task),
  }
  const command = intent.command
  if (command.type === "delete-cards") return {
    ...snapshot,
    tasks: snapshot.tasks.filter((task) => !command.cardIds.includes(task.id)),
  }
  if (command.type === "move-cards") return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => command.cardIds.includes(task.id) ? {
      ...task,
      statusId: command.destination.groupId,
      swimlaneId: command.destination.swimlaneId,
      rank: rankBetween(snapshot.tasks, command.destination, command.neighbors),
    } : task),
  }
  if (command.type === "reorder-groups") return {
    ...snapshot,
    statuses: snapshot.statuses.map((status) => status.id === command.groupId
      ? { ...status, rank: groupRankBetween(snapshot.statuses, command.neighbors) }
      : status),
  }
  // Restore and duplicate normally need server-allocated records/IDs. Merge
  // the returned authoritative snapshot instead of inventing those records.
  return snapshot
}

export function ProjectKanban({ projectId }: { readonly projectId: string }) {
  const queryClient = useQueryClient()
  const [serverSearch, setServerSearch] = useState("")
  const ledger = useMemo(() => createKanbanOptimisticLedger<ProjectSnapshot>(), [projectId])
  const queryKey = [...projectKey(projectId), { search: serverSearch }] as const
  const query = useQuery({
    queryKey,
    queryFn: () => api.getProjectBoard({ projectId, search: serverSearch }),
  })

  const mutation = useMutation({
    mutationFn: async (intent: ProjectIntent): Promise<KanbanCommandResult> => {
      // Send clientMutationId as an idempotency key. Duplicate retries must
      // reuse the original result and apply the command only once.
      return api.persistProjectIntent(projectId, intent, { idempotencyKey: intent.clientMutationId })
    },
    onMutate: async (intent) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<ProjectSnapshot>(queryKey, (current) => current
        ? ledger.begin(current, { clientMutationId: intent.clientMutationId, apply: (data) => applyIntent(data, intent) })
        : current)
      return { clientMutationId: intent.clientMutationId, queryKey }
    },
    onSuccess: (result, _intent, context) => {
      const next = result.status === "accepted"
        ? ledger.confirm(context.clientMutationId)
        : ledger.rollback(context.clientMutationId)
      if (next) queryClient.setQueryData(context.queryKey, next)
    },
    onError: (_error, _intent, context) => {
      const next = context ? ledger.rollback(context.clientMutationId) : undefined
      if (next && context) queryClient.setQueryData(context.queryKey, next)
    },
    onSettled: () => {
      // Do not let an older refetch erase a newer optimistic layer.
      if (ledger.pendingIds().length === 0) {
        void queryClient.invalidateQueries({ queryKey: projectKey(projectId) })
      }
    },
  })

  const snapshot = query.data
  const config: KanbanConfig = {
    cards: snapshot ? toKanbanCards(snapshot.tasks) : [],
    groups: snapshot ? toKanbanGroups(snapshot.statuses) : [],
    dataVersion: snapshot?.revision,
    dataState: query.isPending
      ? { status: "loading" }
      : query.isError && !snapshot
        ? { status: "error", error: query.error, hasData: false }
        : query.isError
          ? { status: "error", error: query.error, hasData: true }
          : { status: "ready", isRefetching: query.isFetching },
    search: {
      mode: "server",
      onQueryChange: setServerSearch,
      isPending: query.isFetching,
      resultCount: snapshot?.tasks.length ?? 0,
    },
    getGroupCardCount: (group, loadedCount) => snapshot?.totalByStatus[group.id] ?? loadedCount,
    onRetryData: () => void query.refetch(),
    onCommand: (command) => mutation.mutateAsync({
      type: "board",
      clientMutationId: command.clientMutationId,
      command,
    }),
    onAddCard: ({ groupId, swimlaneId }) => openCreateTaskForm({
      groupId,
      swimlaneId,
      onSubmit: (task) => mutation.mutate({
        type: "create",
        clientMutationId: crypto.randomUUID(),
        task,
      }),
    }),
    renderCard: (card, state) => <TaskCard task={card.data as Task} pending={state.pending} />,
  }

  return <KanbanProvider config={config}><Kanban className="h-[720px]" /></KanbanProvider>
}
```

Use the same ledger for renderer-owned update forms. A create/update/delete layer contains the complete optimistic domain
change, and `rollback` restores its saved base then reapplies newer layers. This avoids the common race where an older
failed mutation restores a stale snapshot over a newer successful edit.

## Incremental groups and swimlanes

Flatten loaded `useInfiniteQuery` pages into `cards`. Return a controlled page state for every group/lane intersection
and route its load request back to the matching query:

```tsx
getPageState: ({ groupId, swimlaneId }) => {
  const page = pages.get(`${groupId}:${swimlaneId ?? ""}`)
  if (!page?.hasNextPage) return { status: "complete", totalCount: page?.totalCount }
  if (page.isFetchingNextPage) return { status: "loading", hasNextPage: true, totalCount: page.totalCount }
  if (page.error) return { status: "error", hasNextPage: true, error: page.error, totalCount: page.totalCount }
  return { status: "idle", hasNextPage: true, totalCount: page.totalCount }
},
onLoadMore: ({ groupId, swimlaneId, requestId }) =>
  pages.get(`${groupId}:${swimlaneId ?? ""}`)?.fetchNextPage({ cancelRefetch: false, meta: { requestId } }),
```

`requestId` is an idempotency key for duplicate clicks/retries. Use `getGroupCardCount` with server totals whenever pages
are partial; otherwise a hard WIP limit could be undercounted locally. The server must still enforce WIP and permissions
in the same transaction as the rank change and return a structured rejection such as `wip-limit` or `conflict`.

## Revisions, live updates, and rank compaction

- Increment `dataVersion` only for authoritative snapshots. An accepted result may return the first `dataVersion` that
  contains the command; the board will not mistake an earlier optimistic cache projection for confirmation.
- Send `clientMutationId` as the API idempotency key. Repeated requests must return the original result without applying
  the command twice.
- For live updates, merge the snapshot into Query and call the optimistic ledger's `rebase` before writing it while local
  layers remain. Older overlapping responses are superseded by the later local intent.
- Generate ranks transactionally from `beforeId`/`afterId`. When no rank can be inserted safely, compact that placement's
  ranks in the same transaction, return canonical records and revision, and let Query replace temporary ranks.
- Return explicit rejected results for permission, validation, not-found, conflict, and WIP failures. Throw only for
  transport/runtime failures; both paths trigger rollback and the board's rejection callbacks.
