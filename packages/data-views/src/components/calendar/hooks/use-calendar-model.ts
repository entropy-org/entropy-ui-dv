import { useMemo } from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarStore } from "./use-calendar-store.js"
import {
  selectAnchorDate,
  selectInteraction,
  selectPendingCommands,
  selectSearchQuery,
} from "../store/selectors.js"
import { getCalendarDateInTimeZone } from "../utils/date-engine.js"
import {
  buildCalendarRenderModel,
  formatCalendarTitle,
} from "../utils/calendar-model.js"
import { getAgendaVisibleSpan } from "../utils/agenda.js"
import {
  getCalendarVisibleRange,
  getConfiguredCalendarSources,
} from "../utils/data-integration.js"

export function useCalendarModel() {
  const config = useCalendarConfig()
  const anchorDate = useCalendarStore(selectAnchorDate)
  const pendingCommands = useCalendarStore(selectPendingCommands)
  const searchQuery = useCalendarStore(selectSearchQuery)
  const interaction = useCalendarStore(selectInteraction)

  return useMemo(() => {
    const model = buildCalendarRenderModel({
      anchorDate,
      items: config.items,
      pendingCommands,
      preferences: config.preferences,
      locale: config.locale,
      maxSpanDays: config.maxSpanDays,
      searchQuery,
      getSearchText: config.getSearchText,
      interaction,
      permissions: config.permissions,
      sources: getConfiguredCalendarSources(config),
    })
    const today = getCalendarDateInTimeZone(
      config.now?.() ?? new Date(),
      config.preferences.timeZone
    )
    const agendaSpan =
      config.preferences.viewMode === "agenda"
        ? getAgendaVisibleSpan(
            anchorDate,
            config.preferences.agenda.span,
            config.preferences.weekStartsOn,
            config.preferences.showWeekends
          )
        : null
    const titleGrid = agendaSpan
      ? {
          ...model.grid,
          startDate: agendaSpan.startDate,
          endDate: agendaSpan.endDate,
        }
      : model.grid
    return {
      ...model,
      today,
      visibleRange: getCalendarVisibleRange(anchorDate, config.preferences),
      title: formatCalendarTitle(
        titleGrid,
        config.preferences.viewMode,
        config.locale
      ),
    }
  }, [anchorDate, config, interaction, pendingCommands, searchQuery])
}
