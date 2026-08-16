import { createContext, useContext } from "react"
import type {
  TimelineMutationDraft,
  TimelineMutationOutcome,
} from "../production-types.js"

export interface TimelineMutationController {
  dispatch: (draft: TimelineMutationDraft) => Promise<TimelineMutationOutcome>
  cancelPending: (reason?: string) => void
}

export const TimelineMutationContext =
  createContext<TimelineMutationController | null>(null)

export function useTimelineMutations(): TimelineMutationController {
  const controller = useContext(TimelineMutationContext)
  if (!controller) {
    throw new Error(
      "useTimelineMutations must be used within a TimelineProvider"
    )
  }
  return controller
}

/** Internal compatibility hook for low-level component tests/embeds. */
export function useOptionalTimelineMutations() {
  return useContext(TimelineMutationContext)
}
