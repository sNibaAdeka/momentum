import { createNoise3D, mulberry32, smoothstep } from '../lib/noise'

/*
 * Synthetic non-contrast head CT, generated in Hounsfield units.
 * No real patient data: every pixel comes from noise + anatomy-shaped functions.
 * Image orientation follows radiological convention: the patient's right is on the image's left,
 * anterior is up. The infarct sits in the right MCA territory → it appears on the LEFT of the image.
 */

export const CT_SIZE = 256
export const CT_SLICES = 28
export const CT_FOV_MM = 220
export const CT_THICKNESS_MM = 5
export const PIXEL_MM = CT_FOV_MM / CT_SIZE

export interface CtSlice {
  index: number
  hu: Int16Array
  mask: Uint8Array
  maskCount: number
}

const nSulci = createNoise3D(mulberry32(11))
const nWarp = createNoise3D(mulberry32(23))
const nEdge = createNoise3D(mulberry32(37))

const inEllipse = (u: number, v: number, cx: number, cy: number, ax: number, ay: number) => {
  const x = (u - cx) / ax
  const y = (v - cy) / ay
  return x * x + y * y
}
const bell = (x: number) => Math.exp(-x * x)

export function sliceZ(index: number) {
  return 0.16 + (0.78 * index) / (CT_SLICES - 1)
}

export function synthSlice(index: number): CtSlice {
  const S = CT_SIZE
  const hu = new Int16Array(S * S)
  const mask = new Uint8Array(S * S)
  const rng = mulberry32(1000 + index)
  const gauss = () => (rng() + rng() + rng() - 1.5) * 2
  const z = sliceZ(index)

  const w = Math.sqrt(Math.max(0, 1 - ((z - 0.45) / 0.62) ** 2))
  const ah = 0.7 * w + 0.03
  const bh = 0.86 * w + 0.03
  const vent = bell((z - 0.58) / 0.1)
  const deepGray = smoothstep(0.36, 0.42, z) * smoothstep(0.58, 0.52, z)
  const fossa = smoothstep(0.36, 0.26, z)
  const lesionZ = smoothstep(0.4, 0.46, z) * smoothstep(0.7, 0.62, z)
  let count = 0

  for (let j = 0; j < S; j++) {
    const v = ((j + 0.5) / S) * 2 - 1
    for (let i = 0; i < S; i++) {
      const u = ((i + 0.5) / S) * 2 - 1
      const k = j * S + i
      const ang = Math.atan2(v, u)
      const wobble = 1 + 0.014 * nEdge(Math.cos(ang) * 2, Math.sin(ang) * 2, z * 3)
      const er = Math.sqrt((u / ah) ** 2 + ((v - 0.02) / bh) ** 2) / wobble
      let val: number

      if (er > 1) {
        // air + scanner headrest
        const hv = 0.9 - 0.22 * u * u
        val = Math.abs(v - hv) < 0.011 && Math.abs(u) < 0.78 ? 170 + gauss() * 20 : -1000 + gauss() * 6
      } else if (er > 0.975) {
        val = 42 + gauss() * 4 // scalp
      } else if (er > 0.93) {
        const tt = (er - 0.93) / 0.045
        const diploe = Math.abs(tt - 0.5) < 0.2
        val = diploe ? 820 + 200 * nSulci(u * 22, v * 22, z * 6) : 1450 + gauss() * 40
      } else if (er > 0.915) {
        val = 8 + gauss() * 3 // subarachnoid CSF
      } else {
        const br = er / 0.915
        // sulci: high angular / low radial frequency → they run inward from the cortex like real ones
        const th = Math.atan2(v - 0.02, u)
        const wx = Math.cos(th) * 7.5 + 0.5 * nWarp(u * 3, v * 3, z * 2)
        const wy = Math.sin(th) * 7.5 + 0.5 * nWarp(u * 3 + 4, v * 3, z * 2)
        const sn = nSulci(wx, wy, br * 2.6 + z * 5)
        const s = Math.abs(sn)
        const cortexZone = smoothstep(0.62, 0.95, br)
        if (br > 0.66 && s < 0.06 * cortexZone + 0.002) val = 9
        else if (br > 0.965 || (br > 0.66 && s < 0.2 * cortexZone)) val = 37
        else val = 28

        // interhemispheric fissure + falx
        const fis = Math.abs(u - 0.008 * sn)
        if ((Math.abs(v) > 0.32 || z > 0.74) && fis < 0.011) val = fis < 0.0035 ? 62 : 8

        // deep grey nuclei, soft-edged
        if (deepGray > 0) {
          for (const sd of [-1, 1]) {
            const e1 = inEllipse(u, v, sd * 0.22, -0.03, 0.06 * deepGray + 0.01, 0.13 * deepGray + 0.01)
            val += (33 - val) * smoothstep(1.15, 0.7, e1) * (val > 20 ? 1 : 0)
            const e2 = inEllipse(u, v, sd * 0.085, 0.1, 0.07 * deepGray + 0.01, 0.085 * deepGray + 0.01)
            val += (33 - val) * smoothstep(1.15, 0.7, e2) * (val > 20 ? 1 : 0)
          }
        }
        // lateral ventricles: bodies drift outward posteriorly, frontal horns diverge
        if (vent > 0.05) {
          for (const sd of [-1, 1]) {
            const cu = sd * (0.075 + 0.07 * Math.max(0, v + 0.1))
            if (inEllipse(u, v, cu, -0.04, 0.036 * vent + 0.006, 0.25 * vent + 0.02) < 1) val = 6
            if (z < 0.62 && inEllipse(u, v, sd * 0.1 + sd * 0.02, -0.24, 0.035 * vent, 0.06 * vent) < 1) val = 6
            if (z < 0.6 && inEllipse(u, v, sd * 0.19, 0.27, 0.03 * vent, 0.08 * vent) < 1) val = 6
          }
        }
        if (z > 0.37 && z < 0.47 && Math.abs(u) < 0.014 && v > -0.08 && v < 0.08) val = 6

        // posterior fossa: V-shaped tentorium, cerebellar folia, pons, 4th ventricle
        if (fossa > 0) {
          const tent = 0.12 + 0.55 * u * u
          if (v > tent) {
            const rr = Math.sqrt(u * u + (v - 0.02) ** 2)
            val = 33 + 3.5 * Math.sin(rr * 62 + nWarp(u * 5, v * 5, z) * 5)
            if (Math.abs(u) < 0.006 && v > 0.5) val = 10
          }
          if (Math.abs(v - tent) < 0.007) val = 52
          if (inEllipse(u, v, 0, 0.04, 0.11, 0.09) < 1) val = 31
          if (inEllipse(u, v, 0, 0.17, 0.028, 0.02) < 1) val = 6
        }

        // right MCA infarct (image left): hypodense, grey–white differentiation lost
        if (lesionZ > 0 && u < 0) {
          const a = Math.atan2(v, -u)
          const edge = 0.1 * nEdge(u * 5, v * 5, z * 6)
          const L =
            smoothstep(-0.46, -0.32, a + edge) *
            smoothstep(0.3, 0.16, a + edge) *
            smoothstep(0.64, 0.74, br + edge * 0.5) *
            lesionZ
          if (L > 0.02 && val > 12) val = val - (val - 20) * 0.85 * L
          if (L > 0.45) {
            mask[k] = 1
            count++
          }
        }
        val += gauss() * 3.2
      }
      hu[k] = Math.round(val)
    }
  }
  return { index, hu, mask, maskCount: count }
}

export interface Window {
  id: 'brain' | 'stroke' | 'bone'
  label: string
  width: number
  level: number
}

export const WINDOWS: Window[] = [
  { id: 'brain', label: 'Мозг', width: 80, level: 40 },
  { id: 'stroke', label: 'Инсульт', width: 36, level: 30 },
  { id: 'bone', label: 'Кость', width: 1800, level: 500 },
]

const ALERT = [255, 91, 74]

/** Windowing + optional mask overlay into an ImageData buffer. `maskAmount` 0..1 fades the overlay in. */
export function paintSlice(img: ImageData, slice: CtSlice, win: Window, maskAmount: number) {
  const S = CT_SIZE
  const d = img.data
  const lo = win.level - win.width / 2
  const scale = 255 / win.width
  const { hu, mask } = slice
  for (let k = 0; k < S * S; k++) {
    let g = (hu[k] - lo) * scale
    g = g < 0 ? 0 : g > 255 ? 255 : g
    let r = g, gg = g, b = g
    if (maskAmount > 0 && mask[k]) {
      const i = k % S
      const edge =
        (i > 0 && !mask[k - 1]) || (i < S - 1 && !mask[k + 1]) || (k >= S && !mask[k - S]) || (k < S * S - S && !mask[k + S])
      const a = edge ? 0.95 * maskAmount : 0.36 * maskAmount
      r = r + (ALERT[0] - r) * a
      gg = gg + (ALERT[1] - gg) * a
      b = b + (ALERT[2] - b) * a
    }
    const o = k * 4
    d[o] = r
    d[o + 1] = gg
    d[o + 2] = b
    d[o + 3] = 255
  }
}

/** Reported values are the product's reference case; per-slice areas are scaled so they sum to it. */
export const REFERENCE = {
  volumeMl: 32.8,
  confidence: 97.4,
  seconds: 18,
  location: 'MCA / M2',
}

export function sliceAreaCm2(slice: CtSlice, totalMaskPx: number) {
  if (!totalMaskPx) return 0
  const volumeMm3 = REFERENCE.volumeMl * 1000
  const share = slice.maskCount / totalMaskPx
  return (share * volumeMm3) / CT_THICKNESS_MM / 100
}
