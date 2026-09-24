import { CT_FOV_MM, CT_SIZE, CT_SLICES, CT_THICKNESS_MM } from './ctSynth'
import { getSlice } from './cache'

/*
 * One in-memory study, whatever it came from (synthetic demo, DICOM series, NIfTI volume).
 * Values are Hounsfield units for CT; raw intensities for MR (then `isCT` is false).
 * Patient identifiers are never read into this structure.
 */
export interface Volume {
  id: string
  source: 'synthetic' | 'dicom' | 'nifti'
  modality: string
  isCT: boolean
  width: number
  height: number
  depth: number
  slices: Int16Array[]
  /** mm: column spacing, row spacing, slice spacing */
  spacing: [number, number, number]
  /** default display window */
  window: { level: number; width: number }
  note?: string
}

export interface WindowPreset {
  id: 'brain' | 'stroke' | 'bone' | 'auto'
  label: string
  level?: number
  width?: number
}

export const PRESETS: WindowPreset[] = [
  { id: 'brain', label: 'Мозг', level: 40, width: 80 },
  { id: 'stroke', label: 'Инсульт', level: 32, width: 36 },
  { id: 'bone', label: 'Кость', level: 500, width: 1800 },
  { id: 'auto', label: 'Авто' },
]

/** 1st–99th percentile window for data without calibrated units (MR, or CT without window tags). */
export function autoWindow(slices: Int16Array[]) {
  const sample: number[] = []
  const step = Math.max(1, Math.floor((slices.length * slices[0].length) / 200_000))
  let i = 0
  for (const s of slices) {
    for (let k = i % step; k < s.length; k += step) sample.push(s[k])
    i++
  }
  sample.sort((a, b) => a - b)
  const lo = sample[Math.floor(sample.length * 0.02)] ?? 0
  const hi = sample[Math.floor(sample.length * 0.995)] ?? 1
  return { level: (lo + hi) / 2, width: Math.max(1, hi - lo) }
}

/** The demo study, generated slice by slice so the page stays responsive. */
export async function syntheticVolume(onSlice?: (done: number, total: number) => void): Promise<Volume> {
  const slices: Int16Array[] = []
  for (let i = 0; i < CT_SLICES; i++) {
    slices.push(getSlice(i).hu)
    onSlice?.(i + 1, CT_SLICES)
    await new Promise<void>((r) => setTimeout(r, 0))
  }
  const px = CT_FOV_MM / CT_SIZE
  return {
    id: `synthetic-${Date.now()}`,
    source: 'synthetic',
    modality: 'CT',
    isCT: true,
    width: CT_SIZE,
    height: CT_SIZE,
    depth: CT_SLICES,
    slices,
    spacing: [px, px, CT_THICKNESS_MM],
    window: { level: 40, width: 80 },
  }
}

export type Overlay = 'none' | 'mask' | 'asym'

const HYPO_RGB = [255, 91, 74]
const HYPER_RGB = [255, 196, 64]
const COOL_RGB = [111, 132, 255]

/** Window/level plus the chosen overlay into an RGBA buffer of the slice's size. */
export function paint(
  img: ImageData,
  hu: Int16Array,
  win: { level: number; width: number },
  overlay: Overlay = 'none',
  mask?: Uint8Array | null,
  asym?: Int8Array | null,
) {
  const d = img.data
  const w = img.width
  const n = hu.length
  const lo = win.level - win.width / 2
  const scale = 255 / win.width
  for (let k = 0; k < n; k++) {
    let g = (hu[k] - lo) * scale
    g = g < 0 ? 0 : g > 255 ? 255 : g
    let r = g
    let gg = g
    let b = g
    if (overlay === 'mask' && mask && mask[k]) {
      const i = k % w
      const v = mask[k]
      const edge = (i > 0 && mask[k - 1] !== v) || (i < w - 1 && mask[k + 1] !== v) || (k >= w && mask[k - w] !== v) || (k < n - w && mask[k + w] !== v)
      const a = edge ? 0.95 : 0.36
      const c = v === 2 ? HYPER_RGB : HYPO_RGB
      r += (c[0] - r) * a
      gg += (c[1] - gg) * a
      b += (c[2] - b) * a
    } else if (overlay === 'asym' && asym && asym[k] >= 3) {
      const t = Math.min(1, (asym[k] - 3) / 9)
      const a = 0.3 + 0.55 * t
      const c0 = COOL_RGB[0] + (HYPO_RGB[0] - COOL_RGB[0]) * t
      const c1 = COOL_RGB[1] + (HYPO_RGB[1] - COOL_RGB[1]) * t
      const c2 = COOL_RGB[2] + (HYPO_RGB[2] - COOL_RGB[2]) * t
      r += (c0 - r) * a
      gg += (c1 - gg) * a
      b += (c2 - b) * a
    }
    const o = k * 4
    d[o] = r
    d[o + 1] = gg
    d[o + 2] = b
    d[o + 3] = 255
  }
}

/** PNG data URL of one slice (for the report). */
export function sliceImage(vol: Volume, index: number, win: { level: number; width: number }, overlay: Overlay, mask?: Uint8Array | null) {
  const c = document.createElement('canvas')
  c.width = vol.width
  c.height = vol.height
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(vol.width, vol.height)
  paint(img, vol.slices[index], win, overlay, mask)
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

export const SOURCE_LABEL: Record<Volume['source'], string> = {
  synthetic: 'Демо-серия',
  dicom: 'DICOM',
  nifti: 'NIfTI',
}
