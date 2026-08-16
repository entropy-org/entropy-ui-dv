import type {
  CalendarInvalidItem,
  CalendarItem,
} from "../types.js"
import { isCalendarDate } from "./date-engine.js"

function issue(
  item: CalendarItem,
  itemIndex: number,
  reason: CalendarInvalidItem["reason"],
  message: string
): CalendarInvalidItem {
  return { item, itemIndex, reason, message }
}

/** Validate consumer data without repairing or mutating it. */
export function validateCalendarItems(
  items: readonly CalendarItem[]
): CalendarInvalidItem[] {
  const issues: CalendarInvalidItem[] = []
  const seenIds = new Set<string>()

  items.forEach((item, itemIndex) => {
    const itemId = item.id
    if (typeof item.id !== "string" || item.id.trim() === "") {
      issues.push(
        issue(item, itemIndex, "empty-id", "Calendar item IDs cannot be empty.")
      )
    } else if (seenIds.has(item.id)) {
      issues.push(
        issue(
          item,
          itemIndex,
          "duplicate-id",
          `Calendar item ID "${item.id}" is duplicated.`
        )
      )
    } else {
      seenIds.add(item.id)
    }

    if (
      item.calendarId !== undefined &&
      (typeof item.calendarId !== "string" || item.calendarId.trim() === "")
    ) {
      issues.push(
        issue(
          item,
          itemIndex,
          "invalid-source-id",
          `Calendar item "${item.id}" has an empty calendarId.`
        )
      )
    }

    if (item.occurrence) {
      const occurrence = item.occurrence
      const validIdentity =
        occurrence.type === item.kind &&
        typeof occurrence.seriesId === "string" &&
        occurrence.seriesId.trim() !== "" &&
        typeof occurrence.occurrenceId === "string" &&
        occurrence.occurrenceId === item.id &&
        (occurrence.type === "all-day"
          ? isCalendarDate(occurrence.originalStartDate)
          : occurrence.originalStart instanceof Date &&
            Number.isFinite(occurrence.originalStart.getTime()))
      if (!validIdentity) {
        issues.push(
          issue(
            item,
            itemIndex,
            "invalid-occurrence",
            `Calendar occurrence "${item.id}" must match the item kind and ID and include a valid series/original start.`
          )
        )
      }
    }

    if (item.kind === "all-day") {
      if (!isCalendarDate(item.startDate)) {
        issues.push(
          issue(
            item,
            itemIndex,
            "invalid-start",
            `All-day item "${item.id}" has an invalid startDate.`
          )
        )
      }
      if (!isCalendarDate(item.endDate)) {
        issues.push(
          issue(
            item,
            itemIndex,
            "invalid-end",
            `All-day item "${item.id}" has an invalid endDate.`
          )
        )
      }
      if (
        isCalendarDate(item.startDate) &&
        isCalendarDate(item.endDate) &&
        item.endDate < item.startDate
      ) {
        issues.push(
          issue(
            item,
            itemIndex,
            "reversed-range",
            `All-day item "${item.id}" ends before it starts.`
          )
        )
      }
      return
    }

    if (item.kind === "timed") {
      const startTime =
        item.start instanceof Date ? item.start.getTime() : Number.NaN
      const endTime = item.end instanceof Date ? item.end.getTime() : Number.NaN

      if (!Number.isFinite(startTime)) {
        issues.push(
          issue(
            item,
            itemIndex,
            "invalid-start",
            `Timed item "${item.id}" has an invalid start instant.`
          )
        )
      }
      if (!Number.isFinite(endTime)) {
        issues.push(
          issue(
            item,
            itemIndex,
            "invalid-end",
            `Timed item "${item.id}" has an invalid end instant.`
          )
        )
      }
      if (Number.isFinite(startTime) && Number.isFinite(endTime)) {
        if (endTime === startTime) {
          issues.push(
            issue(
              item,
              itemIndex,
              "zero-duration",
              `Timed item "${item.id}" must have a positive duration.`
            )
          )
        } else if (endTime < startTime) {
          issues.push(
            issue(
              item,
              itemIndex,
              "reversed-range",
              `Timed item "${item.id}" ends before it starts.`
            )
          )
        }
      }
      return
    }

    issues.push(
      issue(
        item,
        itemIndex,
        "invalid-kind",
        `Calendar item "${itemId}" must be "all-day" or "timed".`
      )
    )
  })

  return issues
}
