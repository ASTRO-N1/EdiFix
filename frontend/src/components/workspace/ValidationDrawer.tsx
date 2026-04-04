import useAppStore from '../../store/useAppStore'
import { useState, useRef } from 'react'

// ── Error → EDI path + form field mapping ─────────────────────────────────────
interface NormalisedError {
  id: number | string
  type: 'error' | 'warning'
  code: string
  element: string
  loop: string
  msg: string
}

function resolveTreePath(err: NormalisedError): string {
  const el = (err.element ?? '').toUpperCase()
  const loop = (err.loop ?? '').toUpperCase()

  if (loop.includes('2010AA') || (loop.includes('2000A') && el.includes('NM1'))) return 'loop_2010AA.NM1'
  if (loop.includes('2010BA') || loop.includes('2000B') && el === 'NM109') return 'loop_2010BA.NM1'
  if (loop.includes('1000A')) return 'loop_1000A.NM1'
  if (loop.includes('1000B')) return 'loop_1000B.NM1'
  if (loop.includes('2300') && (el === 'CLM02' || err.code.toLowerCase().includes('amount'))) return 'loop_2300.CLM'
  if (loop.includes('2300') && el.startsWith('HI')) return 'loop_2300.HI'
  if (loop.includes('2300') && el.startsWith('DTP')) return 'loop_2300.DTP'
  if (loop.includes('2300')) return 'loop_2300'
  if (loop.includes('2400') && el.startsWith('SV')) return 'loop_2400[0].SV1'
  if (loop.includes('2400')) return 'loop_2400[0]'

  if (el.startsWith('NM1') && el === 'NM109') return 'loop_2010AA.NM1'
  if (el === 'CLM02') return 'loop_2300.CLM'
  return 'loop_2300'
}

function resolveFormField(err: NormalisedError): string {
  const el = (err.element ?? '').toUpperCase()
  const loop = (err.loop ?? '').toUpperCase()
  const code = (err.code ?? '').toLowerCase()

  if (code.includes('npi') || (el === 'NM109' && (loop.includes('2010AA') || loop.includes('2000A')))) return 'billing-npi'
  if (el === 'NM109' && (loop.includes('2010BA') || loop.includes('2000B'))) return 'sub-member-id'
  if (el === 'NM103' && loop.includes('1000A')) return 'submitter-name'
  if (el === 'NM103' && loop.includes('1000B')) return 'receiver-name'
  if (el === 'CLM02' || code.includes('amount')) return 'clm-amount'
  if (el === 'CLM01') return 'clm-id'
  if (el.startsWith('HI')) return 'dx-code-1'
  if (el === 'SV101') return 'svc-0-proc'
  if (el === 'SV102') return 'svc-0-amount'
  if (el === 'DTP03' && loop.includes('2300')) return 'clm-service-date'
  if (el === 'DTP03' && loop.includes('2400')) return 'svc-0-date'
  if (el === 'N301') return 'billing-address'
  if (el === 'N401') return 'billing-city'
  if (el === 'N402') return 'billing-state'
  if (el === 'N403') return 'billing-zip'
  if (el === 'DMG02') return 'sub-dob'
  if (el === 'DMG03') return 'sub-gender'
  return 'clm-id'
}

function normaliseErrors(raw: unknown[]): NormalisedError[] {
  return raw.map((e: any, i) => ({
    id: e.id ?? i,
    type: (e.type === 'warning' || e.type === 'SituationalWarning') ? 'warning' : 'error',
    code: e.code ?? e.error_code ?? e.type ?? 'ValidationError',
    element: e.element ?? e.field ?? e.segment ?? '',
    loop: e.loop ?? e.loop_id ?? e.location ?? '',
    msg: e.message ?? e.msg ?? e.description ?? 'Validation error.',
  }))
}

const PLACEHOLDER_ERRORS: NormalisedError[] = [
  { id: 1, type: 'error', code: 'InvalidNPI', element: 'NM109', loop: '2010AA', msg: 'Billing Provider NPI is missing or invalid format (must be 10 digits).' },
  { id: 2, type: 'warning', code: 'AmountMismatch', element: 'CLM02', loop: '2300', msg: 'Total claim charge amount does not equal sum of service lines (SV102).' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ValidationDrawer() {
  const parseResult = useAppStore((s) => s.parseResult)
  const ediFile = useAppStore((s) => s.ediFile)
  const setSelectedPath = useAppStore((s) => s.setSelectedPath)
  const setFocusFieldId = useAppStore((s) => s.setFocusFieldId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const [isMinimized, setIsMinimized] = useState(false)
  // Height of the drawer when it is NOT minimized — the user can drag this
  const [expandedHeight, setExpandedHeight] = useState(220)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(220)

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) return
    dragStartY.current = e.clientY
    dragStartHeight.current = expandedHeight
    setIsDragging(true)
    e.preventDefault()

    const onMouseMove = (ev: MouseEvent) => {
      // Moving the mouse UP (negative delta) increases the drawer height
      const delta = dragStartY.current - ev.clientY
      const newHeight = Math.max(80, Math.min(600, dragStartHeight.current + delta))
      setExpandedHeight(newHeight)
    }
    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const hasFile = !!(parseResult || ediFile.fileName)

  const errors: NormalisedError[] = (() => {
    if (!parseResult) return PLACEHOLDER_ERRORS
    const root = parseResult as Record<string, any>
    const nested = root.data || {}

    const e = root.validation_errors ?? root.errors ?? nested.validation_errors ?? nested.errors ?? []
    const w = root.warnings ?? nested.warnings ?? []
    const raw = [...(e as any[]), ...(w as any[])]

    return normaliseErrors(raw)
  })()

  const errorCount = errors.filter((e) => e.type === 'error').length
  const warningCount = errors.filter((e) => e.type === 'warning').length

  const handleErrorClick = (err: NormalisedError) => {
    const treePath = resolveTreePath(err)
    const fieldId = resolveFormField(err)
    setSelectedPath(treePath)
    setFocusFieldId(fieldId)
    setActiveTabId('form')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#FDFAF4',
        overflow: 'hidden',
        flexShrink: 0,
        // Height drives both minimize animation and user-drag; suppress transition during drag
        height: isMinimized ? 44 : expandedHeight,
        transition: isDragging ? 'none' : 'height 0.3s ease-in-out',
      }}
    >
      {/* ── Drag-resize handle (top edge of the drawer) ────────────── */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          height: 5,
          flexShrink: 0,
          cursor: isMinimized ? 'default' : 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid rgba(26,26,46,0.1)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => {
          if (!isMinimized) e.currentTarget.style.background = 'rgba(78,205,196,0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
        }}
      />
      {/* Drawer Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FF6B6B',
        borderBottom: '2.5px solid #1A1A2E',
        padding: '6px 16px',
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 8, marginTop: -2 }}>
          <path d="M8 1L15 14H1L8 1Z" stroke="#1A1A2E" strokeWidth="2" strokeLinejoin="round" />
          <line x1="8" y1="6" x2="8" y2="10" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="12.5" r="1" fill="#1A1A2E" />
        </svg>
        <span style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 800,
          fontSize: 12,
          color: '#1A1A2E',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Validation Problems
        </span>

        {hasFile && (
          <span style={{
            marginLeft: 10,
            fontFamily: 'Nunito, sans-serif',
            fontSize: 10,
            color: 'rgba(26,26,46,0.55)',
            fontStyle: 'italic',
            fontWeight: 600,
          }}>
            · click any error to navigate
          </span>
        )}

        <div style={{ flex: 1 }} />
        <button
          onClick={() => setIsMinimized(v => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            transition: 'transform 0.3s ease',
            transform: isMinimized ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }} className="custom-scrollbar">
        {!hasFile ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'Nunito, sans-serif',
            fontSize: 12,
            color: 'rgba(26,26,46,0.3)',
            fontStyle: 'italic',
          }}>
            No validation data. Upload a file to see errors.
          </div>
        ) : errors.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'Nunito, sans-serif',
            fontSize: 13,
            color: '#4ECDC4',
            fontWeight: 700,
          }}>
            ✨ No validation errors found! All checks passed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {errors.map((err) => (
              <button
                key={err.id}
                onClick={() => handleErrorClick(err)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '8px 12px',
                  background: '#FFFFFF',
                  border: '1.5px solid rgba(26,26,46,0.1)',
                  borderRadius: 6,
                  boxShadow: '1px 1px 0px rgba(26,26,46,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.1s, box-shadow 0.1s, transform 0.1s',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(78,205,196,0.07)'
                  e.currentTarget.style.boxShadow = '2px 2px 0px rgba(78,205,196,0.3)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF'
                  e.currentTarget.style.boxShadow = '1px 1px 0px rgba(26,26,46,0.05)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>
                  {err.type === 'error' ? '🔴' : '🟡'}
                </span>

                <div style={{ minWidth: 110, flexShrink: 0 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1A1A2E',
                  }}>
                    {err.code}
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: 'rgba(26,26,46,0.45)',
                  }}>
                    {err.loop ? `Loop ${err.loop}` : '—'} · {err.element || '—'}
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 13,
                  color: 'rgba(26,26,46,0.7)',
                  lineHeight: 1.4,
                }}>
                  {err.msg}
                </div>

                <div style={{ flexShrink: 0, opacity: 0.35 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="#1A1A2E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{
        padding: '4px 16px',
        background: '#FFFFFF',
        borderTop: '1px solid rgba(26,26,46,0.1)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: 'rgba(26,26,46,0.5)',
        display: 'flex',
        gap: 16,
      }}>
        {hasFile && (
          <>
            <span>🔴 {errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
            <span>🟡 {warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
    </div>
  )
}