import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* Infinite logo/term strip in the spirit of Vetra's "companies" band. Pure CSS; paused for reduced motion. */
export function Marquee({ items, className }: { items: { icon: ReactNode; label: string }[]; className?: string }) {
  const row = (hidden: boolean) => (
    <ul className="marquee__row" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <li key={i} className="marquee__item">
          {it.icon}
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className={cn('marquee', className)}>
      <div className="marquee__track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
