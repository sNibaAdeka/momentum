import { Counter, ScanReveal, SpotlightPanel, Reveal } from '../components/primitives'
import { NEURONS_PER_SECOND, useElapsed } from '../lib/clock'
import { fmtDec, fmtInt } from '../lib/format'
import { useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

/* Counts neurons lost since this block scrolled into view — the statistic, made physical. */
function LiveLoss() {
  const ref = useRef<HTMLParagraphElement>(null)
  const inView = useInView(ref, { once: true })
  const t = useElapsed()
  const [since, setSince] = useState<number | null>(null)
  useEffect(() => {
    if (inView && since === null) setSince(t)
  }, [inView, since, t])
  const lost = since === null ? 0 : (t - since) * NEURONS_PER_SECOND
  return (
    <p ref={ref} className="urg__live">
      <span className="urg__live-dot" aria-hidden="true" />
      <span>
        С момента, как вы начали читать этот блок: <b className="num">−{fmtInt(lost)}</b>
      </span>
    </p>
  )
}

function Patients() {
  return (
    <div className="urg__patients" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 40 64" className={i < 2 ? 'is-late' : 'is-ontime'}>
          <circle cx="20" cy="12" r="9" />
          <path d="M5 62V38c0-9 6.5-15 15-15s15 6 15 15v24" />
        </svg>
      ))}
    </div>
  )
}

export function Urgency() {
  return (
    <section id="urgency" className="section urg" aria-labelledby="urg-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <h2 id="urg-title" className="h2">
              Пока снимок ждёт описания, мозг теряет клетки
            </h2>
          </ScanReveal>
          <Reveal delay={0.1}>
            <p className="lead">
              При ишемическом инсульте счёт идёт на минуты. Самая долгая часть маршрута часто не сам снимок, а ожидание его
              расшифровки.
            </p>
          </Reveal>
        </div>

        <div className="urg__grid">
          <SpotlightPanel as="article" className="urg__card urg__card--main" tilt={3}>
            <p className="urg__figure coral">
              <Counter to={1.9} duration={1.8} format={(n) => `${fmtDec(n, 1)} млн`} />
            </p>
            <p className="urg__caption">нейронов гибнут каждую минуту без лечения</p>
            <LiveLoss />
            <p className="source">Saver J.L., «Time is brain — quantified», Stroke, 2006</p>
          </SpotlightPanel>

          <SpotlightPanel as="article" className="urg__card">
            <div className="urg__row">
              <p className="urg__figure urg__figure--sm">
                2 <span className="urg__of">из</span> 3
              </p>
              <Patients />
            </div>
            <p className="urg__caption">пациентов получают лечение позже рекомендованных 60 минут</p>
            <p className="source">AHA/ASA Guidelines for the Early Management of Acute Ischemic Stroke</p>
          </SpotlightPanel>

          <SpotlightPanel as="article" className="urg__card">
            <p className="urg__figure urg__figure--sm">
              <Counter to={890} duration={1.6} format={(n) => `$${fmtInt(n)} млрд`} />
            </p>
            <p className="urg__caption">ежегодная мировая экономическая нагрузка инсульта</p>
            <p className="source">World Stroke Organization, Global Stroke Fact Sheet 2025</p>
          </SpotlightPanel>
        </div>
      </div>
    </section>
  )
}
