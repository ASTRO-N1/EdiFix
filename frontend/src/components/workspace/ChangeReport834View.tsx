/**
 * ChangeReport834View.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 834 Benefit Enrollment Change Report — multi-file upload flow.
 *
 * Upload State:
 *   One dropzone that accepts 2–N 834 EDI files at once (or added one-by-one).
 *   Each file is parsed client-side via /api/v1/parse and shown in a queue
 *   with per-file status chips. Timeline (oldest → newest) is detected
 *   automatically on the server — no T-0/T-1 labelling anywhere.
 *   "Generate Report" activates once ≥ 2 files are parsed successfully.
 *
 * Results State:
 *   Tab bar: Additions | Terminations | Changes | Anomalies
 *   Changes tab rows expand in-place to show "Old → New" attribute diffs.
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import useAppStore from '../../store/useAppStore'

// ── Design tokens ────────────────────────────────────────────────────────────

const API_URL    = (import.meta.env.VITE_API_URL || 'http://localhost:8000') as string
const BYPASS     = { 'X-Internal-Bypass': 'frontend-ui-secret' } as const
const MINT       = '#95E1D3'
const TEAL       = '#4ECDC4'
const CORAL      = '#FF6B6B'
const INK        = '#1A1A2E'
const INK_MUTED  = 'rgba(26,26,46,0.50)'
const INK_FAINT  = 'rgba(26,26,46,0.34)'
const BG         = '#FDFAF4'
const WHITE      = '#FFFFFF'

// ── Types ────────────────────────────────────────────────────────────────────

type FileStatus = 'idle' | 'loading' | 'ok' | 'error'

interface QueuedFile {
  id: string
  name: string
  size: number
  status: FileStatus
  error?: string
  parsed?: Record<string, unknown>
  fileDate?: string   // extracted from BGN03 after parse — display only
}

interface MemberDemographics { last_name: string; first_name: string; middle_name: string; dob: string; gender: string }
interface Coverage { ins_line: string; plan_coverage: string; tier: string; coverage_date: string; is_active: boolean }
interface Member   { golden_id: string; subscriber_id: string; relationship_code: string; ins01: string; ins02: string; ins03: string; ins04: string; effective_date: string; demographics: MemberDemographics; address: Record<string,string>; coverages: Coverage[] }

interface AdditionRecord    { golden_id: string; subscriber_id: string; name: string; relationship: string; effective_date: string; ins03: string; member: Member; anomalies: string[] }
interface TerminationRecord { golden_id: string; subscriber_id: string; name: string; relationship: string; effective_date: string; ins03: string; member: Member; anomalies: string[] }
interface AttributeDiff     { field: string; category: string; old_value: string; new_value: string }
interface ChangeRecord      { golden_id: string; subscriber_id: string; name: string; relationship: string; effective_date: string; ins03: string; attribute_diffs: AttributeDiff[]; has_changes: boolean; anomalies: string[] }

interface ReportSummary {
  total_members_t_minus_1: number; total_members_t_now: number
  additions_count: number; terminations_count: number; changes_count: number
  anomalies_count: number; file_date_t_minus_1: string; file_date_t_now: string
  file_order_auto_swapped: boolean
}
interface ChangeReport834 {
  summary: ReportSummary
  additions: AdditionRecord[]
  terminations: TerminationRecord[]
  changes: ChangeRecord[]
  anomalies: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `f${++_uid}`

function fmtDate(raw: string): string {
  if (!raw || raw === 'unknown') return raw || '—'
  if (raw.length === 8) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
  return raw
}
function fmtBytes(b: number): string {
  return b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`
}
function relLabel(code: string): string {
  const M: Record<string,string> = { '18':'Self','01':'Spouse','19':'Child','34':'Other','53':'Life Partner','G8':'Other' }
  return M[code] ? `${M[code]} (${code})` : code || '—'
}
function ins03Label(code: string): string {
  const M: Record<string,string> = { '001':'Change','021':'Addition','024':'Termination','030':'Audit' }
  return M[code] ? `${M[code]} (${code})` : code || '—'
}

/** Extract BGN03 date from a parse response for display */
function extractFileDateFromParsed(parsed: Record<string,unknown>): string {
  try {
    const data  = (parsed as any)?.data ?? parsed
    const loops = data?.loops ?? {}
    const header: any[] = Array.isArray(loops['834_HEADER']) ? loops['834_HEADER'] : (loops['834_HEADER'] ? [loops['834_HEADER']] : [])
    for (const inst of header) {
      const rd = inst?.BGN?.raw_data ?? []
      const d  = rd[3]
      if (d && String(d).length >= 8) return String(d)
    }
    // fallback metadata
    const meta: any = data?.metadata ?? {}
    return meta.gs_date || meta.isa_date || ''
  } catch { return '' }
}

async function parseEdiFile(file: File): Promise<{ ok: boolean; data?: any; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  try {
    const res  = await fetch(`${API_URL}/api/v1/parse`, { method: 'POST', headers: BYPASS, body: form })
    const json = await res.json()
    if (!res.ok || json.status === 'error') return { ok: false, error: json.message || json.detail || 'Parse failed' }
    return { ok: true, data: json }
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' }
  }
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:12, background:bg, color:fg, whiteSpace:'nowrap' }}>{label}</span>
  )
}

function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string,{bg:string;color:string}> = {
    Demographics: { bg:'rgba(78,205,196,0.13)',  color:'#1A9B93' },
    Address:      { bg:'rgba(255,230,109,0.22)',  color:'#8A6F00' },
    Coverage:     { bg:'rgba(201,184,255,0.22)',  color:'#6644BB' },
  }
  const s = map[cat] ?? { bg:'rgba(26,26,46,0.07)', color:INK_MUTED }
  return (
    <span style={{ fontFamily:'Nunito, sans-serif', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:4, background:s.bg, color:s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{cat}</span>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding:'44px 24px', textAlign:'center', background:WHITE, border:'2px solid rgba(26,26,46,0.08)', borderRadius:12, boxShadow:'3px 3px 0 rgba(26,26,46,0.05)' }}>
      <div style={{ fontSize:38, marginBottom:10 }}>{icon}</div>
      <p style={{ fontFamily:'Nunito, sans-serif', fontSize:13, color:INK_FAINT, fontStyle:'italic' }}>{text}</p>
    </div>
  )
}

function SectionLabel({ color, text, count }: { color: string; text: string; count: number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ width:4, height:20, background:color, borderRadius:2 }} />
      <h2 style={{ fontFamily:'Nunito, sans-serif', fontWeight:900, fontSize:13, color:INK, margin:0, textTransform:'uppercase', letterSpacing:'0.07em' }}>{text} ({count})</h2>
    </div>
  )
}

// ── File queue row ────────────────────────────────────────────────────────────

function FileRow({ f, onRemove }: { f: QueuedFile; onRemove: (id: string) => void }) {
  const statusColor =
    f.status === 'ok'      ? '#27AE60' :
    f.status === 'error'   ? '#C0392B' :
    f.status === 'loading' ? TEAL      : INK_FAINT

  const statusBg =
    f.status === 'ok'      ? 'rgba(46,204,113,0.1)'   :
    f.status === 'error'   ? 'rgba(255,107,107,0.08)'  :
    f.status === 'loading' ? 'rgba(78,205,196,0.08)'   : 'rgba(26,26,46,0.04)'

  const statusText =
    f.status === 'ok'      ? '✓ Parsed' :
    f.status === 'error'   ? '✕ Failed' :
    f.status === 'loading' ? '⟳ Parsing…' : 'idle'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:statusBg, border:`1.5px solid ${statusColor}30`, borderRadius:8, transition:'all 0.2s' }}>
      {/* Icon */}
      <div style={{ fontSize:20, flexShrink:0 }}>📄</div>

      {/* Meta */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:700, color:INK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
          <span style={{ fontFamily:'Nunito, sans-serif', fontSize:11, color:INK_FAINT }}>{fmtBytes(f.size)}</span>
          {f.fileDate && f.status === 'ok' && (
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, color:INK_MUTED }}>BGN03: {fmtDate(f.fileDate)}</span>
          )}
          {f.error && (
            <span style={{ fontFamily:'Nunito, sans-serif', fontSize:11, color:'#C0392B', fontStyle:'italic' }}>{f.error}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <span style={{ fontFamily:'Nunito, sans-serif', fontSize:11, fontWeight:800, color:statusColor, whiteSpace:'nowrap' }}>{statusText}</span>

      {/* Remove */}
      {f.status !== 'loading' && (
        <button onClick={() => onRemove(f.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:INK_FAINT, lineHeight:1, padding:'2px 4px', borderRadius:4, transition:'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = CORAL }}
          onMouseLeave={(e) => { e.currentTarget.style.color = INK_FAINT }}>
          ✕
        </button>
      )}
    </div>
  )
}

// ── Upload View ───────────────────────────────────────────────────────────────

function UploadView({ onResult }: { onResult: (r: ChangeReport834) => void }) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isRunning,  setIsRunning]  = useState(false)
  const [runError,   setRunError]   = useState('')

  const readyFiles   = queue.filter(f => f.status === 'ok')
  const loadingFiles = queue.filter(f => f.status === 'loading')
  const canRun       = readyFiles.length >= 2 && loadingFiles.length === 0 && !isRunning

  /** Parse a single file and update its queue entry */
  const parseFile = useCallback(async (entry: QueuedFile, raw: File) => {
    setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'loading' } : f))
    const r = await parseEdiFile(raw)
    if (r.ok) {
      const fileDate = extractFileDateFromParsed(r.data)
      setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'ok', parsed: r.data, fileDate } : f))
    } else {
      setQueue(q => q.map(f => f.id === entry.id ? { ...f, status: 'error', error: r.error } : f))
    }
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    const newEntries: QueuedFile[] = accepted.map(raw => {
      const entry: QueuedFile = { id: uid(), name: raw.name, size: raw.size, status: 'idle' }
      // kick off parse immediately
      setTimeout(() => parseFile(entry, raw), 0)
      return entry
    })
    setQueue(q => [...q, ...newEntries])
  }, [parseFile])

  const removeFile = (id: string) => setQueue(q => q.filter(f => f.id !== id))

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain':              ['.edi', '.txt', '.dat', '.x12'],
      'application/octet-stream':['.edi', '.dat', '.x12'],
    },
    multiple: true,
    disabled: isRunning,
  })

  const run = async () => {
    const parsedList = readyFiles.map(f => f.parsed!)
    setIsRunning(true); setRunError('')
    try {
      const res  = await fetch(`${API_URL}/api/reconcile/834/json`, {
        method: 'POST',
        headers: { ...BYPASS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: parsedList }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        setRunError(json.message || json.detail || 'Reconciliation failed')
        return
      }
      if (!json.report) {
         setRunError('Backend returned success but no report data.')
         return
      }
      onResult(json.report as ChangeReport834)
    } catch (e: any) {
      setRunError(e.message || 'Network error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', background:BG }} className="custom-scrollbar">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div style={{ padding:'28px 48px 20px', borderBottom:`2px solid rgba(26,26,46,0.07)`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:MINT, border:`2.5px solid ${INK}`, boxShadow:'3px 3px 0 rgba(26,26,46,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📋</div>
          <div>
            <h1 style={{ fontFamily:'Nunito, sans-serif', fontWeight:900, fontSize:22, color:INK, margin:0, marginBottom:3 }}>834 Change Report</h1>
            <p style={{ fontFamily:'Nunito, sans-serif', fontSize:13, color:INK_MUTED, margin:0 }}>
              Drop 2 or more 834 Benefit Enrollment files. The engine auto-detects the timeline and surfaces additions, terminations, and attribute changes.
            </p>
          </div>
        </div>
      </div>

      {/* ── Drop Zone ────────────────────────────────────────────── */}
      <div style={{ padding:'28px 48px 0' }}>
        <div
          {...getRootProps()}
          style={{
            borderRadius:16, padding: queue.length > 0 ? '28px 32px' : '56px 32px',
            border: `2.5px dashed ${isDragActive ? TEAL : 'rgba(26,26,46,0.22)'}`,
            background: isDragActive ? 'rgba(78,205,196,0.05)' : WHITE,
            boxShadow: isDragActive ? `0 0 0 4px rgba(78,205,196,0.12)` : '3px 3px 0 rgba(26,26,46,0.05)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            textAlign:'center', transition:'all 0.2s ease',
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: queue.length > 0 ? 32 : 48, marginBottom:12 }}>
            {isDragActive ? '📂' : '📑'}
          </div>
          <p style={{ fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize: queue.length > 0 ? 14 : 17, color:INK, margin:0, marginBottom:5 }}>
            {isDragActive ? 'Release to add files!' : queue.length > 0 ? 'Drop more files to add' : 'Drag & drop your 834 files here'}
          </p>
          <p style={{ fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_FAINT, margin:0, marginBottom:queue.length === 0 ? 18 : 0 }}>
            {queue.length === 0 ? 'or click to browse — .edi  ·  .txt  ·  .dat  ·  .x12' : 'or click to browse'}
          </p>
          {queue.length === 0 && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 20px', borderRadius:20, background:'rgba(26,26,46,0.05)', border:'1.5px solid rgba(26,26,46,0.1)' }}>
              <span style={{ fontSize:15 }}>ℹ️</span>
              <span style={{ fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_MUTED }}>Timeline is auto-detected from BGN03 dates — no need to label files</span>
            </div>
          )}
        </div>
      </div>

      {/* ── File Queue ────────────────────────────────────────────── */}
      {queue.length > 0 && (
        <div style={{ padding:'20px 48px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <p style={{ fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:11, color:INK_FAINT, textTransform:'uppercase', letterSpacing:'0.07em', margin:0 }}>
              Files ({queue.length}) — {readyFiles.length} parsed
            </p>
            {readyFiles.length >= 2 && (
              <p style={{ fontFamily:'Nunito, sans-serif', fontSize:11, color:TEAL, fontStyle:'italic', margin:0 }}>
                ✓ Timeline will be auto-sorted by BGN03 — oldest vs newest compared
              </p>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {queue.map(f => <FileRow key={f.id} f={f} onRemove={removeFile} />)}
          </div>
        </div>
      )}

      {/* ── Footer / Run ──────────────────────────────────────────── */}
      <div style={{ marginTop:'auto', padding:'20px 48px 32px', borderTop: queue.length > 0 ? `2px solid rgba(26,26,46,0.07)` : 'none', display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, flexShrink:0 }}>
        <div style={{ flex:1 }}>
          {runError ? (
            <div style={{ padding:'10px 16px', background:'rgba(255,107,107,0.07)', border:`1.5px solid rgba(255,107,107,0.3)`, borderRadius:8, fontFamily:'Nunito, sans-serif', fontSize:12, color:'#C0392B', maxWidth:520 }}>
              <strong>Error:</strong> {runError}
            </div>
          ) : (
            <p style={{ fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_FAINT, fontStyle:'italic', margin:0 }}>
              {canRun
                ? `${readyFiles.length} files ready — generate the change report to compare oldest vs newest.`
                : queue.length === 0
                  ? 'Add 2 or more 834 files to get started.'
                  : readyFiles.length < 2
                    ? `Need at least 2 successfully parsed files (${readyFiles.length} ready so far).`
                    : 'Waiting for files to finish parsing…'}
            </p>
          )}
        </div>

        <button
          id="generate-change-report-btn"
          onClick={run}
          disabled={!canRun}
          style={{
            background: canRun ? MINT : 'rgba(26,26,46,0.07)',
            color: canRun ? INK : INK_FAINT,
            fontFamily:'Nunito, sans-serif', fontWeight:900, fontSize:15,
            border: canRun ? `2.5px solid ${INK}` : '2.5px solid rgba(26,26,46,0.12)',
            borderRadius:12, padding:'12px 32px', cursor: canRun ? 'pointer' : 'not-allowed',
            boxShadow: canRun ? '4px 4px 0 rgba(26,26,46,0.2)' : 'none',
            transition:'all 0.15s ease', display:'flex', alignItems:'center', gap:10, flexShrink:0,
          }}
          onMouseDown={(e) => { if (canRun) { e.currentTarget.style.transform='translate(2px,2px)'; e.currentTarget.style.boxShadow='2px 2px 0 rgba(26,26,46,0.2)' } }}
          onMouseUp={(e)   => { if (canRun) { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='4px 4px 0 rgba(26,26,46,0.2)' } }}
          onMouseEnter={(e) => { if (canRun) e.currentTarget.style.background='#7DCFC5' }}
          onMouseLeave={(e) => { if (canRun) e.currentTarget.style.background=MINT }}
        >
          {isRunning
            ? <><div className="doodle-spinner" style={{ width:18, height:18 }} /> Generating…</>
            : <>📋 Generate Change Report</>}
        </button>
      </div>
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ summary, onReset }: { summary: ReportSummary; onReset: () => void }) {
  const cards = [
    { label:'Baseline (T-1)',    value:summary.total_members_t_minus_1, accent:INK,       icon:'👥', sub: fmtDate(summary.file_date_t_minus_1) },
    { label:'Current (T-Now)',   value:summary.total_members_t_now,     accent:TEAL,      icon:'👥', sub: fmtDate(summary.file_date_t_now) },
    { label:'Additions',         value:summary.additions_count,         accent:'#27AE60', icon:'➕', sub:'New / rejoining' },
    { label:'Terminations',      value:summary.terminations_count,      accent:CORAL,     icon:'🚫', sub:'Cancelled / dropped' },
    { label:'Changes',           value:summary.changes_count,           accent:'#8E44AD', icon:'🔄', sub:'Attribute diffs' },
    ...(summary.anomalies_count > 0
      ? [{ label:'Anomalies', value:summary.anomalies_count, accent:'#E67E22', icon:'⚠️', sub:'Logic conflicts' }]
      : []),
  ]

  return (
    <div style={{ padding:'20px 48px', borderBottom:`2px solid rgba(26,26,46,0.07)`, background:BG, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:MINT, border:`2.5px solid ${INK}`, boxShadow:'3px 3px 0 rgba(26,26,46,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📋</div>
          <div>
            <h1 style={{ fontFamily:'Nunito, sans-serif', fontWeight:900, fontSize:20, color:INK, margin:0 }}>834 Change Report</h1>
            {summary.file_order_auto_swapped && (
              <span style={{ fontFamily:'Nunito, sans-serif', fontSize:11, color:'#E67E22', fontStyle:'italic' }}>↕ File order auto-corrected by chronological sort</span>
            )}
          </div>
        </div>
        <button onClick={onReset} style={{ background:'transparent', color:INK_MUTED, fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:12, border:`1.5px solid rgba(26,26,46,0.18)`, borderRadius:8, padding:'7px 14px', cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor=MINT; e.currentTarget.style.color=INK }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor='rgba(26,26,46,0.18)'; e.currentTarget.style.color=INK_MUTED }}>
          ↺ New Report
        </button>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {cards.map(c => (
          <div key={c.label} style={{ flex:'1 1 120px', minWidth:110, background:WHITE, border:`2px solid ${INK}`, borderRadius:10, boxShadow:'3px 3px 0 rgba(26,26,46,0.09)', padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:9, color:INK_FAINT, letterSpacing:'0.07em', textTransform:'uppercase' }}>{c.label}</span>
              <span style={{ fontSize:14 }}>{c.icon}</span>
            </div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:700, fontSize:24, color:c.accent }}>{c.value}</div>
            <div style={{ fontFamily:'Nunito, sans-serif', fontSize:10, color:INK_FAINT, fontStyle:'italic' }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Additions table ───────────────────────────────────────────────────────────

const TH = { padding:'11px 16px', textAlign:'left' as const, fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:11, letterSpacing:'0.06em', whiteSpace:'nowrap' as const }

function AdditionsTable({ rows }: { rows: AdditionRecord[] }) {
  if (!rows.length) return <EmptyState icon="👤" text="No new members in this period." />
  const COLS = ['Subscriber ID','Name','Relationship','Effective Date','INS03','Anomalies']
  return (
    <div style={{ overflowX:'auto', borderRadius:12, border:`2.5px solid ${INK}`, boxShadow:'4px 4px 0 rgba(26,26,46,0.1)' }} className="custom-scrollbar">
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:680 }}>
        <thead><tr>{COLS.map(h => <th key={h} style={{ ...TH, color:MINT, background:INK }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const bg = i % 2 === 0 ? WHITE : BG
            return (
              <tr key={row.golden_id} style={{ background:bg, borderTop: i > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background='rgba(149,225,211,0.07)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background=bg }}>
                <td style={{ padding:'11px 16px', whiteSpace:'nowrap' }}><code style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:700, background:'rgba(149,225,211,0.15)', color:INK, padding:'2px 7px', borderRadius:4 }}>{row.subscriber_id||'—'}</code></td>
                <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:13, fontWeight:700, color:INK }}>{row.name||'—'}</td>
                <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_MUTED }}>{relLabel(row.relationship)}</td>
                <td style={{ padding:'11px 16px', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:INK_MUTED }}>{fmtDate(row.effective_date)||'—'}</td>
                <td style={{ padding:'11px 16px' }}><Pill label={ins03Label(row.ins03)} fg="#1E8449" bg="rgba(46,204,113,0.12)" /></td>
                <td style={{ padding:'11px 16px' }}>
                  {row.anomalies.length > 0 ? <span title={row.anomalies.join('\n')} style={{ cursor:'help', fontFamily:'Nunito, sans-serif', fontSize:11, color:'#E67E22' }}>⚠️ {row.anomalies.length}</span> : <span style={{ color:INK_FAINT, fontFamily:'Nunito, sans-serif', fontSize:11 }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Terminations table ────────────────────────────────────────────────────────

function TerminationsTable({ rows }: { rows: TerminationRecord[] }) {
  if (!rows.length) return <EmptyState icon="✅" text="No terminations in this period." />
  const COLS = ['Subscriber ID','Name','Relationship','Term Date','INS03','Anomalies']
  return (
    <div style={{ overflowX:'auto', borderRadius:12, border:`2.5px solid ${INK}`, boxShadow:'4px 4px 0 rgba(26,26,46,0.1)' }} className="custom-scrollbar">
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:680 }}>
        <thead><tr>{COLS.map(h => <th key={h} style={{ ...TH, color:'#FF8A80', background:INK }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const bg = i % 2 === 0 ? WHITE : BG
            return (
              <tr key={row.golden_id} style={{ background:bg, borderTop: i > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,107,107,0.05)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background=bg }}>
                <td style={{ padding:'11px 16px', whiteSpace:'nowrap' }}><code style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:700, background:'rgba(255,107,107,0.1)', color:INK, padding:'2px 7px', borderRadius:4 }}>{row.subscriber_id||'—'}</code></td>
                <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:13, fontWeight:700, color:INK }}>{row.name||'—'}</td>
                <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_MUTED }}>{relLabel(row.relationship)}</td>
                <td style={{ padding:'11px 16px', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:INK_MUTED }}>{fmtDate(row.effective_date)||'—'}</td>
                <td style={{ padding:'11px 16px' }}><Pill label={ins03Label(row.ins03)} fg="#922B21" bg="rgba(255,107,107,0.12)" /></td>
                <td style={{ padding:'11px 16px' }}>
                  {row.anomalies.length > 0 ? <span title={row.anomalies.join('\n')} style={{ cursor:'help', fontFamily:'Nunito, sans-serif', fontSize:11, color:'#E67E22' }}>⚠️ {row.anomalies.length}</span> : <span style={{ color:INK_FAINT, fontFamily:'Nunito, sans-serif', fontSize:11 }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Changes table (expandable diffs) ─────────────────────────────────────────

function ChangesTable({ rows }: { rows: ChangeRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!rows.length) return <EmptyState icon="🔄" text="No attribute changes detected." />

  const COLS = ['Subscriber ID','Name','Relationship','Effective Date','Changed Fields','Anomalies']
  const withDiffs = rows.filter(r => r.has_changes)
  const noDiffs   = rows.filter(r => !r.has_changes)

  const renderRows = (list: ChangeRecord[], accent: string) =>
    list.map((row, i) => {
      const isExp = expanded === row.golden_id
      const bg    = i % 2 === 0 ? WHITE : BG
      return (
        <>
          <tr key={row.golden_id}
            style={{ background:bg, borderTop: i > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none', cursor: row.attribute_diffs.length > 0 ? 'pointer' : 'default' }}
            onClick={() => row.attribute_diffs.length > 0 && setExpanded(isExp ? null : row.golden_id)}
            onMouseEnter={(e) => { e.currentTarget.style.background=`${accent}0a` }}
            onMouseLeave={(e) => { e.currentTarget.style.background=bg }}>
            <td style={{ padding:'11px 16px', whiteSpace:'nowrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                {row.attribute_diffs.length > 0 && <span style={{ fontSize:8, color:'rgba(26,26,46,0.3)', transition:'transform 0.15s', transform: isExp ? 'rotate(90deg)' : 'none', display:'inline-block' }}>▶</span>}
                <code style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, fontWeight:700, background:`${accent}18`, color:INK, padding:'2px 7px', borderRadius:4 }}>{row.subscriber_id||'—'}</code>
              </div>
            </td>
            <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:13, fontWeight:700, color:INK }}>{row.name||'—'}</td>
            <td style={{ padding:'11px 16px', fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_MUTED }}>{relLabel(row.relationship)}</td>
            <td style={{ padding:'11px 16px', fontFamily:'JetBrains Mono, monospace', fontSize:12, color:INK_MUTED }}>{fmtDate(row.effective_date)||'—'}</td>
            <td style={{ padding:'11px 16px' }}>
              {row.attribute_diffs.length > 0
                ? <Pill label={`${row.attribute_diffs.length} field${row.attribute_diffs.length !== 1 ? 's' : ''}`} fg="#6644BB" bg="rgba(201,184,255,0.2)" />
                : <span style={{ fontFamily:'Nunito, sans-serif', fontSize:11, color:INK_FAINT, fontStyle:'italic' }}>No changes</span>}
            </td>
            <td style={{ padding:'11px 16px' }}>
              {row.anomalies.length > 0 ? <span title={row.anomalies.join('\n')} style={{ cursor:'help', fontFamily:'Nunito, sans-serif', fontSize:11, color:'#E67E22' }}>⚠️ {row.anomalies.length}</span> : <span style={{ color:INK_FAINT, fontFamily:'Nunito, sans-serif', fontSize:11 }}>—</span>}
            </td>
          </tr>
          {isExp && row.attribute_diffs.map((d, di) => (
            <tr key={`${row.golden_id}-d${di}`} style={{ background:'#F4F1FF', borderTop:'1px solid rgba(26,26,46,0.04)' }}>
              <td colSpan={2} style={{ padding:'8px 16px 8px 40px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:INK_FAINT, fontSize:11 }}>↳</span>
                  <CategoryBadge cat={d.category} />
                  <span style={{ fontFamily:'Nunito, sans-serif', fontSize:12, color:INK, fontWeight:700 }}>{d.field}</span>
                </div>
              </td>
              <td colSpan={4} style={{ padding:'8px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  <code style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, background:'rgba(255,107,107,0.12)', color:'#C0392B', padding:'2px 7px', borderRadius:4, textDecoration:'line-through' }}>{d.old_value}</code>
                  <span style={{ fontFamily:'Nunito, sans-serif', fontSize:12, color:INK_FAINT }}>→</span>
                  <code style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, background:'rgba(46,204,113,0.12)', color:'#1E8449', padding:'2px 7px', borderRadius:4 }}>{d.new_value}</code>
                </div>
              </td>
            </tr>
          ))}
        </>
      )
    })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
      {withDiffs.length > 0 && (
        <div>
          <p style={{ fontFamily:'Nunito, sans-serif', fontSize:11, fontWeight:800, color:INK_FAINT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
            With Attribute Changes ({withDiffs.length}) — Click row to expand diffs
          </p>
          <div style={{ overflowX:'auto', borderRadius:12, border:`2.5px solid ${INK}`, boxShadow:'4px 4px 0 rgba(26,26,46,0.1)' }} className="custom-scrollbar">
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead><tr>{COLS.map(h => <th key={h} style={{ ...TH, color:'#C9B8FF', background:INK }}>{h}</th>)}</tr></thead>
              <tbody>{renderRows(withDiffs, '#8E44AD')}</tbody>
            </table>
          </div>
        </div>
      )}
      {noDiffs.length > 0 && (
        <div>
          <p style={{ fontFamily:'Nunito, sans-serif', fontSize:11, fontWeight:800, color:INK_FAINT, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
            No Changes ({noDiffs.length})
          </p>
          <div style={{ overflowX:'auto', borderRadius:12, border:'2px solid rgba(26,26,46,0.12)', boxShadow:'3px 3px 0 rgba(26,26,46,0.05)' }} className="custom-scrollbar">
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead><tr>{COLS.map(h => <th key={h} style={{ ...TH, color:'rgba(240,235,225,0.55)', background:'rgba(26,26,46,0.5)' }}>{h}</th>)}</tr></thead>
              <tbody>{renderRows(noDiffs, '#888888')}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Anomalies ─────────────────────────────────────────────────────────────────

function AnomaliesPanel({ anomalies }: { anomalies: string[] }) {
  if (!anomalies.length) return <EmptyState icon="✅" text="No logical anomalies detected. All member records appear consistent." />
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {anomalies.map((msg, i) => (
        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', background:WHITE, border:'1.5px solid rgba(230,126,34,0.3)', borderRadius:8, boxShadow:'2px 2px 0 rgba(230,126,34,0.08)' }}>
          <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>⚠️</span>
          <p style={{ fontFamily:'Nunito, sans-serif', fontSize:13, color:'#7D4800', margin:0, lineHeight:1.55 }}>{msg}</p>
        </div>
      ))}
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────────────────────

type Tab = 'additions' | 'terminations' | 'changes' | 'anomalies'

function ResultView({ report, onReset }: { report: ChangeReport834; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>('additions')
  const { summary, additions, terminations, changes, anomalies } = report

  const tabs: { id: Tab; label: string; count: number; accent: string; color: string }[] = [
    { id:'additions',    label:'Additions',    count:additions.length,    accent:'#27AE60', color:MINT },
    { id:'terminations', label:'Terminations', count:terminations.length, accent:CORAL,     color:'#FF8A80' },
    { id:'changes',      label:'Changes',      count:changes.length,      accent:'#8E44AD', color:'#C9B8FF' },
    { id:'anomalies',    label:'Anomalies',    count:anomalies.length,    accent:'#E67E22', color:'#FFD5A0' },
  ]
  const cur = tabs.find(t => t.id === tab)!

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:BG }}>
      <SummaryStrip summary={summary} onReset={onReset} />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:`2px solid rgba(26,26,46,0.07)`, background:BG, flexShrink:0, paddingLeft:48 }}>
        {tabs.map(t => {
          const active = t.id === tab
          return (
            <button key={t.id} id={`cr834-tab-${t.id}`} onClick={() => setTab(t.id)} style={{ fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:13, color: active ? INK : INK_MUTED, background:'transparent', border:'none', borderBottom: active ? `3px solid ${t.accent}` : '3px solid transparent', padding:'14px 20px', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color=INK }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color=INK_MUTED }}>
              {t.label}
              <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, fontWeight:700, background: active ? t.accent : 'rgba(26,26,46,0.08)', color: active ? (t.accent === CORAL ? WHITE : INK) : INK_MUTED, padding:'1px 7px', borderRadius:10, minWidth:20, textAlign:'center' }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'28px 48px 40px' }} className="custom-scrollbar">
        <SectionLabel color={cur.accent} text={cur.label} count={cur.count} />
        {tab === 'additions'    && <AdditionsTable    rows={additions} />}
        {tab === 'terminations' && <TerminationsTable rows={terminations} />}
        {tab === 'changes'      && <ChangesTable      rows={changes} />}
        {tab === 'anomalies'    && <AnomaliesPanel    anomalies={anomalies} />}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function ChangeReport834View() {
  const stored                = useAppStore(s => s.changeReport834Result)
  const setChangeReport834Result = useAppStore(s => s.setChangeReport834Result)

  const [report, setReport] = useState<ChangeReport834 | null>(stored as ChangeReport834 | null)

  const handleResult = (r: ChangeReport834) => { setReport(r); setChangeReport834Result(r as any) }
  const handleReset  = () => { setReport(null); setChangeReport834Result(null) }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {report ? <ResultView report={report} onReset={handleReset} /> : <UploadView onResult={handleResult} />}
    </div>
  )
}
