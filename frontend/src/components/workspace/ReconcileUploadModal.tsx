/**
 * ReconcileUploadModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dual-upload modal for the 835-to-837 Reconciliation Engine.
 * 
 * Flow:
 *   1. User drops/selects an 837 Claim file → parsed via /api/v1/parse
 *   2. User drops/selects an 835 Remittance file → parsed via /api/v1/parse-835
 *   3. Both parse results stored in Zustand (auditParsed837, auditParsed835)
 *   4. "Run Reconciliation" button activates → calls /api/v1/reconcile
 *   5. On success: sets reconciliationResult, closes modal
 *
 * Design: Cream overlay, centered card with dashed borders, hand-drawn aesthetic.
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

// ── Shared helpers ─────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') as string
const BYPASS_HEADER = { 'X-Internal-Bypass': 'frontend-ui-secret' } as const

async function parseFile(file: File, endpoint: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: BYPASS_HEADER,
      body: formData,
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

// ── Single drop zone sub-component ────────────────────────────────────────

interface DropZoneProps {
  label: string
  accept837: boolean  // true for 837, false for 835
  status: 'idle' | 'loading' | 'ok' | 'error'
  fileName?: string
  errorMsg?: string
  onFile: (file: File) => void
}

function FileDropZone({ label, accept837, status, fileName, errorMsg, onFile }: DropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted[0] && onFile(accepted[0]),
    accept: {
      'text/plain': ['.edi', '.txt', '.dat', '.x12'],
      'application/octet-stream': ['.edi', '.dat', '.x12'],
    },
    multiple: false,
    disabled: status === 'loading',
  })

  const accentColor = accept837 ? '#4ECDC4' : '#FFE66D'
  const borderColor = status === 'ok'
    ? accentColor
    : status === 'error'
    ? '#FF6B6B'
    : isDragActive
    ? accentColor
    : 'rgba(26,26,46,0.2)'

  const bgColor = status === 'ok'
    ? (accept837 ? 'rgba(78,205,196,0.06)' : 'rgba(255,230,109,0.08)')
    : status === 'error'
    ? 'rgba(255,107,107,0.05)'
    : isDragActive
    ? (accept837 ? 'rgba(78,205,196,0.06)' : 'rgba(255,230,109,0.08)')
    : '#FFFFFF'

  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      {/* Label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10
      }}>
        <div style={{ width: 4, height: 16, background: accentColor, borderRadius: 2 }} />
        <span style={{
          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12,
          color: '#1A1A2E', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </span>
      </div>

      {/* Drop target */}
      <div
        {...getRootProps()}
        style={{
          padding: '28px 20px',
          border: `2.5px dashed ${borderColor}`,
          borderRadius: 14,
          background: bgColor,
          boxShadow: status === 'ok'
            ? `3px 3px 0 ${accentColor}40`
            : '2px 2px 0 rgba(26,26,46,0.05)',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s ease',
          minHeight: 140,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        <input {...getInputProps()} />

        {status === 'loading' && (
          <>
            <div className="doodle-spinner" style={{ width: 32, height: 32 }} />
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.5)' }}>Parsing…</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: 28 }}>{accept837 ? '🧾' : '💳'}</div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#1A1A2E' }}>
              {fileName}
            </p>
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10,
              background: accentColor, color: '#1A1A2E',
              padding: '2px 10px', borderRadius: 20,
              letterSpacing: '0.06em',
            }}>
              ✓ PARSED
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 24 }}>⚠️</div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B', fontWeight: 700 }}>Parse Failed</p>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.5)' }}>{errorMsg}</p>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic' }}>
              Drop a new file to retry
            </p>
          </>
        )}

        {status === 'idle' && (
          <>
            <div style={{ fontSize: 28 }}>{accept837 ? '🧾' : '💳'}</div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>
              {isDragActive ? 'Drop it! 🎉' : (accept837 ? 'Drop your 837 Claim file' : 'Drop your 835 Remittance file')}
            </p>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)' }}>
              .edi · .txt · .dat · .x12
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────

export default function ReconcileUploadModal() {
  const isOpen = useAppStore((s) => s.isReconcileModalOpen)
  const setIsOpen = useAppStore((s) => s.setIsReconcileModalOpen)
  const parseResult = useAppStore((s) => s.parseResult)  // existing workspace 837 parse
  const auditParsed837 = useAppStore((s) => s.auditParsed837)
  const setAuditParsed837 = useAppStore((s) => s.setAuditParsed837)
  const auditParsed835 = useAppStore((s) => s.auditParsed835)
  const setAuditParsed835 = useAppStore((s) => s.setAuditParsed835)
  const setReconciliationResult = useAppStore((s) => s.setReconciliationResult)
  const isReconciling = useAppStore((s) => s.isReconciling)
  const setIsReconciling = useAppStore((s) => s.setIsReconciling)
  const setActiveMainView = useAppStore((s) => s.setActiveMainView)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const addTab = useAppStore((s) => s.addTab)

  // Per-dropzone state
  const [status837, setStatus837] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [name837, setName837] = useState<string>('')
  const [err837, setErr837] = useState<string>('')

  const [status835, setStatus835] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [name835, setName835] = useState<string>('')
  const [err835, setErr835] = useState<string>('')

  const [reconcileError, setReconcileError] = useState<string>('')

  const canRun = status837 === 'ok' && status835 === 'ok' && !isReconciling

  // ── File handlers ──────────────────────────────────────────────────────

  const handle837 = useCallback(async (file: File) => {
    setStatus837('loading')
    setErr837('')
    setAuditParsed837(null)
    setName837(file.name)
    const result = await parseFile(file, '/api/v1/parse')
    if (result.ok) {
      setAuditParsed837(result.data)
      setStatus837('ok')
    } else {
      setErr837(result.error || 'Unknown error')
      setStatus837('error')
    }
  }, [setAuditParsed837])

  const handle835 = useCallback(async (file: File) => {
    setStatus835('loading')
    setErr835('')
    setAuditParsed835(null)
    setName835(file.name)
    const result = await parseFile(file, '/api/v1/parse-835')
    if (result.ok) {
      setAuditParsed835(result.data)
      setStatus835('ok')
    } else {
      setErr835(result.error || 'Unknown error')
      setStatus835('error')
    }
  }, [setAuditParsed835])

  // ── Run Reconciliation ─────────────────────────────────────────────────

  const runReconciliation = async () => {
    if (!auditParsed837 || !auditParsed835) return
    setIsReconciling(true)
    setReconcileError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/reconcile`, {
        method: 'POST',
        headers: {
          ...BYPASS_HEADER,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parsed_837: auditParsed837,
          parsed_835: auditParsed835,
        }),
      })
      const json = await res.json()

      if (!res.ok || json.status === 'error') {
        setReconcileError(json.message || json.detail || 'Reconciliation failed')
        return
      }

      // Success
      setReconciliationResult(json.report)
      addTab({ id: 'audit', label: 'Financial Audit', type: 'audit', closable: true })
      setActiveMainView('editor')
      setActiveTabId('audit')
      setIsOpen(false)

    } catch (e: any) {
      setReconcileError(e.message || 'Network error during reconciliation')
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isReconciling && setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(2px)',
            }}
          />

          {/* Modal Card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'fixed', zIndex: 9001,
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: '#FDFAF4',
              border: '2.5px solid #1A1A2E',
              borderRadius: 18,
              boxShadow: '6px 6px 0 rgba(26,26,46,0.18)',
              width: '100%', maxWidth: 680,
              padding: '28px 30px',
              display: 'flex', flexDirection: 'column', gap: 22,
              maxHeight: '90vh', overflowY: 'auto',
            }}
            className="custom-scrollbar"
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>⚖️</span>
                  <h2 style={{
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18,
                    color: '#1A1A2E', margin: 0,
                  }}>
                    835 Reconciliation Engine
                  </h2>
                </div>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.5)', margin: 0 }}>
                  Upload both files to cross-reference payments against claims at the procedure level.
                </p>
              </div>
              <button
                onClick={() => !isReconciling && setIsOpen(false)}
                disabled={isReconciling}
                style={{
                  background: 'none', border: 'none', cursor: isReconciling ? 'not-allowed' : 'pointer',
                  padding: 4, borderRadius: 6, flexShrink: 0,
                  color: 'rgba(26,26,46,0.4)', fontSize: 18,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B6B' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(26,26,46,0.4)' }}
              >
                ✕
              </button>
            </div>

            {/* Existing 837 hint */}
            {parseResult && status837 === 'idle' && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(78,205,196,0.08)',
                border: '1.5px solid rgba(78,205,196,0.3)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.7)', margin: 0 }}>
                  You already have an 837 file loaded in the workspace. You can upload that same file here or use a different one.
                </p>
              </div>
            )}

            {/* Dual dropzones */}
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <FileDropZone
                label="Step 1 — 837 Claim File"
                accept837={true}
                status={status837}
                fileName={name837}
                errorMsg={err837}
                onFile={handle837}
              />
              <FileDropZone
                label="Step 2 — 835 Remittance File"
                accept837={false}
                status={status835}
                fileName={name835}
                errorMsg={err835}
                onFile={handle835}
              />
            </div>

            {/* Status row */}
            {(status837 !== 'idle' || status835 !== 'idle') && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: '837 Claim', status: status837, accent: '#4ECDC4' },
                  { label: '835 Remittance', status: status835, accent: '#FFE66D' },
                ].map((s) => (
                  <div key={s.label} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: s.status === 'ok'
                      ? `${s.accent}22`
                      : s.status === 'error'
                      ? 'rgba(255,107,107,0.1)'
                      : 'rgba(26,26,46,0.05)',
                    border: `1px solid ${s.status === 'ok' ? s.accent : s.status === 'error' ? '#FF6B6B' : 'rgba(26,26,46,0.1)'}`,
                  }}>
                    <span style={{ fontSize: 10 }}>
                      {s.status === 'ok' ? '✓' : s.status === 'error' ? '✕' : s.status === 'loading' ? '⟳' : '·'}
                    </span>
                    <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(26,26,46,0.7)' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Reconcile error */}
            {reconcileError && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(255,107,107,0.08)',
                border: '1.5px solid rgba(255,107,107,0.35)',
                borderRadius: 8,
                fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B',
              }}>
                <strong>Reconciliation Error:</strong> {reconcileError}
              </div>
            )}

            {/* Action footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4, borderTop: '1.5px solid rgba(26,26,46,0.08)' }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic', margin: 0 }}>
                Both files must be successfully parsed before running.
              </p>
              <button
                id="run-reconciliation-btn"
                onClick={runReconciliation}
                disabled={!canRun}
                style={{
                  background: canRun ? '#FFE66D' : 'rgba(26,26,46,0.08)',
                  color: canRun ? '#1A1A2E' : 'rgba(26,26,46,0.3)',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14,
                  border: canRun ? '2.5px solid #1A1A2E' : '2.5px solid rgba(26,26,46,0.15)',
                  borderRadius: 10, padding: '10px 24px',
                  cursor: canRun ? 'pointer' : 'not-allowed',
                  boxShadow: canRun ? '3px 3px 0 rgba(26,26,46,0.2)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 8,
                  flexShrink: 0,
                }}
                onMouseDown={(e) => { if (canRun) { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 rgba(26,26,46,0.2)' }}}
                onMouseUp={(e) => { if (canRun) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 rgba(26,26,46,0.2)' }}}
              >
                {isReconciling ? (
                  <>
                    <div className="doodle-spinner" style={{ width: 16, height: 16 }} />
                    Running…
                  </>
                ) : (
                  <>⚖️ Run Reconciliation</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
