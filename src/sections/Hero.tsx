import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MagneticButton, Counter } from '../components/primitives'
import { FallbackScan } from '../components/FallbackScan'
import { easeOut, hasWebGL, isCoarsePointer, isLowPower, isNarrow } from '../lib/env'
import { fmtDec } from '../lib/format'
import type { BrainSceneHandle, SceneLabel } from '../three/types'

type StageMode = 'loading' | 'webgl' | 'fallback'

function BrainStage() {
  const host = useRef<HTMLDivElement>(null)
  const lesionEl = useRef<HTMLDivElement>(null)
  const fidA = useRef<HTMLDivElement>(null)
  const fidB = useRef<HTMLDivElement>(null)
  const fidC = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<StageMode>('loading')
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!hasWebGL()) {
      setMode('fallback')
      return
    }
    let handle: BrainSceneHandle | null = null
    let cancelled = false
    const quality = isCoarsePointer() || isNarrow() || isLowPower() ? 'low' : 'high'

    const start = () => {
      import('../three/StackScene')
        .then(({ createStackScene }) => {
          if (cancelled || !host.current) return
          const labels: SceneLabel[] = []
          if (lesionEl.current) labels.push({ id: 'lesion', el: lesionEl.current })
          if (fidA.current) labels.push({ id: 'fid-a', el: fidA.current })
          if (fidB.current) labels.push({ id: 'fid-b', el: fidB.current })
          if (fidC.current) labels.push({ id: 'fid-c', el: fidC.current })
          handle = createStackScene(host.current, {
            quality,
            reducedMotion: !!window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            labels,
            onReady: () => !cancelled && setMode('webgl'),
            onFail: () => !cancelled && setMode('fallback'),
          })
        })
        .catch(() => !cancelled && setMode('fallback'))
    }
    // lazy: let the headline paint first
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const idleId = hasIdle ? window.requestIdleCallback(start, { timeout: 700 }) : window.setTimeout(start, 150)

    const hero = el.closest('.hero') as HTMLElement | null
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const hgt = hero?.offsetHeight || window.innerHeight
        handle?.setScroll(window.scrollY / hgt)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('scroll', onScroll)
      if (hasIdle) window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      handle?.dispose()
    }
  }, [])

  return (
    <div className={`bstage is-${mode}`}>
      {mode !== 'webgl' && <FallbackScan animated={!reduce} />}
      <div ref={host} className="bstage__gl" />
      <div className="bstage__labels" aria-hidden="true">
        <div ref={lesionEl} className="blabel blabel--lesion">
          <span className="blabel__ring" />
          <span className="blabel__leader" />
          <span className="blabel__box">
            <span className="blabel__title">Очаг · ишемия</span>
            <span className="readout">32,8 мл · MCA / M2</span>
          </span>
        </div>
        {[fidA, fidB, fidC].map((r, i) => (
          <div key={i} ref={r} className="blabel blabel--fid">
            <span className="readout" data-coord />
          </div>
        ))}
      </div>
      {mode === 'webgl' && (
        <p className="bstage__hint readout" aria-hidden="true">
          Потяните, чтобы повернуть
        </p>
      )}
    </div>
  )
}

function HeroHud() {
  const reduce = useReducedMotion()
  const rows: { label: string; value: ReactNode; tone?: 'alert' }[] = [
    { label: 'AI confidence', value: <Counter to={97.4} duration={1.8} format={(n) => `${fmtDec(n, 1)} %`} /> },
    { label: 'Объём очага', value: <Counter to={32.8} duration={1.6} format={(n) => `${fmtDec(n, 1)} мл`} /> },
    { label: 'Время анализа', value: <Counter to={18} duration={1.4} format={(n) => `${Math.round(n)} с`} /> },
    { label: 'Статус', value: 'High priority', tone: 'alert' },
    { label: 'Локализация', value: 'MCA / M2' },
  ]
  return (
    <motion.aside
      className="hud glass"
      aria-label="Пример результата анализа"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut, delay: 0.7 }}
    >
      <div className="hud__head">
        <span className="hud__live" aria-hidden="true" />
        <span className="readout">КТ без контраста · серия 4 · 28 срезов</span>
      </div>
      <dl className="hud__rows">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            className="hud__row"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.85 + i * 0.06 }}
          >
            <dt>{r.label}</dt>
            <dd className={r.tone === 'alert' ? 'hud__value hud__value--alert' : 'hud__value'}>{r.value}</dd>
          </motion.div>
        ))}
      </dl>
      <div className="hud__bar" aria-hidden="true">
        <span style={{ transform: 'scaleX(0.974)' }} />
      </div>
      <p className="hud__foot">
        <span className="hud__scanline" aria-hidden="true" />
        Диагностика, пока пациент ещё в сканере
      </p>
    </motion.aside>
  )
}

export function Hero() {
  const reduce = useReducedMotion()
  const item = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: easeOut, delay: 0.1 + i * 0.08 },
  })
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero__grid" aria-hidden="true" />
      <div className="hero__stage">
        <BrainStage />
      </div>

      <div className="hero__corners" aria-hidden="true">
        <p className="readout hero__corner hero__corner--tl">
          MOMENTUM V1.3
          <br />
          КТ головного мозга · аксиальная
        </p>
        <p className="readout hero__corner hero__corner--tr">
          W 80 · L 40
          <br />
          Срез 15 / 28 · 5,0 мм
        </p>
        <div className="hero__corner hero__corner--bl">
          <span className="hero__scale" />
          <span className="readout">50 мм</span>
        </div>
        <p className="readout hero__corner hero__corner--br">Синтетическая модель, не данные пациента</p>
      </div>

      <div className="wrap hero__inner">
        <div className="hero__copy">
          <motion.p className="hero__tag" {...item(0)}>
            <span className="hero__tag-dot" aria-hidden="true" />
            AI STROKE DETECTION / V1.3 BETA
          </motion.p>
          <h1 id="hero-title" className="display hero__title">
            <motion.span className="hero__line" {...item(1)}>
              Диагноз <br />
              за секунды.
            </motion.span>
            <motion.span className="hero__line coral" {...item(2)}>
              Не за часы.
            </motion.span>
          </h1>
          <motion.p className="lead hero__lead" {...item(3)}>
            Momentum анализирует КТ и МРТ, выделяет зону поражения и формирует понятный отчёт, пока пациент ещё находится в
            аппарате.
          </motion.p>
          <motion.div className="hero__ctas" {...item(4)}>
            <MagneticButton href="#contact">Запросить демо</MagneticButton>
            <MagneticButton href="#how" variant="ghost">
              Как это работает
            </MagneticButton>
          </motion.div>
          <motion.p className="hero__meta" {...item(5)}>
            PACS / HIS · результат за секунды · работа 24/7
          </motion.p>
        </div>
        <HeroHud />
      </div>
    </section>
  )
}
