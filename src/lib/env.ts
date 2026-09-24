import type { Transition } from 'framer-motion'

/* Motion tokens — shared across the site. Enter uses ease-out; exits are ~60% of enter. */
export const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const easeIn: [number, number, number, number] = [0.55, 0, 0.78, 0.35]
export const spring: Transition = { type: 'spring', stiffness: 280, damping: 22 }

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

interface NavigatorHints extends Navigator {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

export function isLowPower(): boolean {
  const n = navigator as NavigatorHints
  if (n.connection?.saveData) return true
  if (n.deviceMemory !== undefined && n.deviceMemory <= 2) return true
  return (navigator.hardwareConcurrency ?? 8) <= 2
}

export const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches
export const isNarrow = () => window.matchMedia('(max-width: 767px)').matches
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
