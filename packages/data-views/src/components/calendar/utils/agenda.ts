import type {
  CalendarAgendaPreferences,
  CalendarAgendaSpan,
  CalendarDate,
  CalendarItem,
  CalendarRange,
  CalendarWeekStartsOn,
  TimedCalendarItem,
} from "../types.js"
import {
  addCalendarDays,
  compareCalendarDates,
  getCalendarDateInTimeZone,
  getDayOfWeek,
  parseCalendarDate,
  startOfWeek,
} from "./date-engine.js"
import { getItemDateSpan } from "./date-range.js"

export const MINUTES_PER_DAY = 1440

export interface CalendarAgendaVisibleSpan {
  readonly dates: readonly CalendarDate[]
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
  readonly resolvedAnchorDate: CalendarDate
}

export interface CalendarAgendaTimedSegment {
  readonly id: string
  readonly item: TimedCalendarItem
  readonly date: CalendarDate
  readonly startMinutes: number
  readonly endMinutes: number
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
  readonly column: number
  readonly columnSpan: number
  readonly columnCount: number
}

export interface CalendarAgendaAllDaySegment {
  readonly id: string
  readonly item: CalendarItem
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
  readonly startIndex: number
  readonly endIndex: number
  readonly lane: number
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
}

function isWeekend(date: CalendarDate): boolean {
  const day = getDayOfWeek(date)
  return day === 0 || day === 6
}

export function resolveVisibleAgendaDate(
  date: CalendarDate,
  showWeekends: boolean,
  direction: -1 | 1 = 1
): CalendarDate {
  let next = date
  while (!showWeekends && isWeekend(next)) next = addCalendarDays(next, direction)
  return next
}

function collectVisibleDates(
  start: CalendarDate,
  count: number,
  showWeekends: boolean
): CalendarDate[] {
  const dates: CalendarDate[] = []
  let date = start
  while (dates.length < count) {
    if (showWeekends || !isWeekend(date)) dates.push(date)
    date = addCalendarDays(date, 1)
  }
  return dates
}

export function getAgendaVisibleSpan(
  anchorDate: CalendarDate,
  span: CalendarAgendaSpan,
  weekStartsOn: CalendarWeekStartsOn,
  showWeekends: boolean
): CalendarAgendaVisibleSpan {
  const resolvedAnchorDate = resolveVisibleAgendaDate(anchorDate, showWeekends)
  let dates: CalendarDate[]
  if (span.type === "week") {
    const weekStart = startOfWeek(resolvedAnchorDate, weekStartsOn)
    dates = Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index)).filter(
      (date) => showWeekends || !isWeekend(date)
    )
  } else {
    dates = collectVisibleDates(
      resolvedAnchorDate,
      span.type === "day" ? 1 : span.dayCount,
      showWeekends
    )
  }
  return {
    dates,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    resolvedAnchorDate,
  }
}

export function getAdjacentAgendaAnchor(
  anchorDate: CalendarDate,
  span: CalendarAgendaSpan,
  weekStartsOn: CalendarWeekStartsOn,
  showWeekends: boolean,
  direction: "previous" | "next"
): CalendarDate {
  const amount = direction === "previous" ? -1 : 1
  if (span.type === "week") {
    return resolveVisibleAgendaDate(
      addCalendarDays(startOfWeek(anchorDate, weekStartsOn), amount * 7),
      showWeekends,
      amount
    )
  }
  const count = span.type === "day" ? 1 : span.dayCount
  let date = resolveVisibleAgendaDate(anchorDate, showWeekends, amount)
  for (let index = 0; index < count; index += 1) {
    date = addCalendarDays(date, amount)
    date = resolveVisibleAgendaDate(date, showWeekends, amount)
  }
  return date
}

interface ZonedParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
}

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
  }
}

export function getWallClockMinutes(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone)
  return parts.hour * 60 + parts.minute
}

/** Resolves a local wall-clock value. Gaps advance to the first valid minute. */
export function agendaWallClockToInstant(
  date: CalendarDate,
  minutes: number,
  timeZone: string
): Date {
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY)
  const normalizedMinutes = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const normalizedDate = addCalendarDays(date, dayOffset)
  const parts = parseCalendarDate(normalizedDate)
  const targetUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    Math.floor(normalizedMinutes / 60),
    normalizedMinutes % 60
  )
  let candidate = targetUtc
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = getZonedParts(new Date(candidate), timeZone)
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    )
    const adjustment = targetUtc - actualUtc
    if (adjustment === 0) return new Date(candidate)
    candidate += adjustment
  }
  // A nonexistent DST wall time has no exact solution. Search forward rather
  // than silently rendering before the requested local time.
  for (let offset = 0; offset <= 180; offset += 1) {
    const instant = new Date(candidate + offset * 60_000)
    const actual = getZonedParts(instant, timeZone)
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    if (actualUtc >= targetUtc) return instant
  }
  return new Date(candidate)
}

export function snapAgendaMinutes(minutes: number, snapMinutes: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes / snapMinutes) * snapMinutes))
}

export function shiftTimedRangeByWallClock(
  range: Extract<CalendarRange, { readonly kind: "timed" }>,
  dayDelta: number,
  minuteDelta: number,
  timeZone: string
): CalendarRange {
  const date = addCalendarDays(getCalendarDateInTimeZone(range.start, timeZone), dayDelta)
  const start = agendaWallClockToInstant(
    date,
    getWallClockMinutes(range.start, timeZone) + minuteDelta,
    timeZone
  )
  return {
    kind: "timed",
    start,
    end: new Date(start.getTime() + (range.end.getTime() - range.start.getTime())),
  }
}

interface MutableTimedSegment extends Omit<CalendarAgendaTimedSegment, "column" | "columnSpan" | "columnCount"> {
  column: number
  columnSpan: number
  columnCount: number
}

function assignOverlapColumns(segments: MutableTimedSegment[]): void {
  segments.sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes || a.id.localeCompare(b.id))
  let cluster: MutableTimedSegment[] = []
  let clusterEnd = -1
  const finish = () => {
    if (cluster.length === 0) return
    const columns: MutableTimedSegment[][] = []
    for (const segment of cluster) {
      let column = columns.findIndex((items) => items[items.length - 1].endMinutes <= segment.startMinutes)
      if (column < 0) column = columns.length
      ;(columns[column] ??= []).push(segment)
      segment.column = column
    }
    for (const segment of cluster) {
      segment.columnCount = columns.length
      let span = 1
      for (let column = segment.column + 1; column < columns.length; column += 1) {
        if (columns[column].some((other) => other.startMinutes < segment.endMinutes && segment.startMinutes < other.endMinutes)) break
        span += 1
      }
      segment.columnSpan = span
    }
    cluster = []
  }
  for (const segment of segments) {
    if (cluster.length > 0 && segment.startMinutes >= clusterEnd) finish()
    cluster.push(segment)
    clusterEnd = Math.max(clusterEnd, segment.endMinutes)
  }
  finish()
}

export function layoutAgendaTimedSegments(
  items: readonly CalendarItem[],
  visibleDates: readonly CalendarDate[],
  timeZone: string
): CalendarAgendaTimedSegment[] {
  const visible = new Set(visibleDates)
  const byDate = new Map<CalendarDate, MutableTimedSegment[]>()
  for (const item of items) {
    if (item.kind !== "timed") continue
    const span = getItemDateSpan(item, timeZone)
    let date = span.startDate
    while (compareCalendarDates(date, span.endDate) <= 0) {
      if (visible.has(date)) {
        const isStart = date === span.startDate
        const isEnd = date === span.endDate
        const startMinutes = isStart ? getWallClockMinutes(item.start, timeZone) : 0
        let endMinutes = isEnd ? getWallClockMinutes(item.end, timeZone) : MINUTES_PER_DAY
        if (isEnd && getCalendarDateInTimeZone(item.end, timeZone) !== date) endMinutes = MINUTES_PER_DAY
        if (endMinutes <= startMinutes) endMinutes = MINUTES_PER_DAY
        const list = byDate.get(date) ?? []
        list.push({
          id: `${item.id}:${date}`,
          item,
          date,
          startMinutes,
          endMinutes,
          continuedBefore: !isStart,
          continuedAfter: !isEnd,
          column: 0,
          columnSpan: 1,
          columnCount: 1,
        })
        byDate.set(date, list)
      }
      date = addCalendarDays(date, 1)
    }
  }
  const result: MutableTimedSegment[] = []
  for (const segments of byDate.values()) {
    assignOverlapColumns(segments)
    result.push(...segments)
  }
  return result
}

export function layoutAgendaAllDaySegments(
  items: readonly CalendarItem[],
  visibleDates: readonly CalendarDate[],
  timeZone: string
): CalendarAgendaAllDaySegment[] {
  const indexByDate = new Map(visibleDates.map((date, index) => [date, index]))
  const placements: CalendarAgendaAllDaySegment[] = []
  const laneEnds: number[] = []
  const candidates = items
    .map((item) => ({ item, span: getItemDateSpan(item, timeZone) }))
    .filter(({ item, span }) => item.kind === "all-day" && span.endDate >= visibleDates[0] && span.startDate <= visibleDates[visibleDates.length - 1])
    .sort((a, b) => a.span.startDate.localeCompare(b.span.startDate) || b.span.endDate.localeCompare(a.span.endDate) || a.item.id.localeCompare(b.item.id))
  for (const { item, span } of candidates) {
    const startIndex = indexByDate.get(span.startDate) ?? visibleDates.findIndex((date) => date >= span.startDate)
    let endIndex = indexByDate.get(span.endDate) ?? -1
    if (endIndex < 0) {
      for (let index = visibleDates.length - 1; index >= 0; index -= 1) {
        if (visibleDates[index] <= span.endDate) { endIndex = index; break }
      }
    }
    if (startIndex < 0 || endIndex < startIndex) continue
    let lane = laneEnds.findIndex((end) => end < startIndex)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = endIndex
    placements.push({
      id: `${item.id}:${visibleDates[startIndex]}`,
      item,
      startDate: visibleDates[startIndex],
      endDate: visibleDates[endIndex],
      startIndex,
      endIndex,
      lane,
      continuedBefore: span.startDate < visibleDates[0],
      continuedAfter: span.endDate > visibleDates[visibleDates.length - 1],
    })
  }
  return placements
}

export function getAgendaHourHeight(preferences: CalendarAgendaPreferences): number {
  return Math.max(32, Math.min(240, preferences.hourHeight))
}
