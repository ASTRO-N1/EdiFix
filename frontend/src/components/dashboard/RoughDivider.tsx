import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import { useTheme } from '../../theme/ThemeContext'

interface RoughDividerProps {
  orientation: 'vertical' | 'horizontal'
}

export default function RoughDivider({ orientation }: RoughDividerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { isDark } = useTheme()

  const draw = (w: number, h: number) => {
    if (!svgRef.current) return
    if (w < 2 && h < 2) return
    const svg = svgRef.current
    svg.replaceChildren()
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    const rc = rough.svg(svg)
    const stroke = isDark
      ? 'rgba(240,235,225,0.55)'
      : 'rgba(26,26,46,0.55)'

    if (orientation === 'vertical') {
      const x = w / 2
      svg.appendChild(
        rc.line(x, 4, x, h - 4, {
          roughness: 1.8,
          strokeWidth: 1.5,
          stroke,
        })
      )
    } else {
      const y = h / 2
      svg.appendChild(
        rc.line(4, y, w - 4, y, {
          roughness: 2.2,
          strokeWidth: 1.5,
          stroke,
        })
      )
    }
  }

  // Mount + resize observer
  useEffect(() => {
    if (!wrapperRef.current) return

    // Wait one animation frame for flex layout to settle
    const raf = requestAnimationFrame(() => {
      if (!wrapperRef.current) return
      const rect = wrapperRef.current.getBoundingClientRect()
      draw(Math.round(rect.width), Math.round(rect.height))
    })

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        draw(
          Math.round(entry.contentRect.width),
          Math.round(entry.contentRect.height)
        )
      }
    })
    ro.observe(wrapperRef.current)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation])

  // Redraw when theme toggles
  useEffect(() => {
    if (!wrapperRef.current) return
    const raf = requestAnimationFrame(() => {
      if (!wrapperRef.current) return
      const rect = wrapperRef.current.getBoundingClientRect()
      draw(Math.round(rect.width), Math.round(rect.height))
    })
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  const style: React.CSSProperties =
    orientation === 'vertical'
      ? {
          width: 12,
          alignSelf: 'stretch',
          flexShrink: 0,
          position: 'relative',
          minHeight: 0,
        }
      : {
          height: 12,
          width: '100%',
          flexShrink: 0,
          position: 'relative',
        }

  return (
    <div ref={wrapperRef} style={style}>
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'block',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      />
    </div>
  )
}