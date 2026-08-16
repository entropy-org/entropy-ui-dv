import { MAX_CALENDAR_HISTORY_ENTRIES } from "../../constants.js"
import {
  calendarExpectationsMatch,
  createCalendarItemMap,
  getCalendarCommandExpectations,
  getCalendarExpectationItemIds,
  invertCalendarMutationCommand,
  replaceCalendarMutationId,
} from "../command-utils.js"
import type {
  CalendarStoreGet,
  CalendarStoreSet,
  CalendarStoreSlice,
} from "../slice-types.js"
import type {
  CalendarHistoryActions,
  CalendarHistoryEntry,
  CalendarHistorySlice,
  CalendarMutationCommand,
  CalendarMutationRejection,
  CalendarPendingCommand,
  CalendarPendingOperation,
  CalendarRange,
} from "../../types.js"
import {
  compareCalendarDates,
  isCalendarDate,
} from "../../utils/date-engine.js"
import { calendarRangesEqual } from "../../utils/date-range.js"

function commandItemIds(command: CalendarMutationCommand): readonly string[] {
  switch (command.type) {
    case "move":
      return command.changes.map((change) => change.itemId)
    case "resize":
      return [command.itemId]
    case "delete":
    case "restore":
      return command.itemIds
  }
}

function rangeIsValid(range: CalendarRange): boolean {
  if (range.kind === "all-day") {
    return (
      isCalendarDate(range.startDate) &&
      isCalendarDate(range.endDate) &&
      compareCalendarDates(range.startDate, range.endDate) <= 0
    )
  }
  const start = range.start instanceof Date ? range.start.getTime() : Number.NaN
  const end = range.end instanceof Date ? range.end.getTime() : Number.NaN
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

function rangeChangeIsValid(previous: CalendarRange, next: CalendarRange) {
  return (
    rangeIsValid(previous) &&
    rangeIsValid(next) &&
    previous.kind === next.kind &&
    !calendarRangesEqual(previous, next)
  )
}

function commandIsValid(command: CalendarMutationCommand): boolean {
  if (command.clientMutationId.trim() === "") return false
  const itemIds = commandItemIds(command)
  if (
    itemIds.length === 0 ||
    itemIds.some((itemId) => itemId === "") ||
    new Set(itemIds).size !== itemIds.length
  ) {
    return false
  }
  if (command.type === "move") {
    return command.changes.every((change) =>
      rangeChangeIsValid(change.previousRange, change.nextRange)
    )
  }
  if (command.type === "resize") {
    return rangeChangeIsValid(command.previousRange, command.nextRange)
  }
  return true
}

function createPendingCommand(
  transactionId: string,
  operation: CalendarPendingOperation,
  command: CalendarMutationCommand
): CalendarPendingCommand {
  const expectations = getCalendarCommandExpectations(command)
  return { transactionId, operation, command, ...expectations }
}

function mutationIdExists(
  clientMutationId: string,
  state: CalendarHistorySlice
): boolean {
  return (
    state.pendingCommands.some(
      (pending) => pending.command.clientMutationId === clientMutationId
    ) ||
    state.undoStack.some(
      (entry) => entry.command.clientMutationId === clientMutationId
    ) ||
    state.redoStack.some(
      (entry) => entry.command.clientMutationId === clientMutationId
    )
  )
}

function withoutPendingCommand(
  pendingCommands: readonly CalendarPendingCommand[],
  clientMutationId: string
): CalendarPendingCommand[] {
  return pendingCommands.filter(
    (pending) => pending.command.clientMutationId !== clientMutationId
  )
}

function removeTransaction(
  entries: readonly CalendarHistoryEntry[],
  transactionId: string
): CalendarHistoryEntry[] {
  return entries.filter((entry) => entry.transactionId !== transactionId)
}

function appendBounded(
  entries: readonly CalendarHistoryEntry[],
  entry: CalendarHistoryEntry
): CalendarHistoryEntry[] {
  return [...entries, entry].slice(-MAX_CALENDAR_HISTORY_ENTRIES)
}

export function createHistorySlice(
  set: CalendarStoreSet,
  get: CalendarStoreGet
): CalendarStoreSlice<CalendarHistorySlice, CalendarHistoryActions> {
  return {
    state: { undoStack: [], redoStack: [], pendingCommands: [] },
    actions: {
      recordCommand: (command) => {
        const state = get()
        if (
          !commandIsValid(command) ||
          mutationIdExists(command.clientMutationId, state) ||
          state.pendingCommands.some(
            (pending) => pending.operation !== "record"
          )
        ) {
          return false
        }

        const entry: CalendarHistoryEntry = {
          transactionId: command.clientMutationId,
          command,
        }
        const undoStack = appendBounded(state.undoStack, entry)
        const retainedTransactions = new Set(
          undoStack.map(({ transactionId }) => transactionId)
        )
        const pendingCommands = [
          ...state.pendingCommands.filter((pending) =>
            retainedTransactions.has(pending.transactionId)
          ),
          createPendingCommand(entry.transactionId, "record", command),
        ]
        set({ undoStack, redoStack: [], pendingCommands })
        return true
      },
      confirmCommand: (clientMutationId) => {
        const state = get()
        if (
          !state.pendingCommands.some(
            (pending) => pending.command.clientMutationId === clientMutationId
          )
        ) {
          return false
        }
        set({
          pendingCommands: withoutPendingCommand(
            state.pendingCommands,
            clientMutationId
          ),
        })
        return true
      },
      rejectCommand: (
        clientMutationId,
        reason = "consumer-rejected",
        message
      ) => {
        const state = get()
        const pending = state.pendingCommands.find(
          (candidate) => candidate.command.clientMutationId === clientMutationId
        )
        if (!pending) return null

        let undoStack = state.undoStack
        let redoStack = state.redoStack
        let pendingCommands = withoutPendingCommand(
          state.pendingCommands,
          clientMutationId
        )

        if (pending.operation === "record") {
          const rejectedIndex = undoStack.findIndex(
            (entry) => entry.transactionId === pending.transactionId
          )
          if (rejectedIndex !== -1) {
            const invalidTransactions = new Set(
              undoStack.slice(rejectedIndex).map((entry) => entry.transactionId)
            )
            undoStack = undoStack.slice(0, rejectedIndex)
            pendingCommands = pendingCommands.filter(
              (candidate) => !invalidTransactions.has(candidate.transactionId)
            )
          }
          redoStack = []
        } else if (pending.operation === "undo") {
          const entry = redoStack.find(
            (candidate) => candidate.transactionId === pending.transactionId
          )
          redoStack = removeTransaction(redoStack, pending.transactionId)
          if (entry) undoStack = appendBounded(undoStack, entry)
        } else {
          const entry = undoStack.find(
            (candidate) => candidate.transactionId === pending.transactionId
          )
          undoStack = removeTransaction(undoStack, pending.transactionId)
          if (entry) redoStack = appendBounded(redoStack, entry)
        }

        set({
          undoStack,
          redoStack,
          pendingCommands,
          interaction: { type: "idle" },
        })
        return { clientMutationId, reason, message }
      },
      reconcileAuthoritativeItems: (
        authoritativeItems,
        authoritativeIdsAreComplete = true
      ) => {
        const itemMap = createCalendarItemMap(authoritativeItems)
        const snapshot = [...get().pendingCommands]
        const expectedMatches = snapshot.map((pending) =>
          authoritativeIdsAreComplete
            ? calendarExpectationsMatch(itemMap, pending.expected)
            : pending.expected.every(
                (expectation) =>
                  expectation.type !== "absent" &&
                  calendarExpectationsMatch(itemMap, [expectation])
              )
        )
        const rejections: CalendarMutationRejection[] = []

        snapshot.forEach((pending, index) => {
          if (
            !get().pendingCommands.some(
              (candidate) =>
                candidate.command.clientMutationId ===
                pending.command.clientMutationId
            )
          ) {
            return
          }

          if (expectedMatches[index]) {
            get().actions.confirmCommand(pending.command.clientMutationId)
            return
          }

          const affectedIds = getCalendarExpectationItemIds(pending.expected)
          const superseded = snapshot.some((later, laterIndex) => {
            if (laterIndex <= index || !expectedMatches[laterIndex])
              return false
            const laterIds = getCalendarExpectationItemIds(later.expected)
            return [...affectedIds].every((itemId) => laterIds.has(itemId))
          })
          if (superseded) {
            get().actions.confirmCommand(pending.command.clientMutationId)
            return
          }

          const previousMatches = authoritativeIdsAreComplete
            ? calendarExpectationsMatch(itemMap, pending.previous)
            : pending.previous.every(
                (expectation) =>
                  expectation.type !== "absent" &&
                  calendarExpectationsMatch(itemMap, [expectation])
              )
          if (previousMatches) return

          if (
            !authoritativeIdsAreComplete &&
            [...affectedIds].some((itemId) => !itemMap.has(itemId))
          ) {
            return
          }

          const rejection = get().actions.rejectCommand(
            pending.command.clientMutationId,
            "authoritative-conflict",
            "Authoritative calendar items conflict with the pending mutation."
          )
          if (rejection) rejections.push(rejection)
        })

        return rejections
      },
      takeUndoCommand: (clientMutationId) => {
        const state = get()
        const entry = state.undoStack.at(-1)
        if (
          !entry ||
          state.pendingCommands.length > 0 ||
          clientMutationId.trim() === "" ||
          mutationIdExists(clientMutationId, state)
        ) {
          return null
        }

        const command = invertCalendarMutationCommand(
          entry.command,
          clientMutationId
        )
        set({
          undoStack: state.undoStack.slice(0, -1),
          redoStack: appendBounded(state.redoStack, entry),
          pendingCommands: [
            createPendingCommand(entry.transactionId, "undo", command),
          ],
        })
        return command
      },
      takeRedoCommand: (clientMutationId) => {
        const state = get()
        const entry = state.redoStack.at(-1)
        if (
          !entry ||
          state.pendingCommands.length > 0 ||
          clientMutationId.trim() === "" ||
          mutationIdExists(clientMutationId, state)
        ) {
          return null
        }

        const command = replaceCalendarMutationId(
          entry.command,
          clientMutationId
        )
        set({
          undoStack: appendBounded(state.undoStack, entry),
          redoStack: state.redoStack.slice(0, -1),
          pendingCommands: [
            createPendingCommand(entry.transactionId, "redo", command),
          ],
        })
        return command
      },
      clearHistory: () => {
        const state = get()
        if (
          state.undoStack.length > 0 ||
          state.redoStack.length > 0 ||
          state.pendingCommands.length > 0
        ) {
          set({ undoStack: [], redoStack: [], pendingCommands: [] })
        }
      },
    },
  }
}
