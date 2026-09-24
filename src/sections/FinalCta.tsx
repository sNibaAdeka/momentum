import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'
import { MagneticButton, ScanReveal } from '../components/primitives'
import { PLAN_LABEL, choosePlan, usePlan } from '../lib/planStore'
import { CT_SIZE, paintSlice, WINDOWS } from '../ct/ctSynth'
import { getSlice } from '../ct/cache'
import { easeOut } from '../lib/env'

const ROLES = ['Радиолог', 'Невролог', 'Руководитель клиники', 'IT / PACS-администратор', 'Другое'] as const

const schema = z.object({
  email: z.string().trim().min(1, 'Укажите рабочую почту').email('Проверьте адрес: нужен формат name@clinic.kz'),
  clinic: z.string().trim().min(2, 'Укажите название клиники'),
  role: z.string().min(1, 'Выберите роль'),
})
type FormData = z.infer<typeof schema>

/*
 * Delivery: VITE_DEMO_ENDPOINT → POST JSON there; VITE_NETLIFY_FORMS=1 → Netlify Forms (form "demo" is declared in index.html).
 * Without either, the site runs in preview mode and says so after submit.
 */
const ENDPOINT = import.meta.env.VITE_DEMO_ENDPOINT as string | undefined
const NETLIFY = import.meta.env.VITE_NETLIFY_FORMS === '1'
const LIVE = !!ENDPOINT || NETLIFY

async function deliver(data: FormData & { plan: string }) {
  if (ENDPOINT) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) throw new Error(String(res.status))
    return
  }
  if (NETLIFY) {
    const body = new URLSearchParams({ 'form-name': 'demo', ...data }).toString()
    const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    if (!res.ok) throw new Error(String(res.status))
  }
}

/* Quiet backdrop: the lesion slice, huge and dim. */
function SliceBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const id = window.setTimeout(() => {
      const img = ctx.createImageData(CT_SIZE, CT_SIZE)
      paintSlice(img, getSlice(15), WINDOWS[0], 1)
      ctx.putImageData(img, 0, 0)
    }, 50)
    return () => window.clearTimeout(id)
  }, [])
  return <canvas ref={ref} width={CT_SIZE} height={CT_SIZE} className="cta__slice" aria-hidden="true" />
}

export function FinalCta() {
  const plan = usePlan()
  const reduce = useReducedMotion()
  const [sent, setSent] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: '', clinic: '', role: '' } })

  const onSubmit = handleSubmit(async (data) => {
    setFailed(false)
    try {
      await deliver({ ...data, plan: plan ? PLAN_LABEL[plan] : '' })
      setSent(data.email)
    } catch {
      setFailed(true)
    }
  })

  return (
    <section id="contact" className="section cta" aria-labelledby="cta-title">
      <SliceBackdrop />
      <div className="wrap cta__grid">
        <div className="cta__copy">
          <ScanReveal>
            <h2 id="cta-title" className="display cta__title">
              Каждая минута имеет вес.
            </h2>
          </ScanReveal>
          <p className="lead">Покажем, как Momentum встраивается в существующий маршрут пациента.</p>
          <ol className="cta__steps">
            <li>Разберём анализ на обезличенных исследованиях</li>
            <li>Покажем разметку и отчёт в вашем PACS</li>
            <li>Подберём тариф и формат подключения</li>
          </ol>
        </div>

        <div className="cta__form referral">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div
                key="ok"
                className="cta__ok"
                role="status"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } }}
              >
                <CheckCircle2 aria-hidden="true" />
                <h3 className="h3">Заявка на демо отправлена</h3>
                <p className="body-dim">
                  Мы свяжемся с вами по адресу <b>{sent}</b>.
                </p>
                {!LIVE && <p className="source">Режим предпросмотра: форма ещё не подключена к серверу, заявка не ушла.</p>}
              </motion.div>
            ) : (
              <motion.form
                key="form"
                noValidate
                onSubmit={onSubmit}
                name="demo"
                initial={false}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
              >
                <header className="referral__head">
                  <p className="referral__title serif">Направление на демо</p>
                  <p className="referral__no print">Форма № М-1</p>
                </header>
                {plan && (
                  <p className="cta__plan">
                    Интересует тариф <b>{PLAN_LABEL[plan]}</b>
                    <button type="button" onClick={() => choosePlan(null)} aria-label="Убрать выбранный тариф">
                      <X aria-hidden="true" />
                    </button>
                  </p>
                )}
                <div className="field">
                  <label htmlFor="f-email" className="field__label">
                    Рабочая почта
                  </label>
                  <input
                    id="f-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@clinic.kz"
                    className="field__control"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'e-email' : undefined}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p id="e-email" className="field__error">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="f-clinic" className="field__label">
                    Название клиники
                  </label>
                  <input
                    id="f-clinic"
                    type="text"
                    autoComplete="organization"
                    placeholder="Городская больница № 1"
                    className="field__control"
                    aria-invalid={!!errors.clinic}
                    aria-describedby={errors.clinic ? 'e-clinic' : undefined}
                    {...register('clinic')}
                  />
                  {errors.clinic && (
                    <p id="e-clinic" className="field__error">
                      {errors.clinic.message}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="f-role" className="field__label">
                    Ваша роль
                  </label>
                  <select
                    id="f-role"
                    className="field__control"
                    aria-invalid={!!errors.role}
                    aria-describedby={errors.role ? 'e-role' : undefined}
                    {...register('role')}
                  >
                    <option value="" disabled>
                      Выберите из списка
                    </option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {errors.role && (
                    <p id="e-role" className="field__error">
                      {errors.role.message}
                    </p>
                  )}
                </div>
                {failed && (
                  <p className="field__error" role="alert">
                    Заявка не отправилась: нет связи с сервером. Проверьте интернет и нажмите ещё раз.
                  </p>
                )}
                <MagneticButton type="submit" variant="ink" disabled={isSubmitting} className="cta__submit">
                  {isSubmitting ? 'Отправляем…' : 'Запросить демо'}
                </MagneticButton>
                <p className="cta__fine">Нажимая кнопку, вы соглашаетесь на обработку контактных данных для связи по демо.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
