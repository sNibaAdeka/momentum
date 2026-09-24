/*
 * Writes a synthetic head CT (lesion in the LEFT hemisphere, i.e. mirrored against the built-in demo)
 * as an uncompressed DICOM series in a ZIP, so visitors can try the real file-upload path.
 * No patient data: every pixel comes from src/ct/ctSynth.ts.
 *
 *   npx esbuild scripts/make-samples.ts --bundle --platform=node --format=esm --outfile=/tmp/make-samples.mjs && node /tmp/make-samples.mjs
 */
import { writeFileSync } from 'node:fs'
import { zipSync } from 'fflate'
import { CT_FOV_MM, CT_SIZE, CT_SLICES, CT_THICKNESS_MM, synthSlice } from '../src/ct/ctSynth'

const S = CT_SIZE
const PX = CT_FOV_MM / CT_SIZE
const ROOT = '2.25.31415926535897932384626433832795'

export function mirroredSlices() {
  return Array.from({ length: CT_SLICES }, (_, z) => {
    const hu = synthSlice(z).hu
    const out = new Int16Array(hu.length)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out[y * S + x] = hu[y * S + (S - 1 - x)]
    return out
  })
}

class Writer {
  parts: Uint8Array[] = []
  private u16(v: number) {
    const b = new Uint8Array(2)
    new DataView(b.buffer).setUint16(0, v, true)
    return b
  }
  private u32(v: number) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, v, true)
    return b
  }
  el(group: number, elem: number, vr: string, value: Uint8Array) {
    let v = value
    if (v.length % 2) {
      const pad = new Uint8Array(v.length + 1)
      pad.set(v)
      pad[v.length] = vr === 'UI' || vr === 'OB' ? 0 : 0x20
      v = pad
    }
    const long = ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'].includes(vr)
    this.parts.push(this.u16(group), this.u16(elem), new TextEncoder().encode(vr))
    if (long) this.parts.push(new Uint8Array(2), this.u32(v.length))
    else this.parts.push(this.u16(v.length))
    this.parts.push(v)
    return this
  }
  str(group: number, elem: number, vr: string, s: string) {
    return this.el(group, elem, vr, new TextEncoder().encode(s))
  }
  us(group: number, elem: number, n: number) {
    return this.el(group, elem, 'US', this.u16(n))
  }
  bytes() {
    const len = this.parts.reduce((s, p) => s + p.length, 0)
    const out = new Uint8Array(len)
    let o = 0
    for (const p of this.parts) {
      out.set(p, o)
      o += p.length
    }
    return out
  }
}

export function dicomSlice(hu: Int16Array, z: number) {
  const sop = `${ROOT}.3.${z + 1}`
  const meta = new Writer()
    .el(0x0002, 0x0001, 'OB', new Uint8Array([0, 1]))
    .str(0x0002, 0x0002, 'UI', '1.2.840.10008.5.1.4.1.1.2')
    .str(0x0002, 0x0003, 'UI', sop)
    .str(0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
    .str(0x0002, 0x0012, 'UI', `${ROOT}.9`)
    .bytes()
  const groupLen = new Writer().el(0x0002, 0x0000, 'UL', new Uint8Array(new Uint32Array([meta.length]).buffer)).bytes()

  const px = new Int16Array(hu.length)
  for (let k = 0; k < hu.length; k++) px[k] = hu[k] + 1024
  const ds = new Writer()
    .str(0x0008, 0x0016, 'UI', '1.2.840.10008.5.1.4.1.1.2')
    .str(0x0008, 0x0018, 'UI', sop)
    .str(0x0008, 0x0060, 'CS', 'CT')
    .str(0x0008, 0x103e, 'LO', 'SYNTHETIC HEAD CT')
    .str(0x0010, 0x0010, 'PN', 'SYNTHETIC^PHANTOM')
    .str(0x0018, 0x0050, 'DS', String(CT_THICKNESS_MM))
    .str(0x0020, 0x000d, 'UI', `${ROOT}.1`)
    .str(0x0020, 0x000e, 'UI', `${ROOT}.2`)
    .str(0x0020, 0x0013, 'IS', String(z + 1))
    .str(0x0020, 0x0032, 'DS', `${-CT_FOV_MM / 2}\\${-CT_FOV_MM / 2}\\${(z * CT_THICKNESS_MM).toFixed(1)}`)
    .str(0x0020, 0x0037, 'DS', '1\\0\\0\\0\\1\\0')
    .us(0x0028, 0x0002, 1)
    .str(0x0028, 0x0004, 'CS', 'MONOCHROME2')
    .us(0x0028, 0x0010, S)
    .us(0x0028, 0x0011, S)
    .str(0x0028, 0x0030, 'DS', `${PX}\\${PX}`)
    .us(0x0028, 0x0100, 16)
    .us(0x0028, 0x0101, 16)
    .us(0x0028, 0x0102, 15)
    .us(0x0028, 0x0103, 1)
    .str(0x0028, 0x1050, 'DS', '40')
    .str(0x0028, 0x1051, 'DS', '80')
    .str(0x0028, 0x1052, 'DS', '-1024')
    .str(0x0028, 0x1053, 'DS', '1')
    .el(0x7fe0, 0x0010, 'OW', new Uint8Array(px.buffer))
    .bytes()

  const out = new Uint8Array(128 + 4 + groupLen.length + meta.length + ds.length)
  out.set(new TextEncoder().encode('DICM'), 128)
  out.set(groupLen, 132)
  out.set(meta, 132 + groupLen.length)
  out.set(ds, 132 + groupLen.length + meta.length)
  return out
}

if (process.argv[1]?.endsWith('make-samples.mjs')) {
  const slices = mirroredSlices()
  const files: Record<string, Uint8Array> = {}
  // written top-down on purpose: the loader must sort by ImagePositionPatient, not by file order
  for (let z = CT_SLICES - 1; z >= 0; z--) files[`momentum-sample/IM${String(CT_SLICES - z).padStart(4, '0')}.dcm`] = dicomSlice(slices[z], z)
  const zip = zipSync(files, { level: 9 })
  writeFileSync('public/samples/momentum-sample-dicom.zip', zip)
  console.log('public/samples/momentum-sample-dicom.zip', (zip.length / 1024 / 1024).toFixed(2), 'MB')
}
