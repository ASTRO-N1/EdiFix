import React, { useRef, useState, useEffect } from 'react'
import { useInView } from 'framer-motion'
import { WaveTop, WaveBottom } from './DoodleElements'
import { useIsMobile } from '../../hooks/useWindowWidth'

const STATS = [
  { value: 97572, label: 'ICD-10-CM Codes Validated', formatted: '97,572' },
  { value: 1198, label: 'RARC Remark Codes', formatted: '1,198' },
  { value: 407, label: 'CARC Adjustment Codes', formatted: '407' },
  { value: 8184, label: 'HCPCS Level II Codes', formatted: '8,184' },
]

function useCountUp(target: number, duration = 1800, triggered = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!triggered) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out cubic
      const eased = 1 - (1 - progress) ** 3
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, triggered])

  return count
}

function StatItem({ stat, triggered }: { stat: typeof STATS[0]; triggered: boolean }) {
  const count = useCountUp(stat.value, 1800, triggered)

  const formatted = count.toLocaleString()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        minWidth: 160,
      }}
    >
      <span
        className="count-up"
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(36px, 4vw, 52px)',
          color: '#FFE66D',
          lineHeight: 1,
        }}
      >
        {formatted}
      </span>
      <span
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 400,
          fontSize: 14,
          color: 'rgba(253,250,244,0.8)',
          textAlign: 'center',
          maxWidth: 140,
        }}
      >
        {stat.label}
      </span>
    </div>
  )
}

function SquiggleDivider({ horizontal = false }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <svg width="60" height="3" viewBox="0 0 60 3" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: 'block', margin: '4px auto' }}>
        <path
          d="M0 1.5 C8 3, 16 0, 24 1.5 C32 3, 40 0, 48 1.5 C56 3, 60 0, 60 1.5"
          stroke="rgba(253,250,244,0.3)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="3" height="60" viewBox="0 0 3 60" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M1.5 0 C3 8, 0 16, 1.5 24 C3 32, 0 40, 1.5 48 C3 56, 0 60, 1.5 60"
        stroke="rgba(253,250,244,0.3)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tiny grid of 5-6 cells anchored to the bottom-left corner of the section.
 *  Fades immediately outward via a linear gradient mask — grid lines dissolve into the background.
 *  Purely decorative, pointer-events: none.
 */
function CornerDots({ side = 'left' }: { side?: 'left' | 'right' }) {
  const size = 250
  const grid = 5
  const gap = 32
  const center = Math.floor(grid / 2)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        [side]: 0, // this puts it on left or right automatically
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 1,
        WebkitMaskImage:
          side === 'left'
            ? 'linear-gradient(to top right, black 25%, transparent 90%)'
            : 'linear-gradient(to top left, black 25%, transparent 90%)',
        maskImage:
          side === 'left'
            ? 'linear-gradient(to top right, black 25%, transparent 90%)'
            : 'linear-gradient(to top left, black 25%, transparent 90%)',
      }}
    >
      <svg width={size} height={size}>
        {Array.from({ length: grid }).map((_, r) =>
          Array.from({ length: grid }).map((_, c) => {
            const dist = Math.abs(r - center) + Math.abs(c - center)
            const opacity = 0.45 - dist * 0.08

            return (
              <circle
                key={`${r}-${c}`}
                cx={c * gap + 20}
                cy={r * gap + 20}
                r={2}
                fill={`rgba(78,205,196,${Math.max(opacity, 0.08)})`}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const isMobile = useIsMobile()

  return (
    <section ref={ref} style={{ position: 'relative', backgroundColor: '#1A1A2E' }}>
      {!isMobile && <CornerDots side="left" />}
      {!isMobile && <CornerDots side="right" />}
      <WaveTop fill="#1A1A2E" />

      <div
        style={{
          padding: '48px clamp(24px, 5vw, 80px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 0 : 'clamp(16px, 3vw, 40px)',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            justifyContent: 'center',
            width: '100%',
            maxWidth: 900,
          }}
        >
          {STATS.map((stat, i) => (
            <React.Fragment key={stat.label}>
              <StatItem stat={stat} triggered={inView} />
              {i < STATS.length - 1 && <SquiggleDivider horizontal={isMobile} />}
            </React.Fragment>
          ))}
        </div>

        {/* Caption */}
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 13,
            color: 'rgba(253,250,244,0.5)',
            textAlign: 'center',
          }}
        >
          Reference data auto-updated quarterly from CMS, CDC, and X12.org
        </p>
      </div>

      <WaveBottom fill="#1A1A2E" />
      
    </section>
  )
}
