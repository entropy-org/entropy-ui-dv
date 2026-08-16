import React from "react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import type { TimelineRendererErrorInfo } from "../production-types.js"

type BoundaryProps = Omit<TimelineRendererErrorInfo, "error"> & {
  children: React.ReactNode | (() => React.ReactNode)
  fallback?: React.ReactNode
  renderError?: (info: TimelineRendererErrorInfo) => React.ReactNode
}

type BoundaryState = { error: unknown | null }

class RendererBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error }
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error && previous.item?.id !== this.props.item?.id) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error)
      return <RendererContent>{this.props.children}</RendererContent>
    return (
      this.props.renderError?.({
        surface: this.props.surface,
        item: this.props.item,
        error: this.state.error,
      }) ??
      this.props.fallback ??
      null
    )
  }
}

function RendererContent({
  children,
}: {
  children: React.ReactNode | (() => React.ReactNode)
}) {
  return typeof children === "function" ? children() : children
}

export function TimelineRendererBoundary(
  props: Omit<BoundaryProps, "renderError">
) {
  const { renderRendererError } = useTimelineConfig()
  return <RendererBoundary {...props} renderError={renderRendererError} />
}
