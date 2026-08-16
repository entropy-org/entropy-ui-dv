"use client"

import { useCallback, useMemo, type ReactNode } from "react"
import { CalendarDays, Columns3, List, SquareStack } from "lucide-react"
import {
  DataListProvider,
  DataListSurface,
  type DataListAnyProperty,
  type DataListConfig,
  type DataListItem,
  type DataListSelectionDescriptor,
  type DataListStatus,
} from "../components/list/index.js"
import {
  KanbanProvider,
  KanbanSurface,
  type KanbanCard,
  type KanbanCommand,
  type KanbanConfig,
  type KanbanDataState,
  type KanbanGroup,
  type KanbanSwimlane,
} from "../components/kanban/index.js"
import {
  CalendarProvider,
  CalendarSurface,
  createDefaultCalendarPreferences,
  type CalendarConfig,
  type CalendarItem,
  type CalendarMutationIntent,
  type CalendarPreferences,
  type CalendarRange,
} from "../components/calendar/index.js"
import {
  TimelineProvider,
  TimelineSurface,
  type TimelineConfig,
  type TimelineDataState,
  type TimelineItem,
  type TimelineMutationIntent,
} from "../components/timeline/index.js"
import { applyDataViewQuery, formatDataViewValue } from "./query.js"
import { createDataViewPlugin } from "./view-registry.js"
import type {
  DataViewCalendarDefinition,
  DataViewIntent,
  DataViewKanbanDefinition,
  DataViewListDefinition,
  DataViewPlugin,
  DataViewProperty,
  DataViewRendererContext,
  DataViewTimelineDefinition,
  SavedDataView,
} from "./types.js"

export interface BuiltInDataViewRecordRenderContext<TRecord> {
  readonly record: TRecord
  readonly view: SavedDataView
  readonly surface: "list-title" | "kanban-card" | "calendar-item" | "timeline-bar" | "timeline-sidebar"
}

export interface BuiltInDataViewPropertyRenderContext<TRecord> {
  readonly record: TRecord
  readonly property: DataViewProperty<TRecord>
  readonly value: unknown
  readonly view: SavedDataView
}

export interface BuiltInDataViewPluginOptions<TRecord> {
  readonly renderRecord?: (
    context: BuiltInDataViewRecordRenderContext<TRecord>
  ) => ReactNode
  readonly renderProperty?: (
    context: BuiltInDataViewPropertyRenderContext<TRecord>
  ) => ReactNode
  readonly calendarTimeZone?: string
}

function getRecords<TRecord>(context: DataViewRendererContext<TRecord>) {
  return context.source.mode === "client"
    ? applyDataViewQuery(context.source.records, context.view.query, context.schema)
    : context.source.records
}

function getProperty<TRecord>(
  context: DataViewRendererContext<TRecord>,
  propertyId: string | undefined
) {
  if (!propertyId) return undefined
  return context.schema.properties.find((property) => property.id === propertyId)
}

function renderProperty<TRecord>(
  options: BuiltInDataViewPluginOptions<TRecord>,
  context: DataViewRendererContext<TRecord>,
  record: TRecord,
  property: DataViewProperty<TRecord>
) {
  const value = property.getValue(record)
  const rendered = options.renderProperty?.({
    record,
    property,
    value,
    view: context.view,
  })
  if (rendered !== undefined) return rendered
  if (property.type === "custom" && property.renderValue) {
    return property.renderValue(record, value)
  }
  return formatDataViewValue(value)
}

function renderRecord<TRecord>(
  options: BuiltInDataViewPluginOptions<TRecord>,
  context: DataViewRendererContext<TRecord>,
  record: TRecord,
  surface: BuiltInDataViewRecordRenderContext<TRecord>["surface"]
) {
  return (
    options.renderRecord?.({ record, view: context.view, surface }) ??
    context.schema.adapter.getLabel(record)
  )
}

function toDataListStatus<TRecord>(
  context: DataViewRendererContext<TRecord>
): DataListStatus | undefined {
  const status = context.source.status
  if (!status || status.status === "idle" || status.status === "ready") {
    return undefined
  }
  if (status.status === "loading") {
    return { state: "loading", phase: "initial", message: status.message }
  }
  return {
    state: "error",
    phase: status.hasStaleData ? "refresh" : "initial",
    error: status.error instanceof Error ? status.error : String(status.error),
    onRetry: context.source.mode === "server" ? context.source.onRetry : undefined,
  }
}

function recordsFromListSelection<TRecord>(
  selection: DataListSelectionDescriptor,
  records: readonly TRecord[],
  getId: (record: TRecord) => string
) {
  if (selection.kind === "explicit") {
    const ids = new Set(selection.ids)
    return records.filter((record) => ids.has(getId(record)))
  }
  const excluded = new Set(selection.excludedIds)
  return records.filter((record) => !excluded.has(getId(record)))
}

function BuiltInListView<TRecord>({
  context,
  options,
}: {
  readonly context: DataViewRendererContext<TRecord>
  readonly options: BuiltInDataViewPluginOptions<TRecord>
}) {
  const definition = context.view.definition as DataViewListDefinition
  const records = getRecords(context)
  const items = useMemo<readonly DataListItem<TRecord>[]>(
    () =>
      records.map((record) => ({
        id: context.schema.adapter.getId(record),
        rank: context.schema.adapter.getRank?.(record) ?? undefined,
        parentId: context.schema.adapter.getParentId?.(record) ?? undefined,
        data: record,
      })),
    [context.schema.adapter, records]
  )
  const visibleIds = definition.visiblePropertyIds
  const properties = useMemo<readonly DataListAnyProperty<TRecord>[]>(
    () =>
      context.schema.properties
        .filter(
          (property) =>
            property.type !== "title" &&
            !property.hidden &&
            (!visibleIds || visibleIds.includes(property.id))
        )
        .map((property) => ({
          id: property.id,
          label: property.label,
          accessor: (record: TRecord) => property.getValue(record),
          render: ({ item, value }) =>
            options.renderProperty?.({
              record: item.data,
              property,
              value,
              view: context.view,
            }) ?? renderProperty(options, context, item.data, property),
          capabilities: {
            searchable: true,
            sortable: true,
            filterable: true,
            editable: !property.readOnly && !context.readOnly,
          },
        })),
    [context, options, visibleIds]
  )
  const groupingProperty = getProperty(context, definition.groupByPropertyId)
  const config = useMemo<DataListConfig<TRecord>>(
    () => ({
      items,
      properties,
      renderTitle: ({ item }) =>
        renderRecord(options, context, item.data, "list-title"),
      getItemLabel: (item) => context.schema.adapter.getLabel(item.data),
      grouping: groupingProperty
        ? {
            mode: "derived",
            getKey: (item) =>
              formatDataViewValue(groupingProperty.getValue(item.data)),
            getLabel: (key) => key,
          }
        : { mode: "none" },
      hierarchy: context.schema.adapter.getParentId
        ? { mode: "nested", defaultExpanded: true }
        : { mode: "disabled" },
      selection: {
        mode: "multiple",
        value: {
          kind: "explicit",
          ids: [...context.selectedRecordIds],
        },
        onChange: ({ selection }) => {
          const selected = recordsFromListSelection(
            selection,
            records,
            context.schema.adapter.getId
          )
          context.setSelectedRecordIds(
            new Set(selected.map(context.schema.adapter.getId))
          )
        },
      },
      preferences: {
        density: definition.density,
        visiblePropertyIds: definition.visiblePropertyIds,
      },
      status: toDataListStatus(context),
      readOnly: context.readOnly,
      operations: {
        mode: "client",
        getSearchText: (item) =>
          context.schema.adapter.getSearchText?.(item.data) ??
          context.schema.adapter.getLabel(item.data),
      },
      onActivate: (item) =>
        context.emitIntent({
          type: "edit-record",
          view: context.view,
          record: item.data,
        }),
      onEdit: (command) => {
        const item = items.find((candidate) => candidate.id === command.itemId)
        if (item) {
          context.emitIntent({
            type: "update-property",
            view: context.view,
            record: item.data,
            propertyId: command.propertyId,
            value: command.proposedValue,
          })
        }
        return { status: "accepted" }
      },
      onDelete: (command) => {
        context.emitIntent({
          type: "delete-records",
          view: context.view,
          records: recordsFromListSelection(
            command.selection,
            records,
            context.schema.adapter.getId
          ),
        })
        return { status: "accepted" }
      },
    }),
    [context, definition, groupingProperty, items, options, properties, records]
  )
  return (
    <DataListProvider config={config}>
      <DataListSurface showColumnHeaders={definition.showColumnHeaders} className="h-full rounded-none border-0" />
    </DataListProvider>
  )
}

function getGroupId(value: unknown) {
  if (value === null || value === undefined || value === "") return "__ungrouped__"
  return String(value)
}

function getOptionLabel<TRecord>(
  property: DataViewProperty<TRecord> | undefined,
  id: string
) {
  if (property?.type === "select" || property?.type === "multi-select") {
    return property.options.find((option) => option.id === id)?.label ?? id
  }
  return id === "__ungrouped__" ? "No value" : id
}

function toKanbanDataState<TRecord>(
  context: DataViewRendererContext<TRecord>
): KanbanDataState | undefined {
  const status = context.source.status
  if (!status || status.status === "idle") return undefined
  if (status.status === "loading") return { status: "loading" }
  if (status.status === "ready") {
    return { status: "ready", isRefetching: status.isFetching }
  }
  return {
    status: "error",
    error: status.error,
    hasData: status.hasStaleData,
  }
}

function BuiltInKanbanView<TRecord>({
  context,
  options,
}: {
  readonly context: DataViewRendererContext<TRecord>
  readonly options: BuiltInDataViewPluginOptions<TRecord>
}) {
  const definition = context.view.definition as DataViewKanbanDefinition
  const records = getRecords(context)
  const groupProperty = getProperty(context, definition.groupByPropertyId)
  const swimlaneProperty = getProperty(context, definition.swimlaneByPropertyId)
  const recordById = useMemo(
    () =>
      new Map(records.map((record) => [context.schema.adapter.getId(record), record])),
    [context.schema.adapter, records]
  )
  const groupIds = useMemo(
    () => [
      ...new Set(records.map((record) => getGroupId(groupProperty?.getValue(record)))),
    ],
    [groupProperty, records]
  )
  const swimlaneIds = useMemo(
    () =>
      swimlaneProperty
        ? [
            ...new Set(
              records.map((record) =>
                getGroupId(swimlaneProperty.getValue(record))
              )
            ),
          ]
        : [],
    [records, swimlaneProperty]
  )
  const groups = useMemo<readonly KanbanGroup[]>(
    () =>
      groupIds.map((id, index) => ({
        id,
        rank: String(index).padStart(8, "0"),
        data: { label: getOptionLabel(groupProperty, id) },
      })),
    [groupIds, groupProperty]
  )
  const swimlanes = useMemo<readonly KanbanSwimlane[]>(
    () =>
      swimlaneIds.map((id, index) => ({
        id,
        rank: String(index).padStart(8, "0"),
        data: { label: getOptionLabel(swimlaneProperty, id) },
      })),
    [swimlaneIds, swimlaneProperty]
  )
  const cards = useMemo<readonly KanbanCard[]>(
    () =>
      records.map((record, index) => ({
        id: context.schema.adapter.getId(record),
        groupId: getGroupId(groupProperty?.getValue(record)),
        swimlaneId: swimlaneProperty
          ? getGroupId(swimlaneProperty.getValue(record))
          : undefined,
        rank: context.schema.adapter.getRank?.(record) ?? String(index).padStart(8, "0"),
        data: record,
      })),
    [context.schema.adapter, groupProperty, records, swimlaneProperty]
  )
  const visibleProperties = context.schema.properties.filter(
    (property) =>
      !property.hidden &&
      property.type !== "title" &&
      (definition.visiblePropertyIds?.includes(property.id) ?? false)
  )
  const handleCommand = useCallback((command: KanbanCommand) => {
    if (command.type === "move-cards") {
      for (const id of command.cardIds) {
        const record = recordById.get(id)
        if (!record) continue
        context.emitIntent({
          type: "update-property",
          view: context.view,
          record,
          propertyId: definition.groupByPropertyId,
          value: command.destination.groupId,
        })
        if (definition.swimlaneByPropertyId) {
          context.emitIntent({
            type: "update-property",
            view: context.view,
            record,
            propertyId: definition.swimlaneByPropertyId,
            value: command.destination.swimlaneId ?? null,
          })
        }
      }
      return { status: "accepted" as const }
    }
    if (command.type === "delete-cards") {
      context.emitIntent({
        type: "delete-records",
        view: context.view,
        records: command.cardIds
          .map((id) => recordById.get(id))
          .filter((record): record is TRecord => record !== undefined),
      })
      return { status: "accepted" as const }
    }
    return {
      status: "rejected" as const,
      code: "validation" as const,
      message: "This generic adapter does not persist group ordering or duplication.",
    }
  }, [context, definition, recordById])
  const config = useMemo<KanbanConfig>(
    () => ({
      cards,
      groups,
      swimlanes: swimlaneProperty ? swimlanes : undefined,
      readOnly: context.readOnly,
      selection: { mode: "multiple" },
      preferences: { density: definition.cardSize },
      dataState: toKanbanDataState(context),
      getCardLabel: (card) =>
        context.schema.adapter.getLabel(card.data as TRecord),
      getGroupLabel: (group) =>
        (group.data as { readonly label: string }).label,
      getSwimlaneLabel: (swimlane) =>
        (swimlane.data as { readonly label: string }).label,
      getSearchText: (card) =>
        context.schema.adapter.getSearchText?.(card.data as TRecord) ??
        context.schema.adapter.getLabel(card.data as TRecord),
      renderCard: (card) => {
        const record = card.data as TRecord
        return (
          <div className="grid gap-2">
            <div className="font-medium">
              {renderRecord(options, context, record, "kanban-card")}
            </div>
            {visibleProperties.map((property) => (
              <div key={property.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-20 shrink-0 truncate">{property.label}</span>
                <span className="min-w-0 text-foreground">
                  {renderProperty(options, context, record, property)}
                </span>
              </div>
            ))}
          </div>
        )
      },
      onCardOpen: (card) =>
        context.emitIntent({
          type: "edit-record",
          view: context.view,
          record: card.data as TRecord,
        }),
      onAddCard: ({ groupId, swimlaneId }) =>
        context.emitIntent({
          type: "create-record",
          view: context.view,
          initialValues: {
            [definition.groupByPropertyId]: groupId,
            ...(definition.swimlaneByPropertyId
              ? { [definition.swimlaneByPropertyId]: swimlaneId ?? null }
              : {}),
          },
        }),
      onCommand: context.readOnly ? undefined : handleCommand,
      onRetryData: context.source.mode === "server" ? context.source.onRetry : undefined,
      onLoadMore:
        context.source.mode === "server" && context.source.onLoadMore
          ? () => {
              if (context.source.mode === "server") {
                return context.source.onLoadMore?.()
              }
            }
          : undefined,
    }),
    [
      cards,
      context,
      definition,
      groups,
      handleCommand,
      options,
      swimlaneProperty,
      swimlanes,
      visibleProperties,
    ]
  )
  return (
    <KanbanProvider config={config}>
      <KanbanSurface className="h-full min-h-0" />
    </KanbanProvider>
  )
}

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function asDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null
}

function getRangeValues(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    "end" in value
  ) {
    return { start: value.start, end: value.end }
  }
  return null
}

function toCalendarItem<TRecord>(
  record: TRecord,
  context: DataViewRendererContext<TRecord>,
  definition: DataViewCalendarDefinition
): CalendarItem | null {
  const startProperty = getProperty(context, definition.datePropertyId)
  const endProperty = getProperty(context, definition.endDatePropertyId)
  const startValue = startProperty?.getValue(record)
  const range = getRangeValues(startValue)
  const resolvedStart = range?.start ?? startValue
  const resolvedEnd = range?.end ?? endProperty?.getValue(record)
  const id = context.schema.adapter.getId(record)
  const dateOnlyStart = asDateOnly(resolvedStart)
  if (dateOnlyStart) {
    return {
      id,
      kind: "all-day",
      startDate: dateOnlyStart,
      endDate: asDateOnly(resolvedEnd) ?? dateOnlyStart,
      data: record,
    }
  }
  const start = asDate(resolvedStart)
  if (!start) return null
  return {
    id,
    kind: "timed",
    start,
    end: asDate(resolvedEnd) ?? new Date(start.getTime() + 60 * 60 * 1000),
    data: record,
  }
}

function rangeToValues(range: CalendarRange) {
  return range.kind === "all-day"
    ? { start: range.startDate, end: range.endDate }
    : { start: range.start, end: range.end }
}

function updateCalendarRange<TRecord>(
  context: DataViewRendererContext<TRecord>,
  definition: DataViewCalendarDefinition,
  record: TRecord,
  range: CalendarRange
) {
  const values = rangeToValues(range)
  const startProperty = getProperty(context, definition.datePropertyId)
  if (startProperty?.type === "date-range") {
    context.emitIntent({
      type: "update-property",
      view: context.view,
      record,
      propertyId: definition.datePropertyId,
      value: values,
    })
    return
  }
  context.emitIntent({
    type: "update-property",
    view: context.view,
    record,
    propertyId: definition.datePropertyId,
    value: values.start,
  })
  if (definition.endDatePropertyId) {
    context.emitIntent({
      type: "update-property",
      view: context.view,
      record,
      propertyId: definition.endDatePropertyId,
      value: values.end,
    })
  }
}

function BuiltInCalendarView<TRecord>({
  context,
  options,
}: {
  readonly context: DataViewRendererContext<TRecord>
  readonly options: BuiltInDataViewPluginOptions<TRecord>
}) {
  const definition = context.view.definition as DataViewCalendarDefinition
  const records = getRecords(context)
  const recordById = useMemo(
    () =>
      new Map(records.map((record) => [context.schema.adapter.getId(record), record])),
    [context.schema.adapter, records]
  )
  const items = useMemo(
    () =>
      records
        .map((record) => toCalendarItem(record, context, definition))
        .filter((item): item is CalendarItem => item !== null),
    [context, definition, records]
  )
  const preferences = useMemo<CalendarPreferences>(() => {
    const defaults = createDefaultCalendarPreferences(
      definition.timeZone ?? options.calendarTimeZone
    )
    return {
      ...defaults,
      viewMode: definition.mode ?? defaults.viewMode,
      weekStartsOn: definition.weekStartsOn ?? defaults.weekStartsOn,
      showWeekends: definition.showWeekends ?? defaults.showWeekends,
      density: definition.density ?? defaults.density,
      timeFormat: definition.timeFormat ?? defaults.timeFormat,
    }
  }, [definition, options.calendarTimeZone])
  const updateDefinition = useCallback(
    (next: CalendarPreferences) =>
      context.updateView(
        {
          ...context.view,
          definition: {
            ...definition,
            mode: next.viewMode,
            weekStartsOn: next.weekStartsOn,
            showWeekends: next.showWeekends,
            density: next.density,
            timeZone: next.timeZone,
            timeFormat: next.timeFormat,
          },
        },
        { type: "configuration", viewId: context.view.id }
      ),
    [context, definition]
  )
  const handleMutation = useCallback((intent: CalendarMutationIntent) => {
    if (intent.type === "create") {
      const values = rangeToValues(intent.range)
      context.emitIntent({
        type: "create-record",
        view: context.view,
        initialValues: {
          [definition.datePropertyId]: values.start,
          ...(definition.endDatePropertyId
            ? { [definition.endDatePropertyId]: values.end }
            : {}),
        },
      })
      return { status: "accepted" as const }
    }
    if (intent.type === "update") {
      const record = recordById.get(intent.nextItem.id)
      if (record) {
        updateCalendarRange(
          context,
          definition,
          record,
          intent.nextItem.kind === "all-day"
            ? {
                kind: "all-day",
                startDate: intent.nextItem.startDate,
                endDate: intent.nextItem.endDate,
              }
            : { kind: "timed", start: intent.nextItem.start, end: intent.nextItem.end }
        )
      }
      return { status: "accepted" as const }
    }
    if (intent.type === "command") {
      const command = intent.command
      if (command.type === "delete") {
        context.emitIntent({
          type: "delete-records",
          view: context.view,
          records: command.itemIds
            .map((id) => recordById.get(id))
            .filter((record): record is TRecord => record !== undefined),
        })
      } else if (command.type === "move") {
        for (const change of command.changes) {
          const record = recordById.get(change.itemId)
          if (record) updateCalendarRange(context, definition, record, change.nextRange)
        }
      } else if (command.type === "resize") {
        const record = recordById.get(command.itemId)
        if (record) updateCalendarRange(context, definition, record, command.nextRange)
      }
      return { status: "accepted" as const }
    }
    return { status: "rejected" as const, message: "Mutation is not supported by the generic adapter." }
  }, [context, definition, recordById])
  const config = useMemo<CalendarConfig>(
    () => ({
      items,
      preferences,
      readOnly: context.readOnly,
      selection: { mode: "multiple" },
      renderItem: (item) =>
        renderRecord(options, context, item.data as TRecord, "calendar-item"),
      getSearchText: (item) =>
        context.schema.adapter.getSearchText?.(item.data as TRecord) ??
        context.schema.adapter.getLabel(item.data as TRecord),
      getItemAriaLabel: (item) =>
        context.schema.adapter.getLabel(item.data as TRecord),
      onItemClick: (item) =>
        context.emitIntent({
          type: "edit-record",
          view: context.view,
          record: item.data as TRecord,
        }),
      onMutationIntent: context.readOnly ? undefined : handleMutation,
      onItemCreate: context.readOnly
        ? undefined
        : (range) => {
            const values = rangeToValues(range)
            context.emitIntent({
              type: "create-record",
              view: context.view,
              initialValues: {
                [definition.datePropertyId]: values.start,
                ...(definition.endDatePropertyId
                  ? { [definition.endDatePropertyId]: values.end }
                  : {}),
              },
            })
          },
      onPreferencesChange: updateDefinition,
    }),
    [
      context,
      definition,
      handleMutation,
      items,
      options,
      preferences,
      updateDefinition,
    ]
  )
  return (
    <CalendarProvider config={config}>
      <CalendarSurface className="h-full min-h-0" />
    </CalendarProvider>
  )
}

function toTimelineDataState<TRecord>(
  context: DataViewRendererContext<TRecord>
): TimelineDataState | undefined {
  const status = context.source.status
  if (!status || status.status === "idle") return undefined
  if (status.status === "loading") {
    return { status: "loading", message: status.message }
  }
  if (status.status === "ready") {
    return {
      status: "ready",
      isFetching: status.isFetching,
      hasNextPage:
        context.source.mode === "server"
          ? context.source.pageInfo.hasNextPage
          : false,
    }
  }
  return {
    status: "error",
    error: status.error,
    hasStaleData: status.hasStaleData,
  }
}

function BuiltInTimelineView<TRecord>({
  context,
  options,
}: {
  readonly context: DataViewRendererContext<TRecord>
  readonly options: BuiltInDataViewPluginOptions<TRecord>
}) {
  const definition = context.view.definition as DataViewTimelineDefinition
  const loadMore =
    context.source.mode === "server" ? context.source.onLoadMore : undefined
  const records = getRecords(context)
  const startProperty = getProperty(context, definition.startDatePropertyId)
  const endProperty = getProperty(context, definition.endDatePropertyId)
  const parentProperty = getProperty(context, definition.parentPropertyId)
  const recordById = useMemo(
    () =>
      new Map(records.map((record) => [context.schema.adapter.getId(record), record])),
    [context.schema.adapter, records]
  )
  const items = useMemo<TimelineItem[]>(
    () =>
      records.flatMap((record) => {
        const startDate = asDate(startProperty?.getValue(record))
        const endDate = asDate(endProperty?.getValue(record))
        if (!startDate || !endDate || endDate <= startDate) return []
        return [
          {
            id: context.schema.adapter.getId(record),
            startDate,
            endDate,
            parentId:
              (parentProperty
                ? getGroupId(parentProperty.getValue(record))
                : context.schema.adapter.getParentId?.(record)) ?? undefined,
            data: record,
          },
        ]
      }),
    [context.schema.adapter, endProperty, parentProperty, records, startProperty]
  )
  const updateDates = useCallback((record: TRecord, startDate: Date, endDate: Date) => {
    context.emitIntent({
      type: "update-property",
      view: context.view,
      record,
      propertyId: definition.startDatePropertyId,
      value: startDate,
    })
    context.emitIntent({
      type: "update-property",
      view: context.view,
      record,
      propertyId: definition.endDatePropertyId,
      value: endDate,
    })
  }, [context, definition])
  const handleMutation = useCallback((intent: TimelineMutationIntent) => {
    if (intent.type === "create") {
      context.emitIntent({
        type: "create-record",
        view: context.view,
        initialValues: {
          [definition.startDatePropertyId]: intent.requestedRange.startDate,
          [definition.endDatePropertyId]: intent.requestedRange.endDate,
        },
      })
      return { status: "accepted" as const }
    }
    if (intent.type === "delete") {
      context.emitIntent({
        type: "delete-records",
        view: context.view,
        records: intent.itemIds
          .map((id) => recordById.get(id))
          .filter((record): record is TRecord => record !== undefined),
      })
      return { status: "accepted" as const }
    }
    if (intent.type === "move") {
      for (const change of intent.changes) {
        const record = recordById.get(change.itemId)
        if (record) updateDates(record, change.startDate, change.endDate)
      }
      return { status: "accepted" as const }
    }
    if (intent.type === "resize") {
      const record = recordById.get(intent.itemId)
      if (record) updateDates(record, intent.startDate, intent.endDate)
      return { status: "accepted" as const }
    }
    if (intent.type === "update") {
      const record = recordById.get(intent.itemId)
      if (record) {
        updateDates(
          record,
          intent.changes.startDate ?? intent.previousItem.startDate,
          intent.changes.endDate ?? intent.previousItem.endDate
        )
      }
      return { status: "accepted" as const }
    }
    if (intent.type === "hierarchy" && definition.parentPropertyId) {
      const record = recordById.get(intent.itemId)
      if (record) {
        context.emitIntent({
          type: "update-property",
          view: context.view,
          record,
          propertyId: definition.parentPropertyId,
          value: intent.parentId ?? null,
        })
      }
      return { status: "accepted" as const }
    }
    return { status: "rejected" as const, reason: "Mutation is not supported by the generic adapter." }
  }, [context, definition, recordById, updateDates])
  const config = useMemo<TimelineConfig>(
    () => ({
      items,
      viewportMode: definition.zoom,
      readOnly: context.readOnly,
      sidebar: true,
      subItems: parentProperty || context.schema.adapter.getParentId ? "nested" : "disabled",
      dataState: toTimelineDataState(context),
      renderBar: (item) =>
        renderRecord(options, context, item.data as TRecord, "timeline-bar"),
      renderSidebarItem: (item) =>
        renderRecord(options, context, item.data as TRecord, "timeline-sidebar"),
      getSearchText: (item) =>
        context.schema.adapter.getSearchText?.(item.data as TRecord) ??
        context.schema.adapter.getLabel(item.data as TRecord),
      getItemAriaLabel: (item) =>
        context.schema.adapter.getLabel(item.data as TRecord),
      onMutation: context.readOnly ? undefined : handleMutation,
      onItemAdd: context.readOnly
        ? undefined
        : (startDate, endDate) =>
            context.emitIntent({
              type: "create-record",
              view: context.view,
              initialValues: {
                [definition.startDatePropertyId]: startDate,
                [definition.endDatePropertyId]: endDate,
              },
            }),
      onItemDoubleClick: (item) =>
        context.emitIntent({
          type: "edit-record",
          view: context.view,
          record: item.data as TRecord,
        }),
      onViewportModeChange: (zoom) =>
        context.updateView(
          {
            ...context.view,
            definition: { ...definition, zoom },
          },
          { type: "configuration", viewId: context.view.id }
        ),
      onLoadMore:
        loadMore
          ? ({ direction }) => {
              if (direction === "next") loadMore()
            }
          : undefined,
      onRetry: context.source.mode === "server" ? context.source.onRetry : undefined,
    }),
    [
      context,
      definition,
      handleMutation,
      items,
      loadMore,
      options,
      parentProperty,
    ]
  )
  return (
    <TimelineProvider config={config}>
      <TimelineSurface className="h-full min-h-0" />
    </TimelineProvider>
  )
}

/** Creates the four first-party renderers for a generic record schema. */
export function createBuiltInDataViewPlugins<TRecord>(
  options: BuiltInDataViewPluginOptions<TRecord> = {}
): readonly DataViewPlugin<TRecord>[] {
  return [
    createDataViewPlugin({
      id: "list",
      label: "List",
      icon: <List />,
      render: (context) => <BuiltInListView context={context} options={options} />,
    }),
    createDataViewPlugin({
      id: "kanban",
      label: "Kanban",
      icon: <Columns3 />,
      render: (context) => <BuiltInKanbanView context={context} options={options} />,
    }),
    createDataViewPlugin({
      id: "calendar",
      label: "Calendar",
      icon: <CalendarDays />,
      render: (context) => <BuiltInCalendarView context={context} options={options} />,
    }),
    createDataViewPlugin({
      id: "timeline",
      label: "Timeline",
      icon: <SquareStack />,
      render: (context) => <BuiltInTimelineView context={context} options={options} />,
    }),
  ]
}

export function isBuiltInDataViewIntent<TRecord>(
  intent: DataViewIntent<TRecord>
): intent is DataViewIntent<TRecord> {
  return (
    intent.type === "create-record" ||
    intent.type === "edit-record" ||
    intent.type === "delete-records" ||
    intent.type === "update-property"
  )
}
