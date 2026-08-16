import React from "react"

export function DataListRenderSlot({
  render,
}: {
  readonly render: () => React.ReactNode
}) {
  return render()
}

interface DataListRenderBoundaryProps {
  readonly children: React.ReactNode
  readonly fallback?: React.ReactNode
  readonly resetKey: string
  readonly onError?: (error: unknown) => void
}

interface DataListRenderBoundaryState {
  readonly failed: boolean
}

export class DataListRenderBoundary extends React.Component<
  DataListRenderBoundaryProps,
  DataListRenderBoundaryState
> {
  state: DataListRenderBoundaryState = { failed: false }

  static getDerivedStateFromError(): DataListRenderBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error)
  }

  componentDidUpdate(previousProps: DataListRenderBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <span className="text-xs text-destructive">Unable to render</span>
        )
      )
    }
    return this.props.children
  }
}
