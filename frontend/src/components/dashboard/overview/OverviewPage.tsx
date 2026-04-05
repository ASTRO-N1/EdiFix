import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import KPICard from './KPICard'
import ClaimCard from './ClaimCard'

import GuestUpsellCard from '../GuestUpsellCard'
import useAppStore from '../../../store/useAppStore'
import { useTheme } from '../../../theme/ThemeContext'
import { useIsMobile } from '../../../hooks/useWindowWidth'

export default function OverviewPage() {
  const { parseResult, file, session, setActiveMainView } = useAppStore()
  const isMobile = useIsMobile()
  const { t, isDark } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    console.log('[OverviewPage] full parseResult:', JSON.stringify(parseResult, null, 2))
  }, [parseResult])

  const hasData = parseResult !== null

  // ── KPI metrics ────────────────────────────────────────────────────────────
  const metricsRoot = (parseResult as any)?.metrics ?? (parseResult as any)?.data?.metrics ?? {}
  const totalSegments: number | string = metricsRoot?.total_segments ?? '--'
  const txSets: number | string = metricsRoot?.total_claims ?? '--'
  const fileName = (parseResult as any)?.filename ?? file?.name ?? '--'
  const fileSizeBytes = file?.size ?? 0
  const fileSizeLabel = fileSizeBytes > 0
    ? fileSizeBytes < 1024
      ? `${fileSizeBytes} B`
      : fileSizeBytes < 1024 * 1024
        ? `${(fileSizeBytes / 1024).toFixed(1)} KB`
        : `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : '--'

  const PLACEHOLDER_ERRORS = [
    { type: 'error' as const, code: 'InvalidNPI', element: 'NM109', loop: '2010AA', message: 'Billing Provider NPI is missing or invalid format (must be 10 digits).' },
    { type: 'warning' as const, code: 'AmountMismatch', element: 'CLM02', loop: '2300', message: 'Total claim charge amount does not equal sum of service lines (SV102).' },
  ]

  type NormErr = { type: 'error' | 'warning'; code: string; element: string; loop: string; message: string }

  const errorsArr: NormErr[] = (() => {
    if (!parseResult) return PLACEHOLDER_ERRORS;
    const root = parseResult as Record<string, any>;
    const nested = root.data || {};
    const e = root.errors ?? nested.errors ?? [];
    const w = root.warnings ?? nested.warnings ?? [];

    const normE = e.map((err: any) => ({
      type: 'error' as const,
      code: err.code ?? err.error_code ?? err.type ?? 'ValidationError',
      element: err.element ?? err.field ?? err.segment ?? '',
      loop: err.loop ?? err.loop_id ?? err.location ?? '',
      message: err.message ?? err.msg ?? err.description ?? 'Validation error.',
    }));

    const normW = w.map((warn: any) => ({
      type: 'warning' as const,
      code: warn.code ?? warn.error_code ?? warn.type ?? 'Warning',
      element: warn.element ?? warn.field ?? warn.segment ?? '',
      loop: warn.loop ?? warn.loop_id ?? warn.location ?? '',
      message: warn.message ?? warn.msg ?? warn.description ?? 'Validation warning.',
    }));

    return [...normE, ...normW];
  })();

  const errCount = errorsArr.filter(e => e.type === 'error').length
  const warnCount = errorsArr.filter(e => e.type === 'warning').length
  const isValid = hasData && errCount === 0 && warnCount === 0

  const doodleOpacity = isDark ? 0.08 : 0.15

  const handleProceedToWorkspace = () => {
    if (setActiveMainView) {
      setActiveMainView('editor') // Switch workspace mode to explorer panel
    }
    navigate('/workspace')
  }

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
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 24,
        marginBottom: 32,
        animation: 'fadeSlideUp 500ms ease-out 100ms both',
      }}>

        {/* Left Side: Claim Details */}
        <div style={{ flex: isMobile ? 'none' : '1.1', animation: 'fadeSlideUp 500ms ease-out 200ms both' }}>
          <ClaimCard />
        </div>

        {/* Right Side: 2x2 KPI Grid */}
        <div style={{
          flex: isMobile ? 'none' : '1.3',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 6, // Minimal distance between tiles
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

      </div>

      {/* Proceed Button below the grid and cards */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'fadeSlideUp 600ms ease-out 400ms both'
      }}>
        <motion.button
          onClick={handleProceedToWorkspace}
          whileHover={{ scale: 1.02, rotate: 0.5, y: -2, boxShadow: `5px 5px 0px ${t.ink}` }}
          whileTap={{ scale: 0.98, rotate: 0, y: 0, boxShadow: `2px 2px 0px ${t.ink}` }}
          style={{
            background: t.teal,
            color: t.ink,
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 800,
            fontSize: 16,
            padding: '14px 32px',
            border: `2.5px solid ${t.ink}`,
            borderRadius: 8,
            boxShadow: `3px 3px 0px ${t.ink}`,
            cursor: 'pointer',
            transform: 'rotate(-0.5deg)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <span style={{ fontSize: '18px' }}>🚀</span> Proceed to Workspace
        </motion.button>
      </div>

      {!session && <GuestUpsellCard />}
    </div>
  )
}