import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { easeOut } from '../lib/env'

/* ---------- Logo: an axial slice with the finding circled ---------- */

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <ellipse cx="16" cy="16" rx="10" ry="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 5v22" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.1" />
      <path
        d="M7.2 12.4c-2.6 1.4-2.4 6.6.9 7.5 3.3.9 5.6-2.3 4.5-5.3-1-2.7-4.3-3.4-6.6-1.6"
        fill="none"
        stroke="var(--pencil)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <a href="#top" className="logo" aria-label="Momentum — на главную">
      <LogoMark />
      <span className="logo__word">Momentum</span>
    </a>
  )
}

/* ---------- Magnetic button ---------- */

interface MagneticProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'ink'
  size?: 'md' | 'sm'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}

export function MagneticButton({
  children,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  className = '',
}: MagneticProps) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 280, damping: 22, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 280, damping: 22, mass: 0.5 })
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse' || disabled) return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * 0.2)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.3)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }
  const cls = `btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''} ${className}`
  const common = {
    className: cls,
    style: { x: sx, y: sy },
    onPointerMove: onMove,
    onPointerLeave: onLeave,
    whileTap: disabled ? undefined : { scale: 0.97 },
  }
  if (href) {
    return (
      <motion.a href={href} onClick={onClick} {...common}>
        {children}
      </motion.a>
    )
  }
  return (
    <motion.button type={type} onClick={onClick} disabled={disabled} {...common}>
      {children}
    </motion.button>
  )
}

/* ---------- Reveals ---------- */

export function Reveal({
  children,
  className = '',
  delay = 0,
  y = 18,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, ease: easeOut, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Section headings: label, then each headline line rises into place (transform + opacity only). */
export function ScanReveal({ children, className = '' }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const reduce = useReducedMotion()
  return (
    <div ref={ref} className={`lines${inView || reduce ? ' is-in' : ''} ${className}`}>
      {children}
    </div>
  )
}

/* ---------- Counter ---------- */

export function Counter({
  to,
  from = 0,
  duration = 1.6,
  format,
  className = '',
}: {
  to: number
  from?: number
  duration?: number
  format: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduce) {
      el.textContent = format(to)
      return
    }
    const controls = animate(from, to, {
      duration,
      ease: easeOut,
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [inView, reduce, from, to, duration, format])
  return (
    <span className={`num ${className}`}>
      <span ref={ref} aria-hidden="true">
        {format(reduce ? to : from)}
      </span>
      <span className="sr-only">{format(to)}</span>
    </span>
  )
}

/* ---------- Viewbox + film parts ---------- */

export function Lightbox({ children, className = '', flicker = false }: { children: ReactNode; className?: string; flicker?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' })
  const reduce = useReducedMotion()
  const on = flicker && inView && !reduce
  return (
    <div ref={ref} className={`lightbox${on ? ' is-flicker' : ''} ${className}`}>
      <span className="lightbox__spill" aria-hidden="true" />
      <div className="lightbox__panel">
        {children}
        {flicker && !reduce && <span className="lightbox__off" aria-hidden="true" style={inView ? undefined : { opacity: 1 }} />}
      </div>
    </div>
  )
}

const WEDGE = [255, 228, 200, 172, 144, 116, 88, 60, 34, 10]

export function Wedge() {
  return (
    <span className="film__wedge" aria-hidden="true">
      {WEDGE.map((g) => (
        <span key={g} style={{ background: `rgb(${g},${g},${g})` }} />
      ))}
    </span>
  )
}

export function Clips() {
  return (
    <>
      <span className="film__clip film__clip--l" aria-hidden="true" />
      <span className="film__clip film__clip--r" aria-hidden="true" />
    </>
  )
}

/* ---------- Grease pencil ---------- */

/** Hand-drawn loop. `drawn` animates the stroke; pathLength=1 keeps the dash math size-independent. */
export function PencilUnderline({ drawn, className = '' }: { drawn: boolean; className?: string }) {
  return (
    <svg className={`pencil-under ${drawn ? 'is-drawn' : ''} ${className}`} viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
      <path className="pencil" pathLength={1} d="M4 15c46-7 98-9 150-6 44 3 90 4 142-5M40 20c60-5 130-6 210-3" />
    </svg>
  )
}

/** Draws once when scrolled into view. */
export function useDrawn<T extends Element>(margin = '0px 0px -20% 0px') {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { once: true, margin: margin as `${number}px ${number}px ${number}px ${number}px` })
  return [ref, inView] as const
}
