import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { easeOut } from '../lib/env'

/* ---------- Logo: an axial slice, the scanner sweep, the finding ---------- */

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 4.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="var(--scan)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.2 19.5h15.6" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" />
      <circle cx="19.6" cy="13" r="2.7" fill="var(--alert)" />
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
  variant?: 'primary' | 'ghost'
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
    x.set((e.clientX - (r.left + r.width / 2)) * 0.22)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32)
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

/* ---------- Scan reveal: text appears as a scanner line passes over it ---------- */

export function ScanReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const reduce = useReducedMotion()
  const show = inView || !!reduce
  return (
    <div ref={ref} className={`scan-reveal ${className}`}>
      <motion.div
        initial={false}
        animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.55, ease: easeOut, delay: delay + 0.08 }}
      >
        {children}
      </motion.div>
      {!reduce && (
        <motion.span
          className="scan-reveal__line"
          aria-hidden="true"
          initial={{ opacity: 0, y: '0%' }}
          animate={inView ? { opacity: [0, 1, 1, 0], y: ['0%', '100%'] } : undefined}
          transition={{ duration: 0.7, ease: easeOut, delay }}
        />
      )}
    </div>
  )
}

/* ---------- Plain fade reveal for secondary blocks ---------- */

export function Reveal({ children, className = '', delay = 0, y = 20 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
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

/* ---------- Counter: animated number with the final value available to assistive tech ---------- */

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

/* ---------- Spotlight panel: cursor light + slight tilt (transform/opacity only) ---------- */

export function SpotlightPanel({
  children,
  className = '',
  tilt = 5,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  tilt?: number
  as?: 'div' | 'article' | 'li'
}) {
  const reduce = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const lx = useMotionValue(0)
  const ly = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 20 })
  const sry = useSpring(ry, { stiffness: 200, damping: 20 })

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    lx.set(e.clientX - r.left)
    ly.set(e.clientY - r.top)
    if (!reduce) {
      rx.set((0.5 - py) * tilt)
      ry.set((px - 0.5) * tilt * 1.3)
    }
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
  }
  const Tag = as === 'article' ? motion.article : as === 'li' ? motion.li : motion.div
  return (
    <Tag
      className={`panel ${className}`}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.span className="panel__light" style={{ x: lx, y: ly }} aria-hidden="true" />
      {children}
    </Tag>
  )
}

export function Grain() {
  return <div className="grain" aria-hidden="true" />
}
