/**
 * Test render helper — mounts components/hooks inside TimelineProvider
 * contexts and returns the store handle for assertions.
 *
 */
import { render, renderHook, type RenderResult } from "@testing-library/react"
import type { ReactNode } from "react"
import { TimelineContext } from "../context/timeline-context.js"
import { TimelineConfigContext } from "../context/timeline-config-context.js"
import {
  createTimelineStore,
  type CreateTimelineStoreOptions,
  type TimelineStore,
} from "../store/create-store.js"
import type {
  TimelineConfig,
  TimelineItem,
} from "../types.js"

/** Default renderBar used in tests when none is provided */
const defaultRenderBar = (item: TimelineItem) => (
  <div data-testid={`bar-content-${item.id}`}>
    {(item.data as { title?: string })?.title ?? item.id}
  </div>
)

/** Build a minimal valid TimelineConfig, merging overrides */
export function createTestConfig(
  overrides: Partial<TimelineConfig> = {}
): TimelineConfig {
  return {
    items: [],
    renderBar: defaultRenderBar,
    ...overrides,
  }
}

/** Return type of renderTimeline */
export interface RenderTimelineResult {
  /** The testing-library render result */
  renderResult: RenderResult
  /** Direct reference to the store for assertions */
  store: TimelineStore
}

/**
 * Render a component tree wrapped in both timeline contexts.
 *
 * @param ui - The component tree to render
 * @param options - Store initialization options
 * @param configOverrides - Config overrides (renderers, callbacks)
 * @returns The render result and the store handle
 */
export function renderTimeline(
  ui: ReactNode,
  options: CreateTimelineStoreOptions = {},
  configOverrides: Partial<TimelineConfig> = {}
): RenderTimelineResult {
  const store = createTimelineStore(options)
  const config = createTestConfig({
    items: options.items ?? [],
    viewportMode: options.viewportMode,
    readOnly: options.readOnly,
    ...configOverrides,
  })

  const renderResult = render(
    <TimelineConfigContext.Provider value={config}>
      <TimelineContext.Provider value={store}>{ui}</TimelineContext.Provider>
    </TimelineConfigContext.Provider>
  )

  return { renderResult, store }
}

/**
 * Render a hook inside timeline contexts.
 *
 * @param hookFn - The hook to render
 * @param options - Store initialization options
 * @param configOverrides - Config overrides
 * @returns The renderHook result and the store handle
 */
export function renderTimelineHook<T>(
  hookFn: () => T,
  options: CreateTimelineStoreOptions = {},
  configOverrides: Partial<TimelineConfig> = {}
) {
  const store = createTimelineStore(options)
  const config = createTestConfig({
    items: options.items ?? [],
    viewportMode: options.viewportMode,
    ...configOverrides,
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <TimelineConfigContext.Provider value={config}>
      <TimelineContext.Provider value={store}>
        {children}
      </TimelineContext.Provider>
    </TimelineConfigContext.Provider>
  )

  const result = renderHook(hookFn, { wrapper })
  return { ...result, store }
}

/**
 * Create a bare store for direct-access tests (no React context).
 *
 * @param options - Store initialization options
 * @returns The store handle
 */
export function createTestStore(
  options: CreateTimelineStoreOptions = {}
): TimelineStore {
  return createTimelineStore(options)
}
