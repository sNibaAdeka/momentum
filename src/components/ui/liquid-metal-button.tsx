import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'

/*
 * Liquid-metal pill button. Adapted from the 21st.dev / v0 "liquid-metal-button":
 *  – no Tailwind (project uses its own CSS tokens, see src/styles/ui.css),
 *  – width follows the label (Russian labels are longer than "Get Started"),
 *  – label contrast raised from #666 to near-white (WCAG AA on the black core),
 *  – renders <a> for navigation or <button> (incl. type="submit"), keyboard focus ring,
 *  – ShaderMount.dispose() on unmount; animation frozen for prefers-reduced-motion.
 */

interface LiquidMetalButtonProps {
  label: string
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  icon?: ReactNode
  className?: string
  size?: 'md' | 'sm'
}

export function LiquidMetalButton({ label, href, onClick, type = 'button', disabled, icon, className = '', size = 'md' }: LiquidMetalButtonProps) {
  const HEIGHT = size === 'sm' ? 44 : 52
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const [width, setWidth] = useState(170)
  const shaderRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const hitRef = useRef<HTMLElement | null>(null)
  const mount = useRef<ShaderMount | null>(null)
  const rippleId = useRef(0)
  const reduce = useRef(false)

  useLayoutEffect(() => {
    if (labelRef.current) setWidth(Math.max(size === 'sm' ? 120 : 156, Math.ceil(labelRef.current.scrollWidth) + (size === 'sm' ? 40 : 60)))
  }, [label, size])

  useEffect(() => {
    const el = shaderRef.current
    if (!el) return
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    try {
      mount.current = new ShaderMount(
        el,
        liquidMetalFragmentShader,
        {
          u_repetition: 4,
          u_softness: 0.5,
          u_shiftRed: 0.3,
          u_shiftBlue: 0.3,
          u_distortion: 0,
          u_contour: 0,
          u_angle: 45,
          u_scale: 8,
          u_shape: 1,
          u_offsetX: 0.1,
          u_offsetY: -0.1,
        },
        undefined,
        reduce.current ? 0 : 0.6,
      )
    } catch {
      // no WebGL — the black core still reads as a button
    }
    return () => {
      mount.current?.dispose()
      mount.current = null
    }
  }, [])

  const speed = (s: number) => {
    if (!reduce.current) mount.current?.setSpeed(s)
  }

  const onEnter = () => {
    setHovered(true)
    speed(1)
  }
  const onLeave = () => {
    setHovered(false)
    setPressed(false)
    speed(0.6)
  }
  const onClickHit = (e: MouseEvent<HTMLElement>) => {
    speed(2.4)
    window.setTimeout(() => speed(hovered ? 1 : 0.6), 300)
    const r = hitRef.current?.getBoundingClientRect()
    if (r) {
      const ripple = { x: e.clientX - r.left, y: e.clientY - r.top, id: rippleId.current++ }
      setRipples((prev) => [...prev, ripple])
      window.setTimeout(() => setRipples((prev) => prev.filter((p) => p.id !== ripple.id)), 600)
    }
    onClick?.()
  }

  const state = `${hovered ? ' is-hover' : ''}${pressed ? ' is-pressed' : ''}${disabled ? ' is-disabled' : ''}`
  const hitProps = {
    className: 'lmb__hit',
    'aria-label': label,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onClick: onClickHit,
  }
  const rippleNodes = ripples.map((r) => <span key={r.id} className="lmb__ripple" style={{ left: r.x, top: r.y }} />)

  return (
    <span className={`lmb lmb--${size}${state} ${className}`} style={{ width, height: HEIGHT }}>
      <span className="lmb__rim">
        <span ref={shaderRef} className="lmb__shader" />
      </span>
      <span className="lmb__core" />
      <span ref={labelRef} className="lmb__label" aria-hidden="true">
        {icon}
        {label}
      </span>
      {href ? (
        <a ref={(n) => { hitRef.current = n }} href={href} {...hitProps}>
          {rippleNodes}
        </a>
      ) : (
        <button ref={(n) => { hitRef.current = n }} type={type} disabled={disabled} {...hitProps}>
          {rippleNodes}
        </button>
      )}
    </span>
  )
}
