import React from "react"
import { Settings } from "lucide-react"
import { KANBAN_COLUMN_WIDTH_STEP, KANBAN_MAX_COLUMN_WIDTH, KANBAN_MIN_COLUMN_WIDTH } from "../constants.js"
import { useKanbanData } from "../context/kanban-data-context.js"
import { useKanbanPreferencesChange } from "../hooks/use-kanban-preferences.js"
import { useKanbanStore } from "../hooks/use-kanban-store.js"
import { selectKanbanActions, selectKanbanSettingsOpen } from "../store/selectors.js"
import type { KanbanDensity } from "../types.js"
import { Button } from "../../ui/button.js"
import { Input } from "../../ui/input.js"
import { Label } from "../../ui/label.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet.js"
import { Switch } from "../../ui/switch.js"

export const KanbanSettings = React.memo(function KanbanSettings() {
  const { preferences } = useKanbanData()
  const open = useKanbanStore(selectKanbanSettingsOpen)
  const actions = useKanbanStore(selectKanbanActions)
  const change = useKanbanPreferencesChange()
  return <Sheet open={open} onOpenChange={actions.setSettingsOpen}>
    <SheetTrigger render={<Button variant="outline" size="icon-lg" className="bg-background shadow-xs" aria-label="Open Kanban settings"><Settings aria-hidden="true" /></Button>} />
    <SheetContent side="right" className="w-[min(92vw,390px)] gap-0 bg-background/95 p-0 backdrop-blur-xl sm:max-w-[390px]">
      <SheetHeader className="border-b px-5 py-4 pr-14"><SheetTitle>Kanban settings</SheetTitle><SheetDescription>Adjust this controlled board view.</SheetDescription></SheetHeader>
      <div className="space-y-5 p-5">
        <div className="space-y-2"><Label htmlFor="kanban-density">Density</Label><Select value={preferences.density} onValueChange={(value: KanbanDensity | null) => value && change({ type: "density", value })}><SelectTrigger id="kanban-density" className="w-full"><SelectValue>{preferences.density}</SelectValue></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="comfortable">Comfortable</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="kanban-column-width">Column width</Label><Input id="kanban-column-width" type="number" min={KANBAN_MIN_COLUMN_WIDTH} max={KANBAN_MAX_COLUMN_WIDTH} step={KANBAN_COLUMN_WIDTH_STEP} value={preferences.columnWidth} onChange={(event) => change({ type: "column-width", value: Math.min(KANBAN_MAX_COLUMN_WIDTH, Math.max(KANBAN_MIN_COLUMN_WIDTH, Number(event.target.value) || KANBAN_MIN_COLUMN_WIDTH)) })} /></div>
        <div className="flex items-center justify-between gap-4"><div><Label htmlFor="kanban-show-wip">WIP limits</Label><p className="text-[11px] text-muted-foreground">Show counts and limit status.</p></div><Switch id="kanban-show-wip" checked={preferences.showWipLimits} onCheckedChange={(value) => change({ type: "wip-visibility", value })} /></div>
      </div>
    </SheetContent>
  </Sheet>
})
