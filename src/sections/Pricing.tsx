import { Check } from 'lucide-react'
import { MagneticButton, ScanReveal, Reveal } from '../components/primitives'
import { choosePlan, type Plan } from '../lib/planStore'

interface PlanCard {
  id: Plan
  name: string
  price: number
  fits: string
  features: string[]
  featured?: boolean
}

const PLANS: PlanCard[] = [
  {
    id: 'core',
    name: 'Core',
    price: 199,
    fits: 'Для отделения или диагностического центра',
    features: ['Анализ КТ и МРТ', 'Обнаружение и измерение очага', 'Отчёт врачу', 'История исследований'],
  },
  {
    id: 'clinic',
    name: 'Clinic+',
    price: 399,
    fits: 'Для клиник, где Momentum работает внутри маршрута пациента',
    features: ['Всё из Core', 'API-интеграция с PACS/HIS', 'Приоритетная поддержка', 'Аналитика клиники'],
    featured: true,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="section pricing" aria-labelledby="pricing-title">
      <div className="wrap">
        <div className="section-head section-head--split">
          <ScanReveal>
            <h2 id="pricing-title" className="h2">
              Тарифы
            </h2>
          </ScanReveal>
          <p className="lead">Фиксированная цена в месяц. Начните с Core и подключите интеграцию, когда будете готовы.</p>
        </div>
        <div className="plans">
          {PLANS.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08} className="plans__cell">
              <article className={`plan${p.featured ? ' plan--featured' : ' film'}`} aria-labelledby={`plan-${p.id}`}>
                {p.featured && <span className="plan__glow" aria-hidden="true" />}
                <header className="plan__head">
                  <h3 id={`plan-${p.id}`} className="plan__name">
                    {p.name}
                  </h3>
                  {p.featured && <span className="plan__badge">Интеграция с PACS/HIS</span>}
                </header>
                <p className="plan__fits">{p.fits}</p>
                <p className="plan__price">
                  <span className="plan__amount num">${p.price}</span>
                  <span className="plan__per">в месяц</span>
                </p>
                <ul className="plan__list">
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <MagneticButton
                  href="#contact"
                  variant={p.featured ? 'ink' : 'ghost'}
                  onClick={() => choosePlan(p.id)}
                  className="plan__cta"
                >
                  Запросить демо
                </MagneticButton>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
