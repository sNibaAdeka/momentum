import type { Volume } from './volume'

/*
 * Experimental, explainable CT triage — not a neural network and not a diagnosis.
 *
 * Per axial slice:
 *   1. skull = HU ≥ 250; the intracranial space is what the outside air cannot reach through it;
 *   2. the midline is the long axis of the intracranial mask (second moments);
 *   3. brain tissue = HU 15–60, eroded; smoothed with a normalised ~3 mm box filter;
 *   4. every tissue pixel is compared with its mirror across the midline:
 *        hypodense  → mirror is ≥ 5 HU denser and the pixel itself ≤ 30 HU (ischaemia-like);
 *        hyperdense → 50–95 HU and ≥ 12 HU denser than the mirror (haemorrhage-like).
 * Across slices, 2D islands that overlap are merged into 3D findings; volume comes from the voxel size.
 * Image left is the patient's right (radiological convention; loaders normalise orientation).
 */

export type LesionKind = 'hypo' | 'hyper'
export type Side = 'right' | 'left'

export interface Lesion {
  kind: LesionKind
  volumeMl: number
  side: Side
  sliceFrom: number
  sliceTo: number
  keySlice: number
  /** mean HU inside the finding and in its mirror image */
  meanHu: number
  mirrorHu: number
  region: string
}

export interface Midline {
  cx: number
  cy: number
  dx: number
  dy: number
}

export type StageId = 'mask' | 'asym' | 'group'

export const ANALYSIS_STAGES: { id: StageId; label: string }[] = [
  { id: 'mask', label: 'Череп и мозговая ткань' },
  { id: 'asym', label: 'Сравнение полушарий' },
  { id: 'group', label: 'Сборка очагов в объём' },
]

export interface Analysis {
  volumeId: string
  lesions: Lesion[]
  ischemia: Lesion | null
  hemorrhage: Lesion | null
  priority: 'high' | 'medium' | 'routine'
  /** per slice: 1 = hypodense finding, 2 = hyperdense finding */
  masks: (Uint8Array | null)[]
  /** per slice: mirror minus pixel, HU, smoothed (positive = darker than the other side) */
  asym: (Int8Array | null)[]
  midlines: (Midline | null)[]
  slicesUsed: number
  stageMs: Record<StageId, number>
  elapsedMs: number
}

export interface AnalyzeProgress {
  stage: StageId
  done: number
  total: number
}

const HYPO = { diff: 5, maxHu: 30, minAreaMm2: 30, minVolumeMl: 0.8 }
const HYPER = { minHu: 50, maxHu: 95, diff: 12, minAreaMm2: 12, minVolumeMl: 0.2 }

interface Comp {
  id: number
  kind: LesionKind
  slice: number
  pixels: Int32Array
  sumHu: number
  sumMirror: number
  nMirror: number
  sumLat: number // signed lateral offset / half width (+ = image right)
  sumAp: number // offset along the midline / half length (+ = posterior)
}

const now = () => performance.now()
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0))

export async function analyze(
  vol: Volume,
  onProgress: (p: AnalyzeProgress) => void = () => {},
  signal?: AbortSignal,
): Promise<Analysis> {
  const t0 = now()
  const { width: w, height: h, depth } = vol
  const [pxX, pxY, dz] = vol.spacing
  const pxArea = pxX * pxY
  const stageMs: Record<StageId, number> = { mask: 0, asym: 0, group: 0 }
  const midlines: (Midline | null)[] = new Array(depth).fill(null)
  const asym: (Int8Array | null)[] = new Array(depth).fill(null)
  const areas = new Float64Array(depth)
  const comps: Comp[][] = Array.from({ length: depth }, () => [])
  let nextId = 0
  let budget = now()

  for (let z = 0; z < depth; z++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const hu = vol.slices[z]

    let t = now()
    const geo = geometry(hu, w, h)
    stageMs.mask += now() - t
    onProgress({ stage: 'mask', done: z + 1, total: depth })
    if (geo) {
      areas[z] = geo.area * pxArea
      midlines[z] = geo.mid
      t = now()
      const res = asymmetry(hu, w, h, geo, pxX, pxY)
      asym[z] = res.asym
      for (const [kind, cand] of [['hypo', res.hypo], ['hyper', res.hyper]] as const) {
        const minPx = (kind === 'hypo' ? HYPO.minAreaMm2 : HYPER.minAreaMm2) / pxArea
        for (const pixels of islands(cand, w, h, minPx)) {
          const c: Comp = { id: nextId++, kind, slice: z, pixels, sumHu: 0, sumMirror: 0, nMirror: 0, sumLat: 0, sumAp: 0 }
          for (let i = 0; i < pixels.length; i++) {
            const k = pixels[i]
            c.sumHu += hu[k]
            const m = res.mirror[k]
            if (m >= 0 && geo.intra[m]) {
              c.sumMirror += hu[m]
              c.nMirror++
            }
            c.sumLat += res.lat[k]
            c.sumAp += res.ap[k]
          }
          comps[z].push(c)
        }
      }
      stageMs.asym += now() - t
    }
    onProgress({ stage: 'asym', done: z + 1, total: depth })
    if (now() - budget > 14) {
      await yieldToUi()
      budget = now()
    }
  }

  /* ---- 3D grouping ---- */
  let t = now()
  onProgress({ stage: 'group', done: 0, total: 1 })
  const maxArea = Math.max(...areas)
  const usable = (z: number) => areas[z] >= maxArea * 0.25
  let zLo = depth
  let zHi = -1
  for (let z = 0; z < depth; z++)
    if (usable(z)) {
      zLo = Math.min(zLo, z)
      zHi = Math.max(zHi, z)
    }

  const parent = new Int32Array(nextId).map((_, i) => i)
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])))
  const kindOf = new Uint8Array(nextId)
  for (const list of comps) for (const c of list) kindOf[c.id] = c.kind === 'hypo' ? 1 : 2
  const all: Comp[] = []
  let prevMap: Int32Array | null = null
  let prevZ = -2
  for (let z = 0; z < depth; z++) {
    if (!usable(z) || !comps[z].length) {
      prevMap = null
      continue
    }
    const map = new Int32Array(w * h).fill(-1)
    for (const c of comps[z]) {
      all.push(c)
      for (let i = 0; i < c.pixels.length; i++) {
        const k = c.pixels[i]
        map[k] = c.id
        if (prevMap && prevZ === z - 1) {
          const p = prevMap[k]
          if (p >= 0 && kindOf[p] === kindOf[c.id]) parent[find(c.id)] = find(p)
        }
      }
    }
    prevMap = map
    prevZ = z
  }

  const groups = new Map<number, Comp[]>()
  for (const c of all) {
    const r = find(c.id)
    const g = groups.get(r)
    if (g) g.push(c)
    else groups.set(r, [c])
  }

  const masks: (Uint8Array | null)[] = new Array(depth).fill(null)
  const lesions: Lesion[] = []
  for (const g of groups.values()) {
    const kind = g[0].kind
    const px = g.reduce((s, c) => s + c.pixels.length, 0)
    const volumeMl = (px * pxArea * dz) / 1000
    if (volumeMl < (kind === 'hypo' ? HYPO.minVolumeMl : HYPER.minVolumeMl)) continue
    const bySlice = new Map<number, number>()
    let sumHu = 0
    let sumMirror = 0
    let nMirror = 0
    let lat = 0
    let ap = 0
    for (const c of g) {
      bySlice.set(c.slice, (bySlice.get(c.slice) ?? 0) + c.pixels.length)
      sumHu += c.sumHu
      sumMirror += c.sumMirror
      nMirror += c.nMirror
      lat += c.sumLat
      ap += c.sumAp
      const m = masks[c.slice] ?? (masks[c.slice] = new Uint8Array(w * h))
      const v = kind === 'hypo' ? 1 : 2
      for (let i = 0; i < c.pixels.length; i++) m[c.pixels[i]] = v
    }
    const slices = [...bySlice.keys()].sort((a, b) => a - b)
    const keySlice = [...bySlice.entries()].sort((a, b) => b[1] - a[1])[0][0]
    lat /= px
    ap /= px
    const zRel = zHi > zLo ? (keySlice - zLo) / (zHi - zLo) : 0.5
    lesions.push({
      kind,
      volumeMl,
      side: lat > 0 ? 'left' : 'right',
      sliceFrom: slices[0],
      sliceTo: slices[slices.length - 1],
      keySlice,
      meanHu: sumHu / px,
      mirrorHu: nMirror ? sumMirror / nMirror : NaN,
      region: territory(Math.abs(lat), ap, zRel, kind),
    })
  }
  lesions.sort((a, b) => b.volumeMl - a.volumeMl)
  const ischemia = lesions.find((l) => l.kind === 'hypo') ?? null
  const hemorrhage = lesions.find((l) => l.kind === 'hyper') ?? null
  const priority = hemorrhage || (ischemia && ischemia.volumeMl >= 3) ? 'high' : ischemia ? 'medium' : 'routine'
  stageMs.group = now() - t
  onProgress({ stage: 'group', done: 1, total: 1 })

  return {
    volumeId: vol.id,
    lesions,
    ischemia,
    hemorrhage,
    priority,
    masks,
    asym,
    midlines,
    slicesUsed: zHi >= zLo ? zHi - zLo + 1 : 0,
    stageMs,
    elapsedMs: now() - t0,
  }
}

/* Rough vascular territory from where the finding sits inside its hemisphere. Deliberately coarse. */
function territory(lat: number, ap: number, zRel: number, kind: LesionKind) {
  if (zRel < 0.12) return 'задняя черепная ямка'
  if (kind === 'hyper' && lat < 0.45) return 'глубокие отделы полушария'
  if (lat < 0.38 && Math.abs(ap) < 0.4) return 'базальные ядра, внутренняя капсула'
  if (ap < -0.5 && lat < 0.6) return 'бассейн передней мозговой артерии (ACA)'
  if (ap > 0.5) return 'бассейн задней мозговой артерии (PCA)'
  return 'бассейн средней мозговой артерии (MCA)'
}

/* ---------------- per-slice geometry ---------------- */

interface Geometry {
  intra: Uint8Array
  area: number
  mid: Midline
}

function geometry(hu: Int16Array, w: number, h: number): Geometry | null {
  const n = w * h
  const bone = new Uint8Array(n)
  for (let k = 0; k < n; k++) bone[k] = hu[k] >= 250 ? 1 : 0
  const block = dilate(bone, w, h, 1)

  // flood the outside air from the border; whatever it cannot reach is inside the skull
  const outside = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0
  const push = (k: number) => {
    if (!outside[k] && !block[k]) {
      outside[k] = 1
      stack[sp++] = k
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (sp) {
    const k = stack[--sp]
    const x = k % w
    if (x > 0) push(k - 1)
    if (x < w - 1) push(k + 1)
    if (k >= w) push(k - w)
    if (k < n - w) push(k + w)
  }
  const inside = new Uint8Array(n)
  let count = 0
  for (let k = 0; k < n; k++)
    if (!outside[k] && !block[k] && hu[k] > -100) {
      inside[k] = 1
      count++
    }
  if (count < n * 0.01) return null

  // keep the largest island (drops orbits, sinuses, ear canals)
  const intra = largestIsland(inside, w, h)
  let area = 0
  let sx = 0
  let sy = 0
  for (let k = 0; k < n; k++)
    if (intra[k]) {
      area++
      sx += k % w
      sy += (k / w) | 0
    }
  if (area < n * 0.01) return null
  const cx = sx / area
  const cy = sy / area
  let m20 = 0
  let m02 = 0
  let m11 = 0
  for (let k = 0; k < n; k++)
    if (intra[k]) {
      const x = (k % w) - cx
      const y = ((k / w) | 0) - cy
      m20 += x * x
      m02 += y * y
      m11 += x * y
    }
  const phi = 0.5 * Math.atan2(2 * m11, m20 - m02)
  let dx = Math.cos(phi)
  let dy = Math.sin(phi)
  const tr = m20 + m02
  const ecc = Math.sqrt((m20 - m02) ** 2 + 4 * m11 * m11) / (tr || 1)
  // trust the axis only for an elongated, roughly vertical head; otherwise assume no tilt
  if (Math.abs(dx) > Math.sin((15 * Math.PI) / 180) || ecc < 0.04) {
    dx = 0
    dy = 1
  }
  if (dy < 0) {
    dx = -dx
    dy = -dy
  }
  return { intra, area, mid: { cx, cy, dx, dy } }
}

/* ---------------- per-slice asymmetry ---------------- */

function asymmetry(hu: Int16Array, w: number, h: number, geo: Geometry, pxX: number, pxY: number) {
  const n = w * h
  const { intra, mid } = geo
  const { cx, cy, dx, dy } = mid

  // mirror index + position in the midline frame
  const mirror = new Int32Array(n)
  const lat = new Float32Array(n)
  const ap = new Float32Array(n)
  let halfW = 1
  let halfL = 1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      const vx = x - cx
      const vy = y - cy
      const t = vx * dx + vy * dy
      const s = vx * dy - vy * dx
      lat[k] = s
      ap[k] = t
      if (intra[k]) {
        if (Math.abs(s) > halfW) halfW = Math.abs(s)
        if (Math.abs(t) > halfL) halfL = Math.abs(t)
      }
      const mx = Math.round(cx + 2 * t * dx - vx)
      const my = Math.round(cy + 2 * t * dy - vy)
      mirror[k] = mx >= 0 && my >= 0 && mx < w && my < h ? my * w + mx : -1
    }
  for (let k = 0; k < n; k++) {
    lat[k] /= halfW
    ap[k] /= halfL
  }

  const mm = (v: number) => Math.max(1, Math.round(v / Math.min(pxX, pxY)))

  // brain tissue (CSF, sulci and bone excluded), smoothed only over tissue so they do not pull the mean
  const tissue = new Uint8Array(n)
  for (let k = 0; k < n; k++) tissue[k] = intra[k] && hu[k] >= 15 && hu[k] <= 60 ? 1 : 0
  const deep = erode(intra, w, h, mm(2))
  const { mean: smooth, frac } = normalisedBox(hu, tissue, w, h, mm(3))

  const asym = new Int8Array(n)
  const hypo = new Uint8Array(n)
  for (let k = 0; k < n; k++) {
    if (!tissue[k] || !deep[k] || frac[k] < 0.5) continue
    const m = mirror[k]
    if (m < 0 || !intra[m] || frac[m] < 0.5) continue
    const d = smooth[m] - smooth[k]
    asym[k] = d > 127 ? 127 : d < -127 ? -127 : Math.round(d)
    if (d >= HYPO.diff && smooth[k] <= HYPO.maxHu) hypo[k] = 1
  }

  // hyperdense: bright, one-sided blobs inside the skull (bone rim excluded)
  const core = erode(intra, w, h, mm(3))
  const fine = normalisedBox(hu, intra, w, h, mm(1)).mean
  const hyper = new Uint8Array(n)
  for (let k = 0; k < n; k++) {
    if (!core[k]) continue
    const v = fine[k]
    if (v < HYPER.minHu || v > HYPER.maxHu) continue
    const m = mirror[k]
    if (m >= 0 && intra[m] && fine[m] <= v - HYPER.diff) hyper[k] = 1
  }

  // opening drops speckle; closing fills sulci that cross the finding
  const hypoClean = erode(dilate(open(hypo, w, h), w, h, mm(2)), w, h, mm(2))
  for (let k = 0; k < n; k++) hypoClean[k] &= intra[k]
  return { asym, hypo: hypoClean, hyper: open(hyper, w, h), mirror, lat, ap }
}

/* ---------------- raster helpers ---------------- */

function integral(src: ArrayLike<number>, w: number, h: number) {
  const W = w + 1
  const S = new Float64Array(W * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += src[y * w + x]
      S[(y + 1) * W + x + 1] = S[y * W + x + 1] + row
    }
  }
  return S
}

function boxSum(S: Float64Array, w: number, h: number, x: number, y: number, r: number) {
  const W = w + 1
  const x0 = x - r < 0 ? 0 : x - r
  const y0 = y - r < 0 ? 0 : y - r
  const x1 = x + r >= w ? w : x + r + 1
  const y1 = y + r >= h ? h : y + r + 1
  return S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]
}

function normalisedBox(hu: Int16Array, mask: Uint8Array, w: number, h: number, r: number) {
  const n = w * h
  const weighted = new Float32Array(n)
  for (let k = 0; k < n; k++) weighted[k] = mask[k] ? hu[k] : 0
  const Sv = integral(weighted, w, h)
  const Sm = integral(mask, w, h)
  const mean = new Float32Array(n)
  const frac = new Float32Array(n)
  const full = (2 * r + 1) ** 2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      const c = boxSum(Sm, w, h, x, y, r)
      if (!c) continue
      mean[k] = boxSum(Sv, w, h, x, y, r) / c
      frac[k] = c / full
    }
  return { mean, frac }
}

function erode(mask: Uint8Array, w: number, h: number, r: number) {
  const S = integral(mask, w, h)
  const out = new Uint8Array(w * h)
  const full = (2 * r + 1) ** 2
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++) {
      const k = y * w + x
      if (mask[k] && boxSum(S, w, h, x, y, r) === full) out[k] = 1
    }
  return out
}

function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  const S = integral(mask, w, h)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (boxSum(S, w, h, x, y, r) > 0) out[y * w + x] = 1
  return out
}

const open = (m: Uint8Array, w: number, h: number) => dilate(erode(m, w, h, 1), w, h, 1).map((v, k) => v & m[k])

/** 8-connected islands of at least `minPx` pixels. */
function islands(mask: Uint8Array, w: number, h: number, minPx: number): Int32Array[] {
  const n = w * h
  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  const out: Int32Array[] = []
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue
    let sp = 0
    let len = 0
    const buf: number[] = []
    seen[s] = 1
    stack[sp++] = s
    while (sp) {
      const k = stack[--sp]
      buf.push(k)
      len++
      const x = k % w
      const y = (k / w) | 0
      for (let oy = -1; oy <= 1; oy++) {
        const yy = y + oy
        if (yy < 0 || yy >= h) continue
        for (let ox = -1; ox <= 1; ox++) {
          const xx = x + ox
          if (xx < 0 || xx >= w) continue
          const q = yy * w + xx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack[sp++] = q
          }
        }
      }
    }
    if (len >= minPx) out.push(Int32Array.from(buf))
  }
  return out
}

function largestIsland(mask: Uint8Array, w: number, h: number) {
  const all = islands(mask, w, h, 1)
  const best = all.reduce<Int32Array | null>((a, b) => (!a || b.length > a.length ? b : a), null)
  const out = new Uint8Array(w * h)
  if (best) for (let i = 0; i < best.length; i++) out[best[i]] = 1
  return out
}
