import type { Analysis } from '../ct/analyze'
import type { Volume } from '../ct/volume'

/* The last few analyses, kept in this browser only: a one-line summary, never pixels or patient data. */

export interface HistoryItem {
  id: string
  at: number
  source: Volume['source']
  matrix: string
  summary: string
  priority: Analysis['priority']
  ms: number
}

const KEY = 'momentum.history.v1'
const LIMIT = 6

export function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as HistoryItem[]) : []
    return Array.isArray(list) ? list.slice(0, LIMIT) : []
  } catch {
    return []
  }
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  const list = [item, ...readHistory().filter((h) => h.id !== item.id)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage may be blocked; the list still shows for this visit */
  }
  return list
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
