import type { DataSet } from 'dicom-parser'
import { autoWindow, type Volume } from './volume'

/*
 * Opens a study from the user's disk: a DICOM series (many files or one ZIP) or a NIfTI volume.
 * Everything happens in the browser. Only geometry and pixel tags are read — patient name, ID,
 * birth date and institution tags are never accessed.
 */

export class LoadError extends Error {}

const MAX_VOXELS = 160_000_000 // ≈ 320 МБ в памяти; больше браузер не вытянет

const UNCOMPRESSED = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2'])

type Progress = (text: string) => void

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

export async function loadFiles(files: File[], onProgress: Progress = () => {}): Promise<Volume> {
  if (!files.length) throw new LoadError('Файлы не выбраны.')
  const nifti = files.find((f) => /\.nii(\.gz)?$/i.test(f.name))
  if (nifti) return loadNifti(nifti, onProgress)

  onProgress('Чтение файлов')
  const buffers: Uint8Array[] = []
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer())
    if (/\.zip$/i.test(f.name) || isZip(bytes)) {
      onProgress(`Распаковка ${f.name}`)
      buffers.push(...(await unzipAll(bytes)))
    } else if (/\.gz$/i.test(f.name) || isGzip(bytes)) {
      // .gz without .nii: most likely a gzipped NIfTI with an odd name
      return loadNiftiBytes(bytes.buffer as ArrayBuffer, onProgress)
    } else {
      buffers.push(bytes)
    }
  }
  const niftiInZip = buffers.find((b) => looksNifti(b))
  if (niftiInZip) return loadNiftiBytes(niftiInZip.slice().buffer as ArrayBuffer, onProgress)
  return loadDicom(buffers, onProgress)
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b
function looksNifti(b: Uint8Array) {
  if (b.length < 348) return false
  const dv = new DataView(b.buffer, b.byteOffset, 8)
  const le = dv.getInt32(0, true)
  const be = dv.getInt32(0, false)
  return le === 348 || be === 348 || le === 540 || be === 540
}

async function unzipAll(bytes: Uint8Array): Promise<Uint8Array[]> {
  const { unzip } = await import('fflate')
  return new Promise((resolve, reject) => {
    unzip(
      bytes,
      { filter: (f) => !f.name.endsWith('/') && !/(^|\/)(__MACOSX|\.)/.test(f.name) && !/DICOMDIR$/i.test(f.name) },
      (err, out) => {
        if (err) reject(new LoadError('Архив не распаковался. Проверьте, что это обычный ZIP без пароля.'))
        else resolve(Object.values(out))
      },
    )
  })
}

/* ---------------- DICOM ---------------- */

interface DicomSlice {
  rows: number
  cols: number
  frame: Int16Array
  pos: number[] | null
  instance: number
  series: string
  thickness: number
  spacing: [number, number]
  modality: string
  window: { level: number; width: number } | null
  orient: number[] | null
  rawMin: number
}

async function loadDicom(buffers: Uint8Array[], onProgress: Progress): Promise<Volume> {
  const mod = await import('dicom-parser')
  // UMD bundle: the API sits on `default` after CommonJS interop, on the namespace in typings
  const dicomParser = ((mod as { default?: DicomParser }).default ?? mod) as DicomParser
  const slices: DicomSlice[] = []
  let compressed = 0
  let other = 0
  for (let i = 0; i < buffers.length; i++) {
    if (i % 8 === 0) {
      onProgress(`Разбор DICOM: ${i + 1} из ${buffers.length}`)
      await tick()
    }
    const parsed = parseOne(dicomParser, buffers[i])
    if (parsed === 'compressed') compressed++
    else if (parsed === null) other++
    else slices.push(...parsed)
  }
  if (!slices.length) {
    if (compressed) throw new LoadError('Серия сжата (JPEG / JPEG 2000). Пока поддерживается только несжатый DICOM — экспортируйте серию без сжатия.')
    throw new LoadError('Не нашли изображений DICOM. Нужны файлы .dcm одной серии или ZIP-архив с ними.')
  }

  // the biggest series of one matrix size wins (a folder often also holds scouts and reformats)
  const groups = new Map<string, DicomSlice[]>()
  for (const s of slices) {
    const k = `${s.series}|${s.rows}x${s.cols}`
    const g = groups.get(k)
    if (g) g.push(s)
    else groups.set(k, [s])
  }
  const series = [...groups.values()].sort((a, b) => b.length - a.length)[0]
  const first = series[0]

  // order along the slice normal, inferior → superior; instance number as fallback
  let normal = [0, 0, 1]
  if (first.orient) {
    const [a, b, c, d, e, f] = first.orient
    normal = [b * f - c * e, c * d - a * f, a * e - b * d]
  }
  const along = (s: DicomSlice) => (s.pos ? s.pos[0] * normal[0] + s.pos[1] * normal[1] + s.pos[2] * normal[2] : NaN)
  const hasPos = series.every((s) => s.pos)
  series.sort((a, b) => (hasPos ? along(a) - along(b) : a.instance - b.instance))

  let dz = first.thickness || 5
  if (hasPos && series.length > 1) {
    const gaps = series.slice(1).map((s, i) => Math.abs(along(s) - along(series[i]))).filter((g) => g > 0.01)
    gaps.sort((a, b) => a - b)
    if (gaps.length) dz = gaps[Math.floor(gaps.length / 2)]
  }
  if (series.length * first.rows * first.cols > MAX_VOXELS) {
    throw new LoadError('Серия слишком большая для браузера. Выберите серию с толщиной среза 2–5 мм.')
  }

  // radiological display: patient right on the image left, anterior up
  const flipX = !!first.orient && first.orient[0] < -0.5
  const flipY = !!first.orient && first.orient[4] < -0.5
  const frames = series.map((s) => (flipX || flipY ? flip(s.frame, s.cols, s.rows, flipX, flipY) : s.frame))

  const axial = !first.orient || Math.abs(normal[2]) > 0.8
  const isCT = first.modality === 'CT' || (!first.modality && first.rawMin <= -900)
  const notes: string[] = []
  if (!axial) notes.push('Серия не аксиальная — анализ рассчитан на аксиальные срезы.')
  if (compressed) notes.push(`${compressed} сжатых файлов пропущено.`)
  if (groups.size > 1) notes.push(`В папке ${groups.size} серий, открыта самая длинная.`)
  if (other) notes.push(`${other} файлов не распознаны как изображения.`)

  return {
    id: `dicom-${Date.now()}`,
    source: 'dicom',
    modality: first.modality || (isCT ? 'CT' : '—'),
    isCT,
    width: first.cols,
    height: first.rows,
    depth: frames.length,
    slices: frames,
    spacing: [first.spacing[1], first.spacing[0], dz],
    window: isCT ? { level: 40, width: 80 } : first.window ?? autoWindow(frames),
    note: notes.join(' ') || undefined,
  }
}

type DicomParser = typeof import('dicom-parser')

function parseOne(dicomParser: DicomParser, bytes: Uint8Array): DicomSlice[] | 'compressed' | null {
  let ds: DataSet
  try {
    ds = dicomParser.parseDicom(bytes)
  } catch {
    try {
      // no Part 10 preamble: assume implicit little endian
      ds = dicomParser.parseDicom(bytes, { TransferSyntaxUID: '1.2.840.10008.1.2' })
    } catch {
      return null
    }
  }
  const px = ds.elements.x7fe00010
  const rows = ds.uint16('x00280010')
  const cols = ds.uint16('x00280011')
  if (!px || !rows || !cols) return null
  const ts = ds.string('x00020010') ?? '1.2.840.10008.1.2'
  if (px.encapsulatedPixelData || !UNCOMPRESSED.has(ts)) return 'compressed'
  if ((ds.uint16('x00280002') ?? 1) !== 1) return null // colour images (reports, screenshots)

  const bits = ds.uint16('x00280100') ?? 16
  const signed = ds.uint16('x00280103') === 1
  const slope = ds.floatString('x00281053') ?? 1
  const intercept = ds.floatString('x00281052') ?? 0
  const le = ts !== '1.2.840.10008.1.2.2'
  const nFrames = Math.max(1, ds.intString('x00280008') ?? 1)
  const n = rows * cols
  const bytesPer = bits === 8 ? 1 : 2
  if (px.length < n * bytesPer * nFrames) return null

  const dv = new DataView(bytes.buffer, bytes.byteOffset + px.dataOffset, n * bytesPer * nFrames)
  const out: DicomSlice[] = []
  const ps = [ds.floatString('x00280030', 0) ?? 1, ds.floatString('x00280030', 1) ?? ds.floatString('x00280030', 0) ?? 1] as [number, number]
  const pos = ds.elements.x00200032 ? [0, 1, 2].map((i) => ds.floatString('x00200032', i) ?? 0) : null
  const orient = ds.elements.x00200037 ? [0, 1, 2, 3, 4, 5].map((i) => ds.floatString('x00200037', i) ?? 0) : null
  const wc = ds.floatString('x00281050', 0)
  const ww = ds.floatString('x00281051', 0)
  const thickness = ds.floatString('x00180088') ?? ds.floatString('x00180050') ?? 0

  for (let f = 0; f < nFrames; f++) {
    const frame = new Int16Array(n)
    let rawMin = Infinity
    const base = f * n * bytesPer
    for (let k = 0; k < n; k++) {
      let raw: number
      if (bits === 8) raw = signed ? dv.getInt8(base + k) : dv.getUint8(base + k)
      else raw = signed ? dv.getInt16(base + k * 2, le) : dv.getUint16(base + k * 2, le)
      const v = raw * slope + intercept
      if (v < rawMin) rawMin = v
      frame[k] = v < -32768 ? -32768 : v > 32767 ? 32767 : Math.round(v)
    }
    out.push({
      rows,
      cols,
      frame,
      pos: pos && nFrames > 1 ? [pos[0], pos[1], pos[2] + f * (thickness || 1)] : pos,
      instance: (ds.intString('x00200013') ?? 0) * 1000 + f,
      series: ds.string('x0020000e') ?? 'series',
      thickness,
      spacing: ps,
      modality: (ds.string('x00080060') ?? '').trim().toUpperCase(),
      window: wc !== undefined && ww ? { level: wc, width: ww } : null,
      orient,
      rawMin,
    })
  }
  return out
}

function flip(src: Int16Array, w: number, h: number, fx: boolean, fy: boolean) {
  const out = new Int16Array(src.length)
  for (let y = 0; y < h; y++) {
    const sy = fy ? h - 1 - y : y
    for (let x = 0; x < w; x++) out[y * w + x] = src[sy * w + (fx ? w - 1 - x : x)]
  }
  return out
}

/* ---------------- NIfTI ---------------- */

async function loadNifti(file: File, onProgress: Progress): Promise<Volume> {
  onProgress('Чтение NIfTI')
  return loadNiftiBytes(await file.arrayBuffer(), onProgress)
}

async function loadNiftiBytes(input: ArrayBuffer, onProgress: Progress): Promise<Volume> {
  const nifti = await import('nifti-reader-js')
  let data = input
  if (nifti.isCompressed(data)) {
    onProgress('Распаковка NIfTI')
    await tick()
    data = nifti.decompress(data) as ArrayBuffer
  }
  if (!nifti.isNIFTI(data)) throw new LoadError('Файл не похож на NIfTI (.nii или .nii.gz).')
  const h = nifti.readHeader(data)
  if (!h) throw new LoadError('Заголовок NIfTI не читается.')
  const img = nifti.readImage(h, data)
  const [nx, ny, nz] = [h.dims[1], h.dims[2], Math.max(1, h.dims[3])]
  if (nx * ny * nz > MAX_VOXELS) throw new LoadError('Объём слишком большой для браузера.')

  onProgress('Перевод в единицы Хаунсфилда')
  await tick()
  const read = typedView(h.datatypeCode, img, h.littleEndian)
  if (!read) throw new LoadError('Этот тип данных NIfTI пока не поддерживается.')
  const slope = h.scl_slope || 1
  const inter = h.scl_inter || 0

  // voxel → display: patient right on image left, anterior up, slices inferior → superior
  const A = h.affine
  const flipX = A[0][0] > 0
  const flipY = A[1][1] > 0
  const flipZ = A[2][2] < 0
  const axial = Math.abs(A[2][2]) >= Math.abs(A[2][0]) && Math.abs(A[2][2]) >= Math.abs(A[2][1])

  const slices: Int16Array[] = []
  let min = Infinity
  for (let z = 0; z < nz; z++) {
    const sz = flipZ ? nz - 1 - z : z
    const out = new Int16Array(nx * ny)
    for (let y = 0; y < ny; y++) {
      const sy = flipY ? ny - 1 - y : y
      for (let x = 0; x < nx; x++) {
        const sx = flipX ? nx - 1 - x : x
        const v = read(sz * nx * ny + sy * nx + sx) * slope + inter
        if (v < min) min = v
        out[y * nx + x] = v < -32768 ? -32768 : v > 32767 ? 32767 : Math.round(v)
      }
    }
    slices.push(out)
  }
  const isCT = min <= -900
  return {
    id: `nifti-${Date.now()}`,
    source: 'nifti',
    modality: isCT ? 'CT' : 'MR',
    isCT,
    width: nx,
    height: ny,
    depth: nz,
    slices,
    spacing: [Math.abs(h.pixDims[1]) || 1, Math.abs(h.pixDims[2]) || 1, Math.abs(h.pixDims[3]) || 1],
    window: isCT ? { level: 40, width: 80 } : autoWindow(slices),
    note: axial ? undefined : 'Объём не аксиальный — анализ рассчитан на аксиальные срезы.',
  }
}

function typedView(code: number, buf: ArrayBuffer, le: boolean): ((i: number) => number) | null {
  const dv = new DataView(buf)
  switch (code) {
    case 2:
      return (i) => dv.getUint8(i)
    case 256:
      return (i) => dv.getInt8(i)
    case 4:
      return (i) => dv.getInt16(i * 2, le)
    case 512:
      return (i) => dv.getUint16(i * 2, le)
    case 8:
      return (i) => dv.getInt32(i * 4, le)
    case 768:
      return (i) => dv.getUint32(i * 4, le)
    case 16:
      return (i) => dv.getFloat32(i * 4, le)
    case 64:
      return (i) => dv.getFloat64(i * 8, le)
    default:
      return null
  }
}
