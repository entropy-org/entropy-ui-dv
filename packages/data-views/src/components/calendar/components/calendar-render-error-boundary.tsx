import React from "react"
import { Button } from "../../ui/button.js"

interface CalendarRenderErrorBoundaryProps {
  readonly children: React.ReactNode
  readonly onError?: (error: Error) => void
  readonly renderFallback?: (error: Error, reset: () => void) => React.ReactNode
  readonly resetKey: string
}

interface CalendarRenderErrorBoundaryState {
  readonly error: Error | null
}

/** Keeps consumer render-function failures contained to one calendar instance. */
export class CalendarRenderErrorBoundary extends React.Component<
  CalendarRenderErrorBoundaryProps,
  CalendarRenderErrorBoundaryState
> {
  state: CalendarRenderErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  componentDidUpdate(previousProps: CalendarRenderErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.renderFallback) {
      return this.props.renderFallback(error, this.reset)
    }
    return (
      <div
        role="alert"
        className="flex min-h-72 flex-1 items-center justify-center p-8 text-center"
        data-testid="calendar-render-error"
      >
        <div className="max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <h2 className="font-semibold">Calendar could not be displayed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A custom calendar renderer failed. Check the supplied render
            functions, then try again.
          </p>
          <Button className="mt-4" variant="outline" onClick={this.reset}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
}
