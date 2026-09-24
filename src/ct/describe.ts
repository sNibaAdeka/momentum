import type { Analysis, Lesion } from './analyze'
import { fmtDec } from '../lib/format'

/* Plain-language wording shared by the result panel, the report and the history list. */

export const PRIORITY_TEXT: Record<Analysis['priority'], string> = {
  high: 'Высокий',
  medium: 'Средний',
  routine: 'Обычный',
}

export const sideText = (l: Lesion) => (l.side === 'right' ? 'правое полушарие' : 'левое полушарие')
export const sideShort = (l: Lesion) => (l.side === 'right' ? 'справа' : 'слева')
export const ml = (v: number) => `${fmtDec(v, 1)} мл`
export const slicesText = (l: Lesion) =>
  l.sliceFrom === l.sliceTo ? `срез ${l.sliceFrom + 1}` : `срезы ${l.sliceFrom + 1}–${l.sliceTo + 1}`
export const seconds = (ms: number) => `${fmtDec(ms / 1000, ms < 10_000 ? 2 : 1)} с`

export function summaryLine(a: Analysis) {
  const parts: string[] = []
  if (a.hemorrhage) parts.push(`Гиперденсивная зона ${ml(a.hemorrhage.volumeMl)} ${sideShort(a.hemorrhage)}`)
  if (a.ischemia) parts.push(`Гиподенсивная зона ${ml(a.ischemia.volumeMl)} ${sideShort(a.ischemia)}`)
  return parts.join(' · ') || 'Значимой асимметрии нет'
}

export function findingsText(a: Analysis) {
  const out: string[] = []
  if (a.hemorrhage) {
    const l = a.hemorrhage
    out.push(
      `Гиперденсивная зона, ${sideText(l)}, ${l.region}: ${ml(l.volumeMl)}, ${slicesText(l)}. ` +
        `Средняя плотность ${fmtDec(l.meanHu, 0)} HU против ${fmtDec(l.mirrorHu, 0)} HU в симметричной области — необходимо исключить кровоизлияние.`,
    )
  }
  if (a.ischemia) {
    const l = a.ischemia
    out.push(
      `Гиподенсивная зона, ${sideText(l)}, предположительно ${l.region}: ${ml(l.volumeMl)}, ${slicesText(l)}. ` +
        `Средняя плотность ${fmtDec(l.meanHu, 0)} HU против ${fmtDec(l.mirrorHu, 0)} HU с другой стороны — картина, характерная для ишемии.`,
    )
  }
  if (!out.length) {
    out.push(
      'Значимой асимметрии плотности между полушариями не найдено. Это не исключает инсульт: ранние ишемические изменения на КТ могут не определяться.',
    )
  }
  return out
}

export function recommendation(a: Analysis) {
  if (a.hemorrhage) return 'Срочный просмотр врачом: подтвердить или исключить кровоизлияние до решения о тромболизисе.'
  if (a.priority === 'high') return 'Приоритетный просмотр врачом. Подтвердить находку по исходной серии; сосудистая визуализация — по протоколу учреждения.'
  if (a.priority === 'medium') return 'Небольшая зона асимметрии: сверить с клиникой и исходной серией.'
  return 'Обычная очередь описания. Оценка врачом обязательна.'
}

export const ALGORITHM_NOTE =
  'Экспериментальный алгоритм асимметрии плотности (не нейросеть). Результат не является медицинским заключением; решение принимает врач.'
