import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ScanReveal, Reveal } from '../components/primitives'
import { hasWebGL, isCoarsePointer, isNarrow } from '../lib/env'
import type { GlobeHandle, GlobeLabel } from '../three/GlobeScene'

const TIERS = [
  { id: 'tam', name: 'TAM', value: '$1,759 млрд', growth: 'CAGR 9 %', text: 'Мировой рынок AI-диагностики инсульта' },
  { id: 'sam', name: 'SAM', value: '$0,32 млрд', growth: 'CAGR 38,4 %', text: 'Сегмент, доступный продукту' },
  { id: 'som', name: 'SOM', value: '$5 млн', growth: 'цель', text: 'Реалистичная доля на старте' },
]

// other markets are pins on the globe; they are named in the copy next to it
const PLACES: { id: string; name: string; home?: boolean }[] = [{ id: 'kz', name: 'старт — Казахстан', home: true }]

/** 3D globe with TAM / SAM / SOM rings. Loaded only when the section approaches the viewport. */
function GlobeStage() {
  const host = useRef<HTMLDivElement>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!hasWebGL()) {
      setFailed(true)
      return
    }
    let handle: GlobeHandle | null = null
    let cancelled = false
    const section = el.closest('section')
    const onScroll = () => {
      if (!section || !handle) return
      const r = section.getBoundingClientRect()
      handle.setScroll((window.innerHeight - r.top) / (window.innerHeight + r.height))
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || handle) return
        io.disconnect()
        import('../three/GlobeScene')
          .then(({ createGlobe }) => {
            if (cancelled || !host.current) return
            const labels: GlobeLabel[] = Object.entries(refs.current)
              .filter((kv): kv is [string, HTMLDivElement] => !!kv[1])
              .map(([id, node]) => ({ id, el: node }))
            handle = createGlobe(host.current, {
              quality: isCoarsePointer() || isNarrow() ? 'low' : 'high',
              reducedMotion: !!reduce,
              labels,
              onReady: () => !cancelled && setReady(true),
            })
            onScroll()
          })
          .catch(() => !cancelled && setFailed(true))
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      handle?.dispose()
    }
  }, [reduce])

  return (
    <div className={`globe${ready ? ' is-ready' : ''}${failed ? ' is-failed' : ''}`} aria-hidden="true">
      <div ref={host} className="globe__gl" />
      <div className="globe__labels">
        {PLACES.map((p) => (
          <div key={p.id} ref={(n) => { refs.current[p.id] = n }} className={`glabel${p.home ? ' glabel--home' : ''}`}>
            <span className={p.home ? 'hand' : ''}>{p.name}</span>
          </div>
        ))}
        {TIERS.map((t) => (
          <div key={t.id} ref={(n) => { refs.current[t.id] = n }} className={`glabel glabel--ring glabel--${t.id}`}>
            <b>{t.name}</b> {t.value}
          </div>
        ))}
      </div>
      {failed && <div className="globe__fallback" />}
    </div>
  )
}

export function Market() {
  return (
    <section id="market" className="section market theme-dark" aria-labelledby="market-title">
      <div className="wrap market__grid">
        <div className="market__copy">
          <ScanReveal>
            <p className="label"><b>05</b> Рынок</p>
            <h2 id="market-title" className="h2"><span>Рынок растёт быстрее,</span><span className="accent-i">чем очередь на описание.</span></h2>
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
            Старт в Казахстане, дальше — Корея, Саудовская Аравия, Китай, ЕС и США.
          </p>
          <p className="source">World Stroke Organization · MarketsAndMarkets, Stroke AI Market Report</p>
        </div>

        <GlobeStage />
      </div>
    </section>
  )
}
