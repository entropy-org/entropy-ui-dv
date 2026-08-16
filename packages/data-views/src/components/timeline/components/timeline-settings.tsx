import React, { useCallback } from "react"
import { cva } from "class-variance-authority"
import {
  GitBranch,
  ListTree,
  Magnet,
  PanelLeft,
  Rows3,
  Settings,
  ZoomIn,
} from "lucide-react"
import { Button } from "../../ui/button.js"
import { Separator } from "../../ui/separator.js"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../ui/sheet.js"
import { Switch } from "../../ui/switch.js"
import { TimelineViewportSelect } from "./timeline-viewport-select.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import type { SubItemMode } from "../types.js"
import { cn } from "../../../lib/utils.js"

const HIERARCHY_MODES = [
  { value: "disabled", label: "Parents" },
  { value: "flattened", label: "Flat" },
  { value: "nested", label: "Nested" },
] as const

const hierarchyModeButtonVariants = cva(
  "flex h-8 flex-1 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
  {
    variants: {
      active: {
        true: "bg-background text-foreground shadow-sm ring-1 ring-border/70",
        false:
          "text-muted-foreground hover:bg-background/55 hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

type SettingsSectionProps = React.HTMLAttributes<HTMLElement> & {
  title: string
  description: string
}

const SettingsSection = React.memo(
  React.forwardRef<HTMLElement, SettingsSectionProps>(function SettingsSection(
    { title, description, className, children, ...props },
    ref
  ) {
    return (
      <section ref={ref} className={cn("space-y-3", className)} {...props}>
        <div className="space-y-0.5 px-0.5">
          <h3 className="text-xs font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-[0_1px_0_rgb(255_255_255/0.04)]">
          {children}
        </div>
      </section>
    )
  })
)

type SettingsToggleProps = React.HTMLAttributes<HTMLDivElement> & {
  checked: boolean
  description: string
  icon: React.ReactNode
  label: string
  onCheckedChange: (checked: boolean) => void
  testId: string
}

const SettingsToggle = React.memo(
  React.forwardRef<HTMLDivElement, SettingsToggleProps>(function SettingsToggle(
    {
      checked,
      description,
      icon,
      label,
      onCheckedChange,
      testId,
      className,
      ...props
    },
    ref
  ) {
    const switchId = `timeline-setting-${testId}`

    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-14 items-center gap-3 px-3.5 py-2.5",
          className
        )}
        {...props}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground shadow-xs">
          {icon}
        </div>
        <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-xs font-medium text-foreground">
            {label}
          </span>
          <span className="mt-0.5 block text-[10px] leading-3.5 text-muted-foreground">
            {description}
          </span>
        </label>
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          data-testid={testId}
          aria-label={label}
        />
      </div>
    )
  })
)

type HierarchyModeControlProps = React.HTMLAttributes<HTMLDivElement> & {
  description: string
  icon: React.ReactNode
  label: string
  mode: SubItemMode
  onModeChange: (mode: SubItemMode) => void
  surface: "grid" | "sidebar"
}

const HierarchyModeControl = React.memo(
  React.forwardRef<HTMLDivElement, HierarchyModeControlProps>(
    function HierarchyModeControl(
      {
        description,
        icon,
        label,
        mode,
        onModeChange,
        surface,
        className,
        ...props
      },
      ref
    ) {
      return (
        <div
          ref={ref}
          className={cn("space-y-3 px-3.5 py-3", className)}
          {...props}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground shadow-xs">
              {icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-[10px] leading-3.5 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted/55 p-1">
            {HIERARCHY_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={hierarchyModeButtonVariants({
                  active: mode === option.value,
                })}
                onClick={() => onModeChange(option.value)}
                aria-pressed={mode === option.value}
                aria-label={`${label}: ${option.label}`}
                data-testid={`timeline-settings-${surface}-mode-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )
    }
  )
)

export const TimelineSettings = React.memo(function TimelineSettings() {
  const sidebarVisible = useTimelineStore((state) => state.sidebarVisible)
  const dependenciesEnabled = useTimelineStore(
    (state) => state.dependenciesEnabled
  )
  const snapToGrid = useTimelineStore((state) => state.snapToGrid)
  const rowSubItemMode = useTimelineStore((state) => state.rowSubItemMode)
  const sidebarSubItemMode = useTimelineStore(
    (state) => state.sidebarSubItemMode
  )
  const setSidebarVisible = useTimelineStore(
    (state) => state.actions.setSidebarVisible
  )
  const setDependenciesEnabled = useTimelineStore(
    (state) => state.actions.setDependenciesEnabled
  )
  const setSnapToGrid = useTimelineStore((state) => state.actions.setSnapToGrid)
  const setRowSubItemMode = useTimelineStore(
    (state) => state.actions.setRowSubItemMode
  )
  const setSidebarSubItemMode = useTimelineStore(
    (state) => state.actions.setSidebarSubItemMode
  )
  const {
    onDependenciesEnabledChange,
    onRowSubItemModeChange,
    onSidebarSubItemModeChange,
    onSidebarVisibleChange,
    onSnapToGridChange,
  } = useTimelineConfig()

  const handleSidebarVisibleChange = useCallback(
    (visible: boolean) => {
      setSidebarVisible(visible)
      onSidebarVisibleChange?.(visible)
    },
    [onSidebarVisibleChange, setSidebarVisible]
  )

  const handleDependenciesEnabledChange = useCallback(
    (enabled: boolean) => {
      setDependenciesEnabled(enabled)
      onDependenciesEnabledChange?.(enabled)
    },
    [onDependenciesEnabledChange, setDependenciesEnabled]
  )

  const handleSnapToGridChange = useCallback(
    (enabled: boolean) => {
      setSnapToGrid(enabled)
      onSnapToGridChange?.(enabled)
    },
    [onSnapToGridChange, setSnapToGrid]
  )

  const handleRowModeChange = useCallback(
    (mode: SubItemMode) => {
      setRowSubItemMode(mode)
      onRowSubItemModeChange?.(mode)
    },
    [onRowSubItemModeChange, setRowSubItemMode]
  )

  const handleSidebarModeChange = useCallback(
    (mode: SubItemMode) => {
      setSidebarSubItemMode(mode)
      onSidebarSubItemModeChange?.(mode)
    },
    [onSidebarSubItemModeChange, setSidebarSubItemMode]
  )

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="bg-background shadow-xs"
            data-testid="timeline-settings-trigger"
            aria-label="Open timeline settings"
            title="Timeline settings"
          >
            <Settings aria-hidden="true" />
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-[min(92vw,390px)] gap-0 border-border/80 bg-background/95 p-0 shadow-[-24px_0_70px_rgb(0_0_0/0.16)] backdrop-blur-xl sm:max-w-[390px]"
        overlayClassName="bg-black/35 supports-backdrop-filter:backdrop-blur-[2px]"
        data-testid="timeline-settings-panel"
      >
        <SheetHeader className="border-b border-border/70 px-5 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Settings className="size-4" aria-hidden="true" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold tracking-[-0.02em]">
                Timeline settings
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[11px] leading-4">
                Tune the view without leaving your plan.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_28%,transparent)_transparent] space-y-5 overflow-y-auto px-5 py-5">
          <SettingsSection
            title="View"
            description="Control the timeline scale and visible workspace."
          >
            <div className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground shadow-xs">
                <ZoomIn className="size-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  Time scale
                </p>
                <p className="mt-0.5 text-[10px] leading-3.5 text-muted-foreground">
                  Choose how much time each column represents.
                </p>
              </div>
              <TimelineViewportSelect
                className="w-[104px]"
                showIcon={false}
                testIdPrefix="timeline-settings"
              />
            </div>
            <Separator />
            <SettingsToggle
              checked={sidebarVisible}
              description="Show task names beside the grid."
              icon={<PanelLeft className="size-3.5" aria-hidden="true" />}
              label="Sidebar"
              onCheckedChange={handleSidebarVisibleChange}
              testId="timeline-settings-sidebar"
            />
            <Separator />
            <SettingsToggle
              checked={dependenciesEnabled}
              description="Draw and edit links between timeline items."
              icon={<GitBranch className="size-3.5" aria-hidden="true" />}
              label="Dependencies"
              onCheckedChange={handleDependenciesEnabledChange}
              testId="timeline-settings-dependencies"
            />
            <Separator />
            <SettingsToggle
              checked={snapToGrid}
              description="Align movement and resizing to the active scale."
              icon={<Magnet className="size-3.5" aria-hidden="true" />}
              label="Snap to grid"
              onCheckedChange={handleSnapToGridChange}
              testId="timeline-settings-snap"
            />
          </SettingsSection>

          <SettingsSection
            title="Hierarchy"
            description="Choose independently how each surface presents children."
          >
            <HierarchyModeControl
              description="Controls parent and child bars on the canvas."
              icon={<Rows3 className="size-3.5" aria-hidden="true" />}
              label="Grid rows"
              mode={rowSubItemMode}
              onModeChange={handleRowModeChange}
              surface="grid"
            />
            <Separator />
            <HierarchyModeControl
              description="Controls parent and child labels in the side panel."
              icon={<ListTree className="size-3.5" aria-hidden="true" />}
              label="Sidebar items"
              mode={sidebarSubItemMode}
              onModeChange={handleSidebarModeChange}
              surface="sidebar"
            />
          </SettingsSection>
        </div>

        <div className="border-t border-border/70 bg-muted/10 px-5 py-3">
          <p className="text-center text-[10px] text-muted-foreground">
            Changes apply instantly
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
})
