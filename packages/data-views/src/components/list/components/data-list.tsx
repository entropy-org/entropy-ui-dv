import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Rows3 } from "lucide-react"
import { Button } from "../../ui/button.js"
import {
  DATA_LIST_DEFAULT_OVERSCAN,
  DATA_LIST_DEFAULT_VIRTUALIZATION_THRESHOLD,
  DATA_LIST_DENSITIES,
  DATA_LIST_GROUP_HEIGHT,
  DATA_LIST_ROW_HEIGHT,
} from "../constants.js"
import { DataListControls } from "./data-list-controls.js"
import { DataListGroupHeader } from "./data-list-group-header.js"
import { DataListPagination } from "./data-list-pagination.js"
import {
  DataListRenderBoundary,
  DataListRenderSlot,
} from "./data-list-render-boundary.js"
import { DataListRow } from "./data-list-row.js"
import { DataListStateSurface } from "./data-list-state-surface.js"
import { useShiftWheel } from "../../../hooks/use-shift-wheel.js"
import { useDataListConfig } from "../context/data-list-config-context.js"
import { useDataListModel } from "../hooks/use-data-list-model.js"
import {
  useDataListStore,
  useDataListStoreApi,
} from "../hooks/use-data-list-store.js"
import {
  selectAnnouncement,
  selectAnnouncementSequence,
  selectCollapsedGroups,
  selectCollapsedItems,
  selectDrag,
  selectEdit,
  selectFocusedId,
  selectListActions,
  selectPendingCommands,
  selectSearchQuery,
  selectSelection,
  selectViewportWidth,
} from "../store/selectors.js"
import { toPublicSelection } from "../store/create-store.js"
import type { DataListInternalSelection } from "../store/types.js"
import type {
  DataListCommand,
  DataListConfig,
  DataListAnyProperty,
  DataListDisplayEntry,
  DataListEditCommand,
  DataListMutationHandler,
  DataListMutationResult,
  DataListServerOperationState,
  DataListSelectionChange,
} from "../types.js"
import {
  isManualReorderEnabled,
  resolveReorderCommand,
} from "../utils/reorder.js"
import {
  getSelectedCount,
  isItemSelected,
  rangeSelection,
  replaceSelection,
  toggleSelection,
} from "../utils/selection.js"
import { cn } from "../../../lib/utils.js"
import type { DataViewChrome } from "../../../shared/chrome.js"
import { resolveDataViewHeader } from "../../../shared/chrome.js"

export type DataListProps = React.ComponentPropsWithoutRef<"div"> & {
  readonly chrome?: DataViewChrome
  /** @deprecated Use `chrome={{ mode: "embedded" }}`. */
  readonly showHeader?: boolean
  readonly showColumnHeaders?: boolean
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable='true'], [role='textbox']"
      )
    )
  )
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  )
}

function getSemanticRoles<TData>(config: DataListConfig<TData>) {
  const selectedMode = config.semanticMode ?? "auto"
  const root =
    selectedMode === "auto"
      ? config.hierarchy?.mode === "nested"
        ? "treegrid"
        : config.selection?.mode && config.selection.mode !== "none"
          ? "grid"
          : "list"
      : selectedMode
  if (root === "tree")
    return { root: "tree" as const, row: "treeitem" as const, hierarchical: true }
  if (root === "treegrid")
    return { root: "treegrid" as const, row: "row" as const, hierarchical: true }
  if (root === "grid")
    return { root: "grid" as const, row: "row" as const, hierarchical: false }
  if (root === "listbox") {
    return { root: "listbox" as const, row: "option" as const, hierarchical: false }
  }
  return { root: "list" as const, row: "listitem" as const, hierarchical: false }
}

function getCommandLabel<TData>(
  config: DataListConfig<TData>,
  command: DataListCommand
) {
  if (command.type === "edit") {
    const item = config.items.find(
      (candidate) => candidate.id === command.itemId
    )
    return `Could not save ${item ? (config.getItemLabel?.(item) ?? item.id) : command.itemId}.`
  }
  if (command.type === "reorder")
    return "Could not reorder the selected records."
  if (command.type === "delete") return "Could not delete the selected records."
  if (command.type === "duplicate") {
    return "Could not duplicate the selected records."
  }
  return "Could not restore the selected records."
}

function DataListInner(
  {
    className,
    onKeyDown,
    "aria-label": ariaLabel = "Database list",
    showHeader = true,
    chrome,
    showColumnHeaders = false,
    ...props
  }: DataListProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>
) {
  const config = useDataListConfig<unknown>()
  const shouldShowHeader = resolveDataViewHeader(chrome, showHeader)
  const model = useDataListModel<unknown>()
  const store = useDataListStoreApi()
  const actions = useDataListStore(selectListActions)
  const focusedId = useDataListStore(selectFocusedId)
  const selection = useDataListStore(selectSelection)
  const collapsedGroups = useDataListStore(selectCollapsedGroups)
  const toggledItems = useDataListStore(selectCollapsedItems)
  const edit = useDataListStore(selectEdit)
  const drag = useDataListStore(selectDrag)
  const pendingCommands = useDataListStore(selectPendingCommands)
  const query = useDataListStore(selectSearchQuery)
  const announcement = useDataListStore(selectAnnouncement)
  const announcementSequence = useDataListStore(selectAnnouncementSequence)
  const viewportWidth = useDataListStore(selectViewportWidth)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const mountedRef = useRef(true)
  const previousItemsRef = useRef(config.items)
  const mutationSequence = useRef(0)
  const operationSequence = useRef(0)
  const loadMoreInFlightRef = useRef(false)
  const instructionsId = useId()
  const roles = getSemanticRoles(config)
  const density = config.preferences?.density ?? "default"
  const readOnly = config.readOnly ?? false
  const selectionMode = config.selection?.mode ?? "none"
  const selectable = selectionMode !== "none"
  const operations = useMemo(
    () => config.operations ?? { mode: "client" as const },
    [config.operations]
  )
  const reorderable = isManualReorderEnabled({
    readOnly,
    hasHandler: Boolean(config.onReorder),
    operationsMode: operations.mode,
    hasSort: Boolean(operations.sort?.length),
    hasFilters: Boolean(operations.filters?.length),
    query,
    serverAllowed:
      operations.mode === "server" && operations.manualOrderAllowed === true,
  })
  const virtualOptions =
    typeof config.virtualization === "object" ? config.virtualization : {}
  const virtualizationEnabled =
    config.virtualization === false ? false : (virtualOptions.enabled ?? true)
  const shouldVirtualize =
    virtualizationEnabled &&
    model.entries.length >=
      (virtualOptions.threshold ?? DATA_LIST_DEFAULT_VIRTUALIZATION_THRESHOLD)

  // TanStack Virtual intentionally exposes an imperative virtualizer instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: model.entries.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) =>
      model.entries[index]?.kind === "group"
        ? DATA_LIST_GROUP_HEIGHT
        : (virtualOptions.estimateRowHeight ?? DATA_LIST_ROW_HEIGHT[density]),
    getItemKey: (index) => model.entries[index]?.key ?? index,
    overscan: virtualOptions.overscan ?? DATA_LIST_DEFAULT_OVERSCAN,
    enabled: shouldVirtualize,
    initialRect: shouldVirtualize
      ? {
          width: 800,
          height: virtualOptions.initialHeight ?? 640,
        }
      : undefined,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const validIds = new Set(model.itemsById.keys())
    const visibleIds = model.itemEntries.map((entry) => entry.item.id)
    actions.reconcileItems(validIds, visibleIds, operations.mode === "server")
  }, [actions, model.itemEntries, model.itemsById, operations.mode])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      actions.setViewport(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [actions])

  const acceptCommand = useCallback(
    (
      command: DataListCommand,
      source: "handler" | "authoritative" | "external"
    ) => {
      if (!store.getState().pendingCommands.has(command.mutationId)) return
      actions.settleCommand(command.mutationId, true)
      config.onCommandSettled?.({ command, status: "accepted", source })
    },
    [actions, config, store]
  )

  const rejectCommand = useCallback(
    (
      command: DataListCommand,
      error: unknown,
      source: "handler" | "authoritative" | "external" = "handler",
      requirePending = true
    ) => {
      if (
        !mountedRef.current ||
        (requirePending &&
          !store.getState().pendingCommands.has(command.mutationId))
      ) {
        return
      }
      actions.settleCommand(command.mutationId, false)
      actions.announce(getCommandLabel(config, command))
      config.onCommandRejected?.({ command, error })
      config.onCommandSettled?.({
        command,
        status: "rejected",
        source,
        error,
      })
    },
    [actions, config, store]
  )

  useEffect(() => {
    if (previousItemsRef.current === config.items) return
    previousItemsRef.current = config.items
    for (const pending of pendingCommands.values()) {
      if (pending.confirmation !== "authoritative") continue
      if (pending.command.type === "edit") {
        const item = model.itemsById.get(pending.command.itemId)
        let currentValue: unknown
        try {
          currentValue =
            pending.command.propertyId === "__title__"
              ? item && config.titleEditor?.accessor(item.data)
              : model.valuesByItemId
                  .get(pending.command.itemId)
                  ?.get(pending.command.propertyId)
        } catch (error) {
          rejectCommand(pending.command, error, "authoritative")
          continue
        }
        if (Object.is(currentValue, pending.command.proposedValue)) {
          acceptCommand(pending.command, "authoritative")
          actions.announce("Changes saved.")
        }
        continue
      }
      if (pending.command.type === "reorder") {
        const order = config.items.map((item) => item.id)
        const movedIndexes = pending.command.itemIds
          .map((id) => order.indexOf(id))
          .filter((index) => index >= 0)
          .sort((left, right) => left - right)
        const contiguous = movedIndexes.every(
          (index, position) =>
            position === 0 || index === movedIndexes[position - 1] + 1
        )
        const beforeIndex = pending.command.beforeId
          ? order.indexOf(pending.command.beforeId)
          : order.length
        const afterIndex = pending.command.afterId
          ? order.indexOf(pending.command.afterId)
          : -1
        const confirmed =
          contiguous &&
          movedIndexes.length === pending.command.itemIds.length &&
          movedIndexes[0] === afterIndex + 1 &&
          movedIndexes.at(-1)! + 1 === beforeIndex
        if (confirmed) {
          acceptCommand(pending.command, "authoritative")
          actions.announce("Order saved.")
        }
        continue
      }
      if (pending.command.type === "delete") {
        const confirmed =
          pending.command.selection.kind === "explicit" &&
          pending.command.selection.ids.every((id) => !model.itemsById.has(id))
        if (confirmed) acceptCommand(pending.command, "authoritative")
      }
    }
  }, [
    acceptCommand,
    actions,
    config,
    model.itemsById,
    model.valuesByItemId,
    pendingCommands,
    rejectCommand,
  ])

  useEffect(() => {
    for (const settlement of config.mutationSettlements ?? []) {
      const pending = pendingCommands.get(settlement.mutationId)
      if (!pending) continue
      if (settlement.status === "accepted") {
        acceptCommand(pending.command, "external")
      } else {
        rejectCommand(pending.command, settlement.error, "external")
      }
    }
  }, [
    acceptCommand,
    config.mutationSettlements,
    pendingCommands,
    rejectCommand,
  ])

  useEffect(() => {
    actions.announce(
      model.filtered
        ? `${model.resultCount} matching records.`
        : `${model.resultCount} records.`
    )
  }, [actions, model.filtered, model.resultCount])

  useLayoutEffect(() => {
    if (!focusedId) return
    const index = model.itemEntries.findIndex(
      (entry) => entry.item.id === focusedId
    )
    if (index < 0) return
    const entryIndex = model.entries.findIndex(
      (entry) => entry.kind === "item" && entry.item.id === focusedId
    )
    if (shouldVirtualize && entryIndex >= 0) {
      virtualizer.scrollToIndex(entryIndex, { align: "auto" })
    }
    const activeElement = document.activeElement
    const rowOwnedFocus =
      activeElement instanceof HTMLElement &&
      Boolean(activeElement.closest("[data-list-row-id]"))
    if (
      rowOwnedFocus &&
      !rootRef.current?.querySelector(
        `[data-list-row-id="${CSS.escape(focusedId)}"]:focus`
      )
    ) {
      requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector<HTMLElement>(
            `[data-list-row-id="${CSS.escape(focusedId)}"]`
          )
          ?.focus({ preventScroll: true })
      })
    }
  }, [
    focusedId,
    model.entries,
    model.itemEntries,
    shouldVirtualize,
    virtualizer,
  ])

  const setRootRefs = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element
      if (typeof forwardedRef === "function") forwardedRef(element)
      else if (forwardedRef) forwardedRef.current = element
    },
    [forwardedRef]
  )

  const createMutationId = useCallback(() => {
    if (config.environment?.createMutationId) {
      return config.environment.createMutationId()
    }
    mutationSequence.current += 1
    return `list-${mutationSequence.current}`
  }, [config.environment])

  const executeCommand = useCallback(
    <TCommand extends DataListCommand>(
      command: TCommand,
      handler: DataListMutationHandler<TCommand> | undefined,
      waitForAuthoritative = false
    ) => {
      if (!handler) return
      actions.addPendingCommand(command)
      actions.pushHistory(command)
      let result:
        void | DataListMutationResult | Promise<void | DataListMutationResult>
      try {
        result = handler(command)
      } catch (error) {
        rejectCommand(command, error)
        return
      }
      const handlerOwnsConfirmation = isPromiseLike(result)
      if (handlerOwnsConfirmation) {
        actions.setPendingConfirmation(command.mutationId, "handler")
      }
      Promise.resolve(result).then(
        (outcome) => {
          if (!mountedRef.current) return
          if (outcome?.status === "rejected") {
            rejectCommand(command, outcome.error)
          } else if (outcome?.status === "await-authoritative") {
            actions.setPendingConfirmation(command.mutationId, "authoritative")
          } else if (
            outcome?.status === "accepted" ||
            handlerOwnsConfirmation ||
            !waitForAuthoritative
          ) {
            acceptCommand(command, "handler")
          }
        },
        (error: unknown) => rejectCommand(command, error)
      )
    },
    [acceptCommand, actions, rejectCommand]
  )

  const emitSelection = useCallback(
    (
      next: DataListInternalSelection,
      reason: DataListSelectionChange["reason"],
      anchorId?: string | null
    ) => {
      const controlled =
        config.selection?.mode !== "none" &&
        config.selection?.value !== undefined
      if (controlled) {
        if (anchorId !== undefined) {
          actions.setSelection(store.getState().selection, anchorId)
        }
      } else {
        actions.setSelection(next, anchorId)
      }
      const publicSelection = toPublicSelection(next)
      if (config.selection?.mode !== "none") {
        config.selection?.onChange?.({ selection: publicSelection, reason })
      }
      const count = getSelectedCount(next, model.resultCount)
      actions.announce(
        next.kind === "all-matching"
          ? `All ${count} matching records selected.`
          : `${count} record${count === 1 ? "" : "s"} selected.`
      )
    },
    [actions, config.selection, model.resultCount, store]
  )

  const handleSelection = useCallback(
    (
      itemId: string,
      event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
    ) => {
      if (!selectable) return
      const currentSelection = store.getState().selection
      const visibleIds = model.itemEntries.map((entry) => entry.item.id)
      if (selectionMode === "single") {
        emitSelection(replaceSelection(itemId), "replace", itemId)
      } else if (event.shiftKey) {
        emitSelection(
          rangeSelection(
            currentSelection,
            visibleIds,
            store.getState().rangeAnchorId,
            itemId
          ),
          "range"
        )
      } else if (event.metaKey || event.ctrlKey) {
        emitSelection(
          toggleSelection(currentSelection, itemId),
          "toggle",
          itemId
        )
      } else {
        emitSelection(replaceSelection(itemId), "replace", itemId)
      }
    },
    [emitSelection, model.itemEntries, selectable, selectionMode, store]
  )

  const handleRowClick = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      if (event.defaultPrevented) return
      actions.setFocusedId(itemId)
      const item = model.itemsById.get(itemId)
      const behavior =
        config.clickBehavior ?? (selectable ? "select" : "activate")
      if (behavior !== "activate") handleSelection(itemId, event)
      if (item && behavior !== "select") config.onActivate?.(item)
    },
    [actions, config, handleSelection, model.itemsById, selectable]
  )

  const handleRowDoubleClick = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      if (event.defaultPrevented) return
      const item = model.itemsById.get(itemId)
      if (item) config.onActivate?.(item)
    },
    [config, model.itemsById]
  )

  const handleRowContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      const item = model.itemsById.get(itemId)
      if (!item || !config.onContextMenu) return
      event.preventDefault()
      if (selectable && !isItemSelected(store.getState().selection, itemId)) {
        emitSelection(replaceSelection(itemId), "replace", itemId)
      }
      config.onContextMenu(item, event.nativeEvent)
    },
    [config, emitSelection, model.itemsById, selectable, store]
  )

  const startEdit = useCallback(
    (itemId: string, propertyId: string, value: unknown) => {
      if (readOnly || !config.onEdit) return
      actions.beginEdit(itemId, propertyId, value)
      actions.announce(
        `Editing ${propertyId === "__title__" ? "title" : propertyId}.`
      )
    },
    [actions, config.onEdit, readOnly]
  )

  const commitEdit = useCallback(async () => {
    const currentEdit = store.getState().edit
    if (currentEdit.status !== "draft" || !config.onEdit) return
    const item = model.itemsById.get(currentEdit.itemId)
    if (!item) {
      actions.cancelEdit()
      return
    }
    const property = model.propertiesById.get(currentEdit.propertyId)
    const definition =
      currentEdit.propertyId === "__title__"
        ? config.titleEditor
        : property?.editor
    actions.setEditValidating()
    try {
      const validation = await definition?.validate?.(
        currentEdit.value as never,
        item
      )
      if (validation && !validation.valid) {
        if (!mountedRef.current) return
        actions.setEditError(validation.message)
        actions.announce(validation.message)
        return
      }
    } catch (error) {
      if (!mountedRef.current) return
      const message =
        error instanceof Error ? error.message : "Validation failed."
      actions.setEditError(message)
      actions.announce(message)
      return
    }
    if (!mountedRef.current) return
    const command: DataListEditCommand = {
      type: "edit",
      itemId: currentEdit.itemId,
      propertyId: currentEdit.propertyId,
      previousValue: currentEdit.previousValue,
      proposedValue: currentEdit.value,
      mutationId: createMutationId(),
    }
    executeCommand(command, config.onEdit, true)
    actions.cancelEdit()
    actions.announce("Saving changes.")
  }, [
    actions,
    config.onEdit,
    config.titleEditor,
    createMutationId,
    executeCommand,
    model.itemsById,
    model.propertiesById,
    store,
  ])

  const commitReorder = useCallback(
    (
      itemIds: readonly string[],
      targetId: string,
      position: "before" | "after"
    ) => {
      if (!reorderable || !config.onReorder) return
      const command = resolveReorderCommand(
        model.itemEntries,
        itemIds,
        { targetId, position },
        createMutationId()
      )
      if (!command) return
      executeCommand(command, config.onReorder, true)
      actions.announce(
        `Moved ${itemIds.length} record${itemIds.length === 1 ? "" : "s"}.`
      )
    },
    [
      actions,
      config.onReorder,
      createMutationId,
      executeCommand,
      model.itemEntries,
      reorderable,
    ]
  )

  const handleCommitEdit = useCallback(() => {
    void commitEdit()
  }, [commitEdit])

  const handleRendererError = useCallback(
    (rowId: string, propertyId: string | undefined, cause: unknown) => {
      config.onError?.({
        code: "renderer",
        message: `Renderer failed for item "${rowId}"${propertyId ? ` and property "${propertyId}"` : ""}.`,
        itemId: rowId,
        propertyId,
        cause,
      })
    },
    [config]
  )

  const beginPointerReorder = useCallback(
    (itemId: string, event: React.PointerEvent) => {
      if (!reorderable || event.button !== 0) return
      event.preventDefault()
      const currentSelection = store.getState().selection
      const selectedIds =
        currentSelection.kind === "explicit" && currentSelection.ids.has(itemId)
          ? model.itemEntries
              .map((entry) => entry.item.id)
              .filter((id) => currentSelection.ids.has(id))
          : [itemId]
      actions.setDrag({
        mode: "pointer",
        phase: "pending",
        itemIds: selectedIds,
        originX: event.clientX,
        originY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      })
    },
    [actions, model.itemEntries, reorderable, store]
  )

  useEffect(() => {
    if (drag.mode !== "pointer") return
    const handleMove = (event: PointerEvent) => {
      const current = store.getState().drag
      if (current.mode !== "pointer") return
      const distance = Math.hypot(
        event.clientX - current.originX,
        event.clientY - current.originY
      )
      const phase =
        current.phase === "active" || distance >= 5 ? "active" : "pending"
      let targetId = current.targetId
      let position = current.position
      if (phase === "active") {
        const element = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-list-row-id]")
        const candidateId = element?.dataset.listRowId
        if (candidateId && !current.itemIds.includes(candidateId)) {
          targetId = candidateId
          const rect = element.getBoundingClientRect()
          position =
            event.clientY < rect.top + rect.height / 2 ? "before" : "after"
        }
        const viewport = viewportRef.current
        if (viewport) {
          const rect = viewport.getBoundingClientRect()
          const edge = 40
          if (event.clientY < rect.top + edge) viewport.scrollTop -= 16
          else if (event.clientY > rect.bottom - edge) viewport.scrollTop += 16
        }
      }
      actions.setDrag({
        ...current,
        phase,
        currentX: event.clientX,
        currentY: event.clientY,
        targetId,
        position,
      })
    }
    const handleUp = () => {
      const current = store.getState().drag
      if (
        current.mode === "pointer" &&
        current.phase === "active" &&
        current.targetId &&
        current.position
      ) {
        commitReorder(current.itemIds, current.targetId, current.position)
      }
      actions.setDrag({ mode: "idle" })
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp, { once: true })
    window.addEventListener("pointercancel", handleUp, { once: true })
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }
  }, [actions, commitReorder, drag.mode, store])

  const issueSelectionCommand = useCallback(
    (type: "delete" | "duplicate") => {
      if (readOnly || selectionMode === "none") return
      const publicSelection = toPublicSelection(selection)
      if (
        publicSelection.kind === "explicit" &&
        publicSelection.ids.length === 0
      ) {
        return
      }
      const mutationId = createMutationId()
      if (type === "delete") {
        executeCommand(
          { type, selection: publicSelection, mutationId },
          config.onDelete
        )
      } else {
        executeCommand(
          { type, selection: publicSelection, mutationId },
          config.onDuplicate
        )
      }
    },
    [
      config.onDelete,
      config.onDuplicate,
      createMutationId,
      executeCommand,
      readOnly,
      selection,
      selectionMode,
    ]
  )

  const handleKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return
      const current = store.getState()
      if (event.key === "Escape") {
        if (current.edit.status !== "idle") {
          actions.cancelEdit()
          actions.announce("Editing cancelled.")
        } else if (current.drag.mode !== "idle") {
          actions.setDrag({ mode: "idle" })
          actions.announce("Reorder cancelled.")
        } else if (selectable) {
          emitSelection({ kind: "explicit", ids: new Set() }, "clear", null)
        }
        return
      }
      if (isEditableTarget(event.target)) return
      const visibleIds = model.itemEntries.map((entry) => entry.item.id)
      const index = current.focusedId
        ? visibleIds.indexOf(current.focusedId)
        : -1

      if (current.drag.mode === "keyboard") {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          const targetIndex = visibleIds.indexOf(current.drag.targetId)
          const delta = event.key === "ArrowDown" ? 1 : -1
          const nextId =
            visibleIds[
              Math.max(0, Math.min(visibleIds.length - 1, targetIndex + delta))
            ]
          if (nextId && !current.drag.itemIds.includes(nextId)) {
            actions.setDrag({
              ...current.drag,
              targetId: nextId,
              position: delta > 0 ? "after" : "before",
            })
            actions.announce(
              `Move ${current.drag.position} ${config.getItemLabel?.(model.itemsById.get(nextId)!) ?? nextId}.`
            )
          }
          return
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault()
          commitReorder(
            current.drag.itemIds,
            current.drag.targetId,
            current.drag.position
          )
          actions.setDrag({ mode: "idle" })
          return
        }
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageDown" ||
        event.key === "PageUp"
      ) {
        event.preventDefault()
        let nextIndex = index < 0 ? 0 : index
        if (event.key === "ArrowDown") nextIndex += 1
        else if (event.key === "ArrowUp") nextIndex -= 1
        else if (event.key === "Home") nextIndex = 0
        else if (event.key === "End") nextIndex = visibleIds.length - 1
        else if (event.key === "PageDown") nextIndex += 10
        else nextIndex -= 10
        const nextId =
          visibleIds[Math.max(0, Math.min(visibleIds.length - 1, nextIndex))]
        if (nextId) actions.setFocusedId(nextId)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        if (!selectable || selectionMode !== "multiple") return
        event.preventDefault()
        if (
          config.selection?.mode !== "none" &&
          config.selection?.allowAllMatching
        ) {
          emitSelection(
            {
              kind: "all-matching",
              excludedIds: new Set(),
              matchingCount: model.resultCount,
            },
            "all-matching"
          )
        } else {
          emitSelection(
            { kind: "explicit", ids: new Set(visibleIds) },
            "visible"
          )
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        const command = event.shiftKey
          ? current.actions.takeRedo()
          : current.actions.takeUndo()
        if (!command) return
        const callback = event.shiftKey
          ? config.onRedoCommand
          : config.onUndoCommand
        if (callback) {
          Promise.resolve(callback(command)).catch((error: unknown) =>
            rejectCommand(command, error, "handler", false)
          )
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault()
        issueSelectionCommand("duplicate")
        return
      }
      if (event.key === "Delete") {
        event.preventDefault()
        issueSelectionCommand("delete")
        return
      }
      if (!current.focusedId) return
      const item = model.itemsById.get(current.focusedId)
      if (event.key === "Enter" && item) {
        event.preventDefault()
        config.onActivate?.(item)
      } else if (
        event.key === "F2" &&
        item &&
        config.titleEditor &&
        !readOnly
      ) {
        event.preventDefault()
        startEdit(item.id, "__title__", config.titleEditor.accessor(item.data))
      } else if (event.key === " ") {
        event.preventDefault()
        if (reorderable) {
          const ids =
            selection.kind === "explicit" &&
            selection.ids.has(current.focusedId)
              ? visibleIds.filter((id) => selection.ids.has(id))
              : [current.focusedId]
          actions.setDrag({
            mode: "keyboard",
            itemIds: ids,
            targetId: current.focusedId,
            position: "after",
          })
          actions.announce(
            `Picked up ${ids.length} record${ids.length === 1 ? "" : "s"}. Use arrow keys to choose a destination.`
          )
        } else if (selectable) {
          handleSelection(current.focusedId, event)
        }
      } else if (
        roles.root === "tree" &&
        (event.key === "ArrowRight" || event.key === "ArrowLeft")
      ) {
        const entry = model.itemEntries[index]
        if (entry?.hasChildren) {
          const defaultExpanded =
            config.hierarchy?.mode === "nested"
              ? config.hierarchy.defaultExpanded !== false
              : true
          const expanded = toggledItems.has(entry.item.id)
            ? !defaultExpanded
            : defaultExpanded
          if (
            (event.key === "ArrowRight" && !expanded) ||
            (event.key === "ArrowLeft" && expanded)
          ) {
            event.preventDefault()
            actions.toggleItem(entry.item.id)
          }
        }
      }
    },
    [
      actions,
      commitReorder,
      config,
      emitSelection,
      handleSelection,
      issueSelectionCommand,
      model.itemEntries,
      model.itemsById,
      model.resultCount,
      readOnly,
      rejectCommand,
      reorderable,
      roles.root,
      selectable,
      selection,
      selectionMode,
      startEdit,
      store,
      toggledItems,
    ]
  )

  const requestServerOperations = useCallback(
    (
      next: Partial<DataListServerOperationState>,
      reason: "search" | "filters" | "sort" | "refresh"
    ) => {
      if (operations.mode !== "server" || !operations.onOperationsChange) {
        return
      }
      operationSequence.current += 1
      operations.onOperationsChange({
        query: next.query ?? query,
        filters: next.filters ?? operations.filters ?? [],
        sort: next.sort ?? operations.sort ?? [],
        reason,
        requestId: `list-operation-${operationSequence.current}`,
      })
    },
    [operations, query]
  )

  const setQuery = useCallback(
    (nextQuery: string) => {
      const search = operations.search
      if (search?.mode === "controlled") {
        search.onQueryChange(nextQuery)
      } else {
        actions.setSearchQuery(nextQuery)
        search?.onQueryChange?.(nextQuery)
      }
      requestServerOperations({ query: nextQuery }, "search")
    },
    [actions, operations.search, requestServerOperations]
  )

  const matchingCount = model.resultCount
  const selectedCount = getSelectedCount(selection, matchingCount)
  const selectedItems = model.itemEntries
    .filter((entry) => isItemSelected(selection, entry.item.id))
    .map((entry) => entry.item)
  const publicSelection = toPublicSelection(selection)

  const cycleDensity = useCallback(() => {
    if (!config.onPreferencesChange) return
    const currentIndex = DATA_LIST_DENSITIES.indexOf(density)
    const next =
      DATA_LIST_DENSITIES[(currentIndex + 1) % DATA_LIST_DENSITIES.length]
    config.onPreferencesChange({ ...config.preferences, density: next })
  }, [config, density])

  const customControls = (
    <>
      {config.renderControls ? (
        <DataListRenderBoundary
          resetKey={`controls:${query}`}
          onError={(cause) =>
            config.onError?.({
              code: "renderer",
              message: "The list controls renderer failed.",
              cause,
            })
          }
        >
          <DataListRenderSlot
            render={() =>
              config.renderControls?.({
                query,
                setQuery,
                resultCount: model.resultCount,
                loadedCount: model.loadedCount,
                requestServerOperations:
                  operations.mode === "server" && operations.onOperationsChange
                    ? (next, reason) => requestServerOperations(next, reason)
                    : undefined,
              })
            }
          />
        </DataListRenderBoundary>
      ) : null}
      {config.onPreferencesChange ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={cycleDensity}
          aria-label={`Density: ${density}. Change density`}
          title={`Density: ${density}`}
        >
          <Rows3 className="size-3.5" />
        </Button>
      ) : null}
    </>
  )

  const pendingValuesByItem = useMemo(() => {
    const result = new Map<string, Map<string, unknown>>()
    for (const pending of pendingCommands.values()) {
      if (pending.command.type !== "edit") continue
      const values = result.get(pending.command.itemId) ?? new Map()
      values.set(pending.command.propertyId, pending.command.proposedValue)
      result.set(pending.command.itemId, values)
    }
    return result
  }, [pendingCommands])

  const pendingItemIds = useMemo(() => {
    const result = new Set<string>()
    for (const pending of pendingCommands.values()) {
      if (pending.command.type === "edit") result.add(pending.command.itemId)
      else if (pending.command.type === "reorder") {
        pending.command.itemIds.forEach((id) => result.add(id))
      } else if (
        (pending.command.type === "delete" ||
          pending.command.type === "duplicate") &&
        pending.command.selection.kind === "explicit"
      ) {
        pending.command.selection.ids.forEach((id) => result.add(id))
      }
    }
    return result
  }, [pendingCommands])

  const visibleProperties = useMemo(() => {
    const width = viewportWidth
    if (!width || width >= 900) return model.visibleProperties
    const maximum = Math.max(0, Math.floor((width - 300) / 150))
    const required = model.visibleProperties.filter(
      (property) => property.capabilities?.required
    )
    const optional = model.visibleProperties
      .filter((property) => !property.capabilities?.required)
      .sort(
        (left, right) =>
          (right.capabilities?.priority ?? 0) -
          (left.capabilities?.priority ?? 0)
      )
      .slice(0, Math.max(0, maximum - required.length))
    const visible = new Set(
      [...required, ...optional].map((property) => property.id)
    )
    return model.visibleProperties.filter((property) =>
      visible.has(property.id)
    )
  }, [model.visibleProperties, viewportWidth])

  const grouping = useMemo(
    () => config.grouping ?? { mode: "none" as const },
    [config.grouping]
  )
  const renderEntry = useCallback(
    (
      entry: DataListDisplayEntry<unknown>,
      style?: React.CSSProperties,
      measureRef?: (element: Element | null) => void
    ) => {
      if (entry.kind === "group") {
        const collapsed = collapsedGroups.has(entry.group.key)
        let customContent: React.ReactNode
        try {
          customContent =
            grouping.mode === "none"
              ? undefined
              : grouping.renderHeader?.({ group: entry.group, collapsed })
        } catch (cause) {
          config.onError?.({
            code: "renderer",
            message: `Group renderer failed for "${entry.group.key}".`,
            cause,
          })
        }
        return (
          <DataListRenderBoundary
            key={entry.key}
            resetKey={`${entry.key}:${collapsed}`}
            fallback={
              <div className="flex h-9 items-center border-y border-border/50 px-8 text-xs text-destructive">
                Unable to render this group
              </div>
            }
            onError={(cause) => {
              config.onError?.({
                code: "renderer",
                message: `Group content failed for "${entry.group.key}".`,
                cause,
              })
            }}
          >
            <DataListGroupHeader
              ref={measureRef as React.Ref<HTMLDivElement>}
              group={entry.group}
              collapsed={collapsed}
              collapsible={
                grouping.mode !== "none" && Boolean(grouping.collapsible)
              }
              gridSemantics={roles.row === "row"}
              customContent={customContent}
              onToggle={(key) => {
                actions.toggleGroup(key)
                actions.announce(
                  `${collapsed ? "Expanded" : "Collapsed"} ${entry.group.textLabel}.`
                )
              }}
              onAdd={
                readOnly || grouping.mode === "none" || !grouping.onAdd
                  ? undefined
                  : (key) => grouping.onAdd?.({ groupKey: key })
              }
              style={style}
            />
          </DataListRenderBoundary>
        )
      }
      const itemId = entry.item.id
      const state = {
        selected: isItemSelected(selection, itemId),
        focused: focusedId === itemId,
        pending: pendingItemIds.has(itemId),
        readOnly,
      }
      return (
        <DataListRow
          ref={measureRef as React.Ref<HTMLDivElement>}
          key={entry.key}
          config={config}
          entry={entry}
          properties={
            visibleProperties as readonly DataListAnyProperty<unknown>[]
          }
          values={model.valuesByItemId.get(itemId) ?? new Map()}
          state={state}
          density={density}
          semanticRole={roles.row}
          hierarchical={roles.hierarchical}
          selectable={selectable}
          reorderable={reorderable}
          edit={edit}
          pendingValues={pendingValuesByItem.get(itemId) ?? new Map()}
          dropPosition={
            drag.mode !== "idle" && drag.targetId === itemId
              ? drag.position
              : undefined
          }
          hierarchyToggled={toggledItems.has(itemId)}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          onRowFocus={actions.setFocusedId}
          onRowContextMenu={handleRowContextMenu}
          onSelectionToggle={handleSelection}
          onStartEdit={startEdit}
          onEditValueChange={actions.setEditValue}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={actions.cancelEdit}
          onToggleHierarchy={actions.toggleItem}
          onPointerReorderStart={beginPointerReorder}
          onRendererError={handleRendererError}
          style={style}
        />
      )
    },
    [
      actions,
      beginPointerReorder,
      collapsedGroups,
      config,
      density,
      drag,
      edit,
      focusedId,
      grouping,
      handleRowClick,
      handleRowContextMenu,
      handleRowDoubleClick,
      handleSelection,
      handleCommitEdit,
      handleRendererError,
      model.valuesByItemId,
      pendingItemIds,
      pendingValuesByItem,
      readOnly,
      reorderable,
      roles.hierarchical,
      roles.row,
      selectable,
      selection,
      startEdit,
      toggledItems,
      visibleProperties,
    ]
  )

  const measuredVirtualItems = shouldVirtualize
    ? virtualizer.getVirtualItems()
    : []
  const virtualItems =
    shouldVirtualize && measuredVirtualItems.length === 0
      ? Array.from(
          {
            length: Math.min(
              model.entries.length,
              Math.ceil(
                (virtualOptions.initialHeight ?? 640) /
                  (virtualOptions.estimateRowHeight ??
                    DATA_LIST_ROW_HEIGHT[density])
              ) + (virtualOptions.overscan ?? DATA_LIST_DEFAULT_OVERSCAN)
            ),
          },
          (_, index) => ({
            index,
            start:
              index *
              (virtualOptions.estimateRowHeight ??
                DATA_LIST_ROW_HEIGHT[density]),
          })
        )
      : measuredVirtualItems
  const firstVisibleIndex = virtualItems[0]?.index ?? 0
  let activeGroup: Extract<
    DataListDisplayEntry<unknown>,
    { readonly kind: "group" }
  > | null = null
  for (let index = firstVisibleIndex; index >= 0; index -= 1) {
    const entry = model.entries[index]
    if (entry?.kind === "group") {
      activeGroup = entry
      break
    }
  }

  const pagination =
    operations.mode === "server" ? operations.pagination : undefined
  const requestLoadMore = useCallback(() => {
    const currentPagination =
      operations.mode === "server" ? operations.pagination : undefined
    if (
      currentPagination?.mode !== "infinite" ||
      !currentPagination.hasNextPage ||
      currentPagination.fetchingNextPage ||
      loadMoreInFlightRef.current
    ) {
      return
    }
    loadMoreInFlightRef.current = true
    let result: void | Promise<void>
    try {
      result = currentPagination.onLoadMore()
    } catch (cause) {
      loadMoreInFlightRef.current = false
      config.onError?.({
        code: "operation",
        message: "Loading the next page failed.",
        cause,
      })
      return
    }
    Promise.resolve(result).then(
      () => {
        loadMoreInFlightRef.current = false
      },
      (cause: unknown) => {
        loadMoreInFlightRef.current = false
        config.onError?.({
          code: "operation",
          message: "Loading the next page failed.",
          cause,
        })
      }
    )
  }, [config, operations])

  const requestPage = useCallback(
    (pageIndex: number) => {
      const currentPagination =
        operations.mode === "server" ? operations.pagination : undefined
      if (currentPagination?.mode !== "page") return
      try {
        currentPagination.onPageChange(pageIndex)
      } catch (cause) {
        config.onError?.({
          code: "operation",
          message: "Changing the list page failed.",
          cause,
        })
      }
    },
    [config, operations]
  )

  const handleShiftWheel = useCallback(
    (delta: number) => {
      if (pagination?.mode !== "page" || pagination.pending) return
      const hasPrevious = pagination.hasPreviousPage ?? pagination.pageIndex > 0
      const hasNext =
        pagination.hasNextPage ??
        (pagination.pageCount === undefined ||
          pagination.pageIndex + 1 < pagination.pageCount)
      if (delta < 0 && hasPrevious) requestPage(pagination.pageIndex - 1)
      else if (delta > 0 && hasNext) requestPage(pagination.pageIndex + 1)
    },
    [pagination, requestPage]
  )

  useShiftWheel(rootRef, handleShiftWheel, pagination?.mode === "page")

  useEffect(() => {
    if (pagination?.mode !== "infinite" || !pagination.autoLoad) return
    const viewport = viewportRef.current
    if (!viewport) return
    const remaining =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    if (remaining <= (pagination.loadMoreThreshold ?? 240)) requestLoadMore()
  }, [model.loadedCount, pagination, requestLoadMore])

  const status = config.status ?? { state: "ready" as const }
  const serverError =
    operations.mode === "server" ? operations.error : undefined
  const currentError = status.state === "error" ? status.error : serverError
  const hasRows = model.entries.length > 0
  const blockingLoading =
    status.state === "loading" &&
    (status.phase === "initial" || (status.phase === undefined && !hasRows))
  const blockingError =
    Boolean(currentError) &&
    (status.state === "error"
      ? status.phase === "initial" || !hasRows
      : !hasRows)
  const noAccess = status.state === "no-access"
  const showRows = hasRows && !blockingLoading && !blockingError && !noAccess
  const handleRetry = () => {
    if (status.state !== "error" || !status.onRetry) return
    Promise.resolve(status.onRetry()).catch((cause: unknown) =>
      config.onError?.({
        code: "operation",
        message: "Retrying the list request failed.",
        cause,
      })
    )
  }
  const reportStateRendererError = (cause: unknown) =>
    config.onError?.({
      code: "renderer",
      message: "A list state renderer failed.",
      cause,
    })
  const stateSurface = blockingLoading ? (
    <DataListRenderBoundary
      resetKey="loading"
      fallback={
        <DataListStateSurface
          state="loading"
          message={status.state === "loading" ? status.message : undefined}
        />
      }
      onError={reportStateRendererError}
    >
      <DataListRenderSlot
        render={() =>
          config.renderLoading?.() ?? (
            <DataListStateSurface
              state="loading"
              message={status.state === "loading" ? status.message : undefined}
            />
          )
        }
      />
    </DataListRenderBoundary>
  ) : blockingError ? (
    <DataListRenderBoundary
      resetKey={`error:${String(currentError)}`}
      fallback={
        <DataListStateSurface
          state="error"
          message={String(currentError)}
          onRetry={status.state === "error" ? handleRetry : undefined}
        />
      }
      onError={reportStateRendererError}
    >
      <DataListRenderSlot
        render={() =>
          config.renderError?.(currentError!) ?? (
            <DataListStateSurface
              state="error"
              message={String(currentError)}
              onRetry={status.state === "error" ? handleRetry : undefined}
            />
          )
        }
      />
    </DataListRenderBoundary>
  ) : noAccess ? (
    <DataListRenderBoundary
      resetKey="no-access"
      fallback={
        <DataListStateSurface
          state="no-access"
          message={status.state === "no-access" ? status.message : undefined}
        />
      }
      onError={reportStateRendererError}
    >
      <DataListRenderSlot
        render={() =>
          config.renderNoAccess?.() ?? (
            <DataListStateSurface
              state="no-access"
              message={
                status.state === "no-access" ? status.message : undefined
              }
            />
          )
        }
      />
    </DataListRenderBoundary>
  ) : !hasRows ? (
    <DataListRenderBoundary
      resetKey={`empty:${model.filtered}`}
      fallback={
        <DataListStateSurface
          state={model.filtered ? "filtered-empty" : "empty"}
        />
      }
      onError={reportStateRendererError}
    >
      <DataListRenderSlot
        render={() =>
          config.renderEmpty?.(model.filtered) ?? (
            <DataListStateSurface
              state={model.filtered ? "filtered-empty" : "empty"}
            />
          )
        }
      />
    </DataListRenderBoundary>
  ) : null

  const bulkActions = config.renderBulkActions ? (
    <DataListRenderBoundary
      resetKey={`bulk:${selectedCount}`}
      onError={(cause) =>
        config.onError?.({
          code: "renderer",
          message: "The list bulk-actions renderer failed.",
          cause,
        })
      }
    >
      <DataListRenderSlot
        render={() =>
          config.renderBulkActions?.({
            selection: publicSelection,
            selectedItems,
            clearSelection: () =>
              emitSelection(
                { kind: "explicit", ids: new Set() },
                "clear",
                null
              ),
          })
        }
      />
    </DataListRenderBoundary>
  ) : undefined

  return (
    <div
      ref={setRootRefs}
      className={cn(
        "edv-root relative isolate flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border/70 bg-background text-foreground shadow-xs forced-colors:border-[CanvasText]",
        className
      )}
      aria-label={ariaLabel}
      aria-describedby={instructionsId}
      data-testid="data-list"
      data-edv-root=""
      data-edv-part="list"
      data-edv-chrome={chrome?.mode ?? "standalone"}
      data-list-part="root"
      data-density={density}
      data-read-only={readOnly || undefined}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented) handleKeyboard(event)
      }}
      {...props}
    >
      <span id={instructionsId} className="sr-only">
        Use arrow keys to move between records, Enter to open, and F2 to edit.
        {reorderable
          ? " Press Space to pick up a record, arrows to choose a destination, and Space again to drop."
          : null}
      </span>
      <span
        key={announcementSequence}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      {shouldShowHeader ? (
        <DataListControls
          query={query}
          placeholder={operations.search?.placeholder}
          resultCount={model.resultCount}
          totalCount={model.totalCount}
          loadedCount={model.loadedCount}
          pending={
            (operations.mode === "server" && operations.pending) ||
            status.state === "loading" ||
            (pagination?.mode === "page" && pagination.pending) ||
            (pagination?.mode === "infinite" && pagination.fetchingNextPage) ||
            pendingCommands.size > 0
          }
          searchDisabled={
            operations.mode === "server" &&
            !operations.search &&
            !operations.onOperationsChange
          }
          selectedCount={selectable ? selectedCount : 0}
          bulkActions={bulkActions}
          customControls={customControls}
          onQueryChange={setQuery}
          onClearSelection={
            selectable
              ? () =>
                  emitSelection(
                    { kind: "explicit", ids: new Set() },
                    "clear",
                    null
                  )
              : undefined
          }
        />
      ) : null}
      {currentError && !blockingError ? (
        <div
          className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
          data-list-part="refresh-error"
        >
          <span>{String(currentError)}</span>
          {status.state === "error" && status.onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={handleRetry}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-auto focus-within:outline-none"
        style={{
          maxHeight:
            virtualOptions.maxHeight ?? (shouldVirtualize ? 640 : undefined),
        }}
        data-list-part="viewport"
        onScroll={(event) => {
          const viewport = event.currentTarget
          actions.setScrollTop(viewport.scrollTop)
          if (pagination?.mode === "infinite" && pagination.autoLoad) {
            const remaining =
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
            if (remaining <= (pagination.loadMoreThreshold ?? 240)) {
              requestLoadMore()
            }
          }
        }}
      >
        {showColumnHeaders && visibleProperties.length > 0 ? (
          <div
            className="sticky top-0 z-10 grid min-w-full items-center border-b border-border/50 bg-muted/50 text-[11px] font-medium text-muted-foreground"
            style={{
              gridTemplateColumns: `minmax(220px, 1fr) ${visibleProperties
                .map(() => "minmax(120px, auto)")
                .join(" ")}`,
            }}
            aria-hidden="true"
            data-list-part="column-headers"
          >
            <div className="px-2 py-1.5" style={{ paddingInlineStart: "36px" }}>
              Title
            </div>
            {visibleProperties.map((property) => (
              <div key={property.id} className="px-2 py-1.5">
                {property.label}
              </div>
            ))}
          </div>
        ) : null}
        {activeGroup && shouldVirtualize ? (
          <div
            className="pointer-events-none sticky top-0 z-20 flex h-9 items-center gap-2 border-y border-border/50 bg-muted/95 px-8 text-xs font-medium backdrop-blur-sm"
            aria-hidden="true"
            data-list-part="sticky-group"
          >
            <span className="truncate">{activeGroup.group.label}</span>
            <span className="text-muted-foreground">
              {activeGroup.group.count}
            </span>
          </div>
        ) : null}
        <div
          role={showRows ? roles.root : undefined}
          aria-label={ariaLabel}
          aria-multiselectable={
            showRows &&
            (roles.root === "listbox" ||
              roles.root === "grid" ||
              roles.root === "treegrid") &&
            selectionMode === "multiple"
              ? true
              : undefined
          }
          aria-busy={
            status.state === "loading" ||
            (operations.mode === "server" && operations.pending) ||
            (pagination?.mode === "page" && pagination.pending) ||
            (pagination?.mode === "infinite" && pagination.fetchingNextPage) ||
            undefined
          }
          data-list-part="body"
          style={
            shouldVirtualize
              ? {
                  position: "relative",
                  height: `${virtualizer.getTotalSize()}px`,
                  minWidth: "100%",
                }
              : undefined
          }
        >
          {showRows && shouldVirtualize
            ? virtualItems.map((virtualItem) => {
                const entry = model.entries[virtualItem.index]
                if (!entry) return null
                return (
                  <div
                    key={entry.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {renderEntry(entry)}
                  </div>
                )
              })
            : showRows
              ? model.entries.map((entry) => renderEntry(entry))
              : stateSurface}
        </div>
      </div>
      {pagination ? (
        <DataListPagination
          pagination={pagination}
          loadedCount={model.loadedCount}
          matchingCount={model.resultCount}
          onLoadMore={requestLoadMore}
          onPageChange={requestPage}
        />
      ) : null}
      {drag.mode === "pointer" && drag.phase === "active" ? (
        <div
          className="pointer-events-none fixed z-50 max-w-72 truncate rounded border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
          style={{ left: drag.currentX + 12, top: drag.currentY + 12 }}
          aria-hidden="true"
          data-list-part="drag-overlay"
        >
          Moving {drag.itemIds.length} record
          {drag.itemIds.length === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  )
}

export const DataList = React.memo(React.forwardRef(DataListInner))
