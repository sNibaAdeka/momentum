import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Logo, MagneticButton } from './primitives'
import { NEURONS_PER_MINUTE, NEURONS_PER_SECOND, ANALYSIS_SECONDS, useElapsed } from '../lib/clock'
import { fmtCompact, fmtDuration, fmtInt, plural } from '../lib/format'
import { easeIn, easeOut } from '../lib/env'
import { SECTIONS } from '../lib/sections'

const LINKS = SECTIONS.filter((s) => s.nav)

/* A live reminder of what the page is about: neurons a patient would lose while this tab is open. */
function NeuronClock() {
  const t = useElapsed()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const lost = t * NEURONS_PER_SECOND
  const studies = Math.floor(t / ANALYSIS_SECONDS)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="nclock" ref={box}>
      <button
        type="button"
        className="nclock__chip"
        aria-expanded={open}
        aria-controls="nclock-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nclock__pulse" aria-hidden="true" />
        <span className="nclock__value num" aria-hidden="true">
          <span className="nclock__full">−{fmtInt(lost)}</span>
          <span className="nclock__short">−{fmtCompact(lost)}</span>
        </span>
        <span className="nclock__unit" aria-hidden="true">
          нейронов
        </span>
        <span className="sr-only">Счётчик потерь нейронов при инсульте без лечения. Подробнее</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="nclock-pop"
            role="dialog"
            aria-label="Что показывает счётчик"
            className="nclock__pop glass"
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: easeOut } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.17, ease: easeIn } }}
          >
            <p className="nclock__pop-figure num">−{fmtInt(lost)}</p>
            <p>
              Столько нейронов потерял бы пациент с ишемическим инсультом без лечения за {fmtDuration(t)} — пока открыта
              эта страница.
            </p>
            <p className="nclock__pop-alt">
              За это же время Momentum успел бы проанализировать {studies}{' '}
              {plural(studies, ['исследование', 'исследования', 'исследований'])}.
            </p>
            <p className="source">
              Расчёт: {fmtInt(NEURONS_PER_MINUTE)} нейронов в минуту. Saver J.L., «Time is brain — quantified», Stroke,
              2006.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const reduce = useReducedMotion()
  const menuBtn = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menu) return
    document.documentElement.style.overflow = 'hidden'
    const first = sheet.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false)
      if (e.key === 'Tab' && sheet.current) {
        const items = [...sheet.current.querySelectorAll<HTMLElement>('a, button')]
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      menuBtn.current?.focus()
    }
  }, [menu])

  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="nav__inner">
        <Logo />
        <nav className="nav__links" aria-label="Основная навигация">
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="nav__link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav__right">
          <NeuronClock />
          <MagneticButton href="#contact" size="sm" className="nav__cta">
            Запросить демо
          </MagneticButton>
          <button
            ref={menuBtn}
            type="button"
            className="nav__burger"
            aria-expanded={menu}
            aria-controls="mobile-menu"
            aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.div
            id="mobile-menu"
            ref={sheet}
            className="nav__sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18, ease: easeIn } }}
          >
            <nav aria-label="Разделы">
              {LINKS.map((l, i) => (
                <motion.a
                  key={l.id}
                  href={`#${l.id}`}
                  className="nav__sheet-link"
                  onClick={() => setMenu(false)}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i, duration: 0.28, ease: easeOut } }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <MagneticButton href="#contact" onClick={() => setMenu(false)}>
              Запросить демо
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
