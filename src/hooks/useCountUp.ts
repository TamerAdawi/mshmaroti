import { useEffect, useRef, useState } from 'react'

/** True if the user has asked the OS to reduce motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Animates a number from its previous value up to `target` over `durationMs`,
 * using requestAnimationFrame. Snaps instantly when the user prefers reduced
 * motion. Safe to feed straight into a formatter, e.g. `fmtIls(useCountUp(total))`.
 */
export function useCountUp(target: number, durationMs = 650): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(target)
      fromRef.current = target
      return
    }

    const from = fromRef.current
    if (from === target) return

    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = easeOutCubic(t)
      setValue(from + (target - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      fromRef.current = target
    }
  }, [target, durationMs])

  return value
}
