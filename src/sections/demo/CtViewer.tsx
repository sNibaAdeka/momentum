import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CT_SIZE, CT_SLICES, CT_THICKNESS_MM, PIXEL_MM, paintSlice, sliceZ, type Window } from '../../ct/ctSynth'
import { getSlice, isSliceReady } from '../../ct/cache'
import { fmtDec } from '../../lib/format'

interface Props {
  index: number
  win: Window
  maskAmount: number
  scanning: boolean
  interactive: boolean
  empty: boolean
  onIndexChange?: (i: number) => void
  areaCm2?: number
}

/** A small PACS-style viewer: windowing, stack scrolling, HU probe, mask overlay. */
export function CtViewer({ index, win, maskAmount, scanning, interactive, empty, onIndexChange, areaCm2 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<ImageData | null>(null)
  const [probe, setProbe] = useState<{ x: number; y: number; hu: number; px: number; py: number } | null>(null)
  const drag = useRef<{ y: number; start: number } | null>(null)

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    if (empty || !isSliceReady(index)) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, CT_SIZE, CT_SIZE)
      return
    }
    if (!img.current) img.current = ctx.createImageData(CT_SIZE, CT_SIZE)
    paintSlice(img.current, getSlice(index), win, maskAmount)
    ctx.putImageData(img.current, 0, 0)
  }, [index, win, maskAmount, empty])

  // wheel scrolls the stack only while the viewer has focus — never hijacks page scroll
  useEffect(() => {
    const el = frame.current
    if (!el || !interactive) return
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return
      e.preventDefault()
      onIndexChange?.(Math.max(0, Math.min(CT_SLICES - 1, index + (e.deltaY > 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [interactive, index, onIndexChange])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      onIndexChange?.(Math.min(CT_SLICES - 1, index + 1))
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      onIndexChange?.(Math.max(0, index - 1))
    }
  }

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = Math.floor(((e.clientX - r.left) / r.width) * CT_SIZE)
    const py = Math.floor(((e.clientY - r.top) / r.height) * CT_SIZE)
    if (drag.current && e.pointerType === 'mouse') {
      const d = Math.round((drag.current.y - e.clientY) / 12)
      const next = Math.max(0, Math.min(CT_SLICES - 1, drag.current.start + d))
      if (next !== index) onIndexChange?.(next)
    }
    if (px < 0 || py < 0 || px >= CT_SIZE || py >= CT_SIZE || !isSliceReady(index)) return setProbe(null)
    setProbe({ x: e.clientX - r.left, y: e.clientY - r.top, hu: getSlice(index).hu[py * CT_SIZE + px], px, py })
  }

  const zMm = Math.round((sliceZ(index) - 0.5) * 180)
  const mm = (p: number) => fmtDec((p - CT_SIZE / 2) * PIXEL_MM, 0)

  return (
    <div
      ref={frame}
      className={`viewer${interactive ? ' is-interactive' : ''}`}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? `КТ-срез ${index + 1} из ${CT_SLICES}. Стрелки вверх и вниз или колесо мыши меняют срез.` : undefined}
      onKeyDown={onKey}
    >
      <canvas
        ref={canvas}
        width={CT_SIZE}
        height={CT_SIZE}
        className="viewer__img"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setProbe(null)
          drag.current = null
        }}
        onPointerDown={(e) => {
          if (interactive && e.pointerType === 'mouse') drag.current = { y: e.clientY, start: index }
        }}
        onPointerUp={() => (drag.current = null)}
        aria-hidden="true"
      />
      {scanning && <span className="viewer__scan" aria-hidden="true" />}
      {empty && (
        <p className="viewer__empty">
          Серия не загружена.
          <br />
          Выберите файл или запустите демо-исследование.
        </p>
      )}

      <div className="viewer__overlay readout" aria-hidden="true">
        <span className="viewer__c viewer__c--tl">
          MOMENTUM DEMO
          <br />
          Синтетическое исследование
          <br />
          КТ без контраста
        </span>
        <span className="viewer__c viewer__c--tr">
          Срез {String(index + 1).padStart(2, '0')}/{CT_SLICES}
          <br />
          {fmtDec(CT_THICKNESS_MM, 1)} мм · z {zMm > 0 ? '+' : ''}
          {zMm} мм
        </span>
        <span className="viewer__c viewer__c--bl">
          W {win.width} · L {win.level}
          <br />
          {probe ? (
            <>
              HU {probe.hu} · {mm(probe.px)}, {mm(probe.py)} мм
            </>
          ) : (
            'Наведите курсор: плотность HU'
          )}
        </span>
        <span className="viewer__c viewer__c--br">
          {maskAmount > 0 ? (
            <>
              Разметка Momentum
              <br />
              {areaCm2 !== undefined && areaCm2 > 0 ? `${fmtDec(areaCm2, 1)} см² на срезе` : 'на срезе нет очага'}
            </>
          ) : (
            'Разметка скрыта'
          )}
        </span>
        <span className="viewer__o viewer__o--r">R</span>
        <span className="viewer__o viewer__o--l">L</span>
        <span className="viewer__o viewer__o--a">A</span>
        <span className="viewer__o viewer__o--p">P</span>
      </div>
      {probe && interactive && (
        <span className="viewer__probe" style={{ transform: `translate3d(${probe.x}px, ${probe.y}px, 0)` }} aria-hidden="true" />
      )}
    </div>
  )
}
