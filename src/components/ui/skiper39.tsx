import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'

/**
 * Skiper 39 — Crowd Canvas (React + Canvas), adapted for Momentum.
 * Original: Skiper UI by @gurvinder-singh02 (https://gxuri.me), inspired by https://codepen.io/zadvorsky/pen/xxwbBQV.
 * Illustrations: Open Peeps by Pablo Stanley (https://www.openpeeps.com/).
 * Attribution to Skiper UI is shown in the site footer, as the free licence requires.
 *
 * Changes vs. the original: no Tailwind; peeps are scaled to the strip height; the animation pauses
 * while the canvas is off-screen; prefers-reduced-motion draws a still crowd; ResizeObserver instead of window resize.
 */

export const OPEN_PEEPS_SPRITE =
  'https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png'

interface CrowdCanvasProps {
  src?: string
  rows?: number
  cols?: number
  className?: string
}

interface Peep {
  rect: [number, number, number, number]
  width: number
  height: number
  x: number
  y: number
  anchorY: number
  scaleX: number
  walk: gsap.core.Timeline | null
}

const randomRange = (min: number, max: number) => min + Math.random() * (max - min)
const randomIndex = (array: unknown[]) => randomRange(0, array.length) | 0
const removeFromArray = <T,>(array: T[], i: number) => array.splice(i, 1)[0]
const removeItem = <T,>(array: T[], item: T) => removeFromArray(array, array.indexOf(item))
const removeRandom = <T,>(array: T[]) => removeFromArray(array, randomIndex(array))

export function CrowdCanvas({ src = OPEN_PEEPS_SPRITE, rows = 15, cols = 7, className = '' }: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const img = document.createElement('img')
    const stage = { width: 0, height: 0, scale: 1 }
    const all: Peep[] = []
    const available: Peep[] = []
    const crowd: Peep[] = []
    let running = false
    let ready = false

    const resetPeep = (peep: Peep) => {
      const direction = Math.random() > 0.5 ? 1 : -1
      const offsetY = 100 - 250 * gsap.parseEase('power2.in')(Math.random())
      const startY = stage.height - peep.height + offsetY
      let startX: number
      let endX: number
      if (direction === 1) {
        startX = -peep.width
        endX = stage.width
        peep.scaleX = 1
      } else {
        startX = stage.width + peep.width
        endX = 0
        peep.scaleX = -1
      }
      peep.x = startX
      peep.y = startY
      peep.anchorY = startY
      return { startY, endX }
    }

    const walk = (peep: Peep, { startY, endX }: { startY: number; endX: number }) => {
      const xDuration = 10
      const yDuration = 0.25
      const tl = gsap.timeline()
      tl.timeScale(randomRange(0.5, 1.5))
      tl.to(peep, { duration: xDuration, x: endX, ease: 'none' }, 0)
      tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 }, 0)
      return tl
    }

    const addPeep = (): Peep => {
      const peep = removeRandom(available)
      const tl = walk(peep, resetPeep(peep)).eventCallback('onComplete', () => {
        removeItem(crowd, peep)
        available.push(peep)
        addPeep()
      })
      peep.walk = tl
      if (!running) tl.pause()
      crowd.push(peep)
      crowd.sort((a, b) => a.anchorY - b.anchorY)
      return peep
    }

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr * stage.scale, 0, 0, dpr * stage.scale, 0, 0)
      for (const p of crowd) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.scale(p.scaleX, 1)
        ctx.drawImage(img, p.rect[0], p.rect[1], p.rect[2], p.rect[3], 0, 0, p.width, p.height)
        ctx.restore()
      }
    }

    const resize = () => {
      if (!ready) return
      const dpr = window.devicePixelRatio || 1
      const peepH = all[0]?.height || 1
      // peeps are drawn in sprite pixels; scale the stage so a full figure fits the strip
      stage.scale = Math.min(1, canvas.clientHeight / (peepH * 1.05))
      stage.width = canvas.clientWidth / stage.scale
      stage.height = canvas.clientHeight / stage.scale
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      crowd.forEach((p) => p.walk?.kill())
      crowd.length = 0
      available.length = 0
      available.push(...all)
      while (available.length) addPeep().walk?.progress(Math.random())
      render()
    }

    const start = () => {
      if (running || reduce || !ready) return
      running = true
      crowd.forEach((p) => p.walk?.resume())
      gsap.ticker.add(render)
    }
    const stop = () => {
      if (!running) return
      running = false
      crowd.forEach((p) => p.walk?.pause())
      gsap.ticker.remove(render)
    }

    img.onload = () => {
      const w = img.naturalWidth / rows
      const h = img.naturalHeight / cols
      for (let i = 0; i < rows * cols; i++) {
        all.push({
          rect: [(i % rows) * w, ((i / rows) | 0) * h, w, h],
          width: w,
          height: h,
          x: 0,
          y: 0,
          anchorY: 0,
          scaleX: 1,
          walk: null,
        })
      }
      ready = true
      resize()
      if (visible) start()
    }
    img.onerror = () => {
      canvas.style.display = 'none'
    }
    img.src = src

    let visible = false
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(canvas)
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    return () => {
      io.disconnect()
      ro.disconnect()
      stop()
      crowd.forEach((p) => p.walk?.kill())
      img.onload = null
    }
  }, [src, rows, cols])

  return <canvas ref={canvasRef} className={`crowd ${className}`} aria-hidden="true" />
}

export default CrowdCanvas
