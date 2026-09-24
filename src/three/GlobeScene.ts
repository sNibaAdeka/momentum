import * as THREE from 'three'
import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath } from 'd3-geo'
import type { Topology, GeometryCollection } from 'topojson-specification'
import landTopo from 'world-atlas/land-110m.json'

/*
 * Market globe: dotted continents (world-atlas 110m land, rasterised once), Kazakhstan as home,
 * arcs to the next markets, and TAM / SAM / SOM as three rings orbiting the planet.
 * Rotates with scroll, follows the cursor, can be dragged. Pauses off-screen.
 */

export interface GlobeLabel {
  id: string
  el: HTMLElement
}
export interface GlobeOptions {
  quality: 'high' | 'low'
  reducedMotion: boolean
  labels: GlobeLabel[]
  onReady?: () => void
}
export interface GlobeHandle {
  setScroll(p: number): void
  dispose(): void
}

export const MARKETS = [
  { id: 'kz', lat: 43.24, lon: 76.89, home: true },
  { id: 'kr', lat: 37.57, lon: 126.98 },
  { id: 'sa', lat: 24.71, lon: 46.68 },
  { id: 'cn', lat: 39.9, lon: 116.4 },
  { id: 'eu', lat: 50.85, lon: 4.35 },
  { id: 'us', lat: 38.9, lon: -77.04 },
] as const

const RINGS = [
  { id: 'som', r: 1.3, color: '#ff5a43' },
  { id: 'sam', r: 1.55, color: '#6f84ff' },
  { id: 'tam', r: 1.82, color: '#ece9e2' },
] as const

const DEG = Math.PI / 180
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function toVec(lat: number, lon: number, r = 1, out = new THREE.Vector3()) {
  const la = lat * DEG
  const lo = lon * DEG
  return out.set(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r)
}

function landMask() {
  const W = 720
  const H = 360
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>
  const land = feature(topo, topo.objects.land)
  const projection = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2])
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  geoPath(projection, ctx)(land)
  ctx.fill()
  const data = ctx.getImageData(0, 0, W, H).data
  return (lat: number, lon: number) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)))
    const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)))
    return data[(y * W + x) * 4] > 128
  }
}

const dotVertex = /* glsl */ `
attribute float aSize;
attribute float aHome;
uniform float uPR;
uniform float uTime;
varying float vFace;
varying float vHome;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFace = clamp(dot(n, normalize(-mv.xyz)), 0.0, 1.0);
  vHome = aHome;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPR * (4.2 / -mv.z) * (1.0 + aHome * (0.4 + 0.3 * sin(uTime * 2.0)));
}
`
const dotFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHome;
varying float vFace;
varying float vHome;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 col = mix(uColor, uHome, vHome);
  float a = smoothstep(0.5, 0.2, d) * (0.18 + 0.82 * vFace);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`
const atmoVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
const atmoFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  gl_FragColor = vec4(uColor * f * 1.4, f);
  #include <colorspace_fragment>
}
`
const arcVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const arcFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
void main() {
  float t = vUv.x;
  float head = fract(uTime * 0.35 + uSeed);
  float glow = smoothstep(0.18, 0.0, abs(t - head));
  vec3 col = mix(uA, uB, t);
  float a = 0.28 + glow * 0.9;
  gl_FragColor = vec4(col * (0.7 + glow), a);
  #include <colorspace_fragment>
}
`

export function createGlobe(host: HTMLElement, opts: GlobeOptions): GlobeHandle {
  const high = opts.quality === 'high'
  const animate = !opts.reducedMotion
  const renderer = new THREE.WebGLRenderer({ antialias: high, alpha: true, powerPreference: 'high-performance' })
  const pr = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5)
  renderer.setPixelRatio(pr)
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.className = 'globe-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 0.35, 6.4)
  camera.lookAt(0, 0, 0)

  const root = new THREE.Group()
  const globe = new THREE.Group()
  root.add(globe)
  scene.add(root)
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(o: T) => (disposables.push(o), o)
  const U = { uTime: { value: 0 }, uPR: { value: pr } }

  // occluder: the dark body of the planet
  globe.add(
    new THREE.Mesh(
      track(new THREE.SphereGeometry(0.985, 64, 48)),
      track(new THREE.MeshBasicMaterial({ color: 0x07080b })),
    ),
  )

  // continents as dots
  {
    const isLand = landMask()
    const N = high ? 22000 : 9000
    const pos: number[] = []
    const nor: number[] = []
    const size: number[] = []
    const home: number[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    const kz = toVec(48, 67)
    const v = new THREE.Vector3()
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      const x = Math.cos(th) * r
      const z = Math.sin(th) * r
      const lat = Math.asin(y) / DEG
      const lon = Math.atan2(x, z) / DEG
      if (!isLand(lat, lon)) continue
      v.set(x, y, z)
      pos.push(x, y, z)
      nor.push(x, y, z)
      size.push(high ? 1.35 : 1.6)
      home.push(v.distanceTo(kz) < 0.2 ? 1 : 0) // Kazakhstan lights up
    }
    const g = track(new THREE.BufferGeometry())
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1))
    g.setAttribute('aHome', new THREE.Float32BufferAttribute(home, 1))
    const m = track(
      new THREE.ShaderMaterial({
        vertexShader: dotVertex,
        fragmentShader: dotFragment,
        uniforms: { ...U, uColor: { value: new THREE.Color('#dfe3ea') }, uHome: { value: new THREE.Color('#ff5a43') } },
        transparent: true,
        depthWrite: false,
      }),
    )
    globe.add(new THREE.Points(g, m))
  }

  // atmosphere
  {
    const m = track(
      new THREE.ShaderMaterial({
        vertexShader: atmoVertex,
        fragmentShader: atmoFragment,
        uniforms: { uColor: { value: new THREE.Color('#5d74ff') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    )
    const s = new THREE.Mesh(track(new THREE.SphereGeometry(1.14, 64, 48)), m)
    root.add(s)
  }

  // arcs from Kazakhstan
  const home = MARKETS[0]
  const a = toVec(home.lat, home.lon)
  MARKETS.slice(1).forEach((mk, i) => {
    const b = toVec(mk.lat, mk.lon)
    const angle = a.angleTo(b)
    const pts: THREE.Vector3[] = []
    for (let s = 0; s <= 48; s++) {
      const t = s / 48
      const p = new THREE.Vector3().copy(a).lerp(b, t).normalize()
      p.multiplyScalar(1 + Math.sin(Math.PI * t) * angle * 0.22)
      pts.push(p)
    }
    const geo = track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, high ? 0.0055 : 0.007, 6, false))
    const mat = track(
      new THREE.ShaderMaterial({
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
        uniforms: {
          uTime: U.uTime,
          uSeed: { value: i * 0.21 },
          uA: { value: new THREE.Color('#ff5a43') },
          uB: { value: new THREE.Color('#8b9bff') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    globe.add(new THREE.Mesh(geo, mat))
  })

  // market pins
  const pinGeo = track(new THREE.SphereGeometry(0.018, 12, 8))
  const pinHome = track(new THREE.MeshBasicMaterial({ color: '#ff5a43' }))
  const pinOther = track(new THREE.MeshBasicMaterial({ color: '#8b9bff' }))
  const anchors: { id: string; local: THREE.Vector3; normal: THREE.Vector3 | null; parent: THREE.Object3D; el?: HTMLElement }[] = []
  MARKETS.forEach((mk) => {
    const p = toVec(mk.lat, mk.lon, 1.01)
    const pin = new THREE.Mesh(pinGeo, 'home' in mk && mk.home ? pinHome : pinOther)
    pin.position.copy(p)
    if ('home' in mk && mk.home) pin.scale.setScalar(1.6)
    globe.add(pin)
    anchors.push({ id: mk.id, local: p.clone(), normal: p.clone().normalize(), parent: globe })
  })

  // TAM / SAM / SOM rings
  const rings = new THREE.Group()
  rings.rotation.set(1.18, 0, -0.32)
  root.add(rings)
  const ringMeshes: THREE.Mesh[] = []
  RINGS.forEach((rg, i) => {
    const mesh = new THREE.Mesh(
      track(new THREE.TorusGeometry(rg.r, i === 0 ? 0.008 : 0.005, 8, 220)),
      track(new THREE.MeshBasicMaterial({ color: rg.color, transparent: true, opacity: i === 2 ? 0.45 : 0.85 })),
    )
    rings.add(mesh)
    ringMeshes.push(mesh)
    const ang = [-0.45, Math.PI + 0.5, Math.PI - 0.25][i]
    const p = new THREE.Vector3(Math.cos(ang) * rg.r, Math.sin(ang) * rg.r, 0)
    anchors.push({ id: rg.id, local: p, normal: null, parent: mesh })
  })

  opts.labels.forEach((l) => {
    const a2 = anchors.find((x) => x.id === l.id)
    if (a2) a2.el = l.el
  })

  /* ---- loop ---- */
  const st = { t: 0, px: 0, py: 0, tpx: 0, tpy: 0, drag: 0, vDrag: 0, dragging: false, lastX: 0, scroll: 0, tScroll: 0, visible: false }
  let raf = 0
  let disposed = false
  let w = 1
  let h = 1
  let ready = false
  const clock = new THREE.Clock()
  const tmp = new THREE.Vector3()
  const tmpN = new THREE.Vector3()
  const camDir = new THREE.Vector3()
  const baseYaw = -home.lon * DEG
  const baseTilt = 0.42

  const invalidate = () => {
    if (!raf && !disposed && st.visible) raf = requestAnimationFrame(frame)
  }
  function resize() {
    w = host.clientWidth
    h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const r = 2.05
    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
    const dist = Math.max(r / Math.sin(vFov / 2), r / Math.sin(hFov / 2))
    camera.position.set(0, dist * 0.06, dist)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }

  function frame() {
    raf = 0
    if (disposed) return
    const dt = Math.min(clock.getDelta(), 0.05)
    if (animate) st.t += dt
    const k = 1 - Math.pow(0.02, dt)
    st.px += (st.tpx - st.px) * k
    st.py += (st.tpy - st.py) * k
    st.scroll += (st.tScroll - st.scroll) * (1 - Math.pow(0.001, dt))
    if (!st.dragging && Math.abs(st.vDrag) > 1e-4) {
      st.drag += st.vDrag * dt * 60
      st.vDrag *= Math.pow(0.05, dt)
    }
    U.uTime.value = st.t
    globe.rotation.set(baseTilt + st.py * 0.12, baseYaw + st.drag + (animate ? st.t * 0.05 : 0) + (st.scroll - 0.5) * 1.4, 0)
    root.rotation.set(st.py * 0.08, st.px * 0.18, 0)
    // cursor pulls the rings apart in depth
    const spread = 0.05 + Math.hypot(st.px, st.py) * 0.22
    ringMeshes.forEach((m, i) => {
      m.position.z = (i - 1) * spread
      m.rotation.z = (animate ? st.t * (0.05 + i * 0.03) : 0) * (i % 2 ? -1 : 1)
    })
    root.updateMatrixWorld()
    renderer.render(scene, camera)

    for (const an of anchors) {
      if (!an.el) continue
      tmp.copy(an.local)
      an.parent.localToWorld(tmp)
      let vis = 1
      if (an.normal) {
        tmpN.copy(an.normal).transformDirection(an.parent.matrixWorld)
        camDir.copy(camera.position).sub(tmp).normalize()
        vis = clamp01((tmpN.dot(camDir) - 0.15) * 4)
      }
      tmp.project(camera)
      an.el.style.transform = `translate3d(${((tmp.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * h).toFixed(1)}px, 0)`
      an.el.style.opacity = vis.toFixed(3)
    }
    if (!ready) {
      ready = true
      opts.onReady?.()
    }
    if (animate || st.dragging || Math.abs(st.vDrag) > 1e-4 || Math.abs(st.scroll - st.tScroll) > 1e-4) invalidate()
  }

  const onPointer = (e: PointerEvent) => {
    if (!animate || e.pointerType !== 'mouse') return
    const r = host.getBoundingClientRect()
    st.tpx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    st.tpy = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
  }
  const onDown = (e: PointerEvent) => {
    st.dragging = true
    st.lastX = e.clientX
    st.vDrag = 0
    canvas.setPointerCapture(e.pointerId)
    invalidate()
  }
  const onMove = (e: PointerEvent) => {
    if (!st.dragging) return
    const dx = e.clientX - st.lastX
    st.lastX = e.clientX
    st.vDrag = dx * 0.006
    st.drag += st.vDrag
    invalidate()
  }
  const onUp = (e: PointerEvent) => {
    st.dragging = false
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting
    if (st.visible) {
      clock.getDelta()
      invalidate()
    }
  })
  io.observe(host)
  resize()

  return {
    setScroll(p) {
      st.tScroll = clamp01(p)
      invalidate()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
