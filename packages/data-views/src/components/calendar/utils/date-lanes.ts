import type {
  CalendarDate,
  CalendarDateSpan,
} from "../types.js"
import type { CalendarDateGridRow } from "./date-grid.js"
import { compareCalendarDates } from "./date-engine.js"
import { isDateWithinSpan } from "./date-range.js"
import type { NormalizedCalendarItem } from "./normalize-items.js"

export interface CalendarLanePlacement {
  readonly item: NormalizedCalendarItem
  readonly rowIndex: number
  readonly lane: number
  readonly startColumn: number
  readonly endColumn: number
  readonly segment: CalendarDateSpan
  readonly isRangeStart: boolean
  readonly isRangeEnd: boolean
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
  readonly isVisible: boolean
}

export interface CalendarDateOverflow {
  readonly date: CalendarDate
  readonly hiddenCount: number
}

export interface CalendarLaneLayout {
  readonly placements: readonly CalendarLanePlacement[]
  readonly visiblePlacements: readonly CalendarLanePlacement[]
  readonly overflowByDate: readonly CalendarDateOverflow[]
  readonly laneCountByRow: readonly number[]
}

function compareItems(
  first: NormalizedCalendarItem,
  second: NormalizedCalendarItem
): number {
  const start = compareCalendarDates(
    first.dateSpan.startDate,
    second.dateSpan.startDate
  )
  if (start !== 0) return start
  if (first.spanDays !== second.spanDays)
    return second.spanDays - first.spanDays
  if (first.item.kind !== second.item.kind) {
    return first.item.kind === "all-day" ? -1 : 1
  }
  if (first.startSortTime !== second.startSortTime) {
    return (first.startSortTime ?? 0) - (second.startSortTime ?? 0)
  }
  return first.item.id.localeCompare(second.item.id)
}

function visibleSegmentDates(
  item: NormalizedCalendarItem,
  row: CalendarDateGridRow
) {
  return row.visibleCells.filter((cell) =>
    isDateWithinSpan(cell.date, item.dateSpan)
  )
}

export function layoutDateLanes(
  items: readonly NormalizedCalendarItem[],
  rows: readonly CalendarDateGridRow[],
  maxVisibleLanes: number
): CalendarLaneLayout {
  const placements: CalendarLanePlacement[] = []
  const overflow = new Map<CalendarDate, number>()
  const laneCountByRow: number[] = []
  const visibleLimit = Math.max(0, Math.floor(maxVisibleLanes))
  const sortedItems = [...items].sort(compareItems)

  for (const row of rows) {
    const laneEnds: number[] = []
    for (const item of sortedItems) {
      const dates = visibleSegmentDates(item, row)
      if (dates.length === 0) continue
      const startColumn = dates[0].visibleColumnIndex as number
      const endColumn = dates[dates.length - 1].visibleColumnIndex as number
      let lane = laneEnds.findIndex(
        (occupiedUntil) => occupiedUntil < startColumn
      )
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = endColumn

      const segment = {
        startDate: dates[0].date,
        endDate: dates[dates.length - 1].date,
      }
      const placement: CalendarLanePlacement = {
        item,
        rowIndex: row.rowIndex,
        lane,
        startColumn,
        endColumn,
        segment,
        isRangeStart: segment.startDate === item.dateSpan.startDate,
        isRangeEnd: segment.endDate === item.dateSpan.endDate,
        continuedBefore:
          compareCalendarDates(item.dateSpan.startDate, segment.startDate) < 0,
        continuedAfter:
          compareCalendarDates(item.dateSpan.endDate, segment.endDate) > 0,
        isVisible: lane < visibleLimit,
      }
      placements.push(placement)
      if (!placement.isVisible) {
        for (const date of dates) {
          overflow.set(date.date, (overflow.get(date.date) ?? 0) + 1)
        }
      }
    }
    laneCountByRow[row.rowIndex] = laneEnds.length
  }

  return {
    placements,
    visiblePlacements: placements.filter((placement) => placement.isVisible),
    overflowByDate: [...overflow.entries()].map(([date, hiddenCount]) => ({
      date,
      hiddenCount,
    })),
    laneCountByRow,
  }
}
