import type { CalendarDate } from "../types.js"

export interface CalendarColumnPosition {
  readonly leftPercent: number
  readonly widthPercent: number
}

export function getColumnIndexAtX(
  clientX: number,
  containerLeft: number,
  containerWidth: number,
  columnCount: number
): number {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(containerLeft) ||
    !Number.isFinite(containerWidth) ||
    containerWidth <= 0 ||
    !Number.isInteger(columnCount) ||
    columnCount <= 0
  ) {
    return -1
  }
  const relative = Math.max(clientX - containerLeft, 0)
  return Math.min(
    columnCount - 1,
    Math.floor((relative / containerWidth) * columnCount)
  )
}

export function getColumnSpanPosition(
  startColumn: number,
  endColumn: number,
  columnCount: number
): CalendarColumnPosition | null {
  if (
    !Number.isInteger(startColumn) ||
    !Number.isInteger(endColumn) ||
    !Number.isInteger(columnCount) ||
    columnCount <= 0 ||
    startColumn < 0 ||
    endColumn < startColumn ||
    endColumn >= columnCount
  ) {
    return null
  }
  return {
    leftPercent: (startColumn / columnCount) * 100,
    widthPercent: ((endColumn - startColumn + 1) / columnCount) * 100,
  }
}

export function getDateAtX(
  visibleDates: readonly CalendarDate[],
  clientX: number,
  containerLeft: number,
  containerWidth: number
): CalendarDate | null {
  const index = getColumnIndexAtX(
    clientX,
    containerLeft,
    containerWidth,
    visibleDates.length
  )
  return index === -1 ? null : visibleDates[index]
}
