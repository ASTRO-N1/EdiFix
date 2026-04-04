import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import KPICard from './KPICard'
import ClaimCard from './ClaimCard'
import ValidationBadge from './ValidationBadge'

import GuestUpsellCard from '../GuestUpsellCard'
import useAppStore from '../../../store/useAppStore'
import { useTheme } from '../../../theme/ThemeContext'
import { useIsMobile } from '../../../hooks/useWindowWidth'

export default function OverviewPage() {
  const { parseResult, file, session } = useAppStore()
  const isMobile = useIsMobile()
  const { t, isDark } = useTheme()
  const validPanelRef = useRef<HTMLDivElement>(null)
  const validRoughRef = useRef<SVGSVGElement>(null)

  // Debug log per user request
  useEffect(() => {
    console.log('[OverviewPage] full parseResult:', JSON.stringify(parseResult, null, 2))
  }, [parseResult])

  const hasData = parseResult !== null

  // ── KPI metrics ────────────────────────────────────────────────────────────
  const metricsRoot = (parseResult as any)?.metrics ?? (parseResult as any)?.data?.metrics ?? {}
  const totalSegments: number | string = metricsRoot?.total_segments ?? '--'
  const txSets:        number | string = metricsRoot?.total_claims   ?? '--'
  const fileName    = (parseResult as any)?.filename ?? file?.name ?? '--'
  const fileSizeBytes = file?.size ?? 0
  const fileSizeLabel = fileSizeBytes > 0
    ? fileSizeBytes < 1024
      ? `${fileSizeBytes} B`
      : fileSizeBytes < 1024 * 1024
        ? `${(fileSizeBytes / 1024).toFixed(1)} KB`
        : `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : '--'

  // ── Error normalisation (mirrors ValidationDrawer exactly) ─────────────────
  const rawErrors: unknown[] = (() => {
    if (!parseResult) return []
    const root = parseResult as Record<string, any>
    const nested = root.data || {}
    // The backend can return both "errors" and "warnings" arrays (or "validation_errors").
    // We concatenate them all here before normalizing.
    const e = root.validation_errors ?? root.errors ?? nested.validation_errors ?? nested.errors ?? []
    const w = root.warnings ?? nested.warnings ?? []
    return [...(e as any[]), ...(w as any[])]
  })()

  // Same placeholder fallback used by ValidationDrawer (only shown when NO FILE is uploaded!)
  const PLACEHOLDER_ERRORS = [
    { type: 'error'   as const, code: 'InvalidNPI',    element: 'NM109', loop: '2010AA', message: 'Billing Provider NPI is missing or invalid format (must be 10 digits).' },
    { type: 'warning' as const, code: 'AmountMismatch', element: 'CLM02', loop: '2300',  message: 'Total claim charge amount does not equal sum of service lines (SV102).' },
  ]

  type NormErr = { type: 'error' | 'warning'; code: string; element: string; loop: string; message: string }
  const normalise = (raw: unknown[]): NormErr[] =>
    raw.map((e: any) => ({
      type:    (e.type === 'warning' || e.type === 'SituationalWarning') ? 'warning' : 'error',
      code:    e.code ?? e.error_code ?? e.type ?? 'ValidationError',
      element: e.element ?? e.field ?? e.segment ?? '',
      loop:    e.loop ?? e.loop_id ?? e.location ?? '',
      message: e.message ?? e.msg ?? e.description ?? 'Validation error.',
    } as NormErr))

  // If a file is loaded, use the REAL parsed errors (which may correctly be empty!).
  // If NO file is loaded, show placeholders.
  const errorsArr: NormErr[] = hasData
    ? normalise(rawErrors)
    : PLACEHOLDER_ERRORS

  const errCount  = errorsArr.filter(e => e.type === 'error').length
  const warnCount = errorsArr.filter(e => e.type === 'warning').length
  const isValid   = hasData && errCount === 0 && warnCount === 0

  useEffect(() => {
    if (!validRoughRef.current || !validPanelRef.current) return
    const container = validPanelRef.current
    const draw = () => {
      if (!validRoughRef.current) return
      const svg = validRoughRef.current
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

  const doodleOpacity = isDark ? 0.08 : 0.15

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', position: 'relative', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Background doodles */}
      <svg width={100} height={100} style={{ position: 'absolute', top: 40, right: 80, opacity: doodleOpacity, pointerEvents: 'none' }}>
        <path d="M50 10 L 60 40 L 90 50 L 60 60 L 50 90 L 40 60 L 10 50 L 40 40 Z" fill="none" stroke={t.yellow} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <svg width={80} height={80} style={{ position: 'absolute', top: 300, left: 20, opacity: doodleOpacity, pointerEvents: 'none' }}>
        <circle cx="40" cy="40" r="20" fill="none" stroke={t.teal} strokeWidth="2" strokeDasharray="4 4" />
      </svg>
      <svg width={60} height={60} style={{ position: 'absolute', bottom: 100, right: 40, opacity: doodleOpacity, pointerEvents: 'none' }}>
        <path d="M10 30 Q 30 10 50 30 T 90 30" fill="none" stroke={t.purple} strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 10 : 16,
        marginBottom: 16,
      }}>
        <KPICard
          label="Total Segments"
          value={totalSegments}
          icon="🧩"
          color={t.teal}
          subtext="across all loops"
          decoration="star"
          delay={0}
        />
        <KPICard
          label="Transaction Sets"
          value={txSets}
          icon="📋"
          color={t.purple}
          subtext="in this interchange"
          decoration="circle"
          delay={80}
        />
        <KPICard
          label="EDI Status"
          value={hasData ? (isValid ? 'Valid' : 'Invalid') : '--'}
          icon={hasData ? (isValid ? '✅' : '❌') : '➖'}
          color={hasData ? (isValid ? t.mint : t.coral) : t.inkMuted}
          subtext={hasData ? `${errCount} errors, ${warnCount} warnings` : 'no file loaded'}
          decoration="zigzag"
          delay={160}
        />
        <KPICard
          label="File Size"
          value={fileSizeLabel}
          icon="📁"
          color={t.yellow}
          subtext={fileName}
          decoration="diamond"
          delay={240}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(300px, 1fr) minmax(300px, 1.2fr)',
        gap: 16,
        marginBottom: 16,
        animation: 'fadeSlideUp 500ms ease-out 320ms both',
      }}>
        <ClaimCard />

        <div
          ref={validPanelRef}
          style={{
            background: t.bgCard,
            borderRadius: 14,
            padding: '20px 24px',
            boxShadow: `4px 4px 0px ${t.shadow}`,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            transition: 'background 0.2s',
          }}
        >
          <svg ref={validRoughRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: t.ink }}>
              Validation Report
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <ValidationBadge />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!hasData ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: t.inkFaint, fontFamily: 'Nunito, sans-serif' }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>📭</span>
                No file parsed yet
              </div>
            ) : isValid ? (
              <div style={{ margin: 'auto', textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isDark ? 'rgba(149,225,211,0.1)' : 'rgba(149,225,211,0.2)',
                  border: `3px solid ${t.teal}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: 32,
                }}>
                  ✨
                </div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, color: t.ink }}>
                  All checks passed
                </div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, color: t.inkMuted, marginTop: 4 }}>
                  SNIP Levels 1-2 verified successfully.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  {['Syntax', 'Balance', 'Segments'].map(tStr => (
                    <span key={tStr} style={{
                      background: isDark ? 'rgba(149,225,211,0.15)' : t.mint,
                      color: t.ink,
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontFamily: 'Nunito, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {tStr} OK
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              // Show errors and warnings from errorsArr (split by type)
              <>
                {errorsArr.filter(e => e.type === 'error').map((err, i) => (
                  <div key={`err-${i}`} style={{
                    background: isDark ? 'rgba(255,107,107,0.12)' : '#FFF0F0',
                    borderLeft: `4px solid ${t.coral}`,
                    padding: '12px 16px',
                    borderRadius: '4px 8px 8px 4px',
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 13,
                    color: t.ink,
                    lineHeight: 1.4,
                  }}>
                    <strong style={{ color: t.coral }}>Error [{err.code}]:</strong> {err.message}
                    {err.element && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.inkMuted, marginLeft: 8 }}>· {err.element}{err.loop ? ` @ ${err.loop}` : ''}</span>}
                  </div>
                ))}
                {errorsArr.filter(e => e.type === 'warning').map((warn, i) => (
                  <div key={`warn-${i}`} style={{
                    background: isDark ? 'rgba(255,230,109,0.08)' : '#FFFBF0',
                    borderLeft: `4px solid ${t.yellow}`,
                    padding: '12px 16px',
                    borderRadius: '4px 8px 8px 4px',
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 13,
                    color: t.ink,
                    lineHeight: 1.4,
                  }}>
                    <strong style={{ color: t.yellow }}>Warning [{warn.code}]:</strong> {warn.message}
                    {warn.element && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: t.inkMuted, marginLeft: 8 }}>· {warn.element}{warn.loop ? ` @ ${warn.loop}` : ''}</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(300px, 1.6fr) minmax(240px, 1fr)',
        gap: 16,
        marginBottom: 32,
        animation: 'fadeSlideUp 600ms ease-out 400ms both',
      }}>
      </div>

      {/* Guest upsell — shown below all data cards */}
      {!session && <GuestUpsellCard />}
    </div>
  )
}
