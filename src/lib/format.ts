const intFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const decFmt = new Map<number, Intl.NumberFormat>()

export const fmtInt = (n: number) => intFmt.format(Math.round(n))

export function fmtDec(n: number, digits = 1) {
  let f = decFmt.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    decFmt.set(digits, f)
  }
  return f.format(n)
}

/** 3 482 110 → «3,5 млн»; 812 400 → «812 тыс.» */
export function fmtCompact(n: number) {
  if (n >= 1e9) return `${fmtDec(n / 1e9, 1)} млрд`
  if (n >= 1e6) return `${fmtDec(n / 1e6, 1)} млн`
  if (n >= 1e4) return `${fmtInt(n / 1e3)} тыс.`
  return fmtInt(n)
}

export function fmtDuration(totalSeconds: number) {
  const s = Math.floor(totalSeconds)
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m === 0) return `${rest} с`
  return `${m} мин ${String(rest).padStart(2, '0')} с`
}

/** Russian plural: plural(5, ['исследование', 'исследования', 'исследований']) */
export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(Math.floor(n)) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
