import { useEffect, useRef } from 'react'
import { CT_SIZE, paintSlice, synthSlice, WINDOWS } from '../ct/ctSynth'

/** Shown while WebGL loads, and instead of it on devices without WebGL: an axial slice with the lesion mask. */
export function FallbackScan({ animated }: { animated: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(CT_SIZE, CT_SIZE)
    paintSlice(img, synthSlice(14), WINDOWS[1], 1)
    ctx.putImageData(img, 0, 0)
  }, [])
  return (
    <div className={`fallback-scan${animated ? ' is-animated' : ''}`} aria-hidden="true">
      <canvas ref={ref} width={CT_SIZE} height={CT_SIZE} />
      <span className="fallback-scan__line" />
      <span className="fallback-scan__ring" />
    </div>
  )
}
