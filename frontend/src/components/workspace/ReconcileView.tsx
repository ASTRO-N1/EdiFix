/**
 * ReconcileView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-page 835-to-837 Financial Reconciliation view.
 *
 * STATE 1 — Upload:
 *   Two large side-by-side dropzones (837 left, 835 right).
 *   "Run Reconciliation" button activates once both files parse successfully.
 *
 * STATE 2 — Results:
 *   Three-tier audit dashboard rendered inline on the same page:
 *   A) Verdict box  B) KPI summary cards  C) Sortable line-item grid
 *
 * Layout: fills 100% of the content area, no tabs shown.
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import useAppStore from '../../store/useAppStore'

// ── Constants ───────────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') as string
const BYPASS = { 'X-Internal-Bypass': 'frontend-ui-secret' } as const

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '$0.00'
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

async function uploadAndParse(
  file: File,
  endpoint: string,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: BYPASS,
      body: form,
    })
    const json = await res.json()
    if (!res.ok || json.status === 'error') {
      return { ok: false, error: json.message || json.detail || 'Parse failed' }
    }
    return { ok: true, data: json }
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type ParseStatus = 'idle' | 'loading' | 'ok' | 'error'

interface Adjustment {
  group_code: string
  reason_code: string
  amount: number
  description: string
}

interface LineItem {
  procedure_code: string
  qualifier: string
  description: string
  billed: number
  allowed: number
  paid: number
  difference: number
  adjustments: Adjustment[]
  adjustments_by_group: Record<string, number>
  integrity_ok: boolean
  pr_amount: number
  co_amount: number
  oa_pi_amount: number
}

interface ClaimSummary {
  total_billed: number
  total_paid: number
  total_patient_responsibility: number
  total_contractual_adjustment: number
  total_oa_pi: number
  total_adjustments: number
  difference: number
  integrity_check_passed: boolean
  claim_level_adjustments: Adjustment[]
  clp_patient_responsibility: number
}

interface Verdict {
  status: string
  label: string
  color: 'green' | 'yellow' | 'red'
  summary: string
}

interface ReconciliationReport {
  matched: boolean
  pcn: string
  line_items: LineItem[]
  claim_summary: ClaimSummary
  verdict: Verdict
  error?: string
}

// ── Sub-components ──────────────────────────────────────────────────────────

function GroupBadge({ group }: { group: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    CO: { bg: 'rgba(78,205,196,0.15)',  text: '#1A9B93' },
    PR: { bg: 'rgba(255,230,109,0.3)',  text: '#8A6F00' },
    OA: { bg: 'rgba(255,107,107,0.15)', text: '#C0392B' },
    PI: { bg: 'rgba(255,107,107,0.15)', text: '#C0392B' },
  }
  const s = map[group] ?? { bg: 'rgba(26,26,46,0.08)', text: 'rgba(26,26,46,0.5)' }
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 4,
      background: s.bg, color: s.text, letterSpacing: '0.04em',
    }}>
      {group}
    </span>
  )
}

// ── Dropzone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  step: number
  label: string
  description: string
  icon: string
  accent: string
  status: ParseStatus
  fileName?: string
  errorMsg?: string
  disabled?: boolean
  onFile: (f: File) => void
}

function BigDropZone({ step, label, description, icon, accent, status, fileName, errorMsg, disabled, onFile }: DropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted[0] && onFile(accepted[0]),
    accept: {
      'text/plain': ['.edi', '.txt', '.dat', '.x12'],
      'application/octet-stream': ['.edi', '.dat', '.x12'],
    },
    multiple: false,
    disabled: disabled || status === 'loading',
  })

  const borderColor =
    status === 'ok'    ? accent :
    status === 'error' ? '#FF6B6B' :
    isDragActive       ? accent :
    'rgba(26,26,46,0.18)'

  const bgColor =
    status === 'ok'    ? `${accent}12` :
    status === 'error' ? 'rgba(255,107,107,0.06)' :
    isDragActive       ? `${accent}0e` :
    '#FFFFFF'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: accent, color: '#1A1A2E',
          fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #1A1A2E', flexShrink: 0,
        }}>
          {step}
        </div>
        <div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#1A1A2E' }}>
            {label}
          </div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>
            {description}
          </div>
        </div>
      </div>

      {/* Drop target */}
      <div
        {...getRootProps()}
        style={{
          flex: 1, minHeight: 260,
          border: `2.5px dashed ${borderColor}`,
          borderRadius: 16,
          background: bgColor,
          boxShadow: status === 'ok' ? `4px 4px 0 ${accent}50` : '3px 3px 0 rgba(26,26,46,0.07)',
          cursor: (disabled || status === 'loading') ? 'not-allowed' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 14, padding: 28,
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <input {...getInputProps()} />

        {status === 'loading' && (
          <>
            <div className="doodle-spinner" style={{ width: 40, height: 40 }} />
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: 'rgba(26,26,46,0.5)' }}>
              Parsing…
            </p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: 40 }}>{icon}</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 }}>
                {fileName}
              </p>
              <span style={{
                fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11,
                background: accent, color: '#1A1A2E',
                padding: '4px 14px', borderRadius: 20,
                border: '1.5px solid #1A1A2E',
              }}>
                ✓ Parsed Successfully
              </span>
            </div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.35)', fontStyle: 'italic', textAlign: 'center' }}>
              Drop a new file to replace
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#C0392B', marginBottom: 4 }}>
                Parse Failed
              </p>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.55)', maxWidth: 260 }}>
                {errorMsg}
              </p>
            </div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.35)', fontStyle: 'italic' }}>
              Drop a new file to retry
            </p>
          </>
        )}

        {status === 'idle' && (
          <>
            <div style={{ fontSize: 44, filter: isDragActive ? 'none' : 'grayscale(0.3)', transition: 'filter 0.2s' }}>
              {icon}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15, color: '#1A1A2E', marginBottom: 4 }}>
                {isDragActive ? 'Drop it here! 🎉' : 'Drag & drop your file'}
              </p>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.45)' }}>
                or click to browse
              </p>
            </div>
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(26,26,46,0.05)',
              border: '1px solid rgba(26,26,46,0.1)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(26,26,46,0.45)',
            }}>
              .edi · .txt · .dat · .x12
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Upload View ───────────────────────────────────────────────────────────────

function UploadView({ onResult }: { onResult: (report: ReconciliationReport) => void }) {
  const [status837, setStatus837] = useState<ParseStatus>('idle')
  const [parsed837, setParsed837] = useState<any>(null)
  const [name837, setName837] = useState('')
  const [err837, setErr837] = useState('')

  const [status835, setStatus835] = useState<ParseStatus>('idle')
  const [parsed835, setParsed835] = useState<any>(null)
  const [name835, setName835] = useState('')
  const [err835, setErr835] = useState('')

  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState('')

  const canRun = status837 === 'ok' && status835 === 'ok' && !isRunning

  const handle837 = useCallback(async (file: File) => {
    setStatus837('loading')
    setErr837('')
    setParsed837(null)
    setName837(file.name)
    const r = await uploadAndParse(file, '/api/v1/parse')
    if (r.ok) { setParsed837(r.data); setStatus837('ok') }
    else       { setErr837(r.error!); setStatus837('error') }
  }, [])

  const handle835 = useCallback(async (file: File) => {
    setStatus835('loading')
    setErr835('')
    setParsed835(null)
    setName835(file.name)
    const r = await uploadAndParse(file, '/api/v1/parse-835')
    if (r.ok) { setParsed835(r.data); setStatus835('ok') }
    else       { setErr835(r.error!); setStatus835('error') }
  }, [])

  const run = async () => {
    if (!parsed837 || !parsed835) return
    setIsRunning(true)
    setRunError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/reconcile`, {
        method: 'POST',
        headers: { ...BYPASS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed_837: parsed837, parsed_835: parsed835 }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        setRunError(json.message || json.detail || 'Reconciliation failed')
        return
      }
      onResult(json.report as ReconciliationReport)
    } catch (e: any) {
      setRunError(e.message || 'Network error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#FDFAF4',
    }} className="custom-scrollbar">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{
        padding: '32px 48px 24px',
        borderBottom: '2px solid rgba(26,26,46,0.07)',
        background: '#FDFAF4',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: '#FFE66D', border: '2.5px solid #1A1A2E',
            boxShadow: '3px 3px 0 rgba(26,26,46,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>
            ⚖️
          </div>
          <div>
            <h1 style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22,
              color: '#1A1A2E', margin: 0, marginBottom: 4,
            }}>
              835 Reconciliation Engine
            </h1>
            <p style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 13,
              color: 'rgba(26,26,46,0.5)', margin: 0,
            }}>
              Cross-reference an 837 Claim against an 835 Remittance — compare billed vs. paid at the procedure level.
            </p>
          </div>
        </div>

        {/* Progress pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
          {[
            { n: 1, label: '837 Claim',      status: status837, accent: '#4ECDC4' },
            { n: 2, label: '835 Remittance', status: status835, accent: '#FFE66D' },
            { n: 3, label: 'Reconcile',      status: canRun ? 'ready' : 'pending', accent: '#1A1A2E' },
          ].map((step, i) => {
            const done = step.status === 'ok' || step.status === 'ready'
            const active = step.status === 'loading'
            const bad = step.status === 'error'
            const color = bad ? '#FF6B6B' : done ? step.accent : 'rgba(26,26,46,0.25)'
            return (
              <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '5px 14px', borderRadius: 20,
                  background: bad ? 'rgba(255,107,107,0.1)' : done ? `${step.accent}20` : 'rgba(26,26,46,0.05)',
                  border: `1.5px solid ${color}`,
                  fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
                  color: bad ? '#C0392B' : done ? '#1A1A2E' : 'rgba(26,26,46,0.4)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                }}>
                  {active && <span style={{ animation: 'spin 1s linear infinite', fontSize: 10 }}>⟳</span>}
                  {done && !active && <span>✓</span>}
                  {bad && <span>✕</span>}
                  Step {step.n}: {step.label}
                </div>
                {i < 2 && (
                  <div style={{ width: 20, height: 1.5, background: 'rgba(26,26,46,0.15)', borderRadius: 2 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Dropzones ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        padding: '32px 48px',
        display: 'flex',
        gap: 28,
        minHeight: 0,
      }}>
        <BigDropZone
          step={1}
          label="Upload 837 Claim File"
          description="The original claim submitted by the provider"
          icon="🧾"
          accent="#4ECDC4"
          status={status837}
          fileName={name837}
          errorMsg={err837}
          onFile={handle837}
        />

        {/* Center divider */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, flexShrink: 0, paddingTop: 44,
        }}>
          <div style={{ width: 1.5, flex: 1, background: 'rgba(26,26,46,0.1)' }} />
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#FDFAF4', border: '2px solid rgba(26,26,46,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11,
            color: 'rgba(26,26,46,0.3)',
          }}>
            VS
          </div>
          <div style={{ width: 1.5, flex: 1, background: 'rgba(26,26,46,0.1)' }} />
        </div>

        <BigDropZone
          step={2}
          label="Upload 835 Remittance File"
          description="Payment advice from the insurer"
          icon="💳"
          accent="#FFE66D"
          status={status835}
          fileName={name835}
          errorMsg={err835}
          onFile={handle835}
        />
      </div>

      {/* ── Run button ───────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 48px 36px',
        borderTop: '2px solid rgba(26,26,46,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, flexShrink: 0,
      }}>
        <div>
          {runError ? (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(255,107,107,0.08)',
              border: '1.5px solid rgba(255,107,107,0.35)',
              borderRadius: 8,
              fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B',
              maxWidth: 480,
            }}>
              <strong>Error:</strong> {runError}
            </div>
          ) : (
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic', margin: 0 }}>
              {canRun
                ? 'Both files are ready — click Run Reconciliation to generate the audit report.'
                : 'Upload both the 837 Claim and 835 Remittance files to enable reconciliation.'}
            </p>
          )}
        </div>

        <button
          id="run-reconciliation-btn"
          onClick={run}
          disabled={!canRun}
          style={{
            background: canRun ? '#FFE66D' : 'rgba(26,26,46,0.07)',
            color: canRun ? '#1A1A2E' : 'rgba(26,26,46,0.3)',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15,
            border: canRun ? '2.5px solid #1A1A2E' : '2.5px solid rgba(26,26,46,0.12)',
            borderRadius: 12,
            padding: '12px 32px',
            cursor: canRun ? 'pointer' : 'not-allowed',
            boxShadow: canRun ? '4px 4px 0 rgba(26,26,46,0.2)' : 'none',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}
          onMouseDown={(e) => { if (canRun) { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '2px 2px 0 rgba(26,26,46,0.2)' } }}
          onMouseUp={(e) => { if (canRun) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '4px 4px 0 rgba(26,26,46,0.2)' } }}
          onMouseEnter={(e) => { if (canRun) e.currentTarget.style.background = '#FFD93D' }}
          onMouseLeave={(e) => { if (canRun) e.currentTarget.style.background = '#FFE66D' }}
        >
          {isRunning
            ? <><div className="doodle-spinner" style={{ width: 18, height: 18 }} /> Running…</>
            : <>⚖️ Run Reconciliation</>}
        </button>
      </div>
    </div>
  )
}

// ── Results View ──────────────────────────────────────────────────────────────

function ResultView({
  report,
  onReset,
}: {
  report: ReconciliationReport
  onReset: () => void
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof LineItem>('procedure_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  if (!report.matched) {
    return (
      <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{
          maxWidth: 560, width: '100%',
          padding: '28px 32px',
          background: 'rgba(255,107,107,0.07)',
          border: '2.5px solid rgba(255,107,107,0.4)',
          borderRadius: 16, boxShadow: '4px 4px 0 rgba(255,107,107,0.15)',
        }}>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18, color: '#C0392B', marginBottom: 10 }}>
            🚨 No Matching Claims Found
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6 }}>
            {report.error || 'The Patient Control Numbers (CLM01 / CLP01) do not match across the two files. Please verify you have uploaded the correct pair.'}
          </p>
          <button
            onClick={onReset}
            style={{
              marginTop: 20,
              background: '#FF6B6B', color: '#FFFFFF',
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13,
              border: '2.5px solid #1A1A2E', borderRadius: 10,
              padding: '10px 20px', cursor: 'pointer',
              boxShadow: '3px 3px 0 rgba(26,26,46,0.2)',
            }}
          >
            ← Try Different Files
          </button>
        </div>
      </div>
    )
  }

  const { line_items, claim_summary, verdict, pcn } = report

  // ── Verdict palette ─────────────────────────────────────────────────────
  const vp = {
    green:  { bg: 'rgba(46,204,113,0.08)', border: 'rgba(46,204,113,0.45)', accent: '#27AE60', badge: 'rgba(46,204,113,0.15)', badgeText: '#1E8449',  icon: '✅' },
    yellow: { bg: 'rgba(255,230,109,0.1)',  border: 'rgba(200,160,0,0.35)',  accent: '#8A6F00', badge: 'rgba(255,230,109,0.3)', badgeText: '#6B5300',   icon: '⚖️' },
    red:    { bg: 'rgba(255,107,107,0.07)', border: 'rgba(255,107,107,0.4)', accent: '#C0392B', badge: 'rgba(255,107,107,0.15)', badgeText: '#922B21', icon: '🚨' },
  }[verdict.color] ?? { bg: '', border: '', accent: '#1A1A2E', badge: '', badgeText: '', icon: '📋' }

  // ── Sort line items ──────────────────────────────────────────────────────
  const sorted = [...line_items].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    const dir = sortDir === 'asc' ? 1 : -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  const onSort = (col: keyof LineItem) => {
    if (col === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  const THStyle: React.CSSProperties = {
    padding: '11px 16px',
    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
    color: '#4ECDC4', background: '#1A1A2E',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', textAlign: 'left',
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#FDFAF4',
    }} className="custom-scrollbar">

      {/* ── Result header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '28px 48px 20px',
        borderBottom: '2px solid rgba(26,26,46,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: '#FFE66D', border: '2.5px solid #1A1A2E',
            boxShadow: '3px 3px 0 rgba(26,26,46,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>
            ⚖️
          </div>
          <div>
            <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, color: '#1A1A2E', margin: 0, marginBottom: 4 }}>
              Financial Audit Report
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.45)' }}>
                Patient Control Number:
              </span>
              <code style={{
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12,
                background: 'rgba(78,205,196,0.12)', color: '#1A1A2E',
                padding: '2px 9px', borderRadius: 5, border: '1px solid rgba(78,205,196,0.25)',
              }}>
                {pcn}
              </code>
            </div>
          </div>
        </div>
        <button
          onClick={onReset}
          style={{
            background: 'transparent', color: 'rgba(26,26,46,0.5)',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
            border: '1.5px solid rgba(26,26,46,0.18)', borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFE66D'; e.currentTarget.style.color = '#1A1A2E' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,26,46,0.18)'; e.currentTarget.style.color = 'rgba(26,26,46,0.5)' }}
        >
          ↺ New Reconciliation
        </button>
      </div>

      <div style={{ flex: 1, padding: '32px 48px', display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* ── SECTION A: Verdict ───────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 18, background: '#FFE66D', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#1A1A2E', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Outcome Summary
            </h2>
          </div>
          <div style={{
            background: vp.bg, border: `2px solid ${vp.border}`,
            borderRadius: 14, padding: '22px 26px',
            boxShadow: `4px 4px 0 ${vp.border}`,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{vp.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: vp.badge, color: vp.badgeText,
                  fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12,
                  padding: '4px 14px', borderRadius: 20, marginBottom: 8,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                }}>
                  {verdict.label}
                </div>
                <p style={{
                  fontFamily: 'Nunito, sans-serif', fontSize: 14, color: vp.accent,
                  lineHeight: 1.65, margin: 0,
                }}>
                  {verdict.summary}
                </p>
              </div>
            </div>
            <div style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 11,
              color: 'rgba(26,26,46,0.38)', fontStyle: 'italic',
              borderTop: `1px solid ${vp.border}`, paddingTop: 10,
            }}>
              This audit is automatically generated from X12 EDI data. Consult your billing team before taking financial action.
            </div>
          </div>
        </section>

        {/* ── SECTION B: KPI Cards ─────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 18, background: '#4ECDC4', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#1A1A2E', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Claim-Level Summary
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Billed',             value: fmt(claim_summary.total_billed),                  accent: '#1A1A2E', icon: '🧾', sub: '837 CLM / SV1' },
              { label: 'Total Paid',                value: fmt(claim_summary.total_paid),                   accent: '#4ECDC4', icon: '💳', sub: '835 CLP04' },
              { label: 'Patient Responsibility',    value: fmt(claim_summary.total_patient_responsibility),  accent: '#B89000', icon: '👤', sub: 'PR group adjustments' },
              { label: 'Contractual Write-Off',     value: fmt(claim_summary.total_contractual_adjustment),  accent: 'rgba(26,26,46,0.5)', icon: '✍️', sub: 'CO group adjustments' },
              ...(claim_summary.total_oa_pi > 0
                ? [{ label: 'Flagged (OA/PI)', value: fmt(claim_summary.total_oa_pi), accent: '#FF6B6B', icon: '⚠️', sub: 'Review required' }]
                : []),
            ].map((card) => (
              <div
                key={card.label}
                className="kpi-card"
                style={{
                  flex: '1 1 160px', minWidth: 150,
                  background: '#FFFFFF', border: '2.5px solid #1A1A2E',
                  borderRadius: 12, boxShadow: '4px 4px 0 rgba(26,26,46,0.1)',
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {card.label}
                  </span>
                  <span style={{ fontSize: 17 }}>{card.icon}</span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 22, color: card.accent }}>
                  {card.value}
                </div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 10, color: 'rgba(26,26,46,0.38)', fontStyle: 'italic' }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Integrity check warning */}
          {!claim_summary.integrity_check_passed && (
            <div style={{
              marginTop: 14,
              padding: '10px 16px',
              background: 'rgba(255,107,107,0.07)',
              border: '1.5px solid rgba(255,107,107,0.3)',
              borderRadius: 8,
              fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B',
            }}>
              ⚠️ <strong>Integrity check failed:</strong> The sum of adjustments doesn't equal the billed-minus-paid difference. A CAS segment may be missing or malformed.
            </div>
          )}

          {/* Claim-level adjustments */}
          {claim_summary.claim_level_adjustments.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10, color: 'rgba(26,26,46,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                Claim-Level Adjustments (CLP)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {claim_summary.claim_level_adjustments.map((adj, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', background: '#FFFFFF',
                    borderRadius: 8, border: '1.5px solid rgba(26,26,46,0.08)',
                    boxShadow: '2px 2px 0 rgba(26,26,46,0.04)',
                  }}>
                    <GroupBadge group={adj.group_code} />
                    <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>
                      CARC-{adj.reason_code}
                    </code>
                    <span style={{ flex: 1, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.65)' }}>
                      {adj.description}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>
                      {fmt(adj.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── SECTION C: Line-Item Grid ────────────────────────────────── */}
        <section style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, background: '#1A1A2E', borderRadius: 2 }} />
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#1A1A2E', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Procedure-Level Detail
              </h2>
            </div>
            {line_items.length > 0 && (
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.38)', fontStyle: 'italic' }}>
                Click a row to expand CARC adjustment details
              </span>
            )}
          </div>

          {line_items.length === 0 ? (
            <div style={{
              padding: '36px', textAlign: 'center',
              background: '#FFFFFF', border: '2px solid rgba(26,26,46,0.08)',
              borderRadius: 12, boxShadow: '3px 3px 0 rgba(26,26,46,0.05)',
            }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic' }}>
                No procedure-level SVC lines found in this 835. The claim was likely adjudicated at the header level only.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '2.5px solid #1A1A2E', boxShadow: '5px 5px 0 rgba(26,26,46,0.1)' }} className="custom-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Procedure', col: 'procedure_code' as keyof LineItem },
                      { label: 'Description', col: undefined },
                      { label: 'Billed',  col: 'billed'  as keyof LineItem },
                      { label: 'Allowed', col: 'allowed' as keyof LineItem },
                      { label: 'Paid',    col: 'paid'    as keyof LineItem },
                      { label: 'Adjustments (PR / CO / OA)', col: undefined },
                    ].map(({ label, col }) => (
                      <th
                        key={label}
                        onClick={() => col && onSort(col)}
                        style={{
                          ...THStyle,
                          cursor: col ? 'pointer' : 'default',
                        }}
                      >
                        {label}{col && sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item, idx) => {
                    const key = `${item.procedure_code}-${idx}`
                    const isExp = expandedRow === key
                    const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#FDFAF4'
                    return (
                      <>
                        <tr
                          key={key}
                          style={{
                            background: rowBg,
                            borderTop: idx > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none',
                            cursor: item.adjustments.length > 0 ? 'pointer' : 'default',
                          }}
                          onClick={() => item.adjustments.length > 0 && setExpandedRow(isExp ? null : key)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(78,205,196,0.05)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = rowBg }}
                        >
                          {/* Code */}
                          <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              {item.adjustments.length > 0 && (
                                <span style={{ fontSize: 8, color: 'rgba(26,26,46,0.3)', display: 'inline-block', transition: 'transform 0.15s', transform: isExp ? 'rotate(90deg)' : 'none' }}>▶</span>
                              )}
                              <code style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                                background: 'rgba(78,205,196,0.1)', color: '#1A1A2E',
                                padding: '2px 8px', borderRadius: 4,
                              }}>
                                {item.qualifier ? `${item.qualifier}:` : ''}{item.procedure_code}
                              </code>
                            </div>
                          </td>
                          {/* Description */}
                          <td style={{ padding: '13px 16px', fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.65)', maxWidth: 280 }}>
                            {item.description}
                          </td>
                          {/* Billed */}
                          <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>
                            {fmt(item.billed)}
                          </td>
                          {/* Allowed */}
                          <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'rgba(26,26,46,0.55)', whiteSpace: 'nowrap' }}>
                            {fmt(item.allowed)}
                          </td>
                          {/* Paid */}
                          <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800,
                              color: item.paid === 0 ? '#FF6B6B' : item.paid >= item.billed ? '#27AE60' : '#4ECDC4',
                            }}>
                              {fmt(item.paid)}
                            </span>
                          </td>
                          {/* Adjustments */}
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {Object.entries(item.adjustments_by_group).map(([g, amt]) => (
                                <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <GroupBadge group={g} />
                                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(26,26,46,0.55)' }}>
                                    {fmt(amt)}
                                  </span>
                                </span>
                              ))}
                              {item.adjustments.length === 0 && (
                                <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.28)', fontStyle: 'italic' }}>—</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded CARC detail rows */}
                        {isExp && item.adjustments.map((adj, ai) => (
                          <tr key={`${key}-${ai}`} style={{ background: '#F5F2EC', borderTop: '1px solid rgba(26,26,46,0.04)' }}>
                            <td colSpan={2} style={{ padding: '8px 16px 8px 48px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ color: 'rgba(26,26,46,0.3)', fontSize: 11 }}>↳</span>
                                <GroupBadge group={adj.group_code} />
                                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(26,26,46,0.5)' }}>CARC-{adj.reason_code}</code>
                              </div>
                            </td>
                            <td colSpan={3} style={{ padding: '8px 16px', fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.58)', fontStyle: 'italic' }}>
                              {adj.description}
                            </td>
                            <td style={{ padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: 'rgba(26,26,46,0.7)', textAlign: 'right' }}>
                              {fmt(adj.amount)}
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Root Component ────────────────────────────────────────────────────────────

export default function ReconcileView() {
  const [report, setReport] = useState<ReconciliationReport | null>(
    // Re-hydrate from store if we navigated away and came back
    useAppStore.getState().reconciliationResult as ReconciliationReport | null
  )
  const setReconciliationResult = useAppStore((s) => s.setReconciliationResult)

  const handleResult = (r: ReconciliationReport) => {
    setReport(r)
    setReconciliationResult(r as any)
  }

  const handleReset = () => {
    setReport(null)
    setReconciliationResult(null)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {report
        ? <ResultView report={report} onReset={handleReset} />
        : <UploadView onResult={handleResult} />}
    </div>
  )
}
