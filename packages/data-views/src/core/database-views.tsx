"use client"

import React, { useCallback, useId, useMemo, type ReactNode } from "react"
import {
  CalendarDays,
  Columns3,
  Ellipsis,
  Filter,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  SortAsc,
  SquareStack,
  Trash2,
  Copy,
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
import type { DataViewChrome } from "../shared/chrome.js"
import type {
  DataViewController,
  DataViewCreateRequest,
  DataViewDataSource,
  DataViewFlowState,
  DataViewIntent,
  DataViewPlugin,
  DataViewRendererContext,
  DataViewSchema,
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

export interface DatabaseViewsHeaderProps
  extends Omit<React.ComponentPropsWithoutRef<"header">, "title"> {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly actions?: ReactNode
}

export const DatabaseViewsHeader = React.memo(
  React.forwardRef<HTMLElement, DatabaseViewsHeaderProps>(
    function DatabaseViewsHeader(
      { title, description, actions, className, ...props },
      ref
    ) {
      return (
        <header
          ref={ref}
          className={cn(
            "flex min-h-12 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background px-3 py-2",
            className
          )}
          data-edv-part="database-header"
          {...props}
        >
          <div className="min-w-0">
            <h2 className="truncate font-heading text-sm font-semibold">{title}</h2>
            {description ? (
              <div className="truncate text-xs text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )
    }
  )
)

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
            "flex min-w-0 items-center gap-0.5 overflow-x-auto px-2",
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
                variant={view.id === activeViewId ? "secondary" : "ghost"}
                className="gap-1.5"
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

export interface DatabaseViewsToolbarProps
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly view: SavedDataView
  readonly canEditView: boolean
  readonly onSearchChange?: (search: string) => void
  readonly onConfigureView?: (view: SavedDataView) => void
  readonly onDuplicateView?: (view: SavedDataView) => void
  readonly onDeleteView?: (view: SavedDataView) => void
  readonly viewActions?: ReactNode
}

export const DatabaseViewsToolbar = React.memo(
  React.forwardRef<HTMLDivElement, DatabaseViewsToolbarProps>(
    function DatabaseViewsToolbar(
      {
        view,
        canEditView,
        onSearchChange,
        onConfigureView,
        onDuplicateView,
        onDeleteView,
        viewActions,
        className,
        ...props
      },
      ref
    ) {
      const menu = useDatabaseViewsStore((state) => state.menu)
      const setMenu = useDatabaseViewsStore((state) => state.actions.setMenu)
      const menuOpen = menu.type === "view-actions" && menu.viewId === view.id
      return (
        <div
          ref={ref}
          className={cn(
            "flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-border/50 px-2 py-1.5",
            className
          )}
          data-edv-part="view-toolbar"
          {...props}
        >
          <div className="relative min-w-36 max-w-sm flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={`Search ${view.name}`}
              className="pl-7"
              value={view.query.search}
              readOnly={!onSearchChange}
              onChange={(event) => onSearchChange?.(event.currentTarget.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {view.query.filters.length > 0 ? (
              <Button variant="secondary" onClick={() => onConfigureView?.(view)}>
                <Filter />
                {view.query.filters.length}
              </Button>
            ) : null}
            {view.query.sorts.length > 0 ? (
              <Button variant="secondary" onClick={() => onConfigureView?.(view)}>
                <SortAsc />
                {view.query.sorts.length}
              </Button>
            ) : null}
            {viewActions}
            {onConfigureView ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Configure ${view.name}`}
                onClick={() => onConfigureView(view)}
              >
                <SlidersHorizontal />
              </Button>
            ) : null}
            {canEditView && (onDuplicateView || onDeleteView) ? (
              <Popover
                open={menuOpen}
                onOpenChange={(open) =>
                  setMenu(
                    open
                      ? { type: "view-actions", viewId: view.id }
                      : { type: "closed" }
                  )
                }
              >
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`More actions for ${view.name}`}
                    />
                  }
                >
                  <Ellipsis />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 gap-1 p-1">
                  {onDuplicateView ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => onDuplicateView(view)}
                    >
                      <Copy /> Duplicate view
                    </Button>
                  ) : null}
                  {onDeleteView ? (
                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      onClick={() => onDeleteView(view)}
                    >
                      <Trash2 /> Delete view
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      )
    }
  )
)

export interface DatabaseViewSurfaceProps
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly children: ReactNode
}

export const DatabaseViewSurface = React.memo(
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
  /** Hides the database title header when a host section already owns it. */
  readonly chrome?: DataViewChrome
  readonly description?: ReactNode
  readonly headerActions?: ReactNode
  readonly renderViewActions?: (
    view: SavedDataView,
    controller: DataViewController<TRecord>
  ) => ReactNode
  readonly onIntent?: (intent: DataViewIntent<TRecord>) => void
  readonly onCreateViewRequest?: (request: DataViewCreateRequest) => void
  readonly onConfigureView?: (view: SavedDataView) => void
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
  chrome = { mode: "standalone" },
  description,
  headerActions,
  renderViewActions,
  onIntent,
  onCreateViewRequest,
  onConfigureView,
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
        data-edv-chrome={chrome.mode}
        aria-label={typeof title === "string" ? title : source.label ?? "Database views"}
        {...props}
      >
        {chrome.mode === "standalone" ? (
          <DatabaseViewsHeader
            title={title ?? source.label ?? "Database"}
            description={description}
            actions={
              <>
                {headerActions}
                {onIntent && !readOnly ? (
                  <Button
                    onClick={() => emitIntent({ type: "create-record", view: activeView })}
                  >
                    <Plus /> New
                  </Button>
                ) : null}
              </>
            }
          />
        ) : null}
        <div className="shrink-0 bg-background/95 backdrop-blur-xl">
          <DatabaseViewTabs
            views={views}
            activeViewId={activeView.id}
            onActiveViewIdChange={onActiveViewIdChange}
            onCreateViewRequest={onCreateViewRequest}
            plugins={plugins as readonly DataViewPlugin<unknown>[] | undefined}
          />
          <DatabaseViewsToolbar
            view={activeView}
            canEditView={Boolean(onViewsChange)}
            onSearchChange={onViewsChange ? search : undefined}
            onConfigureView={onConfigureView}
            onDuplicateView={onDuplicateView}
            onDeleteView={onDeleteView}
            viewActions={
              <>
                {renderViewActions?.(activeView, controller)}
                {chrome.mode === "embedded" ? headerActions : null}
                {chrome.mode === "embedded" && onIntent && !readOnly ? (
                  <Button
                    onClick={() =>
                      emitIntent({ type: "create-record", view: activeView })
                    }
                  >
                    <Plus /> New
                  </Button>
                ) : null}
              </>
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
