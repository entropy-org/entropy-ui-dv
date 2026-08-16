"use client"

import React, { type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import { Label } from "../components/ui/label.js"
import { cn } from "../lib/utils.js"
import type {
  DataViewDateRangeValue,
  DataViewProperty,
  DataViewPropertyId,
  DataViewSchema,
} from "./types.js"

export type DataViewFormSurfaceProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "title"
> & {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly footer?: ReactNode
  readonly onCancel: () => void
}

/**
 * Optional shell for consumer-owned create/edit forms. The consumer owns form
 * state, validation, submission, and persistence.
 */
export const DataViewFormSurface = React.memo(
  React.forwardRef<HTMLDivElement, DataViewFormSurfaceProps>(
    function DataViewFormSurface(
      {
        title,
        description,
        footer,
        onCancel,
        className,
        children,
        onKeyDown,
        ...props
      },
      ref
    ) {
      return (
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "absolute inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-popover text-popover-foreground shadow-xl",
            className
          )}
          data-edv-part="record-form"
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (!event.defaultPrevented && event.key === "Escape") onCancel()
          }}
          {...props}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div>
              <h2 className="font-heading text-base font-semibold">{title}</h2>
              {description ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {description}
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close form"
              onClick={onCancel}
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-border p-4">
              {footer}
            </div>
          ) : null}
        </div>
      )
    }
  )
)

export interface DataViewCustomEditorContext<TRecord> {
  readonly property: DataViewProperty<TRecord>
  readonly record: TRecord | null
  readonly value: unknown
  readonly disabled: boolean
  readonly onValueChange: (value: unknown) => void
}

export interface DataViewPropertyEditorProps<TRecord>
  extends Omit<
    React.ComponentPropsWithoutRef<"div">,
    "onChange" | "property"
  > {
  readonly property: DataViewProperty<TRecord>
  readonly record?: TRecord | null
  readonly value: unknown
  readonly onValueChange: (value: unknown) => void
  readonly disabled?: boolean
  readonly error?: ReactNode
  readonly renderCustomEditor?: (
    context: DataViewCustomEditorContext<TRecord>
  ) => ReactNode
}

function formatInputDate(value: unknown, includesTime: boolean) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return ""
  return includesTime
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
    : date.toISOString().slice(0, 10)
}

function getEditor<TRecord>({
  property,
  record = null,
  value,
  onValueChange,
  disabled = false,
  renderCustomEditor,
}: DataViewPropertyEditorProps<TRecord>) {
  const shared = {
    id: `edv-property-${property.id}`,
    disabled: disabled || property.readOnly,
  }
  if (property.type === "checkbox") {
    return (
      <input
        {...shared}
        type="checkbox"
        className="size-4 rounded border-input accent-primary"
        checked={Boolean(value)}
        onChange={(event) => onValueChange(event.currentTarget.checked)}
      />
    )
  }
  if (property.type === "select") {
    return (
      <select
        {...shared}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onValueChange(event.currentTarget.value || null)}
      >
        <option value="">No value</option>
        {property.options.map((option) => (
          <option key={option.id} value={option.id} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  if (property.type === "multi-select") {
    const selected = new Set(Array.isArray(value) ? value : [])
    return (
      <div className="grid gap-2 rounded-md border border-input p-2">
        {property.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={shared.disabled || option.disabled}
              checked={selected.has(option.id)}
              onChange={(event) => {
                const next = new Set(selected)
                if (event.currentTarget.checked) next.add(option.id)
                else next.delete(option.id)
                onValueChange([...next])
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    )
  }
  if (property.type === "date") {
    return (
      <Input
        {...shared}
        type={property.includesTime ? "datetime-local" : "date"}
        value={formatInputDate(value, property.includesTime ?? false)}
        onChange={(event) => onValueChange(event.currentTarget.value || null)}
      />
    )
  }
  if (property.type === "date-range") {
    const range =
      typeof value === "object" && value !== null && "start" in value && "end" in value
        ? (value as DataViewDateRangeValue)
        : null
    const inputType = property.includesTime ? "datetime-local" : "date"
    return (
      <div className="grid grid-cols-2 gap-2">
        <Input
          {...shared}
          id={`${shared.id}-start`}
          aria-label={`${property.label} start`}
          type={inputType}
          value={formatInputDate(range?.start, property.includesTime ?? false)}
          onChange={(event) =>
            onValueChange({
              start: event.currentTarget.value,
              end: range?.end ?? event.currentTarget.value,
            })
          }
        />
        <Input
          {...shared}
          id={`${shared.id}-end`}
          aria-label={`${property.label} end`}
          type={inputType}
          value={formatInputDate(range?.end, property.includesTime ?? false)}
          onChange={(event) =>
            onValueChange({
              start: range?.start ?? event.currentTarget.value,
              end: event.currentTarget.value,
            })
          }
        />
      </div>
    )
  }
  if (property.type === "number") {
    return (
      <Input
        {...shared}
        type="number"
        value={typeof value === "number" ? String(value) : ""}
        onChange={(event) =>
          onValueChange(
            event.currentTarget.value === ""
              ? null
              : event.currentTarget.valueAsNumber
          )
        }
      />
    )
  }
  if (property.type === "custom" || property.type === "person") {
    return (
      renderCustomEditor?.({
        property,
        record,
        value,
        disabled: shared.disabled ?? false,
        onValueChange,
      }) ?? (
        <div className="rounded-md border border-dashed border-input p-2 text-xs text-muted-foreground">
          Supply a custom editor for {property.label}.
        </div>
      )
    )
  }
  return (
    <Input
      {...shared}
      type={property.type === "email" ? "email" : property.type === "url" ? "url" : "text"}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  )
}

/** Controlled default editor for one schema property. */
export const DataViewPropertyEditor = React.memo(
  React.forwardRef<HTMLDivElement, DataViewPropertyEditorProps<unknown>>(
    function DataViewPropertyEditor(
      { className, property, error, ...props },
      ref
    ) {
      return (
        <div
          ref={ref}
          className={cn("grid gap-1.5", className)}
          data-edv-part="property-editor"
        >
          <Label htmlFor={`edv-property-${property.id}`}>{property.label}</Label>
          {property.description ? (
            <div className="text-xs text-muted-foreground">
              {property.description}
            </div>
          ) : null}
          {getEditor({ property, error, ...props })}
          {error ? (
            <div className="text-xs text-destructive" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      )
    }
  )
) as <TRecord>(
  props: DataViewPropertyEditorProps<TRecord> &
    React.RefAttributes<HTMLDivElement>
) => React.ReactElement | null

export interface DataViewRecordFormFieldsProps<TRecord>
  extends React.ComponentPropsWithoutRef<"div"> {
  readonly schema: DataViewSchema<TRecord>
  readonly record?: TRecord | null
  readonly values: Readonly<Record<DataViewPropertyId, unknown>>
  readonly onValueChange: (propertyId: DataViewPropertyId, value: unknown) => void
  readonly disabled?: boolean
  readonly errors?: Readonly<Record<DataViewPropertyId, ReactNode>>
  readonly renderCustomEditor?: (
    context: DataViewCustomEditorContext<TRecord>
  ) => ReactNode
}

/** Reusable fields only; it deliberately does not own submit or persistence. */
function DataViewRecordFormFieldsInner<TRecord>(
  {
    schema,
    record = null,
    values,
    onValueChange,
    disabled,
    errors,
    renderCustomEditor,
    className,
    ...props
  }: DataViewRecordFormFieldsProps<TRecord>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div ref={ref} className={cn("grid gap-4", className)} {...props}>
      {schema.properties
        .filter((property) => !property.hidden)
        .map((property) => (
          <DataViewPropertyEditor
            key={property.id}
            property={property}
            record={record}
            value={values[property.id] ?? (record ? property.getValue(record) : null)}
            disabled={disabled}
            error={errors?.[property.id]}
            renderCustomEditor={renderCustomEditor}
            onValueChange={(value) => onValueChange(property.id, value)}
          />
        ))}
    </div>
  )
}

type DataViewRecordFormFieldsComponent = <TRecord>(
  props: DataViewRecordFormFieldsProps<TRecord> &
    React.RefAttributes<HTMLDivElement>
) => React.ReactElement | null

export const DataViewRecordFormFields = React.memo(
  React.forwardRef(DataViewRecordFormFieldsInner)
) as DataViewRecordFormFieldsComponent
