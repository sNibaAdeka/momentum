import { useRef, useState } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ScanReveal } from '../components/primitives'
import { NEURONS_PER_MINUTE } from '../lib/clock'
import { fmtCompact, fmtDec } from '../lib/format'

/*
 * The stroke clock: two lanes of the same patient pathway, scrubbed by scroll.
 * Intervals are an explicit model (labelled on the page) — the only product claim used is "5× faster primary read".
 */

const MAX = 70
const GUIDELINE = 60

interface Segment {
  from: number
  to: number
  label: string
  kind: 'base' | 'wait' | 'ai' | 'check'
}

const STANDARD: Segment[] = [
  { from: 0, to: 20, label: 'Поступление и КТ', kind: 'base' },
  { from: 20, to: 50, label: 'Ожидание описания', kind: 'wait' },
  { from: 50, to: 65, label: 'Решение о терапии', kind: 'base' },
]
const WITH_MOMENTUM: Segment[] = [
  { from: 0, to: 20, label: 'Поступление и КТ', kind: 'base' },
  { from: 20, to: 20.3, label: 'Momentum, 18 с', kind: 'ai' },
  { from: 20.3, to: 26, label: 'Врач проверяет разметку', kind: 'check' },
  { from: 26, to: 41, label: 'Решение о терапии', kind: 'base' },
]
const TREAT_STD = 65
const TREAT_M = 41

const pct = (m: number) => `${(m / MAX) * 100}%`
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function Lane({ title, segments, treat, t, tone }: { title: string; segments: Segment[]; treat: number; t: number; tone: 'std' | 'm' }) {
  const lost = Math.min(t, treat) * NEURONS_PER_MINUTE
  const started = t >= treat
  const late = treat > GUIDELINE
  return (
    <div className={`lane lane--${tone}`}>
      <div className="lane__head">
        <h3 className="lane__title">{title}</h3>
        <p className="lane__loss">
          <span className="num">−{fmtCompact(lost)}</span> нейронов
          <span className={`lane__state${started ? ' is-on' : ''}`}>{started ? 'лечение начато' : 'ожидание'}</span>
        </p>
      </div>
      <div className="lane__track">
        {segments.map((s) => {
          const fill = clamp01((t - s.from) / (s.to - s.from))
          return (
            <div key={s.label} className={`seg seg--${s.kind}`} style={{ left: pct(s.from), width: pct(s.to - s.from) }}>
              <span className="seg__fill" style={{ transform: `scaleX(${fill})` }} />
              <span className="seg__label">{s.label}</span>
            </div>
          )
        })}
        <div className={`treat${late ? ' treat--late' : ''}${started ? ' is-on' : ''}`} style={{ left: pct(treat) }}>
          <span className="treat__flag">
            Лечение · <span className="num">{treat}</span> мин
          </span>
        </div>
      </div>
    </div>
  )
}

export function PatientRoute() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [t, setT] = useState(reduce ? MAX : 0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduce) setT(clamp01(v * 1.12) * MAX)
  })
  const saved = TREAT_STD - TREAT_M
  const done = t >= TREAT_STD

  return (
    <section id="route" ref={ref} className={`route${reduce ? ' route--static' : ''}`} aria-labelledby="route-title">
      <div className="route__sticky">
        <div className="wrap">
          <div className="section-head section-head--split route__head">
            <ScanReveal>
              <p className="label"><b>02</b> Маршрут пациента</p>
            <h2 id="route-title" className="h2"><span>Где маршрут</span><span className="accent-b">теряет минуты.</span></h2>
            </ScanReveal>
            <p className="lead">
              Один и тот же пациент, два маршрута. Прокручивайте страницу: время идёт, а вместе с ним растёт цена каждой
              минуты.
            </p>
          </div>

          <div className="route__board" role="img" aria-label={`Модель: без Momentum лечение начинается на ${TREAT_STD}-й минуте, с Momentum — на ${TREAT_M}-й. Разница ${saved} минуты.`}>
            <div className="route__axis" aria-hidden="true">
              {Array.from({ length: MAX / 10 + 1 }, (_, i) => (
                <span key={i} className="route__tick" style={{ left: pct(i * 10) }}>
                  {i * 10}
                </span>
              ))}
              <span className="route__unit">мин</span>
            </div>
            <div className="route__lanes" aria-hidden="true">
              <Lane title="Обычный маршрут" segments={STANDARD} treat={TREAT_STD} t={t} tone="std" />
              <Lane title="С Momentum" segments={WITH_MOMENTUM} treat={TREAT_M} t={t} tone="m" />
              <div className="route__guide" style={{ left: pct(GUIDELINE) }}>
                <span>60 мин — ориентир AHA/ASA</span>
              </div>
              <div className="route__playhead" style={{ transform: `translateX(${(t / MAX) * 100}cqw)` }}>
                <span className="route__clock num">T+{Math.floor(t)} мин</span>
              </div>
            </div>
          </div>

          <div className={`route__verdict${done ? ' is-on' : ''}`}>
            <p className="route__verdict-main">
              Разница — <span className="num">{saved}</span> минуты. Это около{' '}
              <span className="coral num">{fmtDec((saved * NEURONS_PER_MINUTE) / 1e6, 1)} млн</span> нейронов.
            </p>
            <p className="source">
              Модельный пример: интервалы условные и зависят от клиники. Ускорение первичной оценки в 5 раз — по данным
              Momentum. Решение о терапии всегда принимает врач.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
