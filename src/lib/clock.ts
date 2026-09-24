import { useSyncExternalStore } from 'react'

/** Saver J.L. «Time is brain — quantified», Stroke, 2006. */
export const NEURONS_PER_MINUTE = 1_900_000
export const NEURONS_PER_SECOND = NEURONS_PER_MINUTE / 60
/** Время анализа одного исследования Momentum. */
export const ANALYSIS_SECONDS = 18

const startedAt = typeof performance !== 'undefined' ? performance.now() : 0
let elapsed = 0
let timer: number | undefined
const listeners = new Set<() => void>()

function tick() {
  elapsed = (performance.now() - startedAt) / 1000
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) timer = window.setInterval(tick, 100)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}

/** Секунды с момента открытия страницы; обновляется 10 раз в секунду, один таймер на всё приложение. */
export function useElapsed(): number {
  return useSyncExternalStore(subscribe, () => elapsed, () => 0)
}
