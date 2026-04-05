/**
 * EligibilityScrubberView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Eligibility Scrubber — Multi-834 Roster Builder + Single 837 Claims Validator
 *
 * STATE 1 — Upload:
 *   - Multiple 834 dropzone (builds roster)
 *   - Single 837 dropzone (claims file)
 *   - "Run Eligibility Check" activates when both are ready
 *
 * STATE 2 — Results:
 *   - Summary KPIs
 *   - Filterable claims table with flags (CLEARED | FLAGGED)
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import useAppStore from '../../store/useAppStore'

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') as string
const BYPASS = { 'X-Internal-Bypass': 'frontend-ui-secret' } as const
const INK = '#1A1A2E'
const TEAL = '#4ECDC4'
const YELLOW = '#FFE66D'
const CORAL = '#FF6B6B'
const MINT = '#95E1D3'
const BG = '#FDFAF4'
const WHITE = '#FFFFFF'

// ── Types ────────────────────────────────────────────────────────────────────

type FileStatus = 'idle' | 'loading' | 'ok' | 'error'

interface QueuedFile {
  id: string
  name: string
  size: number
  status: FileStatus
  error?: string
  parsed?: Record<string, unknown>
}

interface ClaimResult {
  claim_id: string
  patient_id: string
  date_of_service: string
  flag: 'CLEARED' | 'MEMBER_NOT_FOUND' | 'FLAGGED_NOT_YET_EFFECTIVE' | 'FLAGGED_TERMINATED' | 'UNKNOWN'
  message: string
  member_effective_date: string | null
  member_termination_date: string | null
  member_name: string
}

interface EligibilityReport {
  status: string
  total_claims: number
  cleared_count: number
  flagged_not_found: number
  flagged_not_yet_effective: number
  flagged_terminated: number
  roster_stats: {
    total_members: number
    active_members: number
    terminated_members: number
    total_additions_processed: number
    total_terminations_processed: number
    total_audits_processed: number
  }
  claims: ClaimResult[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `f${++_uid}`

function fmtBytes(b: number): string {
  return b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
}

async function parseEdiFile(file: File): Promise<{ ok: boolean; data?: any; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`${API_URL}/api/v1/parse`, { method: 'POST', headers: BYPASS, body: form })
    const json = await res.json()
    if (!res.ok || json.status === 'error') return { ok: false, error: json.message || json.detail || 'Parse failed' }
    return { ok: true, data: json }
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' }
  }
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function FlagBadge({ flag }: { flag: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    CLEARED: { bg: 'rgba(46,204,113,0.15)', text: '#1E8449', label: '✓ Cleared' },
    MEMBER_NOT_FOUND: { bg: 'rgba(255,107,107,0.12)', text: '#C0392B', label: '✕ Not Found' },
    FLAGGED_NOT_YET_EFFECTIVE: { bg: 'rgba(255,230,109,0.25)', text: '#8A6F00', label: '⚠ Not Yet Effective' },
    FLAGGED_TERMINATED: { bg: 'rgba(255,107,107,0.15)', text: '#922B21', label: '🚫 Terminated' },
    UNKNOWN: { bg: 'rgba(26,26,46,0.08)', text: 'rgba(26,26,46,0.5)', label: '? Unknown' },
  }
  const s = map[flag] ?? map.UNKNOWN
  return (
    <span style={{
      fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: 800,
      padding: '3px 10px', borderRadius: 12, background: s.bg, color: s.text,
      whiteSpace: 'nowrap', letterSpacing: '0.03em',
    }}>
      {s.label}
    </span>
  )
}

// ── File queue row ────────────────────────────────────────────────────────────

function FileRow({ f, onRemove }: { f: QueuedFile; onRemove: (id: string) => void }) {
  const statusColor =
    f.status === 'ok' ? '#27AE60' :
      f.status === 'error' ? '#C0392B' :
        f.status === 'loading' ? TEAL : 'rgba(26,26,46,0.3)'

  const statusBg =
    f.status === 'ok' ? 'rgba(46,204,113,0.1)' :
      f.status === 'error' ? 'rgba(255,107,107,0.08)' :
        f.status === 'loading' ? 'rgba(78,205,196,0.08)' : 'rgba(26,26,46,0.04)'

  const statusText =
    f.status === 'ok' ? '✓ Parsed' :
      f.status === 'error' ? '✕ Failed' :
        f.status === 'loading' ? '⟳ Parsing…' : 'idle'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: statusBg, border: `1.5px solid ${statusColor}30`, borderRadius: 8, transition: 'all 0.2s' }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>📄</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>{fmtBytes(f.size)}</span>
          {f.error && <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: '#C0392B', fontStyle: 'italic' }}>{f.error}</span>}
        </div>
      </div>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: 800, color: statusColor, whiteSpace: 'nowrap' }}>{statusText}</span>
      {f.status !== 'loading' && (
        <button onClick={() => onRemove(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(26,26,46,0.3)', lineHeight: 1, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = CORAL }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(26,26,46,0.3)' }}>
          ✕
        </button>
      )}
    </div>
  )
}

// ── Upload View ───────────────────────────────────────────────────────────────

function UploadView({ onResult }: { onResult: (r: EligibilityReport) => void }) {
  const [queue834, setQueue834] = useState<QueuedFile[]>([])
  const [file837, setFile837] = useState<QueuedFile | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState('')

  const ready834 = queue834.filter(f => f.status === 'ok')
  const loading834 = queue834.filter(f => f.status === 'loading')
  const canRun = ready834.length > 0 && file837?.status === 'ok' && loading834.length === 0 && !isRunning

  const parseFile = useCallback(async (entry: QueuedFile, raw: File, queue: QueuedFile[], setQueue: React.Dispatch<React.SetStateAction<QueuedFile[]>>) => {
    setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'loading' } : f))
    const r = await parseEdiFile(raw)
    if (r.ok) {
      setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'ok', parsed: r.data } : f))
    } else {
      setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'error', error: r.error } : f))
    }
  }, [])

  const onDrop834 = useCallback((accepted: File[]) => {
    const newEntries: QueuedFile[] = accepted.map(raw => {
      const entry: QueuedFile = { id: uid(), name: raw.name, size: raw.size, status: 'idle' }
      setTimeout(() => parseFile(entry, raw, queue834, setQueue834), 0)
      return entry
    })
    setQueue834(q => [...q, ...newEntries])
  }, [parseFile, queue834])

  const onDrop837 = useCallback((accepted: File[]) => {
    if (!accepted[0]) return
    const raw = accepted[0]
    const entry: QueuedFile = { id: uid(), name: raw.name, size: raw.size, status: 'idle' }
    setFile837(entry)
    parseFile(entry, raw, [entry], (updated) => setFile837(updated[0]))
  }, [parseFile])

  const { getRootProps: get834Props, getInputProps: get834Input, isDragActive: isDrag834 } = useDropzone({
    onDrop: onDrop834,
    accept: { 'text/plain': ['.edi', '.txt', '.dat', '.x12'], 'application/octet-stream': ['.edi', '.dat', '.x12'] },
    multiple: true,
    disabled: isRunning,
  })

  const { getRootProps: get837Props, getInputProps: get837Input, isDragActive: isDrag837 } = useDropzone({
    onDrop: onDrop837,
    accept: { 'text/plain': ['.edi', '.txt', '.dat', '.x12'], 'application/octet-stream': ['.edi', '.dat', '.x12'] },
    multiple: false,
    disabled: isRunning,
  })

  const run = async () => {
    const parsedList834 = ready834.map(f => f.parsed!)
    const parsed837 = file837!.parsed!
    setIsRunning(true); setRunError('')
    try {
      const res = await fetch(`${API_URL}/api/eligibility/scrub`, {
        method: 'POST',
        headers: { ...BYPASS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed_834_files: parsedList834, parsed_837: parsed837 }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        setRunError(json.message || json.detail || 'Eligibility check failed')
        return
      }
      if (!json.report) {
        setRunError('Backend returned success but no report data.')
        return
      }
      onResult(json.report as EligibilityReport)
    } catch (e: any) {
      setRunError(e.message || 'Network error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: BG }} className="custom-scrollbar">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div style={{ padding: '28px 48px 20px', borderBottom: `2px solid rgba(26,26,46,0.07)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: YELLOW, border: `2.5px solid ${INK}`, boxShadow: '3px 3px 0 rgba(26,26,46,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            ✓
          </div>
          <div>
            <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, color: INK, margin: 0, marginBottom: 3 }}>Eligibility Scrubber</h1>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.5)', margin: 0 }}>
              Build a member roster from multiple 834 files, then validate 837 claims against coverage periods.
            </p>
          </div>
        </div>
      </div>

      {/* ── 834 Drop Zone ────────────────────────────────────────────── */}
      <div style={{ padding: '28px 48px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: TEAL, color: INK, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1A1A2E', flexShrink: 0 }}>1</div>
          <div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: INK }}>Upload 834 Enrollment Files</div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>Full audits + change files — roster is built sequentially</div>
          </div>
        </div>
        <div
          {...get834Props()}
          style={{
            borderRadius: 16, padding: queue834.length > 0 ? '24px 28px' : '48px 28px',
            border: `2.5px dashed ${isDrag834 ? TEAL : 'rgba(26,26,46,0.22)'}`,
            background: isDrag834 ? 'rgba(78,205,196,0.05)' : WHITE,
            boxShadow: isDrag834 ? `0 0 0 4px rgba(78,205,196,0.12)` : '3px 3px 0 rgba(26,26,46,0.05)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textAlign: 'center', transition: 'all 0.2s ease',
          }}
        >
          <input {...get834Input()} />
          <div style={{ fontSize: queue834.length > 0 ? 28 : 40, marginBottom: 10 }}>
            {isDrag834 ? '📂' : '📑'}
          </div>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: queue834.length > 0 ? 14 : 16, color: INK, margin: 0, marginBottom: 4 }}>
            {isDrag834 ? 'Release to add 834 files!' : queue834.length > 0 ? 'Drop more 834 files to add' : 'Drag & drop your 834 files here'}
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)', margin: 0 }}>
            {queue834.length === 0 ? 'or click to browse — .edi  ·  .txt  ·  .dat  ·  .x12' : 'or click to browse'}
          </p>
        </div>
      </div>

      {/* ── 834 File Queue ────────────────────────────────────────────── */}
      {queue834.length > 0 && (
        <div style={{ padding: '16px 48px 0' }}>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: 'rgba(26,26,46,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            834 Roster Files ({queue834.length}) — {ready834.length} parsed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue834.map(f => <FileRow key={f.id} f={f} onRemove={(id) => setQueue834(q => q.filter(x => x.id !== id))} />)}
          </div>
        </div>
      )}

      {/* ── 837 Drop Zone ────────────────────────────────────────────── */}
      <div style={{ padding: '28px 48px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: MINT, color: INK, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1A1A2E', flexShrink: 0 }}>2</div>
          <div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: INK }}>Upload 837 Claims File</div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>The claims file to validate against the roster</div>
          </div>
        </div>
        <div
          {...get837Props()}
          style={{
            borderRadius: 16, padding: '48px 28px',
            border: `2.5px dashed ${isDrag837 ? MINT : file837?.status === 'ok' ? MINT : 'rgba(26,26,46,0.22)'}`,
            background: isDrag837 ? 'rgba(149,225,211,0.08)' : file837?.status === 'ok' ? 'rgba(149,225,211,0.12)' : WHITE,
            boxShadow: isDrag837 ? `0 0 0 4px rgba(149,225,211,0.15)` : file837?.status === 'ok' ? `4px 4px 0 ${MINT}50` : '3px 3px 0 rgba(26,26,46,0.05)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textAlign: 'center', transition: 'all 0.2s ease',
          }}
        >
          <input {...get837Input()} />
          {file837?.status === 'loading' && (
            <>
              <div className="doodle-spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: 'rgba(26,26,46,0.5)', marginTop: 12 }}>Parsing…</p>
            </>
          )}
          {file837?.status === 'ok' && (
            <>
              <div style={{ fontSize: 36 }}>🧾</div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: INK, marginBottom: 6 }}>{file837.name}</p>
                <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11, background: MINT, color: INK, padding: '4px 14px', borderRadius: 20, border: '1.5px solid #1A1A2E' }}>✓ Parsed Successfully</span>
              </div>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.35)', fontStyle: 'italic', marginTop: 10 }}>Drop a new file to replace</p>
            </>
          )}
          {file837?.status === 'error' && (
            <>
              <div style={{ fontSize: 36 }}>⚠️</div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#C0392B', marginBottom: 4 }}>Parse Failed</p>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.55)', maxWidth: 260, margin: '0 auto' }}>{file837.error}</p>
              </div>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.35)', fontStyle: 'italic', marginTop: 10 }}>Drop a new file to retry</p>
            </>
          )}
          {!file837 && (
            <>
              <div style={{ fontSize: 40, filter: isDrag837 ? 'none' : 'grayscale(0.3)', transition: 'filter 0.2s' }}>🧾</div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15, color: INK, marginBottom: 4 }}>
                  {isDrag837 ? 'Drop it here! 🎉' : 'Drag & drop your 837 file'}
                </p>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.45)' }}>or click to browse</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Footer / Run ──────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', padding: '20px 48px 32px', borderTop: (queue834.length > 0 || file837) ? `2px solid rgba(26,26,46,0.07)` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          {runError ? (
            <div style={{ padding: '10px 16px', background: 'rgba(255,107,107,0.07)', border: `1.5px solid rgba(255,107,107,0.3)`, borderRadius: 8, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B', maxWidth: 520 }}>
              <strong>Error:</strong> {runError}
            </div>
          ) : (
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic', margin: 0 }}>
              {canRun
                ? `Ready: ${ready834.length} roster file(s) + 1 claims file. Click to run eligibility check.`
                : queue834.length === 0 && !file837
                  ? 'Upload 834 roster files and an 837 claims file to begin.'
                  : !file837 || file837.status !== 'ok'
                    ? 'Upload an 837 claims file (Step 2) to continue.'
                    : ready834.length === 0
                      ? 'Upload at least one 834 roster file (Step 1) to continue.'
                      : 'Waiting for files to finish parsing…'}
            </p>
          )}
        </div>

        <button
          onClick={run}
          disabled={!canRun}
          style={{
            background: canRun ? YELLOW : 'rgba(26,26,46,0.07)',
            color: canRun ? INK : 'rgba(26,26,46,0.3)',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15,
            border: canRun ? `2.5px solid ${INK}` : '2.5px solid rgba(26,26,46,0.12)',
            borderRadius: 12, padding: '12px 32px', cursor: canRun ? 'pointer' : 'not-allowed',
            boxShadow: canRun ? '4px 4px 0 rgba(26,26,46,0.2)' : 'none',
            transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}
          onMouseDown={(e) => { if (canRun) { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '2px 2px 0 rgba(26,26,46,0.2)' } }}
          onMouseUp={(e) => { if (canRun) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '4px 4px 0 rgba(26,26,46,0.2)' } }}
          onMouseEnter={(e) => { if (canRun) e.currentTarget.style.background = '#FFD93D' }}
          onMouseLeave={(e) => { if (canRun) e.currentTarget.style.background = YELLOW }}
        >
          {isRunning
            ? <><div className="doodle-spinner" style={{ width: 18, height: 18 }} /> Running…</>
            : <>✓ Run Eligibility Check</>}
        </button>
      </div>
    </div>
  )
}

// ── Results View ──────────────────────────────────────────────────────────────

function ResultView({ report, onReset }: { report: EligibilityReport; onReset: () => void }) {
  const [filter, setFilter] = useState<'ALL' | 'CLEARED' | 'FLAGGED'>('ALL')
  const [sortCol, setSortCol] = useState<keyof ClaimResult>('claim_id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = report.claims.filter(c => {
    if (filter === 'CLEARED') return c.flag === 'CLEARED'
    if (filter === 'FLAGGED') return c.flag !== 'CLEARED'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    const dir = sortDir === 'asc' ? 1 : -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  const onSort = (col: keyof ClaimResult) => {
    if (col === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  const THStyle: React.CSSProperties = {
    padding: '11px 16px',
    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
    color: YELLOW, background: INK,
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', textAlign: 'left',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: BG }} className="custom-scrollbar">

      {/* ── Result header ──────────────────────────────────────────────── */}
      <div style={{ padding: '28px 48px 20px', borderBottom: '2px solid rgba(26,26,46,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: YELLOW, border: `2.5px solid ${INK}`, boxShadow: '3px 3px 0 rgba(26,26,46,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>✓</div>
          <div>
            <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, color: INK, margin: 0, marginBottom: 4 }}>Eligibility Report</h1>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.45)' }}>
              {report.total_claims} claim{report.total_claims !== 1 ? 's' : ''} validated against {report.roster_stats.total_members} member{report.roster_stats.total_members !== 1 ? 's' : ''}
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
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = YELLOW; e.currentTarget.style.color = INK }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,26,46,0.18)'; e.currentTarget.style.color = 'rgba(26,26,46,0.5)' }}
        >
          ↺ New Check
        </button>
      </div>

      <div style={{ flex: 1, padding: '32px 48px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── KPI Cards ───────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 18, background: TEAL, borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: INK, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Summary</h2>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Claims', value: report.total_claims, accent: INK, icon: '🧾' },
              { label: 'Cleared', value: report.cleared_count, accent: '#27AE60', icon: '✓' },
              { label: 'Not Found', value: report.flagged_not_found, accent: CORAL, icon: '✕' },
              { label: 'Not Yet Effective', value: report.flagged_not_yet_effective, accent: '#B89000', icon: '⚠' },
              { label: 'Terminated', value: report.flagged_terminated, accent: '#922B21', icon: '🚫' },
              { label: 'Roster Size', value: report.roster_stats.total_members, accent: TEAL, icon: '👥' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  flex: '1 1 140px', minWidth: 130,
                  background: WHITE, border: '2.5px solid #1A1A2E',
                  borderRadius: 12, boxShadow: '4px 4px 0 rgba(26,26,46,0.1)',
                  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {card.label}
                  </span>
                  <span style={{ fontSize: 16 }}>{card.icon}</span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 20, color: card.accent }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Claims Table ─────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, background: INK, borderRadius: 2 }} />
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: INK, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Claims Detail ({sorted.length})
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'CLEARED', 'FLAGGED'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? YELLOW : 'transparent',
                  color: filter === f ? INK : 'rgba(26,26,46,0.5)',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
                  border: filter === f ? `2px solid ${INK}` : '2px solid rgba(26,26,46,0.15)',
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={(e) => { if (filter !== f) { e.currentTarget.style.borderColor = 'rgba(26,26,46,0.3)'; e.currentTarget.style.color = INK } }}
                  onMouseLeave={(e) => { if (filter !== f) { e.currentTarget.style.borderColor = 'rgba(26,26,46,0.15)'; e.currentTarget.style.color = 'rgba(26,26,46,0.5)' } }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', background: WHITE, border: '2px solid rgba(26,26,46,0.08)', borderRadius: 12, boxShadow: '3px 3px 0 rgba(26,26,46,0.05)' }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic' }}>
                No claims match the selected filter.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '2.5px solid #1A1A2E', boxShadow: '5px 5px 0 rgba(26,26,46,0.1)' }} className="custom-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Claim ID', col: 'claim_id' as keyof ClaimResult },
                      { label: 'Patient ID', col: 'patient_id' as keyof ClaimResult },
                      { label: 'Patient Name', col: 'member_name' as keyof ClaimResult },
                      { label: 'Date of Service', col: 'date_of_service' as keyof ClaimResult },
                      { label: 'Status', col: 'flag' as keyof ClaimResult },
                      { label: 'Details', col: undefined },
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
                  {sorted.map((claim, idx) => {
                    const rowBg = idx % 2 === 0 ? WHITE : BG
                    return (
                      <tr
                        key={`${claim.claim_id}-${idx}`}
                        style={{
                          background: rowBg,
                          borderTop: idx > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,230,109,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = rowBg }}
                      >
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, background: 'rgba(78,205,196,0.1)', color: INK, padding: '2px 8px', borderRadius: 4 }}>
                            {claim.claim_id}
                          </code>
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(26,26,46,0.7)', whiteSpace: 'nowrap' }}>
                          {claim.patient_id}
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.7)' }}>
                          {claim.member_name || '—'}
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(26,26,46,0.7)', whiteSpace: 'nowrap' }}>
                          {claim.date_of_service}
                        </td>
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          <FlagBadge flag={claim.flag} />
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.6)', fontStyle: 'italic', maxWidth: 340 }}>
                          {claim.message}
                        </td>
                      </tr>
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

// ── Root ──────────────────────────────────────────────────────────────────────

export default function EligibilityScrubberView() {
  const stored = useAppStore(s => s.eligibilityScrubberResult)
  const setEligibilityScrubberResult = useAppStore(s => s.setEligibilityScrubberResult)

  const [report, setReport] = useState<EligibilityReport | null>(stored as EligibilityReport | null)

  const handleResult = (r: EligibilityReport) => { setReport(r); setEligibilityScrubberResult(r as any) }
  const handleReset = () => { setReport(null); setEligibilityScrubberResult(null) }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {report ? <ResultView report={report} onReset={handleReset} /> : <UploadView onResult={handleResult} />}
    </div>
  )
}