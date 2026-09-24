import { CT_SIZE, paintSlice, synthSlice, WINDOWS, type CtSlice, type Window } from './ctSynth'

const slices = new Map<number, CtSlice>()
const urls = new Map<string, string>()

export function getSlice(index: number): CtSlice {
  let s = slices.get(index)
  if (!s) {
    s = synthSlice(index)
    slices.set(index, s)
  }
  return s
}

/** PNG data URL of a windowed slice, cached. */
export function sliceUrl(index: number, win: Window = WINDOWS[0], mask = 0): string {
  const key = `${index}:${win.id}:${mask}`
  const hit = urls.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = CT_SIZE
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(CT_SIZE, CT_SIZE)
  paintSlice(img, getSlice(index), win, mask)
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL('image/png')
  urls.set(key, url)
  return url
}
