import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Eye, Plus, Stethoscope, Workflow } from 'lucide-react'
import { ScanReveal, Reveal } from '../components/primitives'
import { easeIn, easeOut } from '../lib/env'

const PRINCIPLES = [
  {
    icon: Stethoscope,
    title: 'Решение за врачом',
    text: 'Momentum подсвечивает находки и расставляет приоритеты. Диагноз и тактику лечения определяет специалист.',
  },
  {
    icon: Eye,
    title: 'Каждая находка проверяема',
    text: 'Маска поражения ложится на исходную серию: врач видит, на что опирается модель, и может с ней не согласиться.',
  },
  {
    icon: Workflow,
    title: 'Встраивается, а не заменяет',
    text: 'Результат приходит туда, где врач уже работает, — в PACS и HIS. Без нового окна и лишних кликов.',
  },
]

const FAQ = [
  {
    q: 'Какие исследования поддерживаются?',
    a: 'КТ и МРТ головного мозга. Серии принимаются в форматах DICOM, NIfTI и ZIP-архивом.',
  },
  {
    q: 'Сколько длится анализ?',
    a: 'Около 18 секунд на исследование — результат готов, пока пациент ещё находится в аппарате.',
  },
  {
    q: 'Заменяет ли Momentum врача?',
    a: 'Нет. Это инструмент поддержки решений: он сокращает путь к диагнозу, но не ставит его. Заключение подписывает врач.',
  },
  {
    q: 'Как подключить к PACS и HIS?',
    a: 'В тарифе Clinic+ — через API-интеграцию. На демо покажем, как это выглядит в маршруте вашей клиники.',
  },
  {
    q: 'На какой стадии продукт?',
    a: 'Сейчас доступна версия V1.3 Beta. Условия подключения обсудим на демо.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <div className={`faq__item${open ? ' is-open' : ''}`}>
      <h3>
        <button type="button" className="faq__q" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {q}
          <Plus aria-hidden="true" className="faq__icon" />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="faq__a"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.17, ease: easeIn } }}
          >
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Principles() {
  return (
    <section id="principles" className="section principles" aria-labelledby="principles-title">
      <div className="wrap principles__grid">
        <div>
          <ScanReveal>
            <p className="label"><b>08</b> Принципы</p>
            <h2 id="principles-title" className="h2"><span>Врач принимает решение.</span><span className="accent-i">Momentum сокращает путь к нему.</span></h2>
          </ScanReveal>
          <ul className="principles__list">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title}>
                <Reveal delay={i * 0.06}>
                  <div className="card principle">
                      <span className="principle__icon" aria-hidden="true">
                        <p.icon />
                      </span>
                      <h3 className="h3">{p.title}</h3>
                      <p className="body-dim">{p.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
        <div className="faq">
          <h2 className="faq__title">Частые вопросы</h2>
          {FAQ.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}
