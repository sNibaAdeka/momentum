import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/*
 * Particles — from Vetra (MIT; originally Magic UI). Mouse-magnetic dust.
 * Changes: no React state per mouse move (ref only), pauses when off-screen,
 * static field for prefers-reduced-motion, colour from props.
 */
interface ParticlesProps {
  className?: string
  quantity?: number
  staticity?: number
  ease?: number
  size?: number
  color?: string
}

interface Circle {
  x: number
  y: number
  tx: number
  ty: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

function hexToRgb(hex: string) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function Particles({ className, quantity = 90, staticity = 50, ease = 50, size = 0.4, color = '#ffffff' }: ParticlesProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    const box = wrap.current
    const ctx = c?.getContext('2d')
    if (!c || !box || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rgb = hexToRgb(color).join(', ')
    const mouse = { x: 0, y: 0 }
    let w = 0
    let h = 0
    let circles: Circle[] = []
    let raf = 0
    let visible = false

    const make = (): Circle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      tx: 0,
      ty: 0,
      size: Math.floor(Math.random() * 2) + size,
      alpha: reduce ? 0.5 : 0,
      targetAlpha: +(Math.random() * 0.6 + 0.1).toFixed(1),
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    })
    const resize = () => {
      w = box.offsetWidth
      h = box.offsetHeight
      c.width = w * dpr
      c.height = h * dpr
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      circles = Array.from({ length: quantity }, make)
      draw()
    }
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const p of circles) {
        ctx.beginPath()
        ctx.arc(p.x + p.tx, p.y + p.ty, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`
        ctx.fill()
      }
    }
    const step = () => {
      raf = 0
      for (let i = 0; i < circles.length; i++) {
        const p = circles[i]
        const edge = Math.min(p.x + p.tx - p.size, w - p.x - p.tx - p.size, p.y + p.ty - p.size, h - p.y - p.ty - p.size)
        const k = Math.max(0, Math.min(1, edge / 20))
        p.alpha = k >= 1 ? Math.min(p.targetAlpha, p.alpha + 0.02) : p.targetAlpha * k
        p.x += p.dx
        p.y += p.dy
        p.tx += (mouse.x / (staticity / p.magnetism) - p.tx) / ease
        p.ty += (mouse.y / (staticity / p.magnetism) - p.ty) / ease
        if (p.x < -p.size || p.x > w + p.size || p.y < -p.size || p.y > h + p.size) circles[i] = make()
      }
      draw()
      if (visible) raf = requestAnimationFrame(step)
    }
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect()
      const x = e.clientX - r.left - w / 2
      const y = e.clientY - r.top - h / 2
      if (Math.abs(x) < w / 2 && Math.abs(y) < h / 2) {
        mouse.x = x
        mouse.y = y
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !reduce
      if (visible && !raf) raf = requestAnimationFrame(step)
    })
    io.observe(box)
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      ro.disconnect()
      io.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [quantity, staticity, ease, size, color])

  return (
    <div ref={wrap} className={cn('pointer-events-none', className)} aria-hidden="true">
      <canvas ref={canvas} className="size-full" />
    </div>
  )
}
