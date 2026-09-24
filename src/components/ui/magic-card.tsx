import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import React, { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/*
 * MagicCard — from Vetra (Shreyas-29/vetra, MIT; originally Magic UI).
 * Changes: Momentum colours (coral → electric blue border), card background from tokens,
 * listeners scoped to the card instead of the whole document.
 */
interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number
  gradientColor?: string
  gradientOpacity?: number
  gradientFrom?: string
  gradientTo?: string
}

export function MagicCard({
  children,
  className,
  gradientSize = 260,
  gradientColor = 'rgba(111,132,255,0.10)',
  gradientOpacity = 1,
  gradientFrom = '#ff5a43',
  gradientTo = '#6f84ff',
  ...props
}: MagicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const r = cardRef.current?.getBoundingClientRect()
      if (!r) return
      mouseX.set(e.clientX - r.left)
      mouseY.set(e.clientY - r.top)
    },
    [mouseX, mouseY],
  )
  const onLeave = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [gradientSize, mouseX, mouseY])

  useEffect(() => onLeave(), [onLeave])

  const spot = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`
  const edge = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, var(--rule-strong) 100%)`

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn('magic group relative flex size-full rounded-[26px]', className)}
      {...props}
    >
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: edge }} />
      <div aria-hidden="true" className="absolute inset-px z-10 rounded-[inherit] bg-card" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spot, opacity: gradientOpacity }}
      />
      <div className="relative z-30 w-full">{children}</div>
    </div>
  )
}
