import { useCallback, type RefObject } from "react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanData } from "../context/kanban-data-context.js"
import { useKanbanCommandActions } from "./use-kanban-command-actions.js"
import { useKanbanPreferencesChange } from "./use-kanban-preferences.js"
import { useKanbanStoreApi } from "../context/kanban-context.js"
import type { KanbanDisplayModel } from "../utils/display-model.js"
import { getPlacementKey } from "../utils/normalize.js"
import { evaluateMoveWip } from "../utils/wip.js"

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

export function useKanbanKeyboard(
  rootRef: RefObject<HTMLDivElement | null>,
  display: KanbanDisplayModel
) {
  const config = useKanbanConfig()
  const { normalized } = useKanbanData()
  const store = useKanbanStoreApi()
  const commands = useKanbanCommandActions()
  const changePreferences = useKanbanPreferencesChange()
  const selectionEnabled = config.selection?.mode !== "none"

  return useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || isEditable(event.target)) return
      const state = store.getState()
      const actions = state.actions
      const visible = display.visibleCardIds
      const currentId =
        state.focusedCardId && visible.includes(state.focusedCardId)
          ? state.focusedCardId
          : (visible[0] ?? null)
      const primary = event.metaKey || event.ctrlKey

      if (primary && event.key.toLowerCase() === "f") {
        event.preventDefault()
        rootRef.current
          ?.querySelector<HTMLInputElement>("[data-kanban-search]")
          ?.focus()
        return
      }
      if (selectionEnabled && primary && event.key.toLowerCase() === "a") {
        event.preventDefault()
        actions.selectVisible(visible)
        actions.announce(
          `${visible.length} visible card${visible.length === 1 ? "" : "s"} selected.`
        )
        return
      }
      if (
        !config.readOnly &&
        config.onCommand &&
        primary &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault()
        if (event.shiftKey) commands.redo()
        else commands.undo()
        return
      }
      if (
        !config.readOnly &&
        config.onCommand &&
        primary &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault()
        commands.redo()
        return
      }
      if (
        selectionEnabled &&
        !config.readOnly &&
        config.onCommand &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault()
        commands.deleteCards(visible.filter((id) => state.selectedIds.has(id)))
        return
      }
      if (
        selectionEnabled &&
        !config.readOnly &&
        config.onCommand &&
        primary &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault()
        commands.duplicateCards(
          visible.filter((id) => state.selectedIds.has(id))
        )
        return
      }
      if (event.key === "Escape" && state.interaction.type !== "idle") {
        event.preventDefault()
        actions.setInteraction({ type: "idle" })
        actions.announce("Move cancelled.")
        return
      }

      if (
        state.interaction.type === "card-drag" &&
        state.interaction.input === "keyboard"
      ) {
        const drag = state.interaction
        if (event.key === " ") {
          event.preventDefault()
          if (drag.blockedReason) {
            actions.announce(drag.blockedReason)
            return
          }
          commands.moveCards(
            drag.cardIds,
            drag.destinationGroupId,
            drag.destinationSwimlaneId,
            drag.destinationIndex
          )
          actions.setInteraction({ type: "idle" })
          actions.announce(
            `${drag.cardIds.length} card${drag.cardIds.length === 1 ? "" : "s"} moved.`
          )
          return
        }
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(event.key)
        ) {
          event.preventDefault()
          let groupId = drag.destinationGroupId
          let index = drag.destinationIndex
          const groupIndex = normalized.orderedGroupIds.indexOf(groupId)
          if (event.key === "ArrowLeft")
            groupId =
              normalized.orderedGroupIds[Math.max(0, groupIndex - 1)] ?? groupId
          if (event.key === "ArrowRight")
            groupId =
              normalized.orderedGroupIds[
                Math.min(normalized.orderedGroupIds.length - 1, groupIndex + 1)
              ] ?? groupId
          const targetIds =
            normalized.cardIdsByPlacement.get(
              getPlacementKey(groupId, drag.destinationSwimlaneId)
            ) ?? []
          if (event.key === "ArrowUp") index = Math.max(0, index - 1)
          if (event.key === "ArrowDown")
            index = Math.min(targetIds.length, index + 1)
          if (event.key === "Home") index = 0
          if (event.key === "End") index = targetIds.length
          if (groupId !== drag.destinationGroupId)
            index = Math.min(index, targetIds.length)
          const group = normalized.groupsById.get(groupId)!
          const authoritativeCount = display.groups.find(
            ({ id }) => id === groupId
          )?.wip.count
          const wip = evaluateMoveWip(
            normalized.acceptedCards,
            group,
            new Set(drag.cardIds),
            authoritativeCount
          )
          const blockedReason =
            wip.status === "hard-blocked"
              ? `${groupId} has a hard WIP limit of ${wip.maximum}.`
              : null
          actions.setInteraction({
            ...drag,
            destinationGroupId: groupId,
            destinationIndex: index,
            blockedReason,
          })
          actions.announce(
            blockedReason ??
              `Move destination ${groupId}, position ${index + 1}.`
          )
          return
        }
      }

      if (
        event.key === " " &&
        currentId &&
        !config.readOnly &&
        config.onCommand
      ) {
        event.preventDefault()
        const card = normalized.cardsById.get(currentId)
        if (!card) return
        const cardIds =
          selectionEnabled && state.selectedIds.has(currentId)
            ? visible.filter((id) => state.selectedIds.has(id))
            : [currentId]
        if (selectionEnabled && !state.selectedIds.has(currentId))
          actions.select(currentId, "replace")
        const placement =
          normalized.cardIdsByPlacement.get(
            getPlacementKey(card.groupId, card.swimlaneId)
          ) ?? []
        actions.setInteraction({
          type: "card-drag",
          input: "keyboard",
          cardIds,
          sourceGroupId: card.groupId,
          ...(card.swimlaneId === undefined
            ? {}
            : { sourceSwimlaneId: card.swimlaneId }),
          destinationGroupId: card.groupId,
          ...(card.swimlaneId === undefined
            ? {}
            : { destinationSwimlaneId: card.swimlaneId }),
          destinationIndex: placement.indexOf(currentId),
          blockedReason: null,
        })
        actions.announce(
          `${cardIds.length} card${cardIds.length === 1 ? "" : "s"} picked up. Use arrow keys to choose a destination, Space to drop, or Escape to cancel.`
        )
        return
      }

      if (event.key === "Enter" && currentId) {
        event.preventDefault()
        const card = normalized.cardsById.get(currentId)
        if (card) config.onCardOpen?.(card)
        return
      }
      if (
        !config.readOnly &&
        event.key.toLowerCase() === "n" &&
        currentId &&
        config.onAddCard
      ) {
        event.preventDefault()
        const card = normalized.cardsById.get(currentId)
        if (card)
          config.onAddCard({
            groupId: card.groupId,
            ...(card.swimlaneId === undefined
              ? {}
              : { swimlaneId: card.swimlaneId }),
            source: "keyboard",
          })
        return
      }
      if (
        !config.readOnly &&
        event.key.toLowerCase() === "c" &&
        currentId &&
        config.onPreferencesChange
      ) {
        event.preventDefault()
        const card = normalized.cardsById.get(currentId)
        if (card)
          changePreferences({
            type: "group-collapsed",
            groupId: card.groupId,
            collapsed: !(
              display.groups.find(({ id }) => id === card.groupId)?.collapsed ??
              false
            ),
          })
        return
      }
      if (
        !currentId ||
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key)
      )
        return
      event.preventDefault()
      let targetIndex = visible.indexOf(currentId)
      if (event.key === "ArrowUp") targetIndex -= 1
      if (event.key === "ArrowDown") targetIndex += 1
      if (event.key === "Home") targetIndex = 0
      if (event.key === "End") targetIndex = visible.length - 1
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const card = normalized.cardsById.get(currentId)
        if (card) {
          const groupIndex = normalized.orderedGroupIds.indexOf(card.groupId)
          const direction = event.key === "ArrowLeft" ? -1 : 1
          for (
            let index = groupIndex + direction;
            index >= 0 && index < normalized.orderedGroupIds.length;
            index += direction
          ) {
            const candidate = normalized.cardIdsByPlacement
              .get(
                getPlacementKey(
                  normalized.orderedGroupIds[index]!,
                  card.swimlaneId
                )
              )
              ?.find((id) => visible.includes(id))
            if (candidate) {
              targetIndex = visible.indexOf(candidate)
              break
            }
          }
        }
      }
      const targetId =
        visible[Math.max(0, Math.min(visible.length - 1, targetIndex))]
      if (targetId) {
        actions.setFocusedCardId(targetId)
        if (selectionEnabled && event.shiftKey)
          actions.select(targetId, "range", visible)
        else actions.requestFocus({ type: "card", id: targetId })
      }
    },
    [
      changePreferences,
      commands,
      config,
      display.groups,
      display.visibleCardIds,
      normalized,
      rootRef,
      selectionEnabled,
      store,
    ]
  )
}
