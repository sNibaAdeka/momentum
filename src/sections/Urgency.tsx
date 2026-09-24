import { useEffect, useState } from 'react'
import { Counter, PencilUnderline, ScanReveal, Reveal, useDrawn } from '../components/primitives'
import { NEURONS_PER_SECOND, useElapsed } from '../lib/clock'
import { fmtDec, fmtInt } from '../lib/format'
import { sliceUrl } from '../ct/cache'

/* Counts neurons lost since this block scrolled into view — the statistic, made physical. */
function LiveLoss({ active }: { active: boolean }) {
  const t = useElapsed()
  const [since, setSince] = useState<number | null>(null)
  useEffect(() => {
    if (active && since === null) setSince(t)
  }, [active, since, t])
  const lost = since === null ? 0 : (t - since) * NEURONS_PER_SECOND
  return (
    <p className="urg__live">
      <span className="hand">пока вы читаете:</span> <b className="num">−{fmtInt(lost)}</b>
    </p>
  )
}

function useSlice(index: number, active: boolean) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!active || url) return
    const id = window.setTimeout(() => setUrl(sliceUrl(index)), 30)
    return () => window.clearTimeout(id)
  }, [active, index, url])
  return url
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
  const [ref, seen] = useDrawn<HTMLDivElement>()
  const bg = useSlice(18, seen)
  return (
    <section id="urgency" className="section urg theme-dark" aria-labelledby="urg-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <p className="label"><b>01</b> Срочность</p>
            <h2 id="urg-title" className="h2"><span>Пока снимок ждёт описания,</span><span className="accent-i">мозг теряет клетки.</span></h2>
          </ScanReveal>
          <Reveal delay={0.1}>
            <p className="lead">
              Самая долгая часть маршрута часто не снимок, а ожидание его описания.
            </p>
          </Reveal>
        </div>

        <div ref={ref}>
                      <div className="urg__films">
              <article className="card urg__film urg__film--main">
                <div className="urg__inner">
                {bg && <img className="urg__bg" src={bg} alt="" aria-hidden="true" />}
                <p className="urg__figure serif">
                  <Counter to={1.9} duration={1.8} format={(n) => `${fmtDec(n, 1)} млн`} />
                  <PencilUnderline drawn={seen} className="urg__under" />
                </p>
                <p className="urg__caption">нейронов гибнут каждую минуту без лечения</p>
                <LiveLoss active={seen} />
                <p className="film__source print">Saver J.L., Stroke, 2006</p>
              </div>
              </article>

              <article className="card urg__film">
                <div className="urg__inner">
                <div className="urg__row">
                  <p className="urg__figure urg__figure--sm serif">
                    2 <span className="urg__of">из</span> 3
                  </p>
                  <Patients />
                </div>
                <p className="urg__caption">пациентов получают лечение позже рекомендованных 60 минут</p>
                <p className="film__source print">AHA/ASA Guidelines, Acute Ischemic Stroke</p>
              </div>
              </article>

              <article className="card urg__film">
                <div className="urg__inner">
                <p className="urg__figure urg__figure--sm serif">
                  <Counter to={890} duration={1.6} format={(n) => `$${fmtInt(n)} млрд`} />
                </p>
                <p className="urg__caption">ежегодная мировая экономическая нагрузка инсульта</p>
                <p className="film__source print">World Stroke Organization, 2025</p>
              </div>
              </article>
            </div>
        </div>
      </div>
    </section>
  )
}
