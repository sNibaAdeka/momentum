import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Check, Crosshair, FileUp, FolderOpen, Layers, Play, Ruler, ShieldAlert, Target, Trash2 } from 'lucide-react'
import { Viewer, type Tool } from './Viewer'
import { Report } from './Report'
import { MagneticButton, ScanReveal } from '../../components/primitives'
import { PRESETS, SOURCE_LABEL, autoWindow, syntheticVolume, type Overlay, type Volume, type WindowPreset } from '../../ct/volume'
import { LoadError, loadFiles } from '../../ct/loaders'
import { ANALYSIS_STAGES, analyze, type Analysis, type AnalyzeProgress } from '../../ct/analyze'
import { PRIORITY_TEXT, ml, seconds, sideShort, summaryLine } from '../../ct/describe'
import { clearHistory, pushHistory, readHistory, type HistoryItem } from '../../lib/history'
import { fmtDec } from '../../lib/format'

const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: 'none', label: 'Без разметки' },
  { id: 'mask', label: 'Очаги' },
  { id: 'asym', label: 'Асимметрия' },
]

const TOOLS: { id: Tool; label: string; icon: typeof Crosshair }[] = [
  { id: 'probe', label: 'Плотность', icon: Crosshair },
  { id: 'ruler', label: 'Линейка', icon: Ruler },
]

async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e)
  if (!entries.some((e) => e.isDirectory)) return [...dt.files]
  const out: File[] = []
  const walk = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) {
      out.push(await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej)))
    } else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader()
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        if (!batch.length) break
        for (const c of batch) await walk(c)
      }
    }
  }
  for (const e of entries) await walk(e)
  return out
}

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { id: T; label: string; icon?: typeof Crosshair; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`seg__btn${value === o.id ? ' is-on' : ''}`}
          onClick={() => onChange(o.id)}
          disabled={disabled || o.disabled}
        >
          {o.icon && <o.icon aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Workstation() {
  const section = useRef<HTMLElement>(null)
  const [vol, setVol] = useState<Volume | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadMs, setLoadMs] = useState(0)
  const [index, setIndex] = useState(0)
  const [preset, setPreset] = useState<WindowPreset['id']>('brain')
  const [overlay, setOverlay] = useState<Overlay>('mask')
  const [tool, setTool] = useState<Tool>('probe')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [dragging, setDragging] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const loading = useRef(false)

  useEffect(() => setHistory(readHistory()), [])

  const accept = useCallback((v: Volume, ms: number) => {
    abort.current?.abort()
    setVol(v)
    setLoadMs(ms)
    setAnalysis(null)
    setProgress(null)
    setIndex(Math.floor(v.depth / 2))
    setPreset(v.isCT ? 'brain' : 'auto')
    setOverlay('mask')
    setBusy(null)
    setError(null)
  }, [])

  const openDemo = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    const t = performance.now()
    setError(null)
    setBusy('Готовим демо-серию')
    try {
      const v = await syntheticVolume((d, n) => setBusy(`Готовим демо-серию: ${d} из ${n}`))
      accept(v, performance.now() - t)
    } finally {
      loading.current = false
    }
  }, [accept])

  const openFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || loading.current) return
      loading.current = true
      const t = performance.now()
      setError(null)
      setBusy('Чтение файлов')
      try {
        const v = await loadFiles(files, setBusy)
        accept(v, performance.now() - t)
      } catch (e) {
        setBusy(null)
        setError(e instanceof LoadError ? e.message : 'Не удалось открыть файлы. Нужна серия DICOM, ZIP-архив или NIfTI.')
      } finally {
        loading.current = false
      }
    },
    [accept],
  )

  // the demo series is prepared as the section approaches, so the viewer is never empty on arrival
  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        void openDemo()
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [openDemo])

  const run = async () => {
    if (!vol || !vol.isCT || progress) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setAnalysis(null)
    let last = 0
    setProgress({ stage: 'mask', done: 0, total: vol.depth })
    try {
      const a = await analyze(
        vol,
        (p) => {
          const t = performance.now()
          if (t - last > 40 || p.stage === 'group') {
            last = t
            setProgress(p)
          }
        },
        ctrl.signal,
      )
      setAnalysis(a)
      setOverlay('mask')
      const main = a.hemorrhage ?? a.ischemia
      if (main) setIndex(main.keySlice)
      setHistory(
        pushHistory({
          id: `${vol.id}-${Date.now()}`,
          at: Date.now(),
          source: vol.source,
          matrix: `${vol.width}×${vol.height}×${vol.depth}`,
          summary: summaryLine(a),
          priority: a.priority,
          ms: a.elapsedMs + loadMs,
        }),
      )
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('Анализ прервался. Попробуйте другую серию.')
    } finally {
      if (abort.current === ctrl) setProgress(null)
    }
  }

  const autoWin = useMemo(() => (vol && preset === 'auto' ? autoWindow(vol.slices) : null), [vol, preset])
  const win = useMemo(() => {
    if (!vol) return { level: 40, width: 80 }
    const p = PRESETS.find((x) => x.id === preset)
    if (preset === 'auto' || !p?.level || !p.width) return autoWin ?? vol.window
    return { level: p.level, width: p.width }
  }, [vol, preset, autoWin])

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    void openFiles(files)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    void filesFromDrop(e.dataTransfer).then(openFiles)
  }

  const main = analysis?.hemorrhage ?? analysis?.ischemia ?? null
  const running = !!progress
  const stageIndex = progress ? ANALYSIS_STAGES.findIndex((s) => s.id === progress.stage) : -1
  const [sx, sy, sz] = vol?.spacing ?? [0, 0, 0]
  const timeFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <section ref={section} id="demo" className="section demo theme-dark" aria-labelledby="demo-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <p className="label"><b>03</b> Демо</p>
            <h2 id="demo-title" className="h2"><span>Попробуйте</span><span className="accent-i">сами.</span></h2>
          </ScanReveal>
          <div className="demo__intro">
            <p className="lead">Откройте свою КТ или демо-серию. Расчёт идёт прямо в браузере — файлы никуда не отправляются.</p>
            <p className="demo__disclaimer" role="note">
              <ShieldAlert aria-hidden="true" />
              Демонстрационный интерфейс. Не является медицинским заключением.
            </p>
          </div>
        </div>

        <div
          className="ws"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={onDrop}
        >
          <div className="ws__main" style={{ '--ar': vol ? (vol.width * vol.spacing[0]) / (vol.height * vol.spacing[1]) : 1 } as CSSProperties}>
            <div className="ws__bar">
              <Seg
                label="Окно просмотра"
                options={PRESETS.map((p) => ({ id: p.id, label: p.label, disabled: !vol?.isCT && p.id !== 'auto' }))}
                value={preset}
                onChange={setPreset}
                disabled={!vol}
              />
              <Seg label="Разметка" options={OVERLAYS} value={overlay} onChange={setOverlay} disabled={!analysis} />
              <Seg label="Инструмент" options={TOOLS} value={tool} onChange={setTool} disabled={!vol} />
            </div>

            <Viewer
              vol={vol}
              index={index}
              win={win}
              overlay={overlay}
              analysis={analysis}
              tool={tool}
              sourceLabel={vol ? SOURCE_LABEL[vol.source] : ''}
              busy={busy}
              dragging={dragging}
              onIndex={setIndex}
            />

            <div className="ws__nav">
              <label className="ws__slider">
                <span className="readout">
                  Срез <b className="num">{vol ? index + 1 : '–'}</b> / {vol?.depth ?? '–'}
                </span>
                <input
                  type="range"
                  min={1}
                  max={vol?.depth ?? 1}
                  value={index + 1}
                  onChange={(e) => setIndex(Number(e.target.value) - 1)}
                  disabled={!vol}
                  aria-label="Номер среза"
                />
              </label>
              <button type="button" className="ws-btn" onClick={() => main && setIndex(main.keySlice)} disabled={!main}>
                <Target aria-hidden="true" />
                Ключевой срез
              </button>
            </div>
          </div>

          <aside className="ws__side" aria-label="Исследование и анализ">
            <div className="ws-panel">
              <div className="ws-panel__head">
                <h3 className="ws-panel__title">Исследование</h3>
                {vol && <span className="ws-tag">{SOURCE_LABEL[vol.source]}</span>}
              </div>
              {vol ? (
                <dl className="ws-kv">
                  <div>
                    <dt>Матрица</dt>
                    <dd className="num">
                      {vol.width}×{vol.height}×{vol.depth}
                    </dd>
                  </div>
                  <div>
                    <dt>Воксель, мм</dt>
                    <dd className="num">
                      {fmtDec(sx, 2)} × {fmtDec(sy, 2)} × {fmtDec(sz, 1)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="ws-muted">{busy ?? 'Серия не открыта'}</p>
              )}
              {vol?.note && <p className="ws-note">{vol.note}</p>}
              {error && (
                <p className="ws-error" role="alert">
                  {error}
                </p>
              )}
              <div className="ws-open">
                <label className="ws-btn ws-btn--file">
                  <input type="file" multiple className="sr-only" accept=".dcm,.dicom,.ima,.zip,.nii,.gz,application/dicom,application/zip" onChange={onPick} />
                  <FileUp aria-hidden="true" />
                  Файлы
                </label>
                <label className="ws-btn ws-btn--file">
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    ref={(el) => {
                      el?.setAttribute('webkitdirectory', '')
                    }}
                    onChange={onPick}
                  />
                  <FolderOpen aria-hidden="true" />
                  Папка
                </label>
                <button type="button" className="ws-btn" onClick={() => void openDemo()}>
                  <Layers aria-hidden="true" />
                  Демо
                </button>
              </div>
              <p className="ws-muted ws-muted--xs">
                DICOM, ZIP или NIfTI. Имя и ID пациента не считываются. Нет своей КТ —{' '}
                <a className="ws-link" href={`${import.meta.env.BASE_URL}samples/momentum-sample-dicom.zip`} download>
                  скачайте пример DICOM
                </a>{' '}
                (1,6 МБ, очаг слева).
              </p>
            </div>

            <div className="ws-panel" aria-live="polite">
              <MagneticButton onClick={() => void run()} disabled={!vol || !vol.isCT || running || !!busy} className="ws-run">
                {running ? <span className="demo__spinner" aria-hidden="true" /> : <Play aria-hidden="true" />}
                {running ? 'Идёт анализ' : analysis ? 'Пересчитать' : 'Запустить анализ'}
              </MagneticButton>
              {vol && !vol.isCT && <p className="ws-note">Анализ пока только для КТ. МРТ можно просматривать.</p>}

              {(running || analysis) && (
                <ol className="ws-log">
                  <li className="is-done">
                    <Check aria-hidden="true" />
                    <span>Чтение серии</span>
                    <span className="num">{seconds(loadMs)}</span>
                  </li>
                  {ANALYSIS_STAGES.map((s, i) => {
                    const done = !!analysis || i < stageIndex
                    const active = running && i === stageIndex
                    return (
                      <li key={s.id} className={done ? 'is-done' : active ? 'is-active' : ''}>
                        {done ? <Check aria-hidden="true" /> : <span className="ws-log__dot" aria-hidden="true" />}
                        <span>{s.label}</span>
                        <span className="num">
                          {analysis ? seconds(analysis.stageMs[s.id]) : active && progress && s.id !== 'group' ? `${progress.done}/${progress.total}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}

              {analysis && (
                <>
                  <dl className="ws-result">
                    <div>
                      <dt>Гиподенсивная зона</dt>
                      <dd>{analysis.ischemia ? `${ml(analysis.ischemia.volumeMl)} · ${sideShort(analysis.ischemia)}` : 'не найдена'}</dd>
                    </div>
                    <div>
                      <dt>Гиперденсивная зона</dt>
                      <dd>{analysis.hemorrhage ? `${ml(analysis.hemorrhage.volumeMl)} · ${sideShort(analysis.hemorrhage)}` : 'не найдена'}</dd>
                    </div>
                    {main && (
                      <>
                        <div className="ws-result__wide">
                          <dt>Где</dt>
                          <dd>{main.region}</dd>
                        </div>
                        <div>
                          <dt>Плотность, HU</dt>
                          <dd className="num">
                            {fmtDec(main.meanHu, 0)} против {fmtDec(main.mirrorHu, 0)}
                          </dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Приоритет</dt>
                      <dd className={`prio prio--${analysis.priority}`}>{PRIORITY_TEXT[analysis.priority]}</dd>
                    </div>
                  </dl>
                  <p className="ws-total readout">Готово за {seconds(analysis.elapsedMs + loadMs)} · алгоритм асимметрии плотности, не нейросеть</p>
                </>
              )}
            </div>

            {history.length > 0 && (
              <div className="ws-panel">
                <div className="ws-panel__head">
                  <h3 className="ws-panel__title">История в этом браузере</h3>
                  <button
                    type="button"
                    className="ws-icon"
                    onClick={() => {
                      clearHistory()
                      setHistory([])
                    }}
                    aria-label="Очистить историю"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
                <ul className="ws-hist">
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className={`ws-hist__dot prio--${h.priority}`} aria-hidden="true" />
                      <span className="ws-hist__main">{h.summary}</span>
                      <span className="ws-hist__meta readout">
                        {timeFmt.format(h.at)} · {SOURCE_LABEL[h.source]} · {h.matrix}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        <AnimatePresence>{analysis && vol && analysis.volumeId === vol.id && <Report key={analysis.volumeId + analysis.elapsedMs} vol={vol} analysis={analysis} />}</AnimatePresence>
      </div>
    </section>
  )
}
