import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { paint, type Overlay, type Volume } from '../../ct/volume'
import type { Analysis } from '../../ct/analyze'
import { fmtDec } from '../../lib/format'

export type Tool = 'probe' | 'ruler'

interface Props {
  vol: Volume | null
  index: number
  win: { level: number; width: number }
  overlay: Overlay
  analysis: Analysis | null
  tool: Tool
  sourceLabel: string
  busy: string | null
  dragging: boolean
  onIndex: (i: number) => void
}

interface Pt {
  x: number
  y: number
}

/** PACS-style viewer for any volume: window/level, stack scrolling, HU probe, ruler in mm, overlays. */
export function Viewer({ vol, index, win, overlay, analysis, tool, sourceLabel, busy, dragging, onIndex }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<ImageData | null>(null)
  const drag = useRef<{ y: number; start: number } | null>(null)
  const [probe, setProbe] = useState<(Pt & { sx: number; sy: number; hu: number }) | null>(null)
  const [ruler, setRuler] = useState<{ a: Pt; b: Pt } | null>(null)
  const measuring = useRef(false)

  const w = vol?.width ?? 1
  const h = vol?.height ?? 1
  const depth = vol?.depth ?? 1
  const [sx, sy, sz] = vol?.spacing ?? [1, 1, 1]

  useEffect(() => {
    setRuler(null)
    setProbe(null)
    img.current = null
  }, [vol])

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !vol) return
    if (!img.current || img.current.width !== vol.width || img.current.height !== vol.height) {
      img.current = ctx.createImageData(vol.width, vol.height)
    }
    paint(img.current, vol.slices[index], win, overlay, analysis?.masks[index], analysis?.asym[index])
    ctx.putImageData(img.current, 0, 0)
  }, [vol, index, win, overlay, analysis])

  // the wheel pages through slices only while the viewer has focus, so page scrolling is never hijacked
  useEffect(() => {
    const el = frame.current
    if (!el || !vol) return
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return
      e.preventDefault()
      onIndex(Math.max(0, Math.min(depth - 1, index + (e.deltaY > 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [vol, index, depth, onIndex])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!vol) return
    const step: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }
    let next: number | null = null
    if (e.key in step) next = index + step[e.key]
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = depth - 1
    if (next === null) return
    e.preventDefault()
    onIndex(Math.max(0, Math.min(depth - 1, next)))
  }

  const toImage = (e: PointerEvent<HTMLElement>): Pt & { sx: number; sy: number } => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * w,
      y: ((e.clientY - r.top) / r.height) * h,
      sx: e.clientX - r.left,
      sy: e.clientY - r.top,
    }
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!vol) return
    const p = toImage(e)
    if (tool === 'ruler') {
      e.currentTarget.setPointerCapture(e.pointerId)
      measuring.current = true
      setRuler({ a: p, b: p })
    } else if (e.pointerType === 'mouse') {
      drag.current = { y: e.clientY, start: index }
    }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!vol) return
    const p = toImage(e)
    if (measuring.current) {
      setRuler((r) => (r ? { a: r.a, b: p } : r))
      return
    }
    if (drag.current) {
      const d = Math.round((drag.current.y - e.clientY) / 10)
      const next = Math.max(0, Math.min(depth - 1, drag.current.start + d))
      if (next !== index) onIndex(next)
    }
    const px = Math.floor(p.x)
    const py = Math.floor(p.y)
    if (px < 0 || py < 0 || px >= w || py >= h) return setProbe(null)
    setProbe({ ...p, hu: vol.slices[index][py * w + px] })
  }
  const onUp = () => {
    measuring.current = false
    drag.current = null
  }

  const mid = overlay === 'asym' ? analysis?.midlines[index] : null
  const L = Math.max(w, h)
  const maskPx = overlay === 'mask' && analysis?.masks[index] ? countOn(analysis.masks[index]!) : 0
  const rulerMm = ruler ? Math.hypot((ruler.b.x - ruler.a.x) * sx, (ruler.b.y - ruler.a.y) * sy) : 0
  const mm = (v: number, size: number, s: number) => fmtDec((v - size / 2) * s, 0)
  const unit = vol?.isCT ? 'HU' : 'сигнал'

  return (
    <div
      ref={frame}
      className={`viewer vw${vol ? ' is-interactive' : ''}${dragging ? ' is-drop' : ''} vw--${tool}`}
      style={vol ? ({ aspectRatio: `${w * sx} / ${h * sy}`, '--ar': (w * sx) / (h * sy) } as CSSProperties) : undefined}
      tabIndex={vol ? 0 : -1}
      role={vol ? 'group' : undefined}
      aria-label={vol ? `Срез ${index + 1} из ${depth}. Стрелки или колесо мыши после щелчка меняют срез.` : undefined}
      onKeyDown={onKey}
    >
      <div
        className="vw__stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          setProbe(null)
          drag.current = null
        }}
      >
        <canvas ref={canvas} width={w} height={h} className="viewer__img" aria-hidden="true" />
        <svg className="vw__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          {mid && (
            <line
              x1={mid.cx - mid.dx * L}
              y1={mid.cy - mid.dy * L}
              x2={mid.cx + mid.dx * L}
              y2={mid.cy + mid.dy * L}
              className="vw__mid"
            />
          )}
          {ruler && <line x1={ruler.a.x} y1={ruler.a.y} x2={ruler.b.x} y2={ruler.b.y} className="vw__ruler" />}
        </svg>
        {ruler && rulerMm > 0.5 && (
          <span
            className={`vw__ruler-label readout${ruler.b.x > w * 0.62 ? ' is-left' : ''}`}
            style={{ left: `${(ruler.b.x / w) * 100}%`, top: `${(ruler.b.y / h) * 100}%` }}
          >
            {fmtDec(rulerMm, 1)} мм
          </span>
        )}
        {probe && tool === 'probe' && (
          <span className="viewer__probe" style={{ transform: `translate3d(${probe.sx}px, ${probe.sy}px, 0)` }} aria-hidden="true" />
        )}
      </div>

      {!vol && (
        <p className="viewer__empty">{busy ?? 'Перетащите сюда DICOM, ZIP или NIfTI'}</p>
      )}
      {vol && busy && <p className="vw__busy readout">{busy}</p>}
      {dragging && <p className="vw__dropmsg">Отпустите, чтобы открыть</p>}

      {vol && (
        <div className="viewer__overlay readout" aria-hidden="true">
          <span className="viewer__c viewer__c--tl">
            {sourceLabel}
            <br />
            {vol.modality} · {w}×{h}
          </span>
          <span className="viewer__c viewer__c--tr">
            {index + 1} / {depth}
            <br />
            {fmtDec(sz, 1)} мм
          </span>
          <span className="viewer__c viewer__c--bl">
            W {Math.round(win.width)} · L {Math.round(win.level)}
            {probe ? (
              <>
                <br />
                {unit} {probe.hu} · {mm(probe.x, w, sx)}, {mm(probe.y, h, sy)} мм
              </>
            ) : tool === 'ruler' && !ruler ? (
              <>
                <br />
                Тяните по снимку
              </>
            ) : null}
          </span>
          {overlay !== 'none' && analysis && (
            <span className="viewer__c viewer__c--br">
              {overlay === 'asym' ? 'ΔHU ≥ 3' : maskPx ? `${fmtDec((maskPx * sx * sy) / 100, 1)} см²` : ''}
            </span>
          )}
          <span className="viewer__o viewer__o--r">R</span>
          <span className="viewer__o viewer__o--l">L</span>
        </div>
      )}
    </div>
  )
}

function countOn(m: Uint8Array) {
  let n = 0
  for (let k = 0; k < m.length; k++) if (m[k]) n++
  return n
}
