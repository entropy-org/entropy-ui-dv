import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import {
  KANBAN_DEFAULT_OVERSCAN,
  KANBAN_GROUP_VIRTUALIZATION_THRESHOLD,
  KANBAN_POINTER_ACTIVATION_DISTANCE,
} from "../constants.js"
import { KanbanControls } from "./kanban-controls.js"
import { KanbanDataStatus } from "./kanban-data-status.js"
import { KanbanEmptyState } from "./kanban-empty-state.js"
import { KanbanGroupHeader } from "./kanban-group-header.js"
import { KanbanIntersection } from "./kanban-intersection.js"
import { KanbanLoading } from "./kanban-loading.js"
import { KanbanPagination } from "./kanban-pagination.js"
import { KanbanRenderErrorBoundary } from "./kanban-render-error-boundary.js"
import { KanbanSwimlaneHeader } from "./kanban-swimlane-header.js"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanCommandActions } from "../hooks/use-kanban-command-actions.js"
import { useKanbanKeyboard } from "../hooks/use-kanban-keyboard.js"
import { useKanbanModel } from "../hooks/use-kanban-model.js"
import { useKanbanPreferencesChange } from "../hooks/use-kanban-preferences.js"
import { useKanbanStore } from "../hooks/use-kanban-store.js"
import { useShiftWheel } from "../../../hooks/use-shift-wheel.js"
import {
  selectKanbanActions,
  selectKanbanAnnouncement,
  selectKanbanFocusedCardId,
  selectKanbanInteraction,
  selectKanbanPending,
  selectKanbanSelection,
} from "../store/selectors.js"
import type {
  KanbanCard,
  KanbanCardRenderState,
  KanbanProps,
} from "../types.js"
import { createKanbanMutationId } from "../utils/commands.js"
import { evaluateMoveWip } from "../utils/wip.js"
import { cn } from "../../../lib/utils.js"
import { resolveDataViewHeader } from "../../../shared/chrome.js"

const EMPTY_KANBAN_SELECTION: ReadonlySet<string> = new Set()

function setForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) ref.current = value
}

function KanbanCallbackFailure({ error }: { readonly error: Error }): never {
  throw error
}

function KanbanFatalDataError({
  error,
  retry,
  render,
}: {
  readonly error: unknown
  readonly retry?: () => void
  readonly render?: (
    error: unknown,
    retry: (() => void) | undefined
  ) => React.ReactNode
}) {
  if (render) return render(error, retry)
  return (
    <div
      role="alert"
      className="flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <p className="text-sm font-medium">Kanban data could not be loaded</p>
      <p className="max-w-md text-xs text-muted-foreground">
        The board has no usable data to display.
      </p>
      {retry ? (
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={retry}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

function KanbanLoadingContent({
  render,
}: {
  readonly render?: () => React.ReactNode
}) {
  return render ? render() : <KanbanLoading />
}

function KanbanEmptyContent({
  render,
}: {
  readonly render?: () => React.ReactNode
}) {
  return render ? render() : <KanbanEmptyState type="board" />
}

function KanbanSearchEmptyContent({
  query,
  clear,
  render,
}: {
  readonly query: string
  readonly clear: () => void
  readonly render?: (query: string, clear: () => void) => React.ReactNode
}) {
  return render ? (
    render(query, clear)
  ) : (
    <KanbanEmptyState type="search" onClear={clear} />
  )
}

function KanbanOverlayContent({
  cards,
  state,
  renderCard,
  renderOverlay,
}: {
  readonly cards: readonly KanbanCard[]
  readonly state: KanbanCardRenderState
  readonly renderCard: ReturnType<typeof useKanbanConfig>["renderCard"]
  readonly renderOverlay?: ReturnType<
    typeof useKanbanConfig
  >["renderDragOverlay"]
}) {
  if (cards.length === 0) return null
  return (
    <div className="w-72 rounded-lg border bg-card p-3 shadow-xl">
      {renderOverlay?.(cards) ?? (
        <>
          <div className="opacity-90">{renderCard(cards[0]!, state)}</div>
          {cards.length > 1 ? (
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              +{cards.length - 1} more
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function resolveLabel<T>(
  getLabel: ((value: T) => string) | undefined,
  value: T,
  fallback: string
) {
  try {
    return { status: "value" as const, value: getLabel?.(value) ?? fallback }
  } catch (cause) {
    return {
      status: "error" as const,
      error:
        cause instanceof Error
          ? cause
          : new Error("A Kanban label callback failed.", { cause }),
    }
  }
}

export const Kanban = React.memo(
  React.forwardRef<HTMLDivElement, KanbanProps>(function Kanban(
    {
      className,
      onKeyDown,
      role = "region",
      "aria-label": ariaLabel = "Kanban board",
      "aria-describedby": describedBy,
      showHeader = true,
      chrome,
      ...props
    },
    forwardedRef
  ) {
    const config = useKanbanConfig()
    const shouldShowHeader = resolveDataViewHeader(chrome, showHeader)
    const model = useKanbanModel()
    const commands = useKanbanCommandActions()
    const changePreferences = useKanbanPreferencesChange()
    const actions = useKanbanStore(selectKanbanActions)
    const selectedIds = useKanbanStore(selectKanbanSelection)
    const selectionEnabled = config.selection?.mode !== "none"
    const renderedSelectedIds = selectionEnabled
      ? selectedIds
      : EMPTY_KANBAN_SELECTION
    const focusedCardId = useKanbanStore(selectKanbanFocusedCardId)
    const interaction = useKanbanStore(selectKanbanInteraction)
    const pending = useKanbanStore(selectKanbanPending)
    const announcement = useKanbanStore(selectKanbanAnnouncement)
    const pendingFocus = useKanbanStore((state) => state.viewport.pendingFocus)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const boardRef = useRef<HTMLDivElement | null>(null)
    const instructionsId = useId()
    const width = model.preferences.columnWidth
    const configuredOverscan = config.overscan ?? KANBAN_DEFAULT_OVERSCAN
    const keyboard = useKanbanKeyboard(rootRef, model.display)

    useShiftWheel(rootRef, (delta) => {
      const board = boardRef.current
      if (!board) return

      const maximumScrollLeft = Math.max(
        0,
        board.scrollWidth - board.clientWidth
      )
      const nextScrollLeft = Math.min(
        maximumScrollLeft,
        Math.max(0, board.scrollLeft + delta)
      )
      if (nextScrollLeft !== board.scrollLeft) {
        board.scrollLeft = nextScrollLeft
        return
      }

      const pagination = config.pagination
      if (!pagination || pagination.pending) return
      const hasPrevious = pagination.hasPreviousPage ?? pagination.pageIndex > 0
      const hasNext =
        pagination.hasNextPage ??
        pagination.pageIndex + 1 < pagination.pageCount
      if (delta < 0 && hasPrevious) {
        pagination.onPageChange(pagination.pageIndex - 1)
      } else if (delta > 0 && hasNext) {
        pagination.onPageChange(pagination.pageIndex + 1)
      }
    })
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: KANBAN_POINTER_ACTIVATION_DISTANCE },
      })
    )
    const draggingIds = useMemo(
      () =>
        new Set(interaction.type === "card-drag" ? interaction.cardIds : []),
      [interaction]
    )
    const pendingIds = useMemo(
      () => new Set(pending.flatMap(({ affectedCardIds }) => affectedCardIds)),
      [pending]
    )
    const dataState =
      config.dataState ??
      (config.loading
        ? { status: "loading" as const }
        : { status: "ready" as const })
    const pinnedGroupIndexes = useMemo(() => {
      const indexes = new Set<number>()
      if (focusedCardId) {
        const card = model.normalized.cardsById.get(focusedCardId)
        const index = card
          ? model.normalized.orderedGroupIds.indexOf(card.groupId)
          : -1
        if (index >= 0) indexes.add(index)
      }
      if (interaction.type === "card-drag") {
        const source = model.normalized.orderedGroupIds.indexOf(
          interaction.sourceGroupId
        )
        const destination = model.normalized.orderedGroupIds.indexOf(
          interaction.destinationGroupId
        )
        if (source >= 0) indexes.add(source)
        if (destination >= 0) indexes.add(destination)
      } else if (interaction.type === "group-drag") {
        const index = model.normalized.orderedGroupIds.indexOf(
          interaction.groupId
        )
        if (index >= 0) indexes.add(index)
      }
      return indexes
    }, [
      focusedCardId,
      interaction,
      model.normalized.cardsById,
      model.normalized.orderedGroupIds,
    ])
    const virtualizeGroups =
      model.display.groups.length >= KANBAN_GROUP_VIRTUALIZATION_THRESHOLD
    // TanStack Virtual is intentionally kept outside compiler memoization; its imperative methods read live measurements.
    // eslint-disable-next-line react-hooks/incompatible-library
    const groupVirtualizer = useVirtualizer({
      count: virtualizeGroups ? model.display.groups.length : 0,
      horizontal: true,
      getScrollElement: () => boardRef.current,
      estimateSize: () => width,
      overscan: Math.max(2, Math.ceil(configuredOverscan / 2)),
      rangeExtractor: (range) =>
        [
          ...new Set([...defaultRangeExtractor(range), ...pinnedGroupIndexes]),
        ].toSorted((left, right) => left - right),
    })
    const virtualGroups = groupVirtualizer.getVirtualItems()
    const renderedGroups = virtualizeGroups
      ? virtualGroups.length > 0
        ? virtualGroups.map((item) => ({
            index: item.index,
            start: item.start,
            end: item.end,
          }))
        : model.display.groups
            .slice(0, configuredOverscan + 1)
            .map((_, index) => ({
              index,
              start: index * width,
              end: (index + 1) * width,
            }))
      : model.display.groups.map((_, index) => ({
          index,
          start: index * width,
          end: (index + 1) * width,
        }))
    const groupsTotalWidth = virtualizeGroups
      ? groupVirtualizer.getTotalSize()
      : model.display.groups.length * width
    const beforeGroups = renderedGroups[0]?.start ?? 0
    const afterGroups = Math.max(
      0,
      groupsTotalWidth - (renderedGroups.at(-1)?.end ?? 0)
    )

    useEffect(() => {
      const root = rootRef.current
      if (!root) return
      const observer = new ResizeObserver(([entry]) =>
        actions.setViewportDimensions(
          entry.contentRect.width,
          entry.contentRect.height
        )
      )
      observer.observe(root)
      return () => observer.disconnect()
    }, [actions])

    useEffect(() => {
      if (!selectionEnabled && selectedIds.size > 0) actions.clearSelection()
    }, [actions, selectedIds, selectionEnabled])

    useLayoutEffect(() => {
      if (!pendingFocus) return
      const attribute =
        pendingFocus.type === "card" ? "kanbanCard" : "kanbanGroup"
      const selector =
        pendingFocus.type === "card"
          ? "[data-kanban-card]"
          : "[data-kanban-group]"
      const element = [
        ...(rootRef.current?.querySelectorAll<HTMLElement>(selector) ?? []),
      ].find((candidate) => candidate.dataset[attribute] === pendingFocus.id)
      if (element) {
        element.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        })
        element.focus({ preventScroll: true })
        actions.requestFocus(null)
      }
    }, [actions, model.display.visibleCardIds, pendingFocus])

    const focusResult = useCallback(
      (direction: -1 | 1) => {
        const visible = model.display.visibleCardIds
        if (visible.length === 0) return
        const current = focusedCardId ? visible.indexOf(focusedCardId) : -1
        const next =
          current < 0
            ? direction > 0
              ? 0
              : visible.length - 1
            : (current + direction + visible.length) % visible.length
        const id = visible[next]!
        actions.setFocusedCardId(id)
        actions.requestFocus({ type: "card", id })
        actions.announce(`Search result ${next + 1} of ${visible.length}.`)
      },
      [actions, focusedCardId, model.display.visibleCardIds]
    )

    const handleDragStart = useCallback(
      (event: DragStartEvent) => {
        const data = event.active.data.current
        if (data?.type === "group") {
          actions.setInteraction({
            type: "group-drag",
            input: "pointer",
            groupId: String(data.groupId),
            destinationIndex: Number(data.index),
          })
          actions.announce(`Picked up group ${String(data.groupId)}.`)
          return
        }
        if (data?.type !== "card") return
        const cardId = String(data.cardId)
        const card = model.normalized.cardsById.get(cardId)
        if (!card) return
        const cardIds =
          selectionEnabled && selectedIds.has(cardId)
            ? model.display.visibleCardIds.filter((id) => selectedIds.has(id))
            : [cardId]
        if (selectionEnabled && !selectedIds.has(cardId))
          actions.select(cardId, "replace")
        actions.setInteraction({
          type: "card-drag",
          input: "pointer",
          cardIds,
          sourceGroupId: card.groupId,
          ...(card.swimlaneId === undefined
            ? {}
            : { sourceSwimlaneId: card.swimlaneId }),
          destinationGroupId: card.groupId,
          ...(card.swimlaneId === undefined
            ? {}
            : { destinationSwimlaneId: card.swimlaneId }),
          destinationIndex: Number(data.index),
          blockedReason: null,
        })
        actions.announce(
          `${cardIds.length} card${cardIds.length === 1 ? "" : "s"} picked up.`
        )
      },
      [
        actions,
        model.display.visibleCardIds,
        model.normalized.cardsById,
        selectionEnabled,
        selectedIds,
      ]
    )

    const handleDragOver = useCallback(
      (event: DragOverEvent) => {
        const state = interaction.type === "card-drag" ? interaction : null
        if (!state || !event.over) return
        const data = event.over.data.current
        let groupId: string | undefined
        let swimlaneId: string | undefined
        let destinationIndex = 0
        if (data?.type === "card") {
          const overCard = model.normalized.cardsById.get(String(data.cardId))
          if (!overCard) return
          groupId = overCard.groupId
          swimlaneId = overCard.swimlaneId
          destinationIndex = Number(data.index)
          const activeTop = event.active.rect.current.translated?.top
          if (
            activeTop !== undefined &&
            activeTop > event.over.rect.top + event.over.rect.height / 2
          )
            destinationIndex += 1
        } else if (data?.type === "intersection") {
          groupId = String(data.groupId)
          swimlaneId =
            data.swimlaneId === undefined ? undefined : String(data.swimlaneId)
          destinationIndex = Number(data.index)
        }
        if (!groupId) return
        const group = model.normalized.groupsById.get(groupId)
        if (!group) return
        const wip = evaluateMoveWip(
          model.normalized.acceptedCards,
          group,
          new Set(state.cardIds),
          model.groupCardCounts.get(group.id)
        )
        const blockedReason =
          wip.status === "hard-blocked"
            ? `${config.getGroupLabel?.(group) ?? group.id} has a hard WIP limit of ${wip.maximum}.`
            : null
        actions.setInteraction({
          ...state,
          destinationGroupId: groupId,
          ...(swimlaneId === undefined
            ? { destinationSwimlaneId: undefined }
            : { destinationSwimlaneId: swimlaneId }),
          destinationIndex,
          blockedReason,
        })
      },
      [actions, config, interaction, model.groupCardCounts, model.normalized]
    )

    const finishDrag = useCallback(
      (event: DragEndEvent | DragCancelEvent) => {
        const state = interaction
        if ("over" in event && event.over && state.type === "group-drag") {
          const data = event.over.data.current
          const index =
            data?.type === "group" ? Number(data.index) : state.destinationIndex
          commands.reorderGroup(state.groupId, index)
        } else if (
          "over" in event &&
          event.over &&
          state.type === "card-drag"
        ) {
          if (state.blockedReason) actions.announce(state.blockedReason)
          else if (
            commands.moveCards(
              state.cardIds,
              state.destinationGroupId,
              state.destinationSwimlaneId,
              state.destinationIndex
            )
          )
            actions.announce(
              `${state.cardIds.length} card${state.cardIds.length === 1 ? "" : "s"} moved.`
            )
        } else if (state.type !== "idle") actions.announce("Move cancelled.")
        actions.setInteraction({ type: "idle" })
      },
      [actions, commands, interaction]
    )

    const cardLabel = useCallback(
      (card: Parameters<NonNullable<typeof config.getCardLabel>>[0]) =>
        config.getCardLabel?.(card) ?? card.id,
      [config]
    )
    const openCard = useCallback(
      (card: Parameters<typeof cardLabel>[0]) => {
        if (config.onCardDoubleClick) config.onCardDoubleClick(card)
        else config.onCardOpen?.(card)
      },
      [config]
    )
    const activateCard = useCallback(
      (
        card: Parameters<typeof cardLabel>[0],
        event: React.MouseEvent<HTMLElement>
      ) => {
        if (selectionEnabled) {
          actions.select(
            card.id,
            event.shiftKey
              ? "range"
              : event.ctrlKey || event.metaKey
                ? "toggle"
                : "replace",
            model.display.visibleCardIds
          )
        }
        actions.setFocusedCardId(card.id)
        config.onCardClick?.(card)
      },
      [actions, config, model.display.visibleCardIds, selectionEnabled]
    )

    const renderIntersection = (groupId: string, swimlaneId?: string) => {
      const groupModel = model.display.groups.find(({ id }) => id === groupId)!
      const item = groupModel.intersections.find(
        (intersection) => intersection.swimlaneId === swimlaneId
      )!
      const cards = item.cardIds
        .map((id) => model.normalized.cardsById.get(id))
        .filter((card) => card !== undefined)
      const context = {
        groupId,
        ...(swimlaneId === undefined ? {} : { swimlaneId }),
      }
      return (
        <KanbanIntersection
          key={item.key}
          groupId={groupId}
          {...(swimlaneId === undefined ? {} : { swimlaneId })}
          cards={cards}
          density={model.preferences.density}
          overscan={configuredOverscan}
          collapsed={groupModel.collapsed}
          readOnly={Boolean(config.readOnly || !config.onCommand)}
          selectedIds={renderedSelectedIds}
          focusedCardId={focusedCardId}
          draggingIds={draggingIds}
          pendingIds={pendingIds}
          wipWarning={
            groupModel.wip.status === "warning" ||
            groupModel.wip.status === "hard-blocked"
          }
          getLabel={cardLabel}
          renderCard={config.renderCard}
          onActivate={activateCard}
          onOpen={openCard}
          onAdd={
            !config.readOnly && config.onAddCard
              ? () =>
                  config.onAddCard?.({
                    groupId,
                    ...(swimlaneId === undefined ? {} : { swimlaneId }),
                    source: "pointer",
                  })
              : undefined
          }
          getPageState={
            config.getPageState
              ? () => config.getPageState!(context)
              : undefined
          }
          onLoadMore={
            config.onLoadMore
              ? () =>
                  config.onLoadMore!({
                    ...context,
                    requestId: createKanbanMutationId(),
                  })
              : undefined
          }
          renderPageError={
            config.renderPageError
              ? (error, retry) => config.renderPageError!(context, error, retry)
              : undefined
          }
        />
      )
    }

    const renderHeader = (groupId: string, index: number) => {
      const group = model.normalized.groupsById.get(groupId)!
      const groupModel = model.display.groups[index]!
      const state = {
        collapsed: groupModel.collapsed,
        cardCount: groupModel.cardCount,
        visibleCardCount: groupModel.visibleCardCount,
        wip: groupModel.wip,
        readOnly: Boolean(config.readOnly || !config.onCommand),
      }
      const label = resolveLabel(config.getGroupLabel, group, group.id)
      if (label.status === "error")
        return <KanbanCallbackFailure key={groupId} error={label.error} />
      return (
        <KanbanGroupHeader
          key={groupId}
          group={group}
          index={index}
          state={state}
          label={label.value}
          render={config.renderGroupHeader}
          showWipLimits={model.preferences.showWipLimits}
          onToggle={() =>
            changePreferences({
              type: "group-collapsed",
              groupId,
              collapsed: !groupModel.collapsed,
            })
          }
          onAdd={
            !config.readOnly && config.onAddCard
              ? () => config.onAddCard?.({ groupId, source: "pointer" })
              : undefined
          }
        />
      )
    }

    const gridMinWidth = Math.max(groupsTotalWidth, width)
    const resetKey = `${model.normalized.acceptedCards.length}:${model.normalized.acceptedGroups.length}:${model.query}`
    const overlayCards =
      interaction.type === "card-drag"
        ? interaction.cardIds
            .map((id) => model.normalized.cardsById.get(id))
            .filter((card) => card !== undefined)
        : []
    const overlayState: KanbanCardRenderState = {
      selected: true,
      focused: false,
      dragging: true,
      previewing: true,
      pending: false,
      readOnly: Boolean(config.readOnly),
      wipWarning: false,
    }
    const renderGroupWindow = (
      render: (groupId: string, index: number) => React.ReactNode
    ) => (
      <div
        className="flex min-h-full items-stretch bg-border"
        style={{ minWidth: gridMinWidth }}
      >
        {beforeGroups > 0 ? (
          <div
            aria-hidden="true"
            className="shrink-0"
            style={{ width: beforeGroups }}
          />
        ) : null}
        {renderedGroups.map(({ index }) => {
          const group = model.display.groups[index]
          return group ? (
            <div
              key={group.id}
              className="min-w-0 shrink-0 bg-background"
              style={{ width }}
            >
              {render(group.id, index)}
            </div>
          ) : null
        })}
        {afterGroups > 0 ? (
          <div
            aria-hidden="true"
            className="shrink-0"
            style={{ width: afterGroups }}
          />
        ) : null}
      </div>
    )

    return (
      <div
        ref={(element) => {
          rootRef.current = element
          setForwardedRef(forwardedRef, element)
        }}
        role={role}
        aria-label={ariaLabel}
        aria-describedby={[describedBy, instructionsId]
          .filter(Boolean)
          .join(" ")}
        tabIndex={model.display.visibleCardIds.length === 0 ? 0 : -1}
        data-testid="kanban"
        data-edv-root=""
        data-edv-part="kanban"
        data-edv-chrome={chrome?.mode ?? "standalone"}
        className={cn(
          "edv-root relative isolate flex h-full min-h-[520px] min-w-0 flex-col overflow-hidden bg-background text-foreground outline-none forced-colors:border forced-colors:border-[CanvasText]",
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented) keyboard(event)
        }}
        {...props}
      >
        <span id={instructionsId} className="sr-only">
          Use arrow keys to navigate cards. Press Space to pick up a card,
          arrows to choose a destination, Space to drop, or Escape to cancel.
          Control or Command with A selects visible cards.
        </span>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          <span key={announcement.sequence}>{announcement.message}</span>
        </span>
        <KanbanRenderErrorBoundary
          resetKey={resetKey}
          onError={config.onRenderError}
          renderFallback={config.renderErrorState}
        >
          {model.callbackError ? (
            <KanbanCallbackFailure error={model.callbackError} />
          ) : null}
          {shouldShowHeader ? (
            <KanbanControls
              itemCount={model.normalized.acceptedCards.length}
              resultCount={model.display.resultCount}
              visibleOrder={model.display.visibleCardIds}
              onPreviousResult={() => focusResult(-1)}
              onNextResult={() => focusResult(1)}
            />
          ) : null}
          {dataState.status !== "loading" &&
          !(dataState.status === "error" && !dataState.hasData) ? (
            <KanbanDataStatus state={dataState} onRetry={config.onRetryData} />
          ) : null}
          {dataState.status === "loading" ? (
            <KanbanLoadingContent render={config.renderLoading} />
          ) : dataState.status === "error" && !dataState.hasData ? (
            <KanbanFatalDataError
              error={dataState.error}
              retry={config.onRetryData}
              render={config.renderDataError}
            />
          ) : model.normalized.acceptedGroups.length === 0 ? (
            <KanbanEmptyContent render={config.renderEmptyState} />
          ) : model.display.resultCount === 0 &&
            (model.query || config.filterCard) ? (
            <KanbanSearchEmptyContent
              query={model.query}
              clear={() => actions.setSearchQuery("")}
              render={config.renderSearchEmptyState}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll={{ threshold: { x: 0.12, y: 0.12 }, acceleration: 12 }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={finishDrag}
              onDragCancel={finishDrag}
            >
              <div
                ref={boardRef}
                className="flex-1 overflow-auto"
                data-kanban-part="board"
                onScroll={(event) =>
                  actions.setBoardScrollLeft(event.currentTarget.scrollLeft)
                }
                onClick={(event) => {
                  if (selectionEnabled && event.target === event.currentTarget)
                    actions.clearSelection()
                }}
              >
                <div className="min-h-full" style={{ minWidth: gridMinWidth }}>
                  <SortableContext
                    items={model.display.groups.map(({ id }) => `group:${id}`)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {model.display.lanes.length === 0 ? (
                      renderGroupWindow((groupId, index) => (
                        <div className="flex h-full flex-col">
                          {renderHeader(groupId, index)}
                          {renderIntersection(groupId)}
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="sticky top-0 z-20">
                          {renderGroupWindow(renderHeader)}
                        </div>
                        {model.display.lanes.map((laneModel) => {
                          const lane = model.normalized.swimlanesById.get(
                            laneModel.id
                          )!
                          const state = {
                            ...laneModel,
                            readOnly: Boolean(config.readOnly),
                          }
                          const label = resolveLabel(
                            config.getSwimlaneLabel,
                            lane,
                            lane.id
                          )
                          if (label.status === "error")
                            return (
                              <KanbanCallbackFailure
                                key={lane.id}
                                error={label.error}
                              />
                            )
                          return (
                            <section key={lane.id} aria-label={label.value}>
                              <KanbanSwimlaneHeader
                                lane={lane}
                                state={state}
                                label={label.value}
                                render={config.renderSwimlaneHeader}
                                onToggle={() =>
                                  changePreferences({
                                    type: "swimlane-collapsed",
                                    swimlaneId: lane.id,
                                    collapsed: !laneModel.collapsed,
                                  })
                                }
                              />
                              {!laneModel.collapsed
                                ? renderGroupWindow((groupId) =>
                                    renderIntersection(groupId, lane.id)
                                  )
                                : null}
                            </section>
                          )
                        })}
                      </>
                    )}
                  </SortableContext>
                </div>
              </div>
              <DragOverlay dropAnimation={null}>
                <KanbanOverlayContent
                  cards={overlayCards}
                  state={overlayState}
                  renderCard={config.renderCard}
                  renderOverlay={config.renderDragOverlay}
                />
              </DragOverlay>
            </DndContext>
          )}
          {config.pagination ? (
            <KanbanPagination pagination={config.pagination} />
          ) : null}
        </KanbanRenderErrorBoundary>
      </div>
    )
  })
)
