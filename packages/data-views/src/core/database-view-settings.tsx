"use client"

import React, { type ReactNode } from "react"
import { Settings2 } from "lucide-react"
import { Button } from "../components/ui/button.js"
import { Checkbox } from "../components/ui/checkbox.js"
import { Label } from "../components/ui/label.js"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../components/ui/popover.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select.js"
import { Switch } from "../components/ui/switch.js"
import { cn } from "../lib/utils.js"
import type {
  DataViewDefinition,
  DataViewProperty,
  DataViewSettingId,
  DataViewSettings,
  SavedDataView,
} from "./types.js"

const NONE = "__edv_none__"

const DENSITY_LABELS = {
  compact: "Compact",
  default: "Default",
  comfortable: "Comfortable",
} as const

const COLUMN_WIDTH_LABELS = {
  240: "Narrow",
  280: "Default",
  320: "Wide",
  360: "Wider",
} as const

const WEEK_START_LABELS = {
  0: "Sunday",
  1: "Monday",
} as const

const TIME_FORMAT_LABELS = {
  "12h": "12 hour",
  "24h": "24 hour",
} as const

const HIERARCHY_LABELS = {
  disabled: "Parents",
  flattened: "Flat",
  nested: "Nested",
} as const

interface SettingRowProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly label: string
  readonly description?: string
  readonly control: ReactNode
}

const SettingRow = React.memo(
  React.forwardRef<HTMLDivElement, SettingRowProps>(function SettingRow(
    { label, description, control, className, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn("flex min-h-10 items-center gap-3 py-1", className)}
        {...props}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{label}</p>
          {description ? (
            <p className="text-[10px] leading-4 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {control}
      </div>
    )
  })
)

interface SettingsSectionProps extends React.ComponentPropsWithoutRef<"section"> {
  readonly title: string
}

const SettingsSection = React.memo(
  React.forwardRef<HTMLElement, SettingsSectionProps>(function SettingsSection(
    { title, className, children, ...props },
    ref
  ) {
    return (
      <section ref={ref} className={cn("space-y-1", className)} {...props}>
        <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {title}
        </h3>
        {children}
      </section>
    )
  })
)

function supportsGrouping<TRecord>(property: DataViewProperty<TRecord>) {
  return property.type !== "title" && property.type !== "custom"
}

function getPropertyLabel<TRecord>(
  properties: readonly DataViewProperty<TRecord>[],
  propertyId: string | undefined
) {
  if (!propertyId) return "None"
  return (
    properties.find((property) => property.id === propertyId)?.label ??
    "Unknown property"
  )
}

export interface DatabaseViewSettingsProps<TRecord>
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly view: SavedDataView
  readonly properties: readonly DataViewProperty<TRecord>[]
  readonly settings?: Exclude<DataViewSettings, false>
  readonly onViewChange: (view: SavedDataView) => void
  readonly onDuplicateView?: (view: SavedDataView) => void
  readonly onDeleteView?: (view: SavedDataView) => void
}

function DatabaseViewSettingsInner<TRecord>(
  {
    view,
    properties,
    settings,
    onViewChange,
    onDuplicateView,
    onDeleteView,
    className,
    ...props
  }: DatabaseViewSettingsProps<TRecord>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const hidden = new Set<DataViewSettingId>(settings?.hidden ?? [])
  const definition = view.definition
  const visibleProperties = properties.filter(
    (property) => property.type !== "title" && !property.hidden
  )
  const groupingProperties = properties.filter(supportsGrouping)
  const isVisible = (setting: DataViewSettingId) => !hidden.has(setting)
  const updateDefinition = (nextDefinition: DataViewDefinition) =>
    onViewChange({ ...view, definition: nextDefinition })

  const propertyControls =
    (definition.type === "list" || definition.type === "kanban") &&
    isVisible("visible-properties") &&
    visibleProperties.length > 0 ? (
      <SettingsSection title="Properties">
        <div className="grid gap-0.5">
          {visibleProperties.map((property) => {
            const selected =
              definition.visiblePropertyIds === undefined ||
              definition.visiblePropertyIds.includes(property.id)
            return (
              <Label
                key={property.id}
                className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1.5 text-xs font-normal hover:bg-muted/60"
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => {
                    const current = new Set(
                      definition.visiblePropertyIds ??
                        visibleProperties.map((candidate) => candidate.id)
                    )
                    if (checked) current.add(property.id)
                    else current.delete(property.id)
                    updateDefinition({
                      ...definition,
                      visiblePropertyIds: [...current],
                    })
                  }}
                />
                <span className="truncate">{property.label}</span>
              </Label>
            )
          })}
        </div>
      </SettingsSection>
    ) : null

  const listControls =
    definition.type === "list" ? (
      <SettingsSection title="List">
        {isVisible("density") ? (
          <SettingRow
            label="Density"
            control={
              <Select
                value={definition.density ?? "default"}
                onValueChange={(density) =>
                  density &&
                  updateDefinition({
                    ...definition,
                    density: density as "compact" | "default" | "comfortable",
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {DENSITY_LABELS[definition.density ?? "default"]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("column-headers") ? (
          <SettingRow
            label="Column labels"
            control={
              <Switch
                checked={definition.showColumnHeaders ?? true}
                onCheckedChange={(showColumnHeaders) =>
                  updateDefinition({ ...definition, showColumnHeaders })
                }
              />
            }
          />
        ) : null}
        {isVisible("grouping") && groupingProperties.length > 0 ? (
          <SettingRow
            label="Group by"
            control={
              <Select
                value={definition.groupByPropertyId ?? NONE}
                onValueChange={(value) =>
                  value &&
                  updateDefinition({
                    ...definition,
                    groupByPropertyId: value === NONE ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue>
                    {getPropertyLabel(
                      groupingProperties,
                      definition.groupByPropertyId
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value={NONE}>None</SelectItem>
                  {groupingProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        ) : null}
      </SettingsSection>
    ) : null

  const kanbanControls =
    definition.type === "kanban" ? (
      <SettingsSection title="Board">
        {isVisible("grouping") && groupingProperties.length > 0 ? (
          <SettingRow
            label="Group by"
            control={
              <Select
                value={definition.groupByPropertyId}
                onValueChange={(groupByPropertyId) =>
                  groupByPropertyId &&
                  updateDefinition({ ...definition, groupByPropertyId })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue>
                    {getPropertyLabel(
                      groupingProperties,
                      definition.groupByPropertyId
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {groupingProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("swimlanes") && groupingProperties.length > 0 ? (
          <SettingRow
            label="Swimlanes"
            control={
              <Select
                value={definition.swimlaneByPropertyId ?? NONE}
                onValueChange={(value) =>
                  value &&
                  updateDefinition({
                    ...definition,
                    swimlaneByPropertyId: value === NONE ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue>
                    {getPropertyLabel(
                      groupingProperties,
                      definition.swimlaneByPropertyId
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value={NONE}>None</SelectItem>
                  {groupingProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("density") ? (
          <SettingRow
            label="Card size"
            control={
              <Select
                value={definition.cardSize ?? "compact"}
                onValueChange={(cardSize) =>
                  cardSize &&
                  updateDefinition({
                    ...definition,
                    cardSize: cardSize as "compact" | "comfortable",
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {DENSITY_LABELS[definition.cardSize ?? "compact"]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("column-width") ? (
          <SettingRow
            label="Column width"
            control={
              <Select
                value={String(definition.columnWidth ?? 280)}
                onValueChange={(value) =>
                  value &&
                  updateDefinition({ ...definition, columnWidth: Number(value) })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {
                      COLUMN_WIDTH_LABELS[
                        (definition.columnWidth ??
                          280) as keyof typeof COLUMN_WIDTH_LABELS
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="240">Narrow</SelectItem>
                  <SelectItem value="280">Default</SelectItem>
                  <SelectItem value="320">Wide</SelectItem>
                  <SelectItem value="360">Wider</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("wip-limits") ? (
          <SettingRow
            label="WIP limits"
            control={
              <Switch
                checked={definition.showWipLimits ?? true}
                onCheckedChange={(showWipLimits) =>
                  updateDefinition({ ...definition, showWipLimits })
                }
              />
            }
          />
        ) : null}
      </SettingsSection>
    ) : null

  const calendarControls =
    definition.type === "calendar" ? (
      <SettingsSection title="Calendar">
        {isVisible("week-start") ? (
          <SettingRow
            label="Week starts"
            control={
              <Select
                value={String(definition.weekStartsOn ?? 1)}
                onValueChange={(value) =>
                  value &&
                  updateDefinition({
                    ...definition,
                    weekStartsOn: Number(value) as 0 | 1,
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {
                      WEEK_START_LABELS[
                        (definition.weekStartsOn ??
                          1) as keyof typeof WEEK_START_LABELS
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("weekends") ? (
          <SettingRow
            label="Weekends"
            control={
              <Switch
                checked={definition.showWeekends ?? true}
                onCheckedChange={(showWeekends) =>
                  updateDefinition({ ...definition, showWeekends })
                }
              />
            }
          />
        ) : null}
        {isVisible("density") ? (
          <SettingRow
            label="Density"
            control={
              <Select
                value={definition.density ?? "compact"}
                onValueChange={(density) =>
                  density &&
                  updateDefinition({
                    ...definition,
                    density: density as "compact" | "comfortable",
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {DENSITY_LABELS[definition.density ?? "compact"]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
        {isVisible("time-format") ? (
          <SettingRow
            label="Time format"
            control={
              <Select
                value={definition.timeFormat ?? "12h"}
                onValueChange={(timeFormat) =>
                  timeFormat &&
                  updateDefinition({
                    ...definition,
                    timeFormat: timeFormat as "12h" | "24h",
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {TIME_FORMAT_LABELS[definition.timeFormat ?? "12h"]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="12h">12 hour</SelectItem>
                  <SelectItem value="24h">24 hour</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
      </SettingsSection>
    ) : null

  const timelineControls =
    definition.type === "timeline" ? (
      <SettingsSection title="Timeline">
        {isVisible("timeline-sidebar") ? (
          <SettingRow
            label="Sidebar"
            control={
              <Switch
                checked={definition.sidebar ?? true}
                onCheckedChange={(sidebar) =>
                  updateDefinition({ ...definition, sidebar })
                }
              />
            }
          />
        ) : null}
        {isVisible("timeline-dependencies") ? (
          <SettingRow
            label="Dependencies"
            control={
              <Switch
                checked={definition.dependencies ?? false}
                onCheckedChange={(dependencies) =>
                  updateDefinition({ ...definition, dependencies })
                }
              />
            }
          />
        ) : null}
        {isVisible("timeline-snap") ? (
          <SettingRow
            label="Snap to grid"
            control={
              <Switch
                checked={definition.snapToGrid ?? true}
                onCheckedChange={(snapToGrid) =>
                  updateDefinition({ ...definition, snapToGrid })
                }
              />
            }
          />
        ) : null}
        {isVisible("timeline-row-hierarchy") ? (
          <SettingRow
            label="Grid hierarchy"
            control={
              <HierarchySelect
                value={definition.rowSubItems ?? "nested"}
                onValueChange={(rowSubItems) =>
                  updateDefinition({ ...definition, rowSubItems })
                }
              />
            }
          />
        ) : null}
        {isVisible("timeline-sidebar-hierarchy") ? (
          <SettingRow
            label="Sidebar hierarchy"
            control={
              <HierarchySelect
                value={definition.sidebarSubItems ?? "nested"}
                onValueChange={(sidebarSubItems) =>
                  updateDefinition({ ...definition, sidebarSubItems })
                }
              />
            }
          />
        ) : null}
      </SettingsSection>
    ) : null

  return (
    <div ref={ref} className={cn(className)} {...props}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={`View settings for ${view.name}`}
            />
          }
        >
          <Settings2 aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[min(34rem,var(--available-height))] w-72 gap-4 overflow-y-auto p-3"
        >
          <PopoverHeader>
            <PopoverTitle>{view.name}</PopoverTitle>
            <PopoverDescription>
              Settings for this {definition.type} view.
            </PopoverDescription>
          </PopoverHeader>
          {listControls}
          {kanbanControls}
          {calendarControls}
          {timelineControls}
          {propertyControls}
          {onDuplicateView || onDeleteView ? (
            <SettingsSection title="View">
              <div className="grid gap-1">
                {onDuplicateView ? (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => onDuplicateView(view)}
                  >
                    Duplicate view
                  </Button>
                ) : null}
                {onDeleteView ? (
                  <Button
                    variant="ghost"
                    className="justify-start text-destructive hover:text-destructive"
                    onClick={() => onDeleteView(view)}
                  >
                    Delete view
                  </Button>
                ) : null}
              </div>
            </SettingsSection>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function HierarchySelect({
  value,
  onValueChange,
}: {
  readonly value: "disabled" | "flattened" | "nested"
  readonly onValueChange: (value: "disabled" | "flattened" | "nested") => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) =>
        next && onValueChange(next as "disabled" | "flattened" | "nested")
      }
    >
      <SelectTrigger className="w-28">
        <SelectValue>{HIERARCHY_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="disabled">Parents</SelectItem>
        <SelectItem value="flattened">Flat</SelectItem>
        <SelectItem value="nested">Nested</SelectItem>
      </SelectContent>
    </Select>
  )
}

type DatabaseViewSettingsComponent = <TRecord>(
  props: DatabaseViewSettingsProps<TRecord> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement | null

export const DatabaseViewSettings = React.memo(
  React.forwardRef(DatabaseViewSettingsInner)
) as DatabaseViewSettingsComponent
