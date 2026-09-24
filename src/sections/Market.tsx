import { useRef, type PointerEvent } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { ScanReveal, Reveal } from '../components/primitives'

const TIERS = [
  { id: 'tam', name: 'TAM', value: '$1,759 млрд', growth: 'CAGR 9 %', text: 'Мировой рынок AI-диагностики инсульта' },
  { id: 'sam', name: 'SAM', value: '$0,32 млрд', growth: 'CAGR 38,4 %', text: 'Сегмент, доступный продукту' },
  { id: 'som', name: 'SOM', value: '$5 млн', growth: 'цель', text: 'Реалистичная доля на старте' },
]

export function Market() {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const pd = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 120, damping: 20 })
  const sy = useSpring(py, { stiffness: 120, damping: 20 })
  const sd = useSpring(pd, { stiffness: 120, damping: 20 })
  const rotateX = useTransform(sy, (v) => 62 - v * 10)
  const rotateY = useTransform(sx, (v) => v * 12)
  const samZ = useTransform(sd, (d) => 36 + d * 46)
  const somZ = useTransform(sd, (d) => 84 + d * 110)
  const scene = useRef<HTMLDivElement>(null)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse' || !scene.current) return
    const r = scene.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 2 - 1
    const y = ((e.clientY - r.top) / r.height) * 2 - 1
    px.set(x)
    py.set(y)
    pd.set(Math.max(0, 1 - Math.hypot(x, y)))
  }
  const onLeave = () => {
    px.set(0)
    py.set(0)
    pd.set(0)
  }

  return (
    <section id="market" className="section market" aria-labelledby="market-title">
      <div className="wrap market__grid">
        <div className="market__copy">
          <ScanReveal>
            <h2 id="market-title" className="h2">
              Рынок растёт быстрее, чем очередь на описание
            </h2>
          </ScanReveal>
          <dl className="market__list">
            {TIERS.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.06}>
                <div className={`mtier mtier--${t.id}`}>
                  <dt>
                    <span className="mtier__key" aria-hidden="true" />
                    {t.name}
                    <span className="mtier__text">{t.text}</span>
                  </dt>
                  <dd>
                    <span className="mtier__value num">{t.value}</span>
                    <span className="mtier__growth">{t.growth}</span>
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
          <p className="market__geo">
            Разработано в Казахстане. Следующие рынки — Южная Корея, Саудовская Аравия, Китай, Евросоюз и США.
          </p>
          <p className="source">World Stroke Organization · MarketsAndMarkets, Stroke AI Market Report</p>
        </div>

        <div className="market__scene" ref={scene} onPointerMove={onMove} onPointerLeave={onLeave} aria-hidden="true">
          <motion.div className="rings" style={{ rotateX, rotateY }}>
            <motion.div className="ring ring--tam">
              <span className="ring__spin" />
              <span className="ring__tag">TAM</span>
            </motion.div>
            <motion.div className="ring ring--sam" style={{ z: samZ }}>
              <span className="ring__spin" />
              <span className="ring__tag">SAM</span>
            </motion.div>
            <motion.div className="ring ring--som" style={{ z: somZ }}>
              <span className="ring__note hand">старт — Казахстан</span>
              <span className="ring__spin" />
              <span className="ring__tag">SOM</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
