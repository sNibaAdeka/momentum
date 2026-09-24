import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, FileUp, Play, RotateCcw, ShieldAlert } from 'lucide-react'
import { CtViewer } from './CtViewer'
import { Report } from './Report'
import { MagneticButton, ScanReveal } from '../../components/primitives'
import { CT_SLICES, REFERENCE, WINDOWS, sliceAreaCm2, type Window } from '../../ct/ctSynth'
import { getSlice, keySliceIndex, totalMaskPx } from '../../ct/cache'
import { easeIn, easeOut } from '../../lib/env'
import { fmtDec, fmtInt, plural } from '../../lib/format'

const STAGES = [
  { id: 'load', label: 'Загрузка снимков', until: 4, done: 'Серия получена: 28 срезов × 5 мм' },
  { id: 'scan', label: 'Сканирование', until: 10, done: 'Все срезы проанализированы' },
  { id: 'mask', label: 'Маска поражения', until: 15, done: 'Маска построена' },
  { id: 'result', label: 'Результат', until: 17, done: 'Ишемический очаг, 32,8 мл, MCA / M2' },
  { id: 'report', label: 'Отчёт врачу', until: 18, done: 'Отчёт сформирован, приоритет высокий' },
] as const
const TOTAL = 18
const SPEED = 2 // simulated seconds per real second

type Phase = 'idle' | 'running' | 'done'

function stageAt(sim: number) {
  const i = STAGES.findIndex((s) => sim < s.until)
  return i === -1 ? STAGES.length : i
}

const fmtBytes = (b: number) =>
  b > 1024 * 1024 ? `${fmtDec(b / 1024 / 1024, 1)} МБ` : b > 1024 ? `${fmtInt(b / 1024)} КБ` : `${b} Б`

export function Demo() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [sim, setSim] = useState(0)
  const [view, setView] = useState({ index: 14, mask: 0 })
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [win, setWin] = useState<Window>(WINDOWS[1])
  const [maskOn, setMaskOn] = useState(true)
  const [key, setKey] = useState(14)
  const [lesionSlices, setLesionSlices] = useState(0)
  const raf = useRef(0)

  const stage = stageAt(sim)

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current)
    setPhase('running')
    setSim(0)
    setView({ index: 0, mask: 0 })
    let s = 0
    let last = performance.now()
    let lastUi = 0
    let loaded = 0
    const lesion = { from: 0, to: CT_SLICES - 1 }
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      s = reduce ? TOTAL : Math.min(TOTAL, s + dt * SPEED)

      // stage 1: slices arrive one by one (generated on the fly — max one per frame)
      const want = Math.min(CT_SLICES, Math.ceil((s / STAGES[0].until) * CT_SLICES))
      if (loaded < want || reduce) {
        const target = reduce ? CT_SLICES : loaded + 1
        for (; loaded < target; loaded++) getSlice(loaded)
        if (loaded === CT_SLICES) {
          const k = keySliceIndex()
          setKey(k)
          const withLesion = Array.from({ length: CT_SLICES }, (_, i) => i).filter((i) => getSlice(i).maskCount > 0)
          lesion.from = withLesion[0] ?? k
          lesion.to = withLesion[withLesion.length - 1] ?? k
          setLesionSlices(withLesion.length)
        }
      }

      let index = 0
      let mask = 0
      if (s < STAGES[0].until) {
        index = Math.max(0, loaded - 1)
      } else if (s < STAGES[1].until) {
        const p = (s - STAGES[0].until) / (STAGES[1].until - STAGES[0].until)
        index = Math.min(CT_SLICES - 1, Math.floor(p * CT_SLICES))
      } else if (s < STAGES[2].until) {
        const p = (s - STAGES[1].until) / (STAGES[2].until - STAGES[1].until)
        const k = keySliceIndex()
        const sweep = Math.min(1, p * 1.4)
        index = Math.round(lesion.from + (lesion.to - lesion.from) * sweep)
        if (p > 0.72) index = k
        mask = Math.min(1, p * 1.6)
      } else {
        index = keySliceIndex()
        mask = 1
      }

      if (now - lastUi > 33 || s >= TOTAL) {
        lastUi = now
        setSim(s)
        setView((v) => (v.index === index && v.mask === mask ? v : { index, mask }))
      }
      if (s >= TOTAL) {
        setPhase('done')
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [reduce])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const reset = () => {
    cancelAnimationFrame(raf.current)
    setPhase('idle')
    setSim(0)
    setFile(null)
    setView({ index: 14, mask: 0 })
  }

  const onFiles = (list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    setFile({ name: f.name, size: f.size })
  }
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragOver(false)
    onFiles(e.dataTransfer.files)
  }

  const done = phase === 'done'
  const showResult = sim >= STAGES[2].until
  const showReport = sim >= STAGES[3].until
  const total = useMemo(() => (done ? totalMaskPx() : 0), [done])
  const viewIndex = view.index
  const area = done && maskOn ? sliceAreaCm2(getSlice(viewIndex), total) : undefined

  return (
    <section id="demo" className="section demo theme-dark" aria-labelledby="demo-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <p className="label"><b>04</b> Демо</p>
            <h2 id="demo-title" className="h2"><span>Попробуйте</span><span className="accent-i">сами.</span></h2>
          </ScanReveal>
          <div className="demo__intro">
            <p className="lead">
              Загрузите серию или запустите демо-исследование и посмотрите, что Momentum делает за 18 секунд. После анализа
              снимок можно листать как в PACS.
            </p>
            <p className="demo__disclaimer" role="note">
              <ShieldAlert aria-hidden="true" />
              Демонстрационный интерфейс. Не является медицинским заключением.
            </p>
          </div>
        </div>

        <div className="demo__grid">
          {/* left: input + pipeline log */}
          <div className="demo__side">
            <label
              className={`drop${dragOver ? ' is-over' : ''}${file ? ' has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                type="file"
                className="sr-only"
                accept=".dcm,.nii,.gz,.zip,application/dicom,application/zip"
                onChange={(e: ChangeEvent<HTMLInputElement>) => onFiles(e.target.files)}
                disabled={phase === 'running'}
              />
              <FileUp aria-hidden="true" className="drop__icon" />
              {file ? (
                <span className="drop__file">
                  <b>{file.name}</b>
                  <span className="num">{fmtBytes(file.size)}</span>
                </span>
              ) : (
                <span className="drop__text">
                  <b>Перетащите файл или выберите на диске</b>
                  <span>DICOM, NIfTI или ZIP-архив серии</span>
                </span>
              )}
            </label>
            <p className="drop__note">
              Файл не покидает ваш браузер. В демо анализируется синтетическое исследование без данных пациентов.
            </p>

            <div className="demo__actions">
              {phase === 'idle' && (
                <MagneticButton onClick={run}>
                  <Play aria-hidden="true" />
                  {file ? 'Запустить анализ' : 'Запустить демо-исследование'}
                </MagneticButton>
              )}
              {phase === 'running' && (
                <MagneticButton disabled>
                  <span className="demo__spinner" aria-hidden="true" />
                  Идёт анализ
                </MagneticButton>
              )}
              {done && (
                <MagneticButton variant="ghost" onClick={reset}>
                  <RotateCcw aria-hidden="true" />
                  Начать заново
                </MagneticButton>
              )}
            </div>

            <div className="plog" aria-live="polite">
              <div className="plog__top">
                <span className="readout">
                  {phase === 'idle' ? 'Ожидание серии' : done ? 'Анализ завершён' : STAGES[Math.min(stage, 4)].label}
                </span>
                <span className="plog__timer num">
                  {fmtDec(sim, 1)} <span>/ {TOTAL} с</span>
                </span>
              </div>
              <div className="plog__bar" aria-hidden="true">
                {STAGES.map((s, i) => {
                  const from = i === 0 ? 0 : STAGES[i - 1].until
                  const p = Math.max(0, Math.min(1, (sim - from) / (s.until - from)))
                  return (
                    <span key={s.id} className="plog__seg" style={{ flexGrow: s.until - from }}>
                      <span style={{ transform: `scaleX(${p})` }} />
                    </span>
                  )
                })}
              </div>
              <ol className="plog__list">
                {STAGES.map((s, i) => {
                  const state = sim >= s.until ? 'done' : phase === 'running' && stage === i ? 'active' : 'wait'
                  return (
                    <li key={s.id} className={`plog__item is-${state}`}>
                      <span className="plog__mark" aria-hidden="true">
                        {state === 'done' ? <Check /> : <span />}
                      </span>
                      <span className="plog__label">{s.label}</span>
                      <span className="plog__detail">{state === 'done' ? (s.id === 'mask' && lesionSlices ? `${s.done}: ${lesionSlices} ${plural(lesionSlices, ['срез', 'среза', 'срезов'])} с очагом` : s.done) : state === 'active' ? 'выполняется' : ''}</span>
                      <span className="plog__time readout">{state === 'done' ? `${fmtDec(s.until, 1)} с` : ''}</span>
                    </li>
                  )
                })}
              </ol>
              {!reduce && phase !== 'idle' && <p className="plog__speed readout">Воспроизведение ×2</p>}
            </div>
          </div>

          {/* right: viewer + results */}
          <div className="demo__main">
            <CtViewer
              index={viewIndex}
              win={win}
              maskAmount={done ? (maskOn ? 1 : 0) : view.mask}
              scanning={phase === 'running' && stage === 1}
              interactive={done}
              empty={phase === 'idle'}
              onIndexChange={(i) => setView({ index: i, mask: 1 })}
              areaCm2={area}
            />

            <div className={`vctl${done ? ' is-on' : ''}`} aria-hidden={!done}>
              <div className="vctl__group" role="radiogroup" aria-label="Окно просмотра">
                {WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={win.id === w.id}
                    className={`vctl__seg${win.id === w.id ? ' is-on' : ''}`}
                    onClick={() => setWin(w)}
                    disabled={!done}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <label className="vctl__slider">
                <span className="vctl__slider-label">
                  Срез <span className="num">{viewIndex + 1}</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={CT_SLICES}
                  value={viewIndex + 1}
                  onChange={(e) => setView({ index: Number(e.target.value) - 1, mask: 1 })}
                  disabled={!done}
                  aria-label="Номер среза"
                />
              </label>
              <button
                type="button"
                className={`vctl__toggle${maskOn ? ' is-on' : ''}`}
                aria-pressed={maskOn}
                onClick={() => setMaskOn((m) => !m)}
                disabled={!done}
              >
                <span className="vctl__switch" aria-hidden="true" />
                Маска
              </button>
              <button type="button" className="vctl__key" onClick={() => setView({ index: key, mask: 1 })} disabled={!done}>
                Ключевой срез
              </button>
            </div>

            <AnimatePresence>
              {showResult && (
                <motion.dl
                  className="results"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } }}
                  exit={{ opacity: 0, transition: { duration: 0.2, ease: easeIn } }}
                >
                  {[
                    ['Тип поражения', 'Ишемический'],
                    ['Объём очага', `${fmtDec(REFERENCE.volumeMl, 1)} мл`],
                    ['Локализация', REFERENCE.location],
                    ['AI confidence', `${fmtDec(REFERENCE.confidence, 1)} %`],
                    ['Приоритет', 'High priority'],
                    ['Время анализа', `${REFERENCE.seconds} с`],
                  ].map(([k, v], i) => (
                    <motion.div
                      key={k}
                      className="results__item"
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3, ease: easeOut } }}
                    >
                      <dt>{k}</dt>
                      <dd className={k === 'Приоритет' ? 'coral' : undefined}>{v}</dd>
                    </motion.div>
                  ))}
                </motion.dl>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>{showReport && <Report keyIndex={key} fileName={file?.name} />}</AnimatePresence>
      </div>
    </section>
  )
}
