import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import rough from 'roughjs'
import useAppStore from '../../store/useAppStore'
import { useTheme } from '../../theme/ThemeContext'

const NAV_ITEMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9"/>
        <rect x="10" y="6" width="4" height="15"/>
        <rect x="17" y="3" width="4" height="18"/>
      </svg>
    ),
    label: 'Overview', path: '/dashboard/overview'
  },
  { section: 'ANALYSE' },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    label: 'Segment Explorer', path: '/dashboard/segments'
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9,12 11,14 15,10"/>
      </svg>
    ),
    label: 'Validation', path: '/dashboard/validation'
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15"/>
        <circle cx="18" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <path d="M18 9a9 9 0 0 1-9 9"/>
      </svg>
    ),
    label: 'Loop Structure', path: '/dashboard/loops'
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17,8 12,3 7,8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    label: 'Export', path: '/dashboard/export'
  },
  { section: 'TOOLS' },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
      </svg>
    ),
    label: 'AI Assistant', path: '/dashboard/ai'
  },
]

function ActiveHighlight({ width, height, stroke }: { width: number; height: number; stroke: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!svgRef.current || !width || !height) return
    const svg = svgRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    svg.appendChild(rc.rectangle(1, 1, width - 2, height - 2, {
      roughness: 2, strokeWidth: 1.8, stroke, fill: 'none',
    }))
  }, [width, height, stroke])
  if (!width || !height) return null
  return <svg ref={svgRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2, overflow: 'hidden' }} />
}

export default function Sidebar({ onMobileClose }: { onMobileClose?: () => void } = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { file, transactionType } = useAppStore()
  const { t, isDark, toggle } = useTheme()
  const underlineRef = useRef<SVGSVGElement>(null)
  const hackCardRef = useRef<SVGSVGElement>(null)
  const hackContainerRef = useRef<HTMLDivElement>(null)
  // Removed rightBorderRef use per UI fix 1

  useEffect(() => {
    if (!underlineRef.current) return
    const svg = underlineRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    svg.appendChild(rc.line(0, 3, 100, 3, { roughness: 2.5, strokeWidth: 2, stroke: t.teal }))
  }, [t.teal])

  useEffect(() => {
    if (!hackCardRef.current || !hackContainerRef.current) return
    const svg = hackCardRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    const w = hackContainerRef.current.offsetWidth
    const h = hackContainerRef.current.offsetHeight
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    svg.appendChild(rc.rectangle(1, 1, w - 2, h - 2, {
      roughness: 2, strokeWidth: 1.5,
      stroke: isDark ? '#D4A820' : '#B8860B',
      fill: 'none',
    }))
  }, [isDark])

  const displayName = file?.name
    ? file.name.length > 18 ? file.name.slice(0, 15) + '…' : file.name
    : 'No file loaded'

  return (
    <div style={{
      width: 260,
      height: '100vh',
      background: t.bgSidebar,
      position: 'relative',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={t.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="8" width="16" height="11" rx="2" />
            <rect x="9" y="11" width="2" height="2" fill={t.teal} stroke="none" />
            <rect x="13" y="11" width="2" height="2" fill={t.teal} stroke="none" />
            <line x1="9" y1="16" x2="15" y2="16" />
            <line x1="8" y1="8" x2="8" y2="5" />
            <line x1="16" y1="8" x2="16" y2="5" />
            <circle cx="12" cy="4" r="1.5" />
          </svg>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, color: t.ink }}>
            EdiFix
          </span>
        </div>
        <svg ref={underlineRef} width={110} height={8} style={{ display: 'block', marginTop: 2 }} />
      </div>

      {/* File pill */}
      <div style={{ padding: '0 16px', marginBottom: 4 }}>
        <div style={{
          background: t.ink,
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ flexShrink: 0, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.teal} strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18"/>
              <path d="M9 21V9"/>
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              color: t.bg,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {displayName}
            </div>
            {transactionType && (
              <span style={{
                background: t.teal,
                color: t.ink,
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 999,
                display: 'inline-block',
                marginTop: 2,
              }}>
                {transactionType}
              </span>
            )}
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.mint, flexShrink: 0 }} className="pulse-dot" />
        </div>
      </div>

      <div style={{
        margin: '12px 16px',
        height: 1,
        background: isDark ? 'rgba(240,235,225,0.07)' : 'rgba(26,26,46,0.07)'
      }} />

      {/* Nav */}
      <nav style={{ paddingTop: 24, flex: 1 }}>
        {NAV_ITEMS.map((item, idx) => {
          if ('section' in item) {
            return (
              <div key={idx} style={{
                padding: '16px 20px 6px',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                color: t.inkFaint,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>
                {item.section}
              </div>
            )
          }
          const isActive = location.pathname === item.path || (location.pathname === '/dashboard' && item.path === '/dashboard/overview')
          return (
            <div
              key={idx}
              onClick={() => { navigate(item.path!); onMobileClose?.() }}
              style={{
                padding: '10px 16px',
                margin: '2px 12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                background: isActive ? t.ink : 'transparent',
                color: isActive ? t.bg : t.inkMuted,
                boxShadow: isActive ? `3px 3px 0px rgba(0,0,0,0.15)` : 'none',
                transition: 'all 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              className={isActive ? 'nav-active' : 'nav-inactive'}
            >
              {isActive && <ActiveHighlight width={236} height={40} stroke={t.teal} />}
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ marginTop: 'auto' }}>
        {/* Dark mode toggle row */}
        <div style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            color: t.ink,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {isDark ? '🌙' : '☀️'} {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          <div
            onClick={toggle}
            style={{
              width: 44,
              height: 24,
              borderRadius: 999,
              background: isDark ? t.teal : 'rgba(26,26,46,0.15)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
              border: `2px solid ${t.roughStroke}`,
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: isDark ? '#1A1A2E' : '#FFFFFF',
              border: `2px solid ${t.roughStroke}`,
              position: 'absolute',
              top: 1,
              left: isDark ? 20 : 1,
              transition: 'left 0.2s',
              boxShadow: '1px 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>

        {/* Hackathon card */}
        <div
          ref={hackContainerRef}
          style={{
            background: isDark ? '#1E1A0E' : '#FFF9E6',
            padding: '12px 16px',
            margin: 12,
            borderRadius: 10,
            position: 'relative',
          }}
        >
          <svg ref={hackCardRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />
          <div style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 12,
            color: isDark ? '#D4A820' : '#B8860B',
          }}>
            🏆 Hackathon Mode
          </div>
          <div style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 11,
            color: t.inkMuted,
            marginTop: 2,
          }}>
            Best UI prize incoming...
          </div>
        </div>

        <div
          onClick={() => { navigate('/'); onMobileClose?.() }}
          style={{
            padding: '8px 16px 20px',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            color: t.coral,
            cursor: 'pointer',
          }}
        >
          ← Upload New File
        </div>
      </div>
    </div>
  )
}
