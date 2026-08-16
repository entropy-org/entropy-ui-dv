import type {
  CalendarDate,
  CalendarDateSpan,
  CalendarViewMode,
  CalendarWeekStartsOn,
} from "../types.js"

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MILLISECONDS_PER_DAY = 86_400_000

export interface CalendarDateParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

export interface CalendarVisibleRange extends CalendarDateSpan {
  readonly rowCount: number
  readonly dayCount: number
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatCalendarDate(parts: CalendarDateParts): CalendarDate {
  return `${String(parts.year).padStart(4, "0")}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`
}

export function parseCalendarDate(value: CalendarDate): CalendarDateParts {
  const match = CALENDAR_DATE_PATTERN.exec(value)
  if (!match) throw new RangeError(`Invalid calendar date "${value}".`)

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    throw new RangeError(`Invalid calendar date "${value}".`)
  }
  return parts
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== "string") return false
  try {
    parseCalendarDate(value)
    return true
  } catch {
    return false
  }
}

export function calendarDateToEpochDay(date: CalendarDate): number {
  const parts = parseCalendarDate(date)
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / MILLISECONDS_PER_DAY
  )
}

export function epochDayToCalendarDate(epochDay: number): CalendarDate {
  if (!Number.isInteger(epochDay)) {
    throw new RangeError("Epoch day must be an integer.")
  }
  const date = new Date(epochDay * MILLISECONDS_PER_DAY)
  return formatCalendarDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
}

export function addCalendarDays(
  date: CalendarDate,
  days: number
): CalendarDate {
  if (!Number.isInteger(days)) throw new RangeError("Days must be an integer.")
  return epochDayToCalendarDate(calendarDateToEpochDay(date) + days)
}

export function differenceInCalendarDays(
  later: CalendarDate,
  earlier: CalendarDate
): number {
  return calendarDateToEpochDay(later) - calendarDateToEpochDay(earlier)
}

export function compareCalendarDates(
  first: CalendarDate,
  second: CalendarDate
): number {
  return Math.sign(
    calendarDateToEpochDay(first) - calendarDateToEpochDay(second)
  )
}

export function getDayOfWeek(date: CalendarDate): CalendarWeekStartsOn {
  const parts = parseCalendarDate(date)
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day)
  ).getUTCDay() as CalendarWeekStartsOn
}

export function startOfWeek(
  date: CalendarDate,
  weekStartsOn: CalendarWeekStartsOn
): CalendarDate {
  const offset = (getDayOfWeek(date) - weekStartsOn + 7) % 7
  return addCalendarDays(date, -offset)
}

export function endOfWeek(
  date: CalendarDate,
  weekStartsOn: CalendarWeekStartsOn
): CalendarDate {
  return addCalendarDays(startOfWeek(date, weekStartsOn), 6)
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = parseCalendarDate(date)
  return formatCalendarDate({ year, month, day: 1 })
}

export function endOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = parseCalendarDate(date)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return formatCalendarDate({ year, month, day: lastDay })
}

export function getCalendarDateInTimeZone(
  date: Date,
  timeZone: string
): CalendarDate {
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Cannot resolve an invalid instant.")
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const values = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  const year = values.get("year")
  const month = values.get("month")
  const day = values.get("day")
  if (!year || !month || !day) {
    throw new Error(`Unable to resolve a calendar date in "${timeZone}".`)
  }
  return `${year}-${month}-${day}`
}

/** Formats a date-only value without allowing the host time zone to shift it. */
export function formatCalendarDateLabel(
  date: CalendarDate,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const parts = parseCalendarDate(date)
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}

export function getVisibleDateRange(
  anchorDate: CalendarDate,
  viewMode: CalendarViewMode,
  weekStartsOn: CalendarWeekStartsOn
): CalendarVisibleRange {
  if (viewMode === "week" || viewMode === "agenda") {
    const startDate = startOfWeek(anchorDate, weekStartsOn)
    return {
      startDate,
      endDate: addCalendarDays(startDate, 6),
      rowCount: 1,
      dayCount: 7,
    }
  }

  const monthStart = startOfMonth(anchorDate)
  const startDate = startOfWeek(monthStart, weekStartsOn)
  const naturalEnd = endOfWeek(endOfMonth(anchorDate), weekStartsOn)
  const naturalDays = differenceInCalendarDays(naturalEnd, startDate) + 1
  const rowCount = Math.max(5, naturalDays / 7)
  return {
    startDate,
    endDate: addCalendarDays(startDate, rowCount * 7 - 1),
    rowCount,
    dayCount: rowCount * 7,
  }
}
