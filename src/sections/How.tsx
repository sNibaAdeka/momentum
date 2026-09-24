import { ScanReveal } from '../components/primitives'

const STEPS = [
  { t: '0 с', title: 'Снимок', text: 'Серия КТ или МРТ приходит из PACS.' },
  { t: '4 с', title: 'Анализ', text: 'Тип поражения, объём в мл, сосудистый бассейн.' },
  { t: '15 с', title: 'Приоритет', text: 'Срочное исследование встаёт первым в списке.' },
  { t: '18 с', title: 'Отчёт', text: 'Врач видит разметку и короткий отчёт.' },
]

export function How() {
  return (
    <section id="how" className="section how2" aria-labelledby="how-title">
      <div className="wrap">
        <div className="section-head">
          <ScanReveal>
            <p className="label"><b>02</b> Как работает</p>
            <h2 id="how-title" className="h2"><span>От снимка до врача —</span><span className="accent-b">18 секунд.</span></h2>
          </ScanReveal>
        </div>
        <ol className="how2__steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="how2__step">
              <span className="how2__tick" aria-hidden="true" />
              <p className="how2__time readout">{s.t}</p>
              <h3 className="how2__title">
                <span className="how2__n num" aria-hidden="true">{i + 1}</span>
                {s.title}
              </h3>
              <p className="body-dim">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
