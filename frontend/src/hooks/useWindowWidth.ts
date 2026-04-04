import { useEffect, useState } from 'react'

/** Returns the current window inner-width, updated on resize.
 *  Safe to call during SSR (returns 1024 as default). */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [])

  return width
}

export function useIsMobile(breakpoint = 768): boolean {
  return useWindowWidth() < breakpoint
}
