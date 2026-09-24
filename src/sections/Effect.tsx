import { Counter, ScanReveal } from '../components/primitives'
import { fmtInt } from '../lib/format'

export function Effect() {
  return (
    <section id="impact" className="section effect" aria-labelledby="impact-title">
      <div className="wrap">
        <div className="section-head">
          <ScanReveal>
            <p className="label"><b>04</b> Эффект</p>
            <h2 id="impact-title" className="h2"><span>Что меняется</span><span className="accent-b">в клинике.</span></h2>
          </ScanReveal>
        </div>
        <dl className="effect__row">
          <div>
            <dt>быстрее первичной ручной оценки</dt>
            <dd className="effect__fig">
              <Counter to={5} duration={1.2} format={(n) => `${Math.max(1, Math.round(n))}×`} />
            </dd>
          </div>
          <div>
            <dt>потенциальная экономия клиники в год*</dt>
            <dd className="effect__fig">
              <Counter to={100000} duration={1.6} format={(n) => `$${fmtInt(Math.round(n / 1000) * 1000)}`} />
            </dd>
          </div>
          <div>
            <dt>одинаково ночью, днём и в выходные</dt>
            <dd className="effect__fig">24/7</dd>
          </div>
          <div>
            <dt>встраивается в текущий маршрут</dt>
            <dd className="effect__fig effect__fig--word">PACS / HIS</dd>
          </div>
        </dl>
        <p className="source effect__note">* Оценка Momentum; зависит от потока исследований и штата.</p>
      </div>
    </section>
  )
}
