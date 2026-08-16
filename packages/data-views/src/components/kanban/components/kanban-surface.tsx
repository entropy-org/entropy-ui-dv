import React from "react"
import { Kanban } from "./kanban.js"
import type { KanbanProps } from "../types.js"

export type KanbanSurfaceProps = Omit<KanbanProps, "chrome" | "showHeader">

/** Headerless Kanban surface intended for `DatabaseViews` and custom shells. */
export const KanbanSurface = React.memo(
  React.forwardRef<HTMLDivElement, KanbanSurfaceProps>(
    function KanbanSurface(props, ref) {
      return <Kanban ref={ref} chrome={{ mode: "embedded" }} {...props} />
    }
  )
)
