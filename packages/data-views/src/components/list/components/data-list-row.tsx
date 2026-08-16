import React, { useEffect, useId, useRef } from "react"
import { cva } from "class-variance-authority"
import { Check, ChevronRight, CircleDashed, GripVertical } from "lucide-react"
import { Button } from "../../ui/button.js"
import { Input } from "../../ui/input.js"
import {
  DataListRenderBoundary,
  DataListRenderSlot,
} from "./data-list-render-boundary.js"
import type { DataListEditState } from "../store/types.js"
import type {
  DataListConfig,
  DataListAnyProperty,
  DataListDensity,
  DataListDisplayEntry,
  DataListEditor,
  DataListItemState,
} from "../types.js"
import { cn } from "../../../lib/utils.js"

const dataListRowVariants = cva(
  "group/row relative grid min-w-full cursor-pointer items-center border-b border-border/50 bg-background text-sm transition-colors outline-none select-none motion-reduce:transition-none forced-colors:border-[CanvasText]",
  {
    variants: {
      density: {
        compact: "min-h-8 py-0.5",
        default: "min-h-10 py-1",
        comfortable: "min-h-12 py-1.5",
      },
      selected: {
        true: "bg-accent/70 shadow-[inset_2px_0_0_0_var(--color-primary)] forced-colors:outline forced-colors:outline-2",
        false: "hover:bg-muted/45",
      },
      focused: {
        true: "focus-visible:z-[1] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
        false: "",
      },
      pending: {
        true: "after:pointer-events-none after:absolute after:inset-y-1 after:right-1 after:w-0.5 after:animate-pulse after:bg-primary motion-reduce:after:animate-none",
        false: "",
      },
    },
    defaultVariants: {
      density: "default",
      selected: false,
      focused: false,
      pending: false,
    },
  }
)

interface DataListInlineEditorProps<TData> {
  readonly config: DataListConfig<TData>
  readonly entry: Extract<
    DataListDisplayEntry<TData>,
    { readonly kind: "item" }
  >
  readonly property?: DataListAnyProperty<TData>
  readonly edit: Exclude<DataListEditState, { readonly status: "idle" }>
  readonly onValueChange: (value: unknown) => void
  readonly onCommit: () => void
  readonly onCancel: () => void
  readonly onRendererError: (
    itemId: string,
    propertyId: string | undefined,
    error: unknown
  ) => void
}

function DataListInlineEditor<TData>({
  config,
  entry,
  property,
  edit,
  onValueChange,
  onCommit,
  onCancel,
  onRendererError,
}: DataListInlineEditorProps<TData>) {
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const isTitle = edit.propertyId === "__title__"
  const definition = (isTitle ? config.titleEditor : property?.editor) as
    DataListEditor<TData, unknown> | undefined

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [])

  if (definition?.render) {
    return (
      <DataListRenderBoundary
        resetKey={`${entry.item.id}:${edit.propertyId}:editor`}
        onError={(error) =>
          onRendererError(
            entry.item.id,
            isTitle ? undefined : property?.id,
            error
          )
        }
      >
        <DataListRenderSlot
          render={() =>
            definition.render?.({
              item: entry.item,
              value: edit.value,
              error: edit.status === "draft" ? edit.error : undefined,
              validating: edit.status === "validating",
              pending: false,
              setValue: onValueChange,
              commit: onCommit,
              cancel: onCancel,
            })
          }
        />
      </DataListRenderBoundary>
    )
  }

  return (
    <div className="min-w-0 flex-1">
      <Input
        ref={inputRef}
        value={String(edit.value ?? "")}
        disabled={edit.status === "validating"}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "Enter") {
            event.preventDefault()
            onCommit()
          } else if (event.key === "Escape") {
            event.preventDefault()
            onCancel()
          }
        }}
        onBlur={() => {
          if (definition?.commitOnBlur) onCommit()
        }}
        className="h-7 min-w-24 border-ring/50 bg-background px-1.5 text-xs"
        aria-invalid={edit.status === "draft" && Boolean(edit.error)}
        aria-describedby={
          edit.status === "draft" && edit.error ? errorId : undefined
        }
        aria-label={`Edit ${isTitle ? "title" : (property?.label ?? "property")}`}
      />
      {edit.status === "draft" && edit.error ? (
        <span id={errorId} className="sr-only">
          {edit.error}
        </span>
      ) : null}
    </div>
  )
}

export interface DataListRowProps<TData> extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "onContextMenu"
> {
  readonly config: DataListConfig<TData>
  readonly entry: Extract<
    DataListDisplayEntry<TData>,
    { readonly kind: "item" }
  >
  readonly properties: readonly DataListAnyProperty<TData>[]
  readonly values: ReadonlyMap<string, unknown>
  readonly state: DataListItemState
  readonly density: DataListDensity
  readonly semanticRole: "listitem" | "option" | "treeitem" | "row"
  readonly hierarchical: boolean
  readonly selectable: boolean
  readonly reorderable: boolean
  readonly edit: DataListEditState
  readonly pendingValues: ReadonlyMap<string, unknown>
  readonly dropPosition?: "before" | "after"
  readonly hierarchyToggled: boolean
  readonly onRowClick: (id: string, event: React.MouseEvent) => void
  readonly onRowDoubleClick: (id: string, event: React.MouseEvent) => void
  readonly onRowFocus: (id: string) => void
  readonly onRowContextMenu: (id: string, event: React.MouseEvent) => void
  readonly onSelectionToggle: (id: string, event: React.MouseEvent) => void
  readonly onStartEdit: (id: string, propertyId: string, value: unknown) => void
  readonly onEditValueChange: (value: unknown) => void
  readonly onCommitEdit: () => void
  readonly onCancelEdit: () => void
  readonly onToggleHierarchy: (id: string) => void
  readonly onPointerReorderStart: (
    id: string,
    event: React.PointerEvent
  ) => void
  readonly onRendererError: (
    itemId: string,
    propertyId: string | undefined,
    error: unknown
  ) => void
}

function DataListRowInner<TData>(
  {
    config,
    entry,
    properties,
    values,
    state,
    density,
    semanticRole,
    hierarchical,
    selectable,
    reorderable,
    edit,
    pendingValues,
    dropPosition,
    hierarchyToggled,
    onRowClick,
    onRowDoubleClick,
    onRowFocus,
    onRowContextMenu,
    onSelectionToggle,
    onStartEdit,
    onEditValueChange,
    onCommitEdit,
    onCancelEdit,
    onToggleHierarchy,
    onPointerReorderStart,
    onRendererError,
    className,
    style,
    ...props
  }: DataListRowProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const titleEditing =
    edit.status !== "idle" &&
    edit.itemId === entry.item.id &&
    edit.propertyId === "__title__"
  const gridTemplateColumns = `minmax(220px, 1fr) ${properties
    .map(() => "minmax(120px, auto)")
    .join(" ")}`
  const hierarchy = config.hierarchy ?? { mode: "disabled" as const }
  const defaultExpanded =
    hierarchy.mode !== "nested" || hierarchy.defaultExpanded !== false
  const expanded = hierarchyToggled ? !defaultExpanded : defaultExpanded

  return (
    <div
      ref={ref}
      role={semanticRole}
      tabIndex={state.focused ? 0 : -1}
      aria-selected={
        semanticRole === "option" || semanticRole === "row"
          ? state.selected
          : undefined
      }
      aria-level={
        semanticRole === "treeitem" || (semanticRole === "row" && hierarchical)
          ? entry.depth + 1
          : undefined
      }
      aria-posinset={
        semanticRole === "treeitem" || (semanticRole === "row" && hierarchical)
          ? entry.positionInSet
          : undefined
      }
      aria-setsize={
        semanticRole === "treeitem" || (semanticRole === "row" && hierarchical)
          ? entry.setSize
          : undefined
      }
      aria-expanded={
        (semanticRole === "treeitem" ||
          (semanticRole === "row" && hierarchical)) &&
        entry.hasChildren
          ? expanded
          : undefined
      }
      aria-busy={state.pending || undefined}
      aria-label={config.getItemLabel?.(entry.item) ?? entry.item.id}
      className={cn(
        dataListRowVariants({
          density,
          selected: state.selected,
          focused: state.focused,
          pending: state.pending,
        }),
        dropPosition === "before" &&
          "before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-primary",
        dropPosition === "after" &&
          "before:absolute before:inset-x-0 before:bottom-0 before:z-10 before:h-0.5 before:bg-primary",
        className
      )}
      style={{ gridTemplateColumns, ...style }}
      data-list-part="row"
      data-list-row-id={entry.item.id}
      data-selected={state.selected || undefined}
      data-focused={state.focused || undefined}
      data-pending={state.pending || undefined}
      onClick={(event) => onRowClick(entry.item.id, event)}
      onDoubleClick={(event) => onRowDoubleClick(entry.item.id, event)}
      onFocus={() => onRowFocus(entry.item.id)}
      onContextMenu={(event) => onRowContextMenu(entry.item.id, event)}
      {...props}
    >
      <div
        role={semanticRole === "row" ? "rowheader" : undefined}
        className="flex min-w-0 items-center gap-1.5 px-2"
        style={{ paddingInlineStart: `${8 + entry.depth * 20}px` }}
        data-list-part="title"
      >
        {reorderable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 cursor-grab touch-none opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            onPointerDown={(event) => {
              event.stopPropagation()
              onPointerReorderStart(entry.item.id, event)
            }}
            aria-label={`Reorder ${config.getItemLabel?.(entry.item) ?? entry.item.id}`}
            tabIndex={-1}
          >
            <GripVertical className="size-3.5" />
          </Button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        {selectable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-5 shrink-0 rounded-sm border border-transparent p-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
              state.selected &&
                "border-primary bg-primary text-primary-foreground opacity-100"
            )}
            onClick={(event) => {
              event.stopPropagation()
              onSelectionToggle(entry.item.id, event)
            }}
            aria-label={`${state.selected ? "Deselect" : "Select"} ${config.getItemLabel?.(entry.item) ?? entry.item.id}`}
            aria-pressed={state.selected}
            tabIndex={-1}
          >
            {state.selected ? <Check className="size-3" /> : null}
          </Button>
        ) : null}
        {hierarchy.mode === "nested" && entry.hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0"
            onClick={(event) => {
              event.stopPropagation()
              onToggleHierarchy(entry.item.id)
            }}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${config.getItemLabel?.(entry.item) ?? entry.item.id}`}
            tabIndex={-1}
          >
            <ChevronRight className={cn("size-3.5", expanded && "rotate-90")} />
          </Button>
        ) : null}
        {config.renderIcon ? (
          <span className="shrink-0 text-muted-foreground" aria-hidden="true">
            <DataListRenderBoundary
              resetKey={`${entry.item.id}:icon`}
              onError={(error) =>
                onRendererError(entry.item.id, undefined, error)
              }
            >
              <DataListRenderSlot
                render={() => config.renderIcon?.({ item: entry.item, state })}
              />
            </DataListRenderBoundary>
          </span>
        ) : null}
        {titleEditing ? (
          <DataListInlineEditor
            config={config}
            entry={entry}
            edit={edit}
            onValueChange={onEditValueChange}
            onCommit={onCommitEdit}
            onCancel={onCancelEdit}
            onRendererError={onRendererError}
          />
        ) : (
          <div
            className="min-w-0 flex-1 truncate font-medium text-foreground"
            onDoubleClick={(event) => {
              if (!config.titleEditor || state.readOnly) return
              event.stopPropagation()
              onStartEdit(
                entry.item.id,
                "__title__",
                pendingValues.get("__title__") ??
                  config.titleEditor.accessor(entry.item.data)
              )
            }}
          >
            <DataListRenderBoundary
              resetKey={`${entry.item.id}:title`}
              onError={(error) =>
                onRendererError(entry.item.id, undefined, error)
              }
            >
              {pendingValues.has("__title__") ? (
                String(pendingValues.get("__title__") ?? "")
              ) : (
                <DataListRenderSlot
                  render={() => config.renderTitle({ item: entry.item, state })}
                />
              )}
            </DataListRenderBoundary>
          </div>
        )}
        {state.pending ? (
          <CircleDashed
            className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-label="Saving"
          />
        ) : null}
        {config.renderRowActions ? (
          <div
            className="ml-auto flex shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
            data-list-part="row-actions"
            onClick={(event) => event.stopPropagation()}
          >
            <DataListRenderBoundary
              resetKey={`${entry.item.id}:actions`}
              onError={(error) =>
                onRendererError(entry.item.id, undefined, error)
              }
            >
              <DataListRenderSlot
                render={() =>
                  config.renderRowActions?.({ item: entry.item, state })
                }
              />
            </DataListRenderBoundary>
          </div>
        ) : null}
      </div>
      {properties.map((property) => {
        const propertyEditing =
          edit.status !== "idle" &&
          edit.itemId === entry.item.id &&
          edit.propertyId === property.id
        const authoritativeValue = values.get(property.id)
        const renderedValue = pendingValues.has(property.id)
          ? pendingValues.get(property.id)
          : authoritativeValue
        return (
          <div
            key={property.id}
            role={semanticRole === "row" ? "gridcell" : undefined}
            className={cn(
              "flex min-w-0 items-center truncate px-2 text-xs text-muted-foreground",
              property.className
            )}
            data-list-part="property"
            data-list-property-id={property.id}
            onDoubleClick={(event) => {
              if (
                state.readOnly ||
                !property.editor ||
                !property.capabilities?.editable
              ) {
                return
              }
              event.stopPropagation()
              onStartEdit(entry.item.id, property.id, renderedValue)
            }}
          >
            {propertyEditing ? (
              <DataListInlineEditor
                config={config}
                entry={entry}
                property={property}
                edit={edit}
                onValueChange={onEditValueChange}
                onCommit={onCommitEdit}
                onCancel={onCancelEdit}
                onRendererError={onRendererError}
              />
            ) : (
              <DataListRenderBoundary
                resetKey={`${entry.item.id}:${property.id}:${String(renderedValue)}`}
                onError={(error) =>
                  onRendererError(entry.item.id, property.id, error)
                }
              >
                <DataListRenderSlot
                  render={() =>
                    property.render({
                      item: entry.item,
                      value: renderedValue,
                      state,
                    })
                  }
                />
              </DataListRenderBoundary>
            )}
          </div>
        )
      })}
    </div>
  )
}

function sameMap(
  left: ReadonlyMap<string, unknown>,
  right: ReadonlyMap<string, unknown>
) {
  if (left === right) return true
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    if (!right.has(key) || !Object.is(value, right.get(key))) return false
  }
  return true
}

function areDataListRowPropsEqual(
  previous: DataListRowProps<unknown>,
  next: DataListRowProps<unknown>
) {
  const previousEdit =
    previous.edit.status !== "idle" &&
    previous.edit.itemId === previous.entry.item.id
      ? previous.edit
      : null
  const nextEdit =
    next.edit.status !== "idle" && next.edit.itemId === next.entry.item.id
      ? next.edit
      : null
  return (
    previous.config === next.config &&
    previous.entry === next.entry &&
    previous.properties === next.properties &&
    previous.values === next.values &&
    previous.state.selected === next.state.selected &&
    previous.state.focused === next.state.focused &&
    previous.state.pending === next.state.pending &&
    previous.state.readOnly === next.state.readOnly &&
    previous.density === next.density &&
    previous.semanticRole === next.semanticRole &&
    previous.hierarchical === next.hierarchical &&
    previous.selectable === next.selectable &&
    previous.reorderable === next.reorderable &&
    previousEdit === nextEdit &&
    sameMap(previous.pendingValues, next.pendingValues) &&
    previous.dropPosition === next.dropPosition &&
    previous.hierarchyToggled === next.hierarchyToggled &&
    previous.onRowClick === next.onRowClick &&
    previous.onRowDoubleClick === next.onRowDoubleClick &&
    previous.onRowFocus === next.onRowFocus &&
    previous.onRowContextMenu === next.onRowContextMenu &&
    previous.onSelectionToggle === next.onSelectionToggle &&
    previous.onStartEdit === next.onStartEdit &&
    previous.onEditValueChange === next.onEditValueChange &&
    previous.onCommitEdit === next.onCommitEdit &&
    previous.onCancelEdit === next.onCancelEdit &&
    previous.onToggleHierarchy === next.onToggleHierarchy &&
    previous.onPointerReorderStart === next.onPointerReorderStart &&
    previous.onRendererError === next.onRendererError
  )
}

export const DataListRow = React.memo(
  React.forwardRef(DataListRowInner),
  areDataListRowPropsEqual
) as <TData>(
  props: DataListRowProps<TData> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement
