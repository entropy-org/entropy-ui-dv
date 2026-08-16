import React from "react"
import { DataList, type DataListProps } from "./data-list.js"

export type DataListSurfaceProps = Omit<
  DataListProps,
  "chrome" | "showHeader"
>

/** Headerless List surface intended for `DatabaseViews` and custom shells. */
export const DataListSurface = React.memo(
  React.forwardRef<HTMLDivElement, DataListSurfaceProps>(
    function DataListSurface(props, ref) {
      return <DataList ref={ref} chrome={{ mode: "embedded" }} {...props} />
    }
  )
)
