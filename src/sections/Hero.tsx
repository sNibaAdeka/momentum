import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { MagneticButton, Counter, Lightbox, Wedge, Clips } from '../components/primitives'
import { LiquidMetalButton } from '../components/ui/liquid-metal-button'
import { FallbackScan } from '../components/FallbackScan'
import { easeOut, hasWebGL, isCoarsePointer, isLowPower, isNarrow } from '../lib/env'
import { fmtDec } from '../lib/format'
import type { BrainSceneHandle, SceneLabel } from '../three/types'

type StageMode = 'loading' | 'webgl' | 'fallback'

/** The CT volume on the film. The scene positions the grease-pencil annotation over the infarct. */
function VolumeStage() {
  const host = useRef<HTMLDivElement>(null)
  const lesionEl = useRef<HTMLDivElement>(null)
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
          const labels: SceneLabel[] = lesionEl.current ? [{ id: 'lesion', el: lesionEl.current }] : []
          handle = createStackScene(host.current, {
            quality,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            labels,
            onReady: () => !cancelled && setMode('webgl'),
            onFail: () => !cancelled && setMode('fallback'),
          })
        })
        .catch(() => !cancelled && setMode('fallback'))
    }
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const idleId = hasIdle ? window.requestIdleCallback(start, { timeout: 600 }) : window.setTimeout(start, 120)

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        // 0 while the device is at/below the viewport centre, grows as it scrolls away upward
        const r = el.getBoundingClientRect()
        handle?.setScroll(Math.max(0, (window.innerHeight * 0.5 - (r.top + r.height / 2)) / window.innerHeight) * 1.4)
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
    <div className={`vstage is-${mode}`}>
      {mode !== 'webgl' && <FallbackScan animated={!reduce} />}
      <div ref={host} className="vstage__gl" />
      <div className="vstage__labels" aria-hidden="true">
        <div ref={lesionEl} className="gp">
          <svg className="gp__loop" viewBox="0 0 220 140">
            <path
              className="pencil"
              pathLength={1}
              d="M40 88C22 62 44 26 102 20c58-6 104 18 98 56-5 34-58 50-108 46C44 118 14 96 26 66c8-20 40-34 84-36"
            />
          </svg>
          <svg className="gp__tail" viewBox="0 0 120 70">
            <path className="pencil" pathLength={1} d="M4 64C30 50 58 30 112 8" />
          </svg>
          <span className="gp__note hand">
            ишемия
            <br />
            32,8 мл
          </span>
        </div>
      </div>
      {mode === 'webgl' && <p className="vstage__hint print">Потяните — объём вращается</p>}
    </div>
  )
}

const METRICS = [
  { label: 'AI confidence', node: <Counter to={97.4} duration={1.8} format={(n) => `${fmtDec(n, 1)} %`} /> },
  { label: 'Объём очага', node: <Counter to={32.8} duration={1.6} format={(n) => `${fmtDec(n, 1)} мл`} /> },
  { label: 'Время анализа', node: <Counter to={18} duration={1.4} format={(n) => `${Math.round(n)} с`} /> },
  { label: 'Статус', node: <span className="coral">High priority</span> },
  { label: 'Локализация', node: 'MCA / M2' },
]

export function Hero() {
  const reduce = useReducedMotion()
  const item = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 26 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: easeOut, delay: 0.08 + i * 0.08 },
  })
  const figRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: figRef, offset: ['start end', 'center center'] })
  const tiltX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [26, 0])
  const tiltScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.88, 1])
  const tiltY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [60, 0])
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__inner">
        <motion.p className="label hero__label" {...item(0)}>
          <b>AI Stroke Detection</b> / V1.3 Beta
        </motion.p>
        <h1 id="hero-title" className="display hero__title">
          <motion.span {...item(1)}>Диагноз за секунды.</motion.span>
          <motion.span className="accent-i hero__accent" {...item(2)}>
            Не за часы.
          </motion.span>
        </h1>
        <motion.p className="lead hero__lead" {...item(3)}>
          Momentum анализирует КТ и МРТ, выделяет зону поражения и формирует понятный отчёт, пока пациент ещё находится в
          аппарате.
        </motion.p>
        <motion.div className="hero__ctas" {...item(4)}>
          <LiquidMetalButton href="#contact" label="Запросить демо" />
          <MagneticButton href="#how" variant="ghost">
            Как это работает
          </MagneticButton>
        </motion.div>
        <motion.p className="hero__meta" {...item(5)}>
          PACS / HIS · результат за секунды · работа 24/7
        </motion.p>

        <motion.figure
          className="hero__fig"
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.5 }}
        >
          <div ref={figRef} className="hero__tiltwrap">
          <motion.div className="hero__tilt" style={{ rotateX: tiltX, scale: tiltScale, y: tiltY }}>
          <Lightbox flicker className="hero__box">
            <div className="film hero__film">
              <Clips />
              <Wedge />
              <p className="film__corner film__corner--tl print">
                MOMENTUM V1.3
                <br />
                КТ головного мозга · без контраста
                <br />
                Серия 4 · 28 × 5,0 мм
              </p>
              <p className="film__corner film__corner--tr print">
                W 80 · L 40
                <br />
                Объёмная реконструкция
                <br />
                <span className="hero__live">
                  <span aria-hidden="true" /> анализ идёт
                </span>
              </p>
              <VolumeStage />
              <dl className="film__strip" aria-label="Пример результата анализа">
                {METRICS.map((m) => (
                  <div key={m.label}>
                    <dt className="print">{m.label}</dt>
                    <dd>{m.node}</dd>
                  </div>
                ))}
              </dl>
              <p className="film__edge print" aria-hidden="true">
                MOMENTUM · AI STROKE DETECTION · SER 4 · IMG 15/28 · SYNTHETIC
              </p>
            </div>
          </Lightbox>
          </motion.div>
          </div>


          <figcaption className="hero__caption">
            <span className="serif">Рис. 1.</span> Синтетическое исследование, не данные пациента.
          </figcaption>
        </motion.figure>
      </div>
    </section>
  )
}
