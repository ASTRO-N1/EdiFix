import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'
import { useTheme } from '../../theme/ThemeContext'
import { useIsMobile } from '../../hooks/useWindowWidth'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/overview': 'Overview',
  '/dashboard/segments': 'Segment Explorer',
  '/dashboard/validation': 'Validation Report',
  '/dashboard/loops': 'Loop Structure',
  '/dashboard/export': 'Export & Reports',
  '/dashboard/ai': 'AI Assistant',
}

export default function TopBar({ onMenuClick, menuOpen }: { onMenuClick?: () => void; menuOpen?: boolean }) {
  const location = useLocation()
  const { parseResult, transactionType } = useAppStore()
  const { t } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  const title = PAGE_TITLES[location.pathname] ?? 'Overview'
  const data = parseResult?.data as Record<string, unknown> | undefined
  const metadata = data?.metadata as Record<string, unknown> | undefined
  const validation = data?.validation as Record<string, unknown> | undefined

  const errorCount = (validation?.error_count as number) ?? 0
  const warnCount = (validation?.warning_count as number) ?? 0
  const isValid = errorCount === 0 && warnCount === 0 && validation !== undefined
    ? (validation?.is_valid as boolean ?? true)
    : parseResult === null ? null : errorCount === 0 && warnCount === 0

  const interchangeDate = metadata?.interchange_date as string | undefined
  const txType = (metadata?.transaction_type as string)
    ?? transactionType
    ?? (data?.file_info as Record<string, unknown> | undefined)?.transaction_type as string
    ?? null

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Removed borderRef use per UI fix 2

  return (
    <div
      ref={containerRef}
      style={{
        height: 64,
        background: t.bg,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s ease',
      }}
    >

      {/* Left side: mobile menu icon or page title */}
      {isMobile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onMenuClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
              {menuOpen ? (
                <>
                  <line x1="2" y1="2" x2="22" y2="18" strokeWidth="2.5" strokeLinecap="round" stroke={t.ink} />
                  <line x1="22" y1="2" x2="2" y2="18" strokeWidth="2.5" strokeLinecap="round" stroke={t.ink} />
                </>
              ) : (
                <>
                  <line x1="1" y1="3"  x2="23" y2="2.5"  strokeWidth="2.5" strokeLinecap="round" stroke={t.ink} />
                  <line x1="2" y1="10" x2="22" y2="10.5" strokeWidth="2.5" strokeLinecap="round" stroke={t.ink} />
                  <line x1="3" y1="17" x2="23" y2="16.5" strokeWidth="2.5" strokeLinecap="round" stroke={t.ink} />
                </>
              )}
            </svg>
          </button>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, color: t.ink }}>EdiFix</span>
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 22, color: t.ink, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: 11, color: t.inkFaint, marginTop: 1 }}>EdiFix / {title}</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {parseResult !== null && (
          <span style={{
            background: isValid ? (t.mint) : t.coral,
            border: `2px solid ${t.ink}`,
            borderRadius: 999,
            padding: '6px 14px',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 12,
            color: isValid ? t.ink : 'white',
            boxShadow: `2px 2px 0px ${t.shadow}`,
            whiteSpace: 'nowrap',
          }}>
            {isValid ? '✓ Valid EDI' : '✗ Has Errors'}
          </span>
        )}
        {txType && (
          <span style={{
            background: t.ink,
            color: t.yellow,
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}>
            {txType}
          </span>
        )}
        <span style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: t.inkFaint,
          whiteSpace: 'nowrap',
        }}>
          {interchangeDate ?? today}
        </span>
      </div>
    </div>
  )
}
