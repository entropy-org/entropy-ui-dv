import React from "react"
import { Button } from "../../ui/button.js"

interface KanbanRenderErrorBoundaryProps {
  readonly children: React.ReactNode
  readonly resetKey: string
  readonly onError?: (error: Error) => void
  readonly renderFallback?: (error: Error, reset: () => void) => React.ReactNode
}

interface State { readonly error: Error | null }

export class KanbanRenderErrorBoundary extends React.Component<KanbanRenderErrorBoundaryProps, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { this.props.onError?.(error) }
  componentDidUpdate(previous: KanbanRenderErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }
  private reset = () => this.setState({ error: null })
  render() {
    if (!this.state.error) return this.props.children
    if (this.props.renderFallback) return this.props.renderFallback(this.state.error, this.reset)
    return (
      <div role="alert" className="flex min-h-72 flex-1 items-center justify-center p-8" data-testid="kanban-render-error">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
          <h2 className="font-semibold">Kanban board could not be displayed</h2>
          <p className="mt-2 text-sm text-muted-foreground">A custom renderer failed. Check the supplied render functions and try again.</p>
          <Button className="mt-4" variant="outline" onClick={this.reset}>Try again</Button>
        </div>
      </div>
    )
  }
}
