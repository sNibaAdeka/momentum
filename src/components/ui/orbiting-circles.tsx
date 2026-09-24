import React from 'react'
import { cn } from '@/lib/utils'

/* OrbitingCircles + Ripple — from Vetra (MIT; originally Magic UI). Keyframes live in src/styles/tailwind.css. */

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  reverse?: boolean
  duration?: number
  radius?: number
  path?: boolean
  iconSize?: number
  speed?: number
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed
  const count = React.Children.count(children)
  return (
    <>
      {path && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <circle className="orbit-path" strokeDasharray="5 5" cx="50%" cy="50%" r={radius} fill="none" />
        </svg>
      )}
      {React.Children.map(children, (child, index) => (
        <div
          style={
            {
              '--duration': calculatedDuration,
              '--radius': radius,
              '--angle': (360 / count) * index,
              '--icon-size': `${iconSize}px`,
            } as React.CSSProperties
          }
          className={cn(
            'absolute flex size-[var(--icon-size)] transform-gpu animate-orbit items-center justify-center rounded-full',
            reverse && '[animation-direction:reverse]',
            className,
          )}
          {...props}
        >
          {child}
        </div>
      ))}
    </>
  )
}

export const Ripple = React.memo(function Ripple({
  mainCircleSize = 150,
  mainCircleOpacity = 0.22,
  numCircles = 5,
  className,
}: {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 select-none [mask-image:linear-gradient(to_bottom,white,transparent)]', className)}
    >
      {Array.from({ length: numCircles }, (_, i) => (
        <div
          key={i}
          className="ripple-ring absolute rounded-full border"
          style={
            {
              width: mainCircleSize + i * 90,
              height: mainCircleSize + i * 90,
              opacity: mainCircleOpacity - i * 0.03,
              animationDelay: `${i * 0.06}s`,
              borderStyle: i === numCircles - 1 ? 'dashed' : 'solid',
              top: '50%',
              left: '50%',
              '--i': i,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
})
