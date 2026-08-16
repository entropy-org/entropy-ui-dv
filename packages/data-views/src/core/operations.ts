export interface DataViewOperationIdFactory {
  readonly next: (kind: string) => string
}

/** Creates stable, instance-scoped request ids without relying on globals. */
export function createDataViewOperationIdFactory(
  instanceId: string
): DataViewOperationIdFactory {
  let sequence = 0
  const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, "-")
  return {
    next: (kind) => {
      sequence += 1
      return `edv-${safeInstanceId}-${kind}-${sequence}`
    },
  }
}
