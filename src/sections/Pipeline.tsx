import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { BellRing } from 'lucide-react'
import { ScanReveal, Reveal } from '../components/primitives'
import { sliceUrl } from '../ct/cache'

/* ---------- stage visuals ---------- */

function StackVisual({ active }: { active: boolean }) {
  const [urls, setUrls] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '200px' })
  useEffect(() => {
    if (!inView) return
    let cancelled = false
    const picks = [6, 9, 12, 15, 18, 21, 24]
    const out: string[] = []
    const next = (i: number) => {
      if (cancelled || i >= picks.length) return
      out.push(sliceUrl(picks[i]))
      setUrls([...out])
      setTimeout(() => next(i + 1), 16)
    }
    next(0)
    return () => {
      cancelled = true
    }
  }, [inView])
  return (
    <div ref={ref} className={`vis-stack${active ? ' is-active' : ''}`} aria-hidden="true">
      <div className="vis-stack__pile">
        {urls.map((u, i) => (
          <div key={i} className="vis-stack__plate" style={{ '--i': i } as CSSProperties}>
            <img src={u} alt="" />
          </div>
        ))}
      </div>
      <p className="vis-stack__meta readout">DICOM · 28 срезов × 5 мм · 14,2 МБ</p>
    </div>
  )
}

function TypeVisual({ active }: { active: boolean }) {
  const rows = [
    { label: 'Ишемический', value: 97.4, tone: 'alert' },
    { label: 'Геморрагический', value: 1.8, tone: 'dim' },
    { label: 'Без признаков', value: 0.8, tone: 'dim' },
  ]
  return (
    <div className={`vis-type${active ? ' is-active' : ''}`} aria-hidden="true">
      {rows.map((r, i) => (
        <div key={r.label} className={`vis-type__row vis-type__row--${r.tone}`}>
          <span className="vis-type__label">{r.label}</span>
          <span className="vis-type__bar">
            <span style={{ transform: `scaleX(${active ? r.value / 100 : 0})`, transitionDelay: `${i * 80}ms` }} />
          </span>
          <span className="vis-type__val num">{r.value.toLocaleString('ru-RU')} %</span>
        </div>
      ))}
      <div className="vis-type__vol">
        <span className="vis-type__vol-num num">32,8</span>
        <span className="vis-type__vol-unit">мл · объём очага</span>
      </div>
    </div>
  )
}

function wedge(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, inner = 0.22) {
  const pts: string[] = []
  const steps = 18
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
    pts.push(`${(cx + Math.cos(a) * rx).toFixed(1)},${(cy + Math.sin(a) * ry).toFixed(1)}`)
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
    pts.push(`${(cx + Math.cos(a) * rx * inner).toFixed(1)},${(cy + Math.sin(a) * ry * inner).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

function TerritoryVisual({ active }: { active: boolean }) {
  const T = useMemo(
    () => [
      // image left = patient right
      { id: 'aca-r', d: wedge(100, 122, 78, 98, 235, 270), label: '' },
      { id: 'mca-r', d: wedge(100, 122, 78, 98, 140, 235), label: '' },
      { id: 'pca-r', d: wedge(100, 122, 78, 98, 90, 140), label: '' },
      { id: 'aca-l', d: wedge(100, 122, 78, 98, 270, 305), label: '' },
      { id: 'mca-l', d: wedge(100, 122, 78, 98, 305, 400), label: '' },
      { id: 'pca-l', d: wedge(100, 122, 78, 98, 40, 90), label: '' },
    ],
    [],
  )
  return (
    <div className={`vis-terr${active ? ' is-active' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 244">
        <ellipse cx="100" cy="122" rx="86" ry="106" className="vis-terr__skull" />
        {T.map((t) => (
          <path key={t.id} d={t.d} className={`vis-terr__zone vis-terr__zone--${t.id}`} />
        ))}
        <path d="M100 18V226" className="vis-terr__mid" />
        <circle cx="40" cy="118" r="5" className="vis-terr__focus" />
        <circle cx="40" cy="118" r="12" className="vis-terr__focus-ring" />
        <text x="12" y="16" className="vis-terr__txt">R</text>
        <text x="180" y="16" className="vis-terr__txt">L</text>
      </svg>
      <ul className="vis-terr__legend">
        <li>
          <span className="vis-terr__key vis-terr__key--hit" />
          Правая СМА, сегмент M2
        </li>
        <li>
          <span className="vis-terr__key" />
          Бассейны ACA · MCA · PCA
        </li>
      </ul>
    </div>
  )
}

const WORKLIST = [
  { id: 'a', title: 'КТ головного мозга', meta: '14:02 · приёмное', flag: false },
  { id: 'b', title: 'МРТ позвоночника', meta: '13:58 · плановое', flag: false },
  { id: 'c', title: 'КТ органов груди', meta: '13:55 · плановое', flag: false },
  { id: 'd', title: 'КТ головного мозга', meta: '14:05 · Momentum: 32,8 мл, MCA / M2', flag: true },
]

function SendVisual({ active }: { active: boolean }) {
  const list = active ? [WORKLIST[3], ...WORKLIST.slice(0, 3)] : WORKLIST
  return (
    <div className={`vis-send${active ? ' is-active' : ''}`} aria-hidden="true">
      <p className="vis-send__head readout">Рабочий список · дежурная смена</p>
      <ul className="vis-send__list">
        {list.map((r) => (
          <motion.li
            key={r.id}
            layout
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className={`vis-send__row${r.flag ? ' is-flag' : ''}`}
          >
            <span>
              <span className="vis-send__title">{r.title}</span>
              <span className="vis-send__meta">{r.meta}</span>
            </span>
            <span className="vis-send__prio">{r.flag ? 'Высокий приоритет' : 'Обычный'}</span>
          </motion.li>
        ))}
      </ul>
      <div className="vis-send__toast glass">
        <BellRing aria-hidden="true" />
        <span>
          <b>Дежурный невролог</b> получил отчёт с разметкой
        </span>
      </div>
    </div>
  )
}

/* ---------- steps ---------- */

interface Step {
  n: string
  title: string
  text: string
  time: string
  Visual: (p: { active: boolean }) => ReactNode
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Загрузка КТ или МРТ',
    text: 'Серия приходит из PACS автоматически или загружается вручную: DICOM, NIfTI или ZIP-архив.',
    time: '0–4 с',
    Visual: StackVisual,
  },
  {
    n: '02',
    title: 'Тип и объём поражения',
    text: 'Модель отличает ишемический инсульт от геморрагического и измеряет объём очага в миллилитрах.',
    time: '4–12 с',
    Visual: TypeVisual,
  },
  {
    n: '03',
    title: 'Локализация очага',
    text: 'Очаг сопоставляется с сосудистыми бассейнами: видно, какая артерия и какой её сегмент затронуты.',
    time: '12–16 с',
    Visual: TerritoryVisual,
  },
  {
    n: '04',
    title: 'Результат и рекомендации врачу',
    text: 'Исследование поднимается в начало рабочего списка, врач получает отчёт с разметкой и приоритетом.',
    time: '16–18 с',
    Visual: SendVisual,
  },
]

function StepBody({ step, active }: { step: Step; active: boolean }) {
  const V = step.Visual
  return (
    <>
      <div className="step__text">
        <p className="step__num num" aria-hidden="true">
          {step.n}
        </p>
        <h3 className="step__title">{step.title}</h3>
        <p className="body-dim">{step.text}</p>
        <p className="step__time readout">{step.time}</p>
      </div>
      <div className="step__vis">
        <V active={active} />
      </div>
    </>
  )
}

function PinnedCard({ step, i, progress, n, active }: { step: Step; i: number; progress: MotionValue<number>; n: number; active: boolean }) {
  const rel = useTransform(progress, (p) => p * (n - 1) - i)
  const rotateY = useTransform(rel, (r) => Math.max(-1.2, Math.min(1.2, r)) * 34)
  const z = useTransform(rel, (r) => -Math.min(Math.abs(r), 1.4) * 160)
  const opacity = useTransform(rel, (r) => 1 - Math.min(Math.abs(r), 1) * 0.55)
  return (
    <motion.article
      className={`step step--pinned card${active ? ' is-active' : ''}`}
      style={{ rotateY, z, opacity, transformPerspective: 1400 }}
      aria-label={`Этап ${step.n}: ${step.title}`}
    >
      <StepBody step={step} active={active} />
    </motion.article>
  )
}

function MobileStep({ step }: { step: Step }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { margin: '-30% 0px -30% 0px' })
  return (
    <Reveal>
      <article ref={ref} className={`step card${inView ? ' is-active' : ''}`}>
        <StepBody step={step} active={inView} />
      </article>
    </Reveal>
  )
}

function useIsWide() {
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export function Pipeline() {
  const wide = useIsWide()
  const reduce = useReducedMotion()
  const pinned = wide && !reduce
  const ref = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [shift, setShift] = useState(0)
  const [active, setActive] = useState(0)
  const n = STEPS.length

  useLayoutEffect(() => {
    if (!pinned || !track.current) return
    const measure = () => {
      const first = track.current!.children[0] as HTMLElement | undefined
      const second = track.current!.children[1] as HTMLElement | undefined
      if (first && second) setShift(second.offsetLeft - first.offsetLeft)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pinned])

  const x = useTransform(scrollYProgress, (p) => -p * (n - 1) * shift)
  const bar = useTransform(scrollYProgress, (p) => p)
  useMotionValueEvent(scrollYProgress, 'change', (p) => setActive(Math.round(p * (n - 1))))

  return (
    <section id="how" ref={ref} className={`how${pinned ? ' how--pinned' : ''}`} aria-labelledby="how-title">
      <div className={pinned ? 'how__sticky' : 'section'}>
        <div className="wrap">
          <div className="section-head section-head--split how__head">
            <ScanReveal>
              <h2 id="how-title" className="h2">
                Как работает Momentum
              </h2>
            </ScanReveal>
            <p className="lead">
              Четыре шага от снимка до врача — 18 секунд на исследование. Прокручивайте: плёнки едут по негатоскопу, как в
              мотор-альтернаторе рентгенкабинета.
            </p>
          </div>
        </div>

        {pinned ? (
          <>
            <div className="how__viewport">
              <span className="how__tube" aria-hidden="true" />
              <motion.div ref={track} className="how__track" style={{ x }}>
                {STEPS.map((s, i) => (
                  <PinnedCard key={s.n} step={s} i={i} progress={scrollYProgress} n={n} active={active === i} />
                ))}
              </motion.div>
            </div>
            <div className="wrap how__rail" aria-hidden="true">
              <div className="how__rail-line">
                <motion.span style={{ scaleX: bar }} />
              </div>
              <ol className="how__rail-steps">
                {STEPS.map((s, i) => (
                  <li key={s.n} className={i <= active ? 'is-done' : ''}>
                    <span className="num">{s.n}</span> {s.title}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="wrap how__list">
            {STEPS.map((s) => (
              <MobileStep key={s.n} step={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

