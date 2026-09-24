import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Copy, Printer } from 'lucide-react'
import { CT_SLICES, REFERENCE, WINDOWS } from '../../ct/ctSynth'
import { sliceUrl } from '../../ct/cache'
import { easeIn, easeOut } from '../../lib/env'
import { fmtDec } from '../../lib/format'

export function Report({ keyIndex, fileName }: { keyIndex: number; fileName?: string }) {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const img = useMemo(() => sliceUrl(keyIndex, WINDOWS[1], 1), [keyIndex])
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
        new Date(),
      ),
    [],
  )

  const findings =
    'Зона пониженной плотности в бассейне правой средней мозговой артерии (MCA, сегмент M2) с утратой дифференцировки серого и белого вещества. Признаки, характерные для острого ишемического поражения.'
  const recommendation =
    'Приоритетный просмотр врачом. Подтвердить находку по исходной серии; дальнейшая визуализация сосудов — по протоколу учреждения.'

  const plain = [
    'Momentum V1.3 Beta — предварительный AI-отчёт (демо)',
    `Дата: ${date}`,
    `Исследование: КТ головного мозга без контрастирования, ${CT_SLICES} срезов × 5 мм (синтетические данные)`,
    `Находки: ${findings}`,
    `Объём очага: ${fmtDec(REFERENCE.volumeMl, 1)} мл. Локализация: ${REFERENCE.location}. Уверенность модели: ${fmtDec(REFERENCE.confidence, 1)} %.`,
    `Приоритет: высокий. Время анализа: ${REFERENCE.seconds} с.`,
    `Рекомендация: ${recommendation}`,
    'Отчёт сформирован автоматически и не является медицинским заключением. Окончательное решение принимает врач.',
  ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
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
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.25, ease: easeIn } }}
    >
      <header className="report__head">
        <div>
          <p className="report__kicker">Предварительный AI-отчёт · Momentum V1.3 Beta</p>
          <h3 id="report-title" className="report__title">
            КТ головного мозга без контрастирования
          </h3>
          <p className="report__meta">
            {date} · {CT_SLICES} срезов × 5 мм · {fileName ? `файл «${fileName}», ` : ''}синтетические данные
          </p>
        </div>
        <span className="report__prio">Приоритет: высокий</span>
      </header>

      <div className="report__body">
        <figure className="report__fig">
          <img src={img} alt="Ключевой срез: очаг в бассейне правой средней мозговой артерии выделен коралловым контуром" />
          <figcaption className="readout">
            Ключевой срез {keyIndex + 1}/{CT_SLICES} · окно «Инсульт» · R слева
          </figcaption>
        </figure>

        <div className="report__text">
          <section>
            <h4>Находки</h4>
            <p>{findings}</p>
          </section>
          <dl className="report__kv">
            <div>
              <dt>Объём очага</dt>
              <dd className="num">{fmtDec(REFERENCE.volumeMl, 1)} мл</dd>
            </div>
            <div>
              <dt>Локализация</dt>
              <dd>{REFERENCE.location}</dd>
            </div>
            <div>
              <dt>Уверенность модели</dt>
              <dd className="num">{fmtDec(REFERENCE.confidence, 1)} %</dd>
            </div>
            <div>
              <dt>Время анализа</dt>
              <dd className="num">{REFERENCE.seconds} с</dd>
            </div>
          </dl>
          <section>
            <h4>Рекомендация для врача</h4>
            <p>{recommendation}</p>
          </section>
          <p className="report__legal">
            Отчёт сформирован автоматически и не является медицинским заключением. Окончательное решение принимает врач.
          </p>
          <div className="report__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={print}>
              <Printer aria-hidden="true" />
              Распечатать отчёт
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={copy} aria-live="polite">
              <Copy aria-hidden="true" />
              {copied ? 'Текст скопирован' : 'Скопировать текст'}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
