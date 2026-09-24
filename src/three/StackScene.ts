import * as THREE from 'three'
import { CT_SIZE, CT_THICKNESS_MM, CT_FOV_MM, type CtSlice } from '../ct/ctSynth'
import { getSlice } from '../ct/cache'
import type { BrainSceneHandle, BrainSceneOptions } from './types'

/*
 * Hero volume: not a hologram — the study itself.
 * 28 axial slices of the synthetic CT are stacked in 3D as translucent planes (air → transparent,
 * soft tissue → faint, bone → dense). The head is "acquired" slice by slice, a scanner plane sweeps
 * the stack, and the infarct mask becomes a coral volume inside the data.
 */

const UNIT_PER_MM = 1 / 100
const PLANE = CT_FOV_MM * UNIT_PER_MM // 2.2
const GAP = CT_THICKNESS_MM * UNIT_PER_MM // 0.05
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const sliceVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const sliceFragment = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
uniform float uScan;
uniform vec3 uScanColor;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  vec3 col = t.rgb + uScanColor * uScan * 0.55 * t.a;
  float a = t.a * uOpacity * (0.85 + uScan * 0.9);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`

/** RGBA texture: brain window for grey, opacity from density. */
function ctTexture(slice: CtSlice, solid = false) {
  const n = CT_SIZE * CT_SIZE
  const data = new Uint8Array(n * 4)
  const { hu } = slice
  for (let k = 0; k < n; k++) {
    const v = hu[k]
    let g: number
    let a: number
    if (v < -300) {
      g = 0
      a = 0
    } else if (v > 300) {
      g = 228
      a = solid ? 1 : 0.4
    } else {
      g = Math.max(0, Math.min(255, ((v - 0) / 80) * 255))
      a = solid ? 0.97 : v < 12 ? 0.02 : 0.05 + (g / 255) * 0.12
    }
    // headrest is scanner hardware, not anatomy
    if (v > 100 && v < 300) a = 0 // only the headrest lives in this HU band
    const o = k * 4
    data[o] = g
    data[o + 1] = g
    data[o + 2] = g
    data[o + 3] = Math.round(a * 255)
  }
  const tex = new THREE.DataTexture(data, CT_SIZE, CT_SIZE, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.flipY = true
  tex.needsUpdate = true
  return tex
}

function maskTexture(slice: CtSlice) {
  const n = CT_SIZE * CT_SIZE
  const data = new Uint8Array(n * 4)
  const { mask } = slice
  for (let k = 0; k < n; k++) {
    if (!mask[k]) continue
    const i = k % CT_SIZE
    const edge = !mask[k - 1] || !mask[k + 1] || !mask[k - CT_SIZE] || !mask[k + CT_SIZE] || i === 0
    const o = k * 4
    data[o] = 255
    data[o + 1] = 91
    data[o + 2] = 74
    data[o + 3] = edge ? 255 : 150
  }
  const tex = new THREE.DataTexture(data, CT_SIZE, CT_SIZE, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.flipY = true
  tex.needsUpdate = true
  return tex
}

interface SliceMesh {
  base: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  mask: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null
  born: number // seconds when it was acquired
  maskShown: number
}

export function createStackScene(host: HTMLElement, opts: BrainSceneOptions): BrainSceneHandle {
  const high = opts.quality === 'high'
  const animate = !opts.reducedMotion

  const renderer = new THREE.WebGLRenderer({ antialias: high, alpha: true, powerPreference: 'high-performance' })
  const pr = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5)
  renderer.setPixelRatio(pr)
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.className = 'brain-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
  const root = new THREE.Group()
  const stack = new THREE.Group()
  root.add(stack)
  scene.add(root)

  const css = getComputedStyle(document.documentElement)
  const scanColor = new THREE.Color(css.getPropertyValue('--scan').trim() || '#3d8bff')
  const alertColor = new THREE.Color(css.getPropertyValue('--pencil').trim() || '#e8472f')
  const boneColor = new THREE.Color(css.getPropertyValue('--paper').trim() || '#ece9e2')

  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(o: T): T => {
    disposables.push(o)
    return o
  }
  const planeGeo = track(new THREE.PlaneGeometry(PLANE, PLANE))
  planeGeo.rotateX(-Math.PI / 2) // lie flat; image top (anterior) → −z

  const slices: SliceMesh[] = []
  // cut plane = the slice with the largest infarct cross-section: a crisp CT image on top, the head below it
  let TOP = 0
  {
    let best = -1
    for (let i = 8; i < 22; i++) {
      const c = getSlice(i).maskCount
      if (c > best) {
        best = c
        TOP = i
      }
    }
  }
  const COUNT = TOP + 1
  const totalH = TOP * GAP
  let spread = 1 // explode factor driven by scroll
  const yOf = (i: number) => (i - TOP / 2) * GAP * spread

  /* volume box: the frame every 3D workstation draws around a dataset */
  const box = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(new THREE.BoxGeometry(PLANE, 1, PLANE))),
    track(new THREE.LineBasicMaterial({ color: boneColor, transparent: true, opacity: 0.16, depthWrite: false })),
  )
  root.add(box)

  /* scanner plane: a thin frame + laser line that travels through the stack */
  const scanGroup = new THREE.Group()
  const scanFill = new THREE.Mesh(
    track(new THREE.PlaneGeometry(PLANE * 1.08, PLANE * 1.08).rotateX(-Math.PI / 2)),
    track(
      new THREE.MeshBasicMaterial({
        color: scanColor,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    ),
  )
  const scanEdge = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PLANE * 1.08, PLANE * 1.08).rotateX(-Math.PI / 2))),
    track(new THREE.LineBasicMaterial({ color: scanColor, transparent: true, opacity: 0.9, depthWrite: false })),
  )
  scanGroup.add(scanFill, scanEdge)
  scanGroup.renderOrder = 10
  root.add(scanGroup)

  /* anchors → HTML labels (grease-pencil annotation on the lesion) */
  const lesionLocal = new THREE.Vector3()
  let lesionFrom = -1
  let lesionTo = -1
  const lesionLabel = opts.labels.find((l) => l.id === 'lesion')?.el

  const st = {
    t: 0,
    px: 0,
    py: 0,
    tpx: 0,
    tpy: 0,
    dragYaw: 0,
    vYaw: 0,
    dragging: false,
    lastX: 0,
    scroll: 0,
    tScroll: 0,
    visible: true,
    pageVisible: !document.hidden,
    acquired: 0,
    acquireStart: -1,
    detected: false,
    detectAt: 0,
    readySent: false,
  }
  let disposed = false
  let raf = 0
  let w = 1
  let h = 1
  const clock = new THREE.Clock()
  const tmp = new THREE.Vector3()

  const invalidate = () => {
    if (!raf && !disposed && st.visible && st.pageVisible) raf = requestAnimationFrame(frame)
  }

  function resize() {
    w = host.clientWidth
    h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const r = 1.75
    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
    const dist = Math.max(r / Math.sin(vFov / 2), r / Math.sin(hFov / 2))
    camera.position.set(0, dist * 0.8, dist * 0.6)
    camera.lookAt(0, -0.05, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }

  function acquireNext() {
    const i = st.acquired
    if (i >= COUNT) return
    const s = getSlice(i)
    const mat = track(
      new THREE.ShaderMaterial({
        vertexShader: sliceVertex,
        fragmentShader: sliceFragment,
        uniforms: {
          map: { value: track(ctTexture(s, i === TOP)) },
          uOpacity: { value: animate ? 0 : 1 },
          uScan: { value: 0 },
          uScanColor: { value: scanColor },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    const base = new THREE.Mesh(planeGeo, mat)
    stack.add(base)
    let mask: SliceMesh['mask'] = null
    if (s.maskCount > 0) {
      const mm = track(
        new THREE.ShaderMaterial({
          vertexShader: sliceVertex,
          fragmentShader: sliceFragment,
          uniforms: {
            map: { value: track(maskTexture(s)) },
            uOpacity: { value: 0 },
            uScan: { value: 0 },
            uScanColor: { value: alertColor },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      mask = new THREE.Mesh(planeGeo, mm)
      mask.renderOrder = 5
      stack.add(mask)
      // centroid of the mask on this slice → lesion anchor
      let sx = 0
      let sy = 0
      for (let k = 0; k < s.mask.length; k++) {
        if (s.mask[k]) {
          sx += k % CT_SIZE
          sy += Math.floor(k / CT_SIZE)
        }
      }
      sx /= s.maskCount
      sy /= s.maskCount
      if (lesionFrom < 0) lesionFrom = i
      lesionTo = i
      lesionLocal.x += ((sx / CT_SIZE) - 0.5) * PLANE * s.maskCount
      lesionLocal.z += ((sy / CT_SIZE) - 0.5) * PLANE * s.maskCount
      lesionLocal.y += i * s.maskCount
      lesionWeight += s.maskCount
    }
    slices.push({ base, mask, born: st.t, maskShown: animate ? 0 : 1 })
    st.acquired++
  }
  let lesionWeight = 0

  function layout() {
    for (let i = 0; i < slices.length; i++) {
      const y = yOf(i)
      slices[i].base.position.y = y
      if (slices[i].mask) slices[i].mask!.position.y = y + 0.001
    }
    box.scale.y = Math.max(0.001, totalH * spread + GAP)
  }

  function updateLabel() {
    if (!lesionLabel || !lesionWeight) return
    tmp.set(lesionLocal.x / lesionWeight, (TOP / 2) * GAP * spread, lesionLocal.z / lesionWeight)
    stack.localToWorld(tmp)
    tmp.project(camera)
    const x = (tmp.x * 0.5 + 0.5) * w
    const y = (-tmp.y * 0.5 + 0.5) * h
    lesionLabel.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    lesionLabel.style.opacity = st.detected ? String(clamp01(1 - st.scroll * 1.8)) : '0'
    lesionLabel.classList.toggle('is-drawn', st.detected)
    lesionLabel.classList.toggle('is-flip', x > w * 0.58)
  }

  function frame() {
    raf = 0
    if (disposed) return
    const dt = Math.min(clock.getDelta(), 0.05)
    st.t += dt

    // acquisition: one slice every ~55 ms, bottom → top (vertex last), like a helical scan
    if (st.acquired < COUNT) {
      const due = animate ? Math.min(COUNT, Math.floor(st.t / 0.07) + 1) : COUNT
      while (st.acquired < due) acquireNext()
    }
    const acquiring = st.acquired < COUNT

    const k = 1 - Math.pow(0.02, dt)
    st.px += (st.tpx - st.px) * k
    st.py += (st.tpy - st.py) * k
    st.scroll += (st.tScroll - st.scroll) * (1 - Math.pow(0.0005, dt))
    if (!st.dragging && Math.abs(st.vYaw) > 1e-4) {
      st.dragYaw += st.vYaw * dt * 60
      st.vYaw *= Math.pow(0.03, dt)
    }

    spread = 1 + st.scroll * 1.6
    layout()
    const drift = animate ? Math.sin(st.t * 0.12) * 0.22 : 0
    root.rotation.y = 0.18 + drift + st.px * 0.3 + st.dragYaw + st.scroll * 0.5
    root.rotation.x = st.py * 0.08 - st.scroll * 0.12
    root.position.y = st.scroll * 0.4
    root.updateMatrixWorld()

    // scanner position (in slice-index space)
    let scanIdx: number
    if (acquiring) scanIdx = st.acquired - 1
    else if (animate) {
      const tt = st.t - COUNT * 0.07
      scanIdx = ((Math.sin(tt * 0.5 - Math.PI / 2) + 1) / 2) * TOP
    } else scanIdx = (lesionFrom + lesionTo) / 2
    scanGroup.position.y = (scanIdx - TOP / 2) * GAP * spread + 0.004
    ;(scanEdge.material as THREE.LineBasicMaterial).opacity = 0.9 * clamp01(1 - st.scroll * 1.5)
    ;(scanFill.material as THREE.MeshBasicMaterial).opacity = 0.06 * clamp01(1 - st.scroll * 1.5)

    if (!st.detected && !acquiring && lesionFrom >= 0 && scanIdx >= lesionFrom && scanIdx <= lesionTo) {
      st.detected = true
      st.detectAt = st.t
    }
    if (!animate && lesionFrom >= 0) st.detected = true

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i]
      const mat = s.base.material
      const age = st.t - s.born
      const depthFade = i === TOP ? 1 : 0.35 + 0.65 * (i / TOP)
      mat.uniforms.uOpacity.value = (animate ? clamp01(age / 0.35) : 1) * depthFade
      const near = Math.max(0, 1 - Math.abs(i - scanIdx) / 1.2)
      mat.uniforms.uScan.value = near
      if (s.mask) {
        if (st.detected) s.maskShown = animate ? clamp01((st.t - st.detectAt) / 0.6) : 1
        s.mask.material.uniforms.uOpacity.value = s.maskShown * (i === TOP ? 1 : 0.35)
        s.mask.material.uniforms.uScan.value = near * 0.6
      }
    }

    renderer.render(scene, camera)
    updateLabel()

    if (!acquiring && !st.readySent) {
      st.readySent = true
      opts.onReady?.()
    }
    const settling = st.dragging || Math.abs(st.vYaw) > 1e-4 || Math.abs(st.scroll - st.tScroll) > 1e-4
    if (animate || settling || acquiring) invalidate()
  }

  /* ---- input ---- */
  const onPointerMove = (e: PointerEvent) => {
    if (!animate || e.pointerType !== 'mouse') return
    st.tpx = (e.clientX / window.innerWidth) * 2 - 1
    st.tpy = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onDown = (e: PointerEvent) => {
    st.dragging = true
    st.lastX = e.clientX
    st.vYaw = 0
    canvas.setPointerCapture(e.pointerId)
    canvas.classList.add('is-dragging')
    invalidate()
  }
  const onDrag = (e: PointerEvent) => {
    if (!st.dragging) return
    const dx = e.clientX - st.lastX
    st.lastX = e.clientX
    st.vYaw = dx * 0.008
    st.dragYaw += st.vYaw
    invalidate()
  }
  const onUp = (e: PointerEvent) => {
    if (!st.dragging) return
    st.dragging = false
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    canvas.classList.remove('is-dragging')
    invalidate()
  }
  const onVisibility = () => {
    st.pageVisible = !document.hidden
    if (st.pageVisible) {
      clock.getDelta()
      invalidate()
    }
  }
  const onContextLost = (e: Event) => {
    e.preventDefault()
    opts.onFail?.()
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onDrag)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver(
    ([entry]) => {
      st.visible = entry.isIntersecting
      if (st.visible) {
        clock.getDelta()
        invalidate()
      }
    },
    { rootMargin: '120px' },
  )
  io.observe(host)
  resize()
  invalidate()

  return {
    setScroll(p) {
      st.tScroll = clamp01(p)
      invalidate()
    },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onDrag)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
