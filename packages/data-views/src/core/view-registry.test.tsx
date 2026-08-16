import { describe, expect, it } from "vitest"
import { createDataViewPlugin, createDataViewRegistry } from "./view-registry.js"

describe("data view registry", () => {
  it("resolves built-in and custom definitions by plugin id", () => {
    const registry = createDataViewRegistry([
      createDataViewPlugin<unknown>({
        id: "list",
        label: "List",
        render: () => null,
      }),
      createDataViewPlugin<unknown>({
        id: "map",
        label: "Map",
        render: () => null,
      }),
    ])

    expect(registry.get({ type: "list" })?.id).toBe("list")
    expect(
      registry.get({ type: "custom", pluginId: "map", config: {} })?.id
    ).toBe("map")
  })

  it("rejects duplicate plugin ids", () => {
    const plugin = createDataViewPlugin<unknown>({
      id: "list",
      label: "List",
      render: () => null,
    })
    expect(() => createDataViewRegistry([plugin, plugin])).toThrow(
      'plugin id "list" is duplicated'
    )
  })
})
