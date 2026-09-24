import { LogoMark } from '../components/primitives'
import { CrowdCanvas } from '../components/ui/skiper39'
import { ANALYSIS_SECONDS, NEURONS_PER_SECOND, useElapsed } from '../lib/clock'
import { fmtCompact, fmtDuration, plural } from '../lib/format'

const SOURCES = [
  'Saver J.L. Time is brain — quantified. Stroke, 2006; 37(1): 263–266.',
  'Powers W.J. et al. Guidelines for the Early Management of Patients With Acute Ischemic Stroke. AHA/ASA.',
  'World Stroke Organization. Global Stroke Fact Sheet 2025.',
  'MarketsAndMarkets. Stroke AI Market Report.',
]

function Session() {
  const t = useElapsed()
  const studies = Math.floor(t / ANALYSIS_SECONDS)
  return (
    <p className="footer__session">
      Вы на странице <span className="num">{fmtDuration(t)}</span>. За это время Momentum проанализировал бы{' '}
      <span className="num">{studies}</span> {plural(studies, ['исследование', 'исследования', 'исследований'])}, а мозг
      пациента без лечения потерял бы <span className="num coral">{fmtCompact(t * NEURONS_PER_SECOND)}</span> нейронов.
    </p>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <Session />
        <div className="footer__grid">
          <div className="footer__brand">
            <span className="logo">
              <LogoMark />
              <span className="logo__word">Momentum</span>
            </span>
            <p className="body-dim">AI-анализ КТ и МРТ головного мозга при подозрении на инсульт. V1.3 Beta.</p>
          </div>
          <div>
            <h2 className="footer__h">Источники</h2>
            <ol className="footer__sources">
              {SOURCES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="footer__h">Важно</h2>
            <p className="footer__legal">
              Momentum — инструмент поддержки принятия решений и не заменяет врача. Демонстрационные данные на сайте
              синтетические и не содержат сведений о пациентах. Показатели эффективности — оценки компании.
            </p>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© 2026 Momentum</span>
          <a href="#top">Наверх</a>
        </div>
        <p className="footer__crowd-line">Инсульт случается с обычными людьми. Мы работаем для каждого из них.</p>
      </div>
      <div className="footer__crowd" aria-hidden="true">
        <CrowdCanvas />
      </div>
      <p className="footer__credit">
        Анимация толпы — <a href="https://skiper-ui.com" target="_blank" rel="noreferrer">Skiper UI</a>, иллюстрации —{' '}
        <a href="https://www.openpeeps.com" target="_blank" rel="noreferrer">Open Peeps</a>
      </p>
    </footer>
  )
}
