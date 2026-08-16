import { useCallback, useId, useMemo, useRef } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarStoreApi } from "../context/calendar-context.js"
import type { CalendarMutationCommand } from "../types.js"
import type {
  CalendarCreateContext,
  CalendarItem,
  CalendarMutationIntent,
  CalendarMutationOutcome,
  CalendarRange,
} from "../types.js"
import {
  canCreateCalendarItem,
  canExecuteCalendarCommand,
  canMutateCalendarItem,
} from "../utils/data-integration.js"

export interface CalendarCommandActions {
  readonly nextMutationId: (kind: string) => string
  readonly commit: (command: CalendarMutationCommand) => boolean
  readonly deleteSelected: () => CalendarMutationCommand | null
  readonly undo: () => CalendarMutationCommand | null
  readonly redo: () => CalendarMutationCommand | null
  readonly create: (
    range: CalendarRange,
    context: CalendarCreateContext
  ) => boolean
  readonly update: (
    previousItem: CalendarItem,
    nextItem: CalendarItem
  ) => boolean
  readonly duplicate: (items: readonly CalendarItem[]) => boolean
  readonly convert: (item: CalendarItem, range: CalendarRange) => boolean
}

export function useCalendarCommandActions(): CalendarCommandActions {
  const store = useCalendarStoreApi()
  const config = useCalendarConfig()
  const {
    onItemCreate,
    onItemConvert,
    onItemDuplicate,
    onItemMutation,
    onMutationIntent,
    onMutationRejected,
    readOnly,
  } = config
  const instanceId = useId().replaceAll(":", "") || "calendar"
  const sequence = useRef(0)

  const nextMutationId = useCallback(
    (kind: string) => {
      sequence.current += 1
      return `${instanceId}-${kind}-${sequence.current}`
    },
    [instanceId]
  )

  const emit = useCallback(
    (intent: CalendarMutationIntent) => {
      const clientMutationId =
        intent.type === "command"
          ? intent.command.clientMutationId
          : intent.clientMutationId
      const command = intent.type === "command" ? intent.command : null
      const legacyHandler = () => {
        switch (intent.type) {
          case "command":
            return onItemMutation?.(intent.command)
          case "create":
            return onItemCreate?.(intent.range, intent.context)
          case "duplicate":
            return onItemDuplicate?.(intent.items)
          case "convert":
            return onItemConvert?.(intent.item, intent.range)
          case "update":
            return undefined
        }
      }
      const available =
        Boolean(onMutationIntent) ||
        (intent.type === "command"
          ? Boolean(onItemMutation)
          : intent.type === "create"
            ? Boolean(onItemCreate)
            : intent.type === "duplicate"
              ? Boolean(onItemDuplicate)
              : intent.type === "convert"
                ? Boolean(onItemConvert)
                : false)
      if (!available) return false
      const reject = (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Consumer rejected mutation."
        const rejection = command
          ? store
              .getState()
              .actions.rejectCommand(
                clientMutationId,
                "consumer-rejected",
                message
              )
          : { clientMutationId, reason: "consumer-rejected" as const, message }
        if (rejection) onMutationRejected?.(rejection)
        if (rejection) store.getState().actions.announce(message)
      }
      const settle = (outcome: void | CalendarMutationOutcome) => {
        if (outcome?.status === "rejected") {
          reject(
            outcome.message
              ? new Error(outcome.message)
              : "Consumer rejected mutation."
          )
        } else if (outcome?.status === "accepted" && command) {
          store.getState().actions.confirmCommand(clientMutationId)
        }
      }
      try {
        const result = onMutationIntent
          ? onMutationIntent(intent)
          : legacyHandler()
        void Promise.resolve(result).then(settle, reject)
      } catch (error) {
        reject(error)
      }
      return true
    },
    [
      onItemCreate,
      onItemConvert,
      onItemDuplicate,
      onItemMutation,
      onMutationIntent,
      onMutationRejected,
      store,
    ]
  )

  return useMemo(
    () => ({
      nextMutationId,
      commit: (command: CalendarMutationCommand) => {
        if (
          readOnly ||
          (!onMutationIntent && !onItemMutation) ||
          !canExecuteCalendarCommand(config, command)
        )
          return false
        if (!store.getState().actions.recordCommand(command)) {
          store.getState().actions.announce("That calendar change is invalid.")
          return false
        }
        const emitted = emit({ type: "command", command })
        if (emitted) {
          const count =
            command.type === "move"
              ? command.changes.length
              : command.type === "delete" || command.type === "restore"
                ? command.itemIds.length
                : 1
          const action =
            command.type === "move"
              ? "Moved"
              : command.type === "resize"
                ? "Resized"
                : command.type === "delete"
                  ? "Deleted"
                  : "Restored"
          store
            .getState()
            .actions.announce(
              `${action} ${count} calendar item${count === 1 ? "" : "s"}.`
            )
        }
        return emitted
      },
      deleteSelected: () => {
        if (readOnly || (!onMutationIntent && !onItemMutation)) return null
        const selectedItems = [...store.getState().selectedIds].flatMap(
          (itemId) => config.items.find((item) => item.id === itemId) ?? []
        )
        if (selectedItems.length === 0) {
          store.getState().actions.announce("Select an item before deleting.")
          return null
        }
        if (
          selectedItems.some(
            (item) => !canMutateCalendarItem(config, item, "delete")
          )
        ) {
          store
            .getState()
            .actions.announce("The selected items cannot be deleted.")
          return null
        }
        const command = store
          .getState()
          .actions.deleteSelection(nextMutationId("delete"))
        if (command) {
          emit({ type: "command", command })
          if (command.type === "delete") {
            const count = command.itemIds.length
            store
              .getState()
              .actions.announce(
                `Deleted ${count} calendar item${count === 1 ? "" : "s"}.`
              )
          }
        } else {
          store.getState().actions.announce("Select an item before deleting.")
        }
        return command
      },
      undo: () => {
        if (readOnly || (!onMutationIntent && !onItemMutation)) return null
        const command = store
          .getState()
          .actions.takeUndoCommand(nextMutationId("undo"))
        if (command) {
          emit({ type: "command", command })
          store.getState().actions.announce("Undid the last calendar change.")
        } else {
          store
            .getState()
            .actions.announce("There is no calendar change to undo.")
        }
        return command
      },
      redo: () => {
        if (readOnly || (!onMutationIntent && !onItemMutation)) return null
        const command = store
          .getState()
          .actions.takeRedoCommand(nextMutationId("redo"))
        if (command) {
          emit({ type: "command", command })
          store.getState().actions.announce("Redid the calendar change.")
        } else {
          store
            .getState()
            .actions.announce("There is no calendar change to redo.")
        }
        return command
      },
      create: (range, context) => {
        if (!canCreateCalendarItem(config)) return false
        return emit({
          type: "create",
          clientMutationId: nextMutationId("create"),
          range,
          context,
        })
      },
      update: (previousItem, nextItem) => {
        if (
          previousItem.id !== nextItem.id ||
          !canMutateCalendarItem(config, previousItem, "update")
        )
          return false
        return emit({
          type: "update",
          clientMutationId: nextMutationId("update"),
          previousItem,
          nextItem,
        })
      },
      duplicate: (items) => {
        if (
          items.length === 0 ||
          items.some(
            (item) => !canMutateCalendarItem(config, item, "duplicate")
          )
        )
          return false
        return emit({
          type: "duplicate",
          clientMutationId: nextMutationId("duplicate"),
          items,
        })
      },
      convert: (item, range) => {
        if (!canMutateCalendarItem(config, item, "convert")) return false
        return emit({
          type: "convert",
          clientMutationId: nextMutationId("convert"),
          item,
          range,
        })
      },
    }),
    [
      config,
      emit,
      nextMutationId,
      onItemMutation,
      onMutationIntent,
      readOnly,
      store,
    ]
  )
}
