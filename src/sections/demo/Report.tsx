import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FileJson, FileText, Printer } from 'lucide-react'
import type { Analysis } from '../../ct/analyze'
import { SOURCE_LABEL, sliceImage, type Volume } from '../../ct/volume'
import { ALGORITHM_NOTE, PRIORITY_TEXT, findingsText, ml, recommendation, seconds, sideShort } from '../../ct/describe'
import { easeIn, easeOut } from '../../lib/env'
import { fmtDec } from '../../lib/format'

interface Props {
  vol: Volume
  analysis: Analysis
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Printable preliminary report, built only from what the algorithm actually measured. */
export function Report({ vol, analysis }: Props) {
  const reduce = useReducedMotion()
  const main = analysis.hemorrhage ?? analysis.ischemia
  const key = main?.keySlice ?? Math.floor(vol.depth / 2)
  const img = useMemo(
    () => sliceImage(vol, key, { level: 40, width: vol.isCT ? 80 : vol.window.width }, 'mask', analysis.masks[key]),
    [vol, key, analysis],
  )
  const date = useMemo(() => new Date(), [analysis])
  const dateText = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  const [sx, sy, sz] = vol.spacing
  const study = `${SOURCE_LABEL[vol.source]}, ${vol.depth} срезов × ${fmtDec(sz, 1)} мм, матрица ${vol.width}×${vol.height}`
  const findings = findingsText(analysis)
  const rec = recommendation(analysis)

  const plain = () =>
    [
      'Momentum — предварительный отчёт (демо)',
      `Дата: ${dateText}`,
      `Исследование: КТ головного мозга, ${study}`,
      ...findings.map((f) => `Находки: ${f}`),
      `Приоритет: ${PRIORITY_TEXT[analysis.priority]}. Время расчёта: ${seconds(analysis.elapsedMs)}.`,
      `Рекомендация: ${rec}`,
      ALGORITHM_NOTE,
    ].join('\n')

  const json = () =>
    JSON.stringify(
      {
        generator: 'Momentum demo',
        algorithm: 'hemispheric-density-asymmetry v0.1 (experimental, not a medical device)',
        createdAt: date.toISOString(),
        study: { source: vol.source, modality: vol.modality, matrix: [vol.width, vol.height, vol.depth], spacingMm: [sx, sy, sz] },
        priority: analysis.priority,
        findings: analysis.lesions.map((l) => ({
          type: l.kind === 'hypo' ? 'hypodense' : 'hyperdense',
          volumeMl: +l.volumeMl.toFixed(2),
          side: l.side,
          region: l.region,
          slices: [l.sliceFrom + 1, l.sliceTo + 1],
          keySlice: l.keySlice + 1,
          meanHu: +l.meanHu.toFixed(1),
          mirrorHu: +l.mirrorHu.toFixed(1),
        })),
        timingMs: { ...analysis.stageMs, total: analysis.elapsedMs },
        note: ALGORITHM_NOTE,
      },
      null,
      2,
    )

  const stamp = date.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const print = () => {
    document.body.classList.add('is-printing-report')
    const off = () => {
      document.body.classList.remove('is-printing-report')
      window.removeEventListener('afterprint', off)
    }
    window.addEventListener('afterprint', off)
    window.print()
  }

  return (
    <motion.article
      className="report"
      aria-labelledby="report-title"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.2, ease: easeIn } }}
    >
      <header className="report__head">
        <div>
          <p className="report__kicker">Предварительный отчёт Momentum</p>
          <h3 id="report-title" className="report__title">
            КТ головного мозга
          </h3>
          <p className="report__meta">
            {dateText} · {study}
          </p>
        </div>
        <span className={`report__prio report__prio--${analysis.priority}`}>Приоритет: {PRIORITY_TEXT[analysis.priority].toLowerCase()}</span>
      </header>

      <div className="report__body">
        <figure className="report__fig">
          {img && <img src={img} alt={main ? `Срез ${key + 1}: находка выделена цветом` : `Срез ${key + 1}`} />}
          <figcaption className="readout">
            Срез {key + 1}/{vol.depth} · R слева
          </figcaption>
        </figure>

        <div className="report__text">
          <section>
            <h4>Находки</h4>
            {findings.map((f) => (
              <p key={f}>{f}</p>
            ))}
          </section>
          {main && (
            <dl className="report__kv">
              <div>
                <dt>Объём</dt>
                <dd className="num">{ml(main.volumeMl)}</dd>
              </div>
              <div>
                <dt>Сторона</dt>
                <dd>{sideShort(main)}</dd>
              </div>
              <div>
                <dt>Разница плотности</dt>
                <dd className="num">{fmtDec(Math.abs(main.mirrorHu - main.meanHu), 0)} HU</dd>
              </div>
              <div>
                <dt>Время расчёта</dt>
                <dd className="num">{seconds(analysis.elapsedMs)}</dd>
              </div>
            </dl>
          )}
          <section>
            <h4>Рекомендация</h4>
            <p>{rec}</p>
          </section>
          <p className="report__legal">{ALGORITHM_NOTE}</p>
          <div className="report__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={print}>
              <Printer aria-hidden="true" />
              Печать
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => download(`momentum-report-${stamp}.txt`, 'text/plain;charset=utf-8', plain())}>
              <FileText aria-hidden="true" />
              Скачать TXT
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => download(`momentum-report-${stamp}.json`, 'application/json', json())}>
              <FileJson aria-hidden="true" />
              Скачать JSON
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
