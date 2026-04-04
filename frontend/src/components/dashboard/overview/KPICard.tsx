import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import { useTheme } from '../../../theme/ThemeContext'

interface KPICardProps {
  label: string
  value: string | number
  icon: string
  color: string
  subtext?: string
  delay?: number
  decoration?: 'star' | 'circle' | 'zigzag' | 'diamond'
}

export default function KPICard({ label, value, icon, color, subtext, delay = 0, decoration = 'star' }: KPICardProps) {
  const { t, isDark } = useTheme()
  const roughRef = useRef<SVGSVGElement>(null)
  const decoRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roughRef.current || !containerRef.current) return
    const container = containerRef.current
    const draw = () => {
      if (!roughRef.current) return
      const svg = roughRef.current
      svg.innerHTML = ''
      const rc = rough.svg(svg)
      const w = container.offsetWidth
      const h = container.offsetHeight
      if (!w || !h) return
      svg.setAttribute('width', String(w))
      svg.setAttribute('height', String(h))
      svg.appendChild(rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: isDark ? 1.2 : 1.8,
        strokeWidth: isDark ? 1.5 : 2,
        stroke: isDark ? 'rgba(240,235,225,0.35)' : t.roughStroke,
        fill: 'none',
      }))
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [isDark, t.roughStroke])

  useEffect(() => {
    if (!decoRef.current) return
    const svg = decoRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    if (decoration === 'star') {
      const cx = 24, cy = 24, r = 12, ir = 5
      const pts: [number, number][] = []
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        pts.push([cx + (i % 2 === 0 ? r : ir) * Math.cos(angle), cy + (i % 2 === 0 ? r : ir) * Math.sin(angle)])
      }
      for (let i = 0; i < pts.length; i++) {
        const next = pts[(i + 1) % pts.length]
        svg.appendChild(rc.line(pts[i][0], pts[i][1], next[0], next[1], { roughness: 1.8, strokeWidth: 1.2, stroke: color }))
      }
    } else if (decoration === 'circle') {
      svg.appendChild(rc.circle(24, 24, 22, { roughness: 2, strokeWidth: 1.2, stroke: color, fill: 'none' }))
    } else if (decoration === 'zigzag') {
      const pts: [number, number][] = [[4, 24], [10, 12], [18, 32], [26, 14], [34, 24], [42, 14]]
      for (let i = 0; i < pts.length - 1; i++) {
        svg.appendChild(rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { roughness: 1.5, strokeWidth: 1.2, stroke: color }))
      }
    } else if (decoration === 'diamond') {
      svg.appendChild(rc.polygon([[24, 4], [40, 24], [24, 44], [8, 24]], { roughness: 1.8, strokeWidth: 1.2, stroke: color, fill: 'none' }))
    }
  }, [color, decoration])

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  return (
    <div
      ref={containerRef}
      className="kpi-card"
      style={{
        background: t.bgCard,
        borderRadius: 14,
        padding: 16,
        boxShadow: `4px 4px 0px ${t.shadow}`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        animation: `fadeSlideUp 400ms ease-out ${delay}ms both`,
        transition: 'background 0.2s ease',
      }}
    >
      <svg ref={roughRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <svg ref={decoRef} width={48} height={48} style={{ position: 'absolute', bottom: 4, right: 4, opacity: 0.15, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: hexToRgba(color, 0.18),
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
        </div>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 600, fontSize: 12,
          color: t.inkMuted,
          textAlign: 'right', maxWidth: 100, lineHeight: 1.3,
        }}>
          {label}
        </span>
      </div>

      <div style={{
        fontFamily: 'Nunito, sans-serif',
        fontWeight: 800, fontSize: 28, color: t.ink, marginTop: 12, lineHeight: 1.1,
      }}>
        {value}
      </div>

      {subtext && (
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 400, fontSize: 12, color: t.inkFaint, marginTop: 4,
        }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
