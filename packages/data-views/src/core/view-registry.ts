import type {
  DataViewDefinition,
  DataViewPlugin,
  DataViewRendererContext,
} from "./types.js"

export interface DataViewRegistry<TRecord> {
  readonly plugins: readonly DataViewPlugin<TRecord>[]
  readonly get: (definition: DataViewDefinition) => DataViewPlugin<TRecord> | null
  readonly has: (pluginId: string) => boolean
}

export function getDataViewPluginId(definition: DataViewDefinition) {
  return definition.type === "custom" ? definition.pluginId : definition.type
}

export function createDataViewPlugin<TRecord>(
  plugin: DataViewPlugin<TRecord>
): DataViewPlugin<TRecord> {
  if (!plugin.id.trim()) throw new Error("Data view plugins require a non-empty id.")
  if (!plugin.label.trim()) {
    throw new Error(`Data view plugin "${plugin.id}" requires a label.`)
  }
  return Object.freeze(plugin)
}

export function createDataViewRegistry<TRecord>(
  plugins: readonly DataViewPlugin<TRecord>[]
): DataViewRegistry<TRecord> {
  const byId = new Map<string, DataViewPlugin<TRecord>>()
  for (const plugin of plugins) {
    if (byId.has(plugin.id)) {
      throw new Error(`Data view plugin id "${plugin.id}" is duplicated.`)
    }
    byId.set(plugin.id, plugin)
  }
  return {
    plugins: [...plugins],
    get: (definition) => byId.get(getDataViewPluginId(definition)) ?? null,
    has: (pluginId) => byId.has(pluginId),
  }
}

export function renderRegisteredDataView<TRecord>(
  registry: DataViewRegistry<TRecord>,
  context: DataViewRendererContext<TRecord>
) {
  return registry.get(context.view.definition)?.render(context) ?? null
}
