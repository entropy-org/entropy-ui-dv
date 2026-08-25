"use client"

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  CalendarDays,
  Columns3,
  List,
  Plus,
  Search,
  SquareStack,
  X,
} from "lucide-react"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../components/ui/popover.js"
import { cn } from "../lib/utils.js"
import { DatabaseViewsContextProvider } from "./database-views-context.js"
import {
  DatabaseViewsStoreProvider,
  useDatabaseViewsStore,
} from "./database-views-store.js"
import { createDataViewRegistry, renderRegisteredDataView } from "./view-registry.js"
import { createDataViewOperationIdFactory } from "./operations.js"
import { DatabaseViewSettings } from "./database-view-settings.js"
import type {
  DataViewController,
  DataViewCreateRequest,
  DataViewDataSource,
  DataViewFlowState,
  DataViewIntent,
  DataViewPlugin,
  DataViewRendererContext,
  DataViewSchema,
  DataViewSettings,
  SavedDataView,
  SavedDataViewChange,
} from "./types.js"

const BUILT_IN_VIEW_TYPES = ["list", "kanban", "calendar", "timeline"] as const

function ViewIcon({ type }: { readonly type: SavedDataView["definition"]["type"] }) {
  if (type === "kanban") return <Columns3 aria-hidden="true" />
  if (type === "calendar") return <CalendarDays aria-hidden="true" />
  if (type === "timeline") return <SquareStack aria-hidden="true" />
  return <List aria-hidden="true" />
}

export interface DatabaseViewTabsProps
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly views: readonly SavedDataView[]
  readonly activeViewId: string
  readonly onActiveViewIdChange: (viewId: string) => void
  readonly onCreateViewRequest?: (request: DataViewCreateRequest) => void
  readonly plugins?: readonly DataViewPlugin<unknown>[]
}

export const DatabaseViewTabs = React.memo(
  React.forwardRef<HTMLDivElement, DatabaseViewTabsProps>(
    function DatabaseViewTabs(
      {
        views,
        activeViewId,
        onActiveViewIdChange,
        onCreateViewRequest,
        plugins = [],
        className,
        ...props
      },
      ref
    ) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex min-w-0 items-center overflow-x-auto",
            className
          )}
          data-edv-part="view-tabs"
          {...props}
        >
          <div className="contents" role="tablist" aria-label="Data views">
            {views.map((view) => (
              <Button
                key={view.id}
                role="tab"
                aria-selected={view.id === activeViewId}
                variant="ghost"
                size="lg"
                className={cn(
                  "relative h-10 rounded-none px-2.5 text-muted-foreground shadow-none transition-colors duration-150 after:absolute after:right-2.5 after:bottom-0 after:left-2.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 hover:bg-transparent hover:text-foreground",
                  view.id === activeViewId &&
                    "text-foreground after:scale-x-100"
                )}
                onClick={() => onActiveViewIdChange(view.id)}
              >
                <ViewIcon type={view.definition.type} />
                <span className="max-w-36 truncate">{view.name}</span>
              </Button>
            ))}
          </div>
          {onCreateViewRequest ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-0.5"
                    aria-label="Add a view"
                  />
                }
              >
                <Plus />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 gap-2 p-2">
                <PopoverHeader>
                  <PopoverTitle>Add a view</PopoverTitle>
                </PopoverHeader>
                <div className="grid gap-1">
                  {BUILT_IN_VIEW_TYPES.map((type) => (
                    <Button
                      key={type}
                      variant="ghost"
                      className="justify-start capitalize"
                      onClick={() => onCreateViewRequest({ type })}
                    >
                      <ViewIcon type={type} />
                      {type}
                    </Button>
                  ))}
                  {plugins
                    .filter((plugin) => !BUILT_IN_VIEW_TYPES.includes(plugin.id as never))
                    .map((plugin) => (
                      <Button
                        key={plugin.id}
                        variant="ghost"
                        className="justify-start"
                        onClick={() =>
                          onCreateViewRequest({
                            type: "custom",
                            pluginId: plugin.id,
                          })
                        }
                      >
                        {plugin.icon}
                        {plugin.label}
                      </Button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      )
    }
  )
)

interface DatabaseViewsToolbarProps
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly view: SavedDataView
  readonly onSearchChange?: (search: string) => void
  readonly settings?: ReactNode
  readonly createAction?: ReactNode
}

const DatabaseViewsToolbar = React.memo(
  React.forwardRef<HTMLDivElement, DatabaseViewsToolbarProps>(
    function DatabaseViewsToolbar(
      {
        view,
        onSearchChange,
        settings,
        createAction,
        className,
        ...props
      },
      ref
    ) {
      const [searchOpen, setSearchOpen] = useState(Boolean(view.query.search))
      const isSearchOpen = searchOpen || Boolean(view.query.search)
      const inputRef = useRef<HTMLInputElement | null>(null)

      useEffect(() => {
        if (isSearchOpen) inputRef.current?.focus()
      }, [isSearchOpen])

      return (
        <div
          ref={ref}
          className={cn(
            "ml-auto flex min-h-10 shrink-0 items-center justify-end gap-1 px-2",
            className
          )}
          data-edv-part="view-toolbar"
          {...props}
        >
          {onSearchChange ? (
            isSearchOpen ? (
              <div className="relative w-44 animate-in fade-in slide-in-from-right-1 duration-150">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={inputRef}
                  aria-label={`Search ${view.name}`}
                  placeholder="Search…"
                  className="h-8 border-transparent bg-muted/45 pr-8 pl-8 text-xs shadow-none focus-visible:bg-background"
                  value={view.query.search}
                  onChange={(event) =>
                    onSearchChange(event.currentTarget.value)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={`Close search for ${view.name}`}
                  onClick={() => {
                    onSearchChange("")
                    setSearchOpen(false)
                  }}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={`Search ${view.name}`}
                onClick={() => setSearchOpen(true)}
              >
                <Search aria-hidden="true" />
              </Button>
            )
          ) : null}
          {settings}
          {createAction}
        </div>
      )
    }
  )
)

interface DatabaseViewSurfaceProps
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly children: ReactNode
}

const DatabaseViewSurface = React.memo(
  React.forwardRef<HTMLDivElement, DatabaseViewSurfaceProps>(
    function DatabaseViewSurface({ className, children, ...props }, ref) {
      return (
        <div
          ref={ref}
          role="tabpanel"
          className={cn("min-h-0 flex-1 overflow-hidden", className)}
          data-edv-part="view-surface"
          {...props}
        >
          {children}
        </div>
      )
    }
  )
)

export interface DatabaseViewsProps<TRecord>
  extends Omit<
    React.ComponentPropsWithoutRef<"section">,
    "children" | "title"
  > {
  readonly source: DataViewDataSource<TRecord>
  readonly schema: DataViewSchema<TRecord>
  readonly views: readonly SavedDataView[]
  readonly activeViewId: string
  readonly onActiveViewIdChange: (viewId: string) => void
  readonly onViewsChange?: (
    views: readonly SavedDataView[],
    change: SavedDataViewChange
  ) => void
  readonly plugins?: readonly DataViewPlugin<TRecord>[]
  readonly renderView?: (context: DataViewRendererContext<TRecord>) => ReactNode
  readonly renderUnavailableView?: (view: SavedDataView) => ReactNode
  readonly readOnly?: boolean
  readonly title?: ReactNode
  /** User-facing settings shown for the active view, or `false` to hide them. */
  readonly settings?: DataViewSettings
  readonly onIntent?: (intent: DataViewIntent<TRecord>) => void
  readonly onCreateViewRequest?: (request: DataViewCreateRequest) => void
  readonly onDuplicateView?: (view: SavedDataView) => void
  readonly onDeleteView?: (view: SavedDataView) => void
  readonly flow?: DataViewFlowState<TRecord>
  readonly renderForm?: (
    flow: Exclude<DataViewFlowState<TRecord>, { readonly mode: "closed" }>,
    controller: DataViewController<TRecord>
  ) => ReactNode
}

interface DatabaseViewsBodyProps<TRecord> extends DatabaseViewsProps<TRecord> {
  readonly activeView: SavedDataView
  readonly rootRef: React.ForwardedRef<HTMLElement>
}

function DatabaseViewsBody<TRecord>({
  source,
  schema,
  views,
  activeView,
  activeViewId,
  rootRef,
  onActiveViewIdChange,
  onViewsChange,
  plugins,
  renderView,
  renderUnavailableView,
  readOnly = false,
  title,
  settings = {},
  onIntent,
  onCreateViewRequest,
  onDuplicateView,
  onDeleteView,
  flow = { mode: "closed" },
  renderForm,
  className,
  ...props
}: DatabaseViewsBodyProps<TRecord>) {
  const selectedRecordIds = useDatabaseViewsStore(
    (state) => state.selectedRecordIds
  )
  const setSelectedRecordIds = useDatabaseViewsStore(
    (state) => state.actions.setSelectedRecordIds
  )
  const registry = useMemo(
    () => createDataViewRegistry(plugins ?? []),
    [plugins]
  )
  const reactId = useId()
  const operationIds = useMemo(
    () => createDataViewOperationIdFactory(reactId),
    [reactId]
  )
  const emitIntent = useCallback(
    (intent: DataViewIntent<TRecord>) => onIntent?.(intent),
    [onIntent]
  )
  const updateActiveView = useCallback(
    (nextView: SavedDataView, change: SavedDataViewChange) => {
      onViewsChange?.(
        views.map((view) => (view.id === nextView.id ? nextView : view)),
        change
      )
      if (source.mode === "server" && source.onQueryChange && change.type === "query") {
        const reason =
          nextView.query.search !== activeView.query.search
            ? "search"
            : nextView.query.filters !== activeView.query.filters
              ? "filters"
              : nextView.query.sorts !== activeView.query.sorts
                ? "sorts"
                : "grouping"
        void source.onQueryChange({
          requestId: operationIds.next(reason),
          sourceId: source.id,
          viewId: nextView.id,
          query: nextView.query,
          reason,
        })
      }
    },
    [activeView.query, onViewsChange, operationIds, source, views]
  )
  const controller = useMemo<DataViewController<TRecord>>(
    () => ({
      source,
      schema,
      views,
      activeView,
      readOnly,
      activateView: onActiveViewIdChange,
      updateActiveView,
      emitIntent,
    }),
    [
      activeView,
      emitIntent,
      onActiveViewIdChange,
      readOnly,
      schema,
      source,
      updateActiveView,
      views,
    ]
  )
  const rendererContext = useMemo<DataViewRendererContext<TRecord>>(
    () => ({
      source,
      schema,
      view: activeView,
      readOnly,
      selectedRecordIds,
      setSelectedRecordIds,
      emitIntent,
      updateView: updateActiveView,
    }),
    [
      activeView,
      emitIntent,
      readOnly,
      schema,
      selectedRecordIds,
      setSelectedRecordIds,
      source,
      updateActiveView,
    ]
  )
  const renderedView = renderView
    ? renderView(rendererContext)
    : renderRegisteredDataView(registry, rendererContext)

  const search = useCallback(
    (nextSearch: string) =>
      updateActiveView(
        {
          ...activeView,
          query: { ...activeView.query, search: nextSearch },
        },
        { type: "query", viewId: activeView.id }
      ),
    [activeView, updateActiveView]
  )

  return (
    <DatabaseViewsContextProvider value={controller}>
      <section
        ref={rootRef}
        className={cn(
          "edv-root relative isolate flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-xs",
          className
        )}
        data-edv-root=""
        data-edv-part="database-views"
        data-edv-active-view={activeViewId}
        aria-label={typeof title === "string" ? title : source.label ?? "Database views"}
        {...props}
      >
        <div className="flex min-h-10 shrink-0 items-center border-b border-border/60 bg-background/95 backdrop-blur-xl">
          <DatabaseViewTabs
            className="flex-1"
            views={views}
            activeViewId={activeView.id}
            onActiveViewIdChange={onActiveViewIdChange}
            onCreateViewRequest={onCreateViewRequest}
            plugins={plugins as readonly DataViewPlugin<unknown>[] | undefined}
          />
          <DatabaseViewsToolbar
            view={activeView}
            onSearchChange={onViewsChange ? search : undefined}
            settings={
              settings !== false && onViewsChange ? (
                <DatabaseViewSettings
                  view={activeView}
                  properties={schema.properties}
                  settings={settings}
                  onViewChange={(nextView) =>
                    updateActiveView(nextView, {
                      type: "configuration",
                      viewId: nextView.id,
                    })
                  }
                  onDuplicateView={onDuplicateView}
                  onDeleteView={onDeleteView}
                />
              ) : null
            }
            createAction={
              onIntent && !readOnly ? (
                <Button
                  size="lg"
                  className="shadow-none"
                  onClick={() =>
                    emitIntent({ type: "create-record", view: activeView })
                  }
                >
                  <Plus aria-hidden="true" /> New
                </Button>
              ) : null
            }
          />
        </div>
        <DatabaseViewSurface key={activeView.id}>
          {renderedView ??
            renderUnavailableView?.(activeView) ?? (
              <div className="grid h-full min-h-80 place-items-center p-8 text-center text-sm text-muted-foreground">
                No renderer is registered for this view.
              </div>
            )}
        </DatabaseViewSurface>
        {flow.mode !== "closed" && renderForm ? renderForm(flow, controller) : null}
      </section>
    </DatabaseViewsContextProvider>
  )
}

function DatabaseViewsInner<TRecord>(
  props: DatabaseViewsProps<TRecord>,
  ref: React.ForwardedRef<HTMLElement>
) {
  const activeView =
    props.views.find((view) => view.id === props.activeViewId) ?? props.views[0]
  if (!activeView) {
    const { className, title, source, id, style } = props
    return (
      <section
        ref={ref}
        className={cn(
          "edv-root grid min-h-64 place-items-center rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground",
          className
        )}
        data-edv-root=""
        data-edv-part="database-views-empty"
        id={id}
        style={style}
      >
        {title ?? source.label ?? "Add a saved view to get started."}
      </section>
    )
  }
  return (
    <DatabaseViewsStoreProvider>
      <DatabaseViewsBody {...props} activeView={activeView} rootRef={ref} />
    </DatabaseViewsStoreProvider>
  )
}

type DatabaseViewsComponent = <TRecord>(
  props: DatabaseViewsProps<TRecord> & React.RefAttributes<HTMLElement>
) => React.ReactElement | null

export const DatabaseViews = React.memo(
  React.forwardRef(DatabaseViewsInner)
) as DatabaseViewsComponent
