export interface SectionMeta {
  id: string
  label: string
  nav?: boolean
}

/** Page order. The scout rail treats each section as one slice of a CT series. */
export const SECTIONS: SectionMeta[] = [
  { id: 'top', label: 'Первый экран' },
  { id: 'urgency', label: 'Срочность' },
  { id: 'route', label: 'Маршрут пациента' },
  { id: 'how', label: 'Как работает', nav: true },
  { id: 'demo', label: 'Демо', nav: true },
  { id: 'impact', label: 'Эффект', nav: true },
  { id: 'market', label: 'Рынок', nav: true },
  { id: 'pricing', label: 'Тарифы', nav: true },
  { id: 'principles', label: 'Принципы' },
  { id: 'contact', label: 'Запрос демо' },
]
