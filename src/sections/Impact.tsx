import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { Counter, ScanReveal, SpotlightPanel } from '../components/primitives'
import { DataSphere } from '../components/DataSphere'
import { fmtDec, fmtInt, plural } from '../lib/format'

function Prisms() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const reduce = useReducedMotion()
  const on = inView || !!reduce
  return (
    <div ref={ref} className={`prisms${on ? ' is-on' : ''}`} aria-hidden="true">
      <div className="prisms__scene">
        {[
          { cls: 'prism--manual', h: 1, label: 'Первичная ручная оценка' },
          { cls: 'prism--ai', h: 0.2, label: 'Momentum' },
        ].map((p) => (
          <div key={p.cls} className="prisms__col">
            <div className={`prism ${p.cls}`} style={{ '--h': p.h } as CSSProperties}>
              <span className="prism__face prism__face--front" />
              <span className="prism__face prism__face--side" />
              <span className="prism__face prism__face--top" />
            </div>
            <span className="prisms__label">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Clock24() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const hour = now.getHours() + now.getMinutes() / 60
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now)
  return (
    <div className="clock24">
      <svg viewBox="0 0 300 300" className="clock24__dial" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2
          const r1 = i % 6 === 0 ? 132 : 138
          return (
            <line
              key={i}
              x1={150 + Math.cos(a) * r1}
              y1={150 + Math.sin(a) * r1}
              x2={150 + Math.cos(a) * 146}
              y2={150 + Math.sin(a) * 146}
              className={i % 6 === 0 ? 'clock24__tick clock24__tick--major' : 'clock24__tick'}
            />
          )
        })}
        <circle
          cx={150 + Math.cos((hour / 24) * Math.PI * 2 - Math.PI / 2) * 139}
          cy={150 + Math.sin((hour / 24) * Math.PI * 2 - Math.PI / 2) * 139}
          r="5"
          className="clock24__now"
        />
        {['00', '06', '12', '18'].map((l, i) => {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2
          return (
            <text key={l} x={150 + Math.cos(a) * 116} y={150 + Math.sin(a) * 116 + 4} className="clock24__txt">
              {l}
            </text>
          )
        })}
      </svg>
      <DataSphere size={200} className="clock24__sphere" />
      <p className="clock24__now-label readout">Сейчас {time} — Momentum на смене</p>
    </div>
  )
}

function Flow() {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const nodes = [
    { x: 60, label: 'КТ / МРТ' },
    { x: 220, label: 'PACS' },
    { x: 380, label: 'Momentum', accent: true },
    { x: 540, label: 'HIS · врач' },
  ]
  return (
    <svg viewBox="0 0 600 150" className="flow" role="img" aria-label="Путь исследования: аппарат КТ или МРТ, PACS, Momentum, HIS и врач">
      <path id={`flow-${id}`} d="M60 75 H540" className="flow__line" />
      {nodes.map((n) => (
        <g key={n.label} transform={`translate(${n.x} 75)`}>
          <rect x="-54" y="-24" width="108" height="48" rx="10" className={n.accent ? 'flow__node flow__node--accent' : 'flow__node'} />
          <text y="5" className="flow__txt">
            {n.label}
          </text>
        </g>
      ))}
      {!reduce &&
        [0, 1.1, 2.2].map((d) => (
          <circle key={d} r="3.5" className="flow__packet">
            <animateMotion dur="3.3s" begin={`${d}s`} repeatCount="indefinite">
              <mpath href={`#flow-${id}`} />
            </animateMotion>
          </circle>
        ))}
    </svg>
  )
}

function Roi() {
  const [studies, setStudies] = useState(300)
  const [minutes, setMinutes] = useState(20)
  const hours = (studies * (minutes - minutes / 5)) / 60
  const shifts = hours / 8
  return (
    <div className="roi">
      <div className="roi__inputs">
        <h3 className="h3">Посчитайте для своей клиники</h3>
        <label className="roi__field">
          <span className="roi__label">
            КТ и МРТ головы в месяц <b className="num">{fmtInt(studies)}</b>
          </span>
          <input type="range" min={50} max={2000} step={10} value={studies} onChange={(e) => setStudies(Number(e.target.value))} />
        </label>
        <label className="roi__field">
          <span className="roi__label">
            Минут на первичную оценку <b className="num">{minutes}</b>
          </span>
          <input type="range" min={5} max={45} step={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
      </div>
      <div className="roi__out" aria-live="polite">
        <p className="roi__big num">
          {fmtInt(hours)} <span>{plural(hours, ['час', 'часа', 'часов'])}</span>
        </p>
        <p className="roi__cap">
          рабочего времени врачей высвобождается в месяц — это {fmtDec(shifts, 1)} смены по 8 часов
        </p>
        <p className="source">
          Оценка на основе ускорения первичной оценки в 5 раз. Не учитывает время на подтверждение и оформление заключения.
        </p>
      </div>
    </div>
  )
}

export function Impact() {
  return (
    <section id="impact" className="section impact" aria-labelledby="impact-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <h2 id="impact-title" className="h2">
              Что меняется в клинике
            </h2>
          </ScanReveal>
          <p className="lead">Быстрее первичная оценка, меньше очередь на описание, одинаковое качество ночью и днём.</p>
        </div>

        <div className="impact__grid">
          <SpotlightPanel className="icard icard--speed" tilt={0}>
            <div className="icard__text">
              <p className="icard__figure">
                <Counter to={5} duration={1.2} format={(n) => `${Math.max(1, Math.round(n))}×`} />
              </p>
              <p className="icard__cap">быстрее первичной ручной оценки</p>
            </div>
            <Prisms />
          </SpotlightPanel>

          <SpotlightPanel className="icard icard--money" tilt={0}>
            <p className="icard__figure">
              <Counter to={100000} duration={1.8} format={(n) => `$${fmtInt(Math.round(n / 1000) * 1000)}`} />
            </p>
            <p className="icard__cap">потенциальная экономия клиники в год</p>
            <p className="source">Оценка Momentum; зависит от потока исследований и штата.</p>
          </SpotlightPanel>

          <SpotlightPanel className="icard icard--clock" tilt={0}>
            <div className="icard__text">
              <p className="icard__figure">24/7</p>
              <p className="icard__cap">круглосуточный анализ — ночью и в выходные так же, как днём</p>
            </div>
            <Clock24 />
          </SpotlightPanel>

          <SpotlightPanel className="icard icard--flow" tilt={0}>
            <div className="icard__text">
              <p className="icard__figure icard__figure--word">PACS · HIS</p>
              <p className="icard__cap">интеграция в существующий маршрут: без нового окна и лишних кликов</p>
            </div>
            <Flow />
          </SpotlightPanel>

          <SpotlightPanel className="icard icard--roi" tilt={0}>
            <Roi />
          </SpotlightPanel>
        </div>
      </div>
    </section>
  )
}
