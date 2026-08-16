# TanStack Query integration

`DataList` does not fetch, cache, normalize, or persist records. TanStack Query owns server state; the list receives the
current resolved records and emits operation or mutation intents. Its per-provider Zustand store only contains transient
interaction state.

The example below uses a cursor endpoint. Keep search, filters, and sort in the query key so TanStack Query separates
responses for each view and stale responses cannot replace a newer view.

```tsx
import { useMemo, useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { DataList, DataListProvider } from "@/components/list"
import type {
  DataListConfig,
  DataListEditCommand,
  DataListSelectionDescriptor,
  DataListServerOperationState,
} from "@/components/list"

type Task = { id: string; title: string; status: string }
type TaskPage = {
  records: readonly Task[]
  nextCursor?: string
  matchingCount: number
  totalCount: number
}

async function getTasks(input: DataListServerOperationState & { cursor?: string }) {
  return api.tasks.list(input) as Promise<TaskPage>
}

function TasksList() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<DataListServerOperationState>({
    query: "",
    filters: [],
    sort: [],
  })
  const [selection, setSelection] = useState<DataListSelectionDescriptor>({
    kind: "explicit",
    ids: [],
  })

  const tasksQuery = useInfiniteQuery({
    queryKey: ["tasks", view],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getTasks({ ...view, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const items = useMemo(
    () =>
      (tasksQuery.data?.pages ?? []).flatMap((page) =>
        page.records.map((task) => ({ id: task.id, data: task }))
      ),
    [tasksQuery.data]
  )
  const lastPage = tasksQuery.data?.pages.at(-1)

  const editTask = useMutation({
    mutationFn: (command: DataListEditCommand) => api.tasks.edit(command),
    onMutate: async (command) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", view] })
      const previous = queryClient.getQueryData(["tasks", view])
      queryClient.setQueryData(["tasks", view], (current: typeof tasksQuery.data) =>
        current && command.propertyId === "__title__"
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                records: page.records.map((task) =>
                  task.id === command.itemId
                    ? { ...task, title: String(command.proposedValue) }
                    : task
                ),
              })),
            }
          : current
      )
      return { previous }
    },
    onError: (_error, _command, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tasks", view], context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["tasks", view] }),
  })

  const status: DataListConfig<Task>["status"] = tasksQuery.isPending
    ? { state: "loading", phase: "initial" }
    : tasksQuery.isError && !tasksQuery.data
      ? {
          state: "error",
          phase: "initial",
          error: tasksQuery.error,
          onRetry: () => tasksQuery.refetch().then(() => undefined),
        }
      : tasksQuery.isError
        ? {
            state: "error",
            phase: "refresh",
            error: tasksQuery.error,
            onRetry: () => tasksQuery.refetch().then(() => undefined),
          }
        : tasksQuery.isFetching
          ? { state: "loading", phase: "refresh" }
          : { state: "ready" }

  const config: DataListConfig<Task> = {
    items,
    renderTitle: ({ item }) => item.data.title,
    getItemLabel: (item) => item.data.title,
    titleEditor: { accessor: (task) => task.title },
    status,
    operations: {
      mode: "server",
      search: {
        mode: "controlled",
        query: view.query,
        onQueryChange: (query) => setView((current) => ({ ...current, query })),
      },
      filters: view.filters,
      sort: view.sort,
      matchingCount: lastPage?.matchingCount,
      totalCount: lastPage?.totalCount,
      pending: tasksQuery.isFetching && !tasksQuery.isFetchingNextPage,
      onOperationsChange: ({ query, filters, sort }) =>
        setView({ query, filters, sort }),
      pagination: {
        mode: "infinite",
        hasNextPage: tasksQuery.hasNextPage,
        fetchingNextPage: tasksQuery.isFetchingNextPage,
        autoLoad: true,
        onLoadMore: () => tasksQuery.fetchNextPage().then(() => undefined),
      },
    },
    selection: {
      mode: "multiple",
      value: selection,
      allowAllMatching: true,
      onChange: ({ selection: next }) => setSelection(next),
    },
    onEdit: async (command) => {
      await editTask.mutateAsync(command)
      return { status: "accepted" }
    },
  }

  return (
    <DataListProvider config={config}>
      <DataList aria-label="Tasks" />
    </DataListProvider>
  )
}
```

For offset pagination, use `pagination.mode: "page"` and put `pageIndex`/`pageSize` in the same query key. For a server
that canonicalizes values, update the Query cache with the returned record before resolving the mutation handler, or keep
the intent pending with `{ status: "await-authoritative" }` and pass a matching `mutationSettlements` entry when the
canonical result is known.

Do not copy query pages into Zustand. Do not run server sort/filter/search through client mode. Preserve stable record IDs
across pages, refetches, optimistic updates, and rollbacks.
