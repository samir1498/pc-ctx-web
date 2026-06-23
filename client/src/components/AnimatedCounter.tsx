import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface AnimatedCounterProps {
  from?: number
  to: number
  duration?: number
  className?: string
}

export function AnimatedCounter({ from = 0, to, duration = 1.5, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const count = useMotionValue(from)
  const rounded = useTransform(count, (v) => Math.round(v))

  useEffect(() => {
    if (!isInView) return
    const controls = animate(count, to, { duration, ease: 'easeOut' })
    return controls.stop
  }, [isInView, count, to, duration])

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>
}
