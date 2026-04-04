import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import rough from 'roughjs'
import { useTheme } from '../../theme/ThemeContext'

interface ComingSoonProps {
  feature: string
}

interface StarProps {
  x: number | string
  y: number | string
  size: number
  opacity: number
  color: string
}

function StarDoodle({ x, y, size, opacity, color }: StarProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!svgRef.current) return
    const svg = svgRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    const cx = size / 2, cy = size / 2, r = size / 2 - 1, ir = r * 0.4
    for (let i = 0; i < 10; i++) {
      const a1 = (Math.PI / 5) * i - Math.PI / 2
      const a2 = (Math.PI / 5) * (i + 1) - Math.PI / 2
      const ra = i % 2 === 0 ? r : ir
      const rb = i % 2 === 0 ? ir : r
      svg.appendChild(rc.line(
        cx + ra * Math.cos(a1), cy + ra * Math.sin(a1),
        cx + rb * Math.cos(a2), cy + rb * Math.sin(a2),
        { roughness: 2, strokeWidth: 1, stroke: color }
      ))
    }
  }, [size, color])

  const leftVal = typeof x === 'number' ? x : undefined
  const topVal = typeof y === 'number' ? y : undefined
  const rightVal = typeof x === 'string' ? 60 : undefined
  const bottomVal = typeof y === 'string' ? 80 : undefined

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      style={{
        position: 'absolute',
        ...(leftVal !== undefined ? { left: leftVal } : { right: rightVal }),
        ...(topVal !== undefined ? { top: topVal } : { bottom: bottomVal }),
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}

export default function ComingSoon({ feature }: ComingSoonProps) {
  const navigate = useNavigate()
  const { t, isDark } = useTheme()
  const roughBorderRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roughBorderRef.current || !boxRef.current) return
    const svg = roughBorderRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    const w = boxRef.current.offsetWidth
    const h = boxRef.current.offsetHeight
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    svg.appendChild(rc.rectangle(3, 3, w - 6, h - 6, {
      roughness: 3, strokeWidth: 2.5, stroke: t.roughStroke, fill: 'none',
    }))
  }, [t.roughStroke])

  const starOpacity = isDark ? 0.15 : 0.3

  return (
    <div style={{
      padding: '60px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      minHeight: '100%',
      position: 'relative',
      background: t.bg,
      transition: 'background 0.2s',
    }}>
      <StarDoodle x={40} y={40} size={20} opacity={starOpacity} color={t.yellow} />
      <StarDoodle x={80} y={120} size={14} opacity={starOpacity} color={t.yellow} />
      <StarDoodle x="right" y={60} size={18} opacity={starOpacity} color={t.yellow} />
      <StarDoodle x="right" y={150} size={12} opacity={starOpacity * 0.8} color={t.yellow} />
      <StarDoodle x={60} y="bottom" size={16} opacity={starOpacity} color={t.yellow} />

      <div
        ref={boxRef}
        style={{
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '48px 40px',
          position: 'relative',
          background: t.bg,
        }}
      >
        <svg ref={roughBorderRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />

        <svg width={80} height={80} viewBox="0 0 80 80" fill="none" stroke={t.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10 Q40 30 40 40 Q40 55 20 70" />
          <path d="M60 10 Q40 30 40 40 Q40 55 60 70" />
          <line x1="16" y1="10" x2="64" y2="10" />
          <line x1="16" y1="70" x2="64" y2="70" />
          <circle cx="40" cy="40" r="4" fill={t.teal} stroke="none" />
        </svg>

        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 800,
          fontSize: 28,
          color: t.ink,
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          🚧 {feature}
        </div>

        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 400,
          fontSize: 15,
          color: t.inkMuted,
          textAlign: 'center',
        }}>
          This feature is coming soon.
        </div>

        <button
          onClick={() => navigate('/dashboard/overview')}
          className="coming-soon-btn"
          style={{
            background: t.ink,
            color: t.bg,
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            padding: '12px 28px',
            borderRadius: 10,
            border: `2px solid ${t.ink}`,
            boxShadow: `4px 4px 0px ${t.teal}`,
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            marginTop: 8,
          }}
        >
          ← Back to Overview
        </button>
      </div>
    </div>
  )
}
