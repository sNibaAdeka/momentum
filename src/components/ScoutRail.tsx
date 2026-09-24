import { useEffect, useState } from 'react'
import { SECTIONS } from '../lib/sections'

/*
 * CT "scout" (topogram): a lateral view of the head with lines marking slice positions.
 * Here each slice is a section of the page — the reader is always told which slice of the series they're on.
 */
const TOP = 14
const BOTTOM = 92

export function ScoutRail() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = SECTIONS.findIndex((s) => s.id === e.target.id)
            if (idx >= 0) setActive(idx)
          }
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const step = (BOTTOM - TOP) / (SECTIONS.length - 1)
  const current = SECTIONS[active]

  return (
    <nav className={`scout${visible ? ' is-visible' : ''}`} aria-label="Разделы страницы">
      <svg className="scout__head" viewBox="0 0 64 110" aria-hidden="true">
        <path
          d="M36 6c14 0 24 11 24 27 0 9-3 15-6 20l1 12c0 4-2 7-6 8l-4 1v12c0 6-4 11-10 12l-9 2-8-3c-4-2-6-6-6-10l1-9-5-2c-3-1-4-4-3-6l3-5-2-3c-1-2 0-4 2-5l2-1-1-6C9 22 20 6 36 6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <ellipse cx="37" cy="31" rx="18" ry="16" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth=".8" />
      </svg>
      <ol className="scout__slices">
        {SECTIONS.map((s, i) => (
          <li key={s.id} style={{ top: `${TOP + i * step}%` }}>
            <a
              href={`#${s.id}`}
              className={`scout__slice${i === active ? ' is-active' : ''}`}
              aria-current={i === active ? 'true' : undefined}
            >
              <span className="sr-only">{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
      <p className="scout__label readout" aria-live="off">
        <span className="scout__count">
          {String(active + 1).padStart(2, '0')}/{String(SECTIONS.length).padStart(2, '0')}
        </span>
        <span className="scout__name">{current.label}</span>
      </p>
    </nav>
  )
}
