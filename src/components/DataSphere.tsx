import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { mulberry32 } from '../lib/noise'

/**
 * Rotating point sphere drawn in 2D canvas (no second WebGL context).
 * Lit points pulse like studies arriving around the clock.
 */
export function DataSphere({ size = 260, count = 520, lit = 0.07, className = '' }: { size?: number; count?: number; lit?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = size * dpr
    c.height = size * dpr
    ctx.scale(dpr, dpr)

    const rng = mulberry32(3)
    const pts = Array.from({ length: count }, (_, i) => {
      const y = 1 - (i / (count - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = i * Math.PI * (3 - Math.sqrt(5))
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, lit: rng() < lit, ph: rng() * Math.PI * 2 }
    })
    const css = getComputedStyle(document.documentElement)
    const bone = css.getPropertyValue('--paper').trim() || '#ece9e2'
    const tissue = css.getPropertyValue('--scan').trim() || '#2d44ff'
    const R = size * 0.42
    const cx = size / 2
    const cy = size / 2
    const tilt = 0.38
    const ct = Math.cos(tilt)
    const s2 = Math.sin(tilt)

    let a = 0
    let raf = 0
    let visible = false
    let last = performance.now()

    const draw = (t: number) => {
      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = 'rgba(164,196,222,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(cx, cy, R, R * Math.abs(s2), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      for (const p of pts) {
        const x = p.x * ca + p.z * sa
        const z0 = -p.x * sa + p.z * ca
        const y = p.y * ct - z0 * s2
        const z = p.y * s2 + z0 * ct
        const depth = (z + 1) / 2
        const px = cx + x * R
        const py = cy + y * R
        if (p.lit) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + p.ph)
          ctx.globalAlpha = (0.35 + 0.65 * depth) * (0.5 + 0.5 * pulse)
          ctx.fillStyle = tissue
          ctx.beginPath()
          ctx.arc(px, py, 1.6 + depth * 1.8 + pulse, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = 0.08 + depth * 0.5
          ctx.fillStyle = bone
          ctx.fillRect(px - 0.7, py - 0.7, 1.1 + depth, 1.1 + depth)
        }
      }
      ctx.globalAlpha = 1
    }

    const loop = (now: number) => {
      raf = 0
      const dt = Math.min(now - last, 50)
      last = now
      a += dt * 0.00018
      draw(now)
      if (visible) raf = requestAnimationFrame(loop)
    }
    draw(0)
    if (reduce) return
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    })
    io.observe(c)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [size, count, lit, reduce])

  return <canvas ref={ref} className={`dsphere ${className}`} style={{ width: size, height: size }} aria-hidden="true" />
}
