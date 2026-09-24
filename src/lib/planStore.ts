import { useSyncExternalStore } from 'react'

export type Plan = 'core' | 'clinic'

export const PLAN_LABEL: Record<Plan, string> = { core: 'Core', clinic: 'Clinic+' }

let plan: Plan | null = null
const listeners = new Set<() => void>()

export function choosePlan(next: Plan | null) {
  plan = next
  listeners.forEach((l) => l())
}

export function usePlan(): Plan | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => plan,
    () => null,
  )
}
