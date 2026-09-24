import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { Counter, LogoMark, ScanReveal } from '../components/primitives'
import { OrbitingCircles, Ripple } from '@/components/ui/orbiting-circles'
import { HealthStatCard, type HealthGraphData, type StatData } from '@/components/ui/health-stat-card'
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

function Integrations() {
  const chip = (t: string) => <span className="orbit__chip">{t}</span>
  return (
    <div className="orbit" role="img" aria-label="Momentum в центре маршрута: КТ, МРТ, PACS, HIS и врач">
      <Ripple mainCircleSize={110} numCircles={4} />
      <div className="orbit__core">
        <LogoMark size={40} />
      </div>
      <OrbitingCircles radius={92} duration={26} iconSize={56}>
        {chip('КТ')}
        {chip('МРТ')}
      </OrbitingCircles>
      <OrbitingCircles radius={156} duration={40} reverse iconSize={64}>
        {chip('PACS')}
        {chip('HIS')}
        {chip('Врач')}
      </OrbitingCircles>
    </div>
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


const PANEL_STATS: StatData[] = [
  { title: 'исследований за сутки', value: 42 },
  { title: 'среднее время анализа', value: 18, unit: 'с' },
  { title: 'высокий приоритет', value: 3 },
]
const PANEL_BARS: HealthGraphData[] = [
  { label: '00–03', value: 34, color: '#2d44ff', description: 'Ночная смена: анализ без очереди' },
  { label: '03–06', value: 22, color: '#2d44ff', description: 'Ночная смена' },
  { label: '06–09', value: 48, color: '#9aa3a8', description: 'Утро' },
  { label: '09–12', value: 86, color: '#9aa3a8', description: 'Пик плановых исследований' },
  { label: '12–15', value: 100, color: '#d8432c', description: 'Пик + 2 приоритетных случая' },
  { label: '15–18', value: 92, color: '#9aa3a8', description: 'День' },
  { label: '18–21', value: 70, color: '#9aa3a8', description: 'Вечер' },
  { label: '21–24', value: 55, color: '#2d44ff', description: 'Ночная смена' },
]

function DepartmentPanel() {
  return (
    <div className="panelwrap">
      <HealthStatCard
        headerIcon={<Activity className="h-6 w-6" aria-hidden="true" />}
        title="Панель отделения"
        stats={PANEL_STATS}
        graphData={PANEL_BARS}
        graphHeight={140}
        showLegend={false}
        className="max-w-none"
      />
      <p className="source">Загрузка по часам, % от пика. Так выглядит аналитика клиники в тарифе Clinic+. Данные условные.</p>
    </div>
  )
}

export function Impact() {
  return (
    <section id="impact" className="section impact" aria-labelledby="impact-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <p className="label"><b>05</b> Эффект</p>
            <h2 id="impact-title" className="h2"><span>Что меняется</span><span className="accent-b">в клинике.</span></h2>
          </ScanReveal>
          <p className="lead">Быстрее первичная оценка, меньше очередь на описание, одинаковое качество ночью и днём.</p>
        </div>

        <div className="impact__grid">
          <div className="icard icard--speed">
            <div className="icard__text">
              <p className="icard__figure">
                <Counter to={5} duration={1.2} format={(n) => `${Math.max(1, Math.round(n))}×`} />
              </p>
              <p className="icard__cap">быстрее первичной ручной оценки</p>
            </div>
            <Prisms />
          </div>

          <div className="icard icard--money">
            <p className="icard__figure">
              <Counter to={100000} duration={1.8} format={(n) => `$${fmtInt(Math.round(n / 1000) * 1000)}`} />
            </p>
            <p className="icard__cap">потенциальная экономия клиники в год</p>
            <p className="source">Оценка Momentum; зависит от потока исследований и штата.</p>
          </div>

          <div className="icard icard--clock">
            <div className="icard__text">
              <p className="icard__figure">24/7</p>
              <p className="icard__cap">круглосуточный анализ — ночью и в выходные так же, как днём</p>
            </div>
            <Clock24 />
          </div>

          <div className="icard icard--flow">
            <div className="icard__text">
              <p className="icard__figure icard__figure--word">PACS · HIS</p>
              <p className="icard__cap">интеграция в существующий маршрут: без нового окна и лишних кликов</p>
            </div>
            <Integrations />
          </div>

          <div className="icard icard--roi">
            <Roi />
          </div>

          <div className="icard icard--panel">
            <DepartmentPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
