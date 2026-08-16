/**
 * Controls whether a view renders its own controls or is embedded in a shell
 * that owns navigation and global actions.
 */
export type DataViewChrome =
  | { readonly mode: "standalone" }
  | { readonly mode: "embedded" }

export function resolveDataViewHeader(
  chrome: DataViewChrome | undefined,
  legacyShowHeader: boolean
) {
  return chrome?.mode === "embedded" ? false : legacyShowHeader
}
