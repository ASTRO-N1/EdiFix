import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import CenterTabBar from './CenterTabBar'
import FormEditorView from './FormEditorView'

// ── Tab content: Raw EDI ─────────────────────────────────────────────────────

function RawEDIContent() {
  const parseResult = useAppStore((s) => s.parseResult)
  const ediFile = useAppStore((s) => s.ediFile)
  const setEdiFile = useAppStore((s) => s.setEdiFile)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const setTransactionType = useAppStore((s) => s.setTransactionType)
  const setError = useAppStore((s) => s.setError)
  const isSubmitting = useAppStore((s) => s.isSubmitting)
  const setIsSubmitting = useAppStore((s) => s.setIsSubmitting)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const session = useAppStore((s) => s.session)

  const [rawText, setRawText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [genError, setGenError] = useState<string | null>(null)

  // When this tab mounts or parseResult changes, regenerate EDI from the current tree
  useEffect(() => {
    let cancelled = false

    async function regenerate() {
      setIsLoading(true)
      setGenError(null)

      if (parseResult) {
        try {
          const tree = (parseResult as any).data || parseResult
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

          const response = await fetch(`${apiUrl}/api/v1/generate/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tree),
          })

          if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.detail || 'Failed to generate EDI')
          }

          const data = await response.json()

          if (data.status === 'success' && data.edi_string) {
            if (!cancelled) {
              setRawText(data.edi_string.replace(/~/g, '~\n'))
            }
          } else {
            throw new Error(data.detail || 'Generator returned empty output')
          }
        } catch (err: any) {
          if (!cancelled) {
            setGenError(err.message)
            await fallbackToFile()
          }
        }
      } else {
        await fallbackToFile()
      }

      if (!cancelled) setIsLoading(false)
    }

    async function fallbackToFile() {
      if (ediFile?.file && typeof ediFile.file.text === 'function') {
        try {
          const text = await ediFile.file.text()
          if (!cancelled) setRawText(text)
        } catch {
          if (!cancelled) setRawText('Error reading file content.')
        }
      } else {
        if (!cancelled) setRawText('No raw EDI content available. Please upload a file.')
      }
    }

    regenerate()

    return () => { cancelled = true }
  }, [parseResult, ediFile])

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()

    if (!rawText.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const cleanedText = rawText.replace(/\n/g, '')
      const fileName = ediFile?.fileName || 'edited.edi'
      const newFile = new File([cleanedText], fileName, { type: 'text/plain' })

      const formData = new FormData()
      formData.append('file', newFile)

      const headers: Record<string, string> = {
        'X-Internal-Bypass': 'frontend-ui-secret'
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${API_URL}/api/v1/parse`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || 'Failed to parse the modified EDI file.')
      }

      const data = await response.json()

      // Unwrap the API response envelope
      const innerTree = data.data || data
      setEdiFile(newFile)
      setParseResult(innerTree)
      setTransactionType(innerTree?.metadata?.transaction_type || null)
      setActiveTabId('form')

    } catch (err: any) {
      console.error("Parse Error:", err)
      setError(err.message || 'An error occurred during parsing.')
      alert(err.message || 'An error occurred during parsing.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%' }}>
        <div className="doodle-spinner" style={{ width: 32, height: 32 }} />
        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 13, color: 'rgba(26,26,46,0.5)' }}>
          Regenerating EDI from current state…
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic', margin: 0 }}>
            Raw EDI — Edit the raw X12 text and submit to re-validate.
          </p>
          {genError && (
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 10, fontWeight: 700,
              color: '#FF6B6B', background: 'rgba(255,107,107,0.08)',
              border: '1px solid #FF6B6B', borderRadius: 4, padding: '2px 6px',
            }}>
              ⚠ Showing fallback — {genError}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          style={{
            background: isSubmitting ? 'rgba(26,26,46,0.1)' : '#4ECDC4',
            color: isSubmitting ? 'rgba(26,26,46,0.4)' : '#1A1A2E',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 800,
            fontSize: 13,
            border: isSubmitting ? '2px solid rgba(26,26,46,0.1)' : '2px solid #1A1A2E',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: isSubmitting ? 'none' : '2px 2px 0px rgba(26,26,46,0.3)',
            transition: 'all 0.1s ease',
          }}
          onMouseDown={(e) => {
            if (isSubmitting) return;
            e.currentTarget.style.boxShadow = '0px 0px 0px rgba(26,26,46,0.3)';
            e.currentTarget.style.transform = 'translate(2px, 2px)';
          }}
          onMouseUp={(e) => {
            if (isSubmitting) return;
            e.currentTarget.style.boxShadow = '2px 2px 0px rgba(26,26,46,0.3)';
            e.currentTarget.style.transform = 'translate(0px, 0px)';
          }}
        >
          {isSubmitting ? 'Reparsing...' : 'Submit & Reparse'}
        </button>
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        spellCheck={false}
        className="custom-scrollbar"
        style={{
          flex: 1,
          background: '#1A1A2E',
          color: '#4ECDC4',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          padding: '16px 20px',
          border: '2.5px solid #1A1A2E',
          borderRadius: 10,
          boxShadow: '4px 4px 0px rgba(26,26,46,0.3)',
          resize: 'none',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box'
        }}
      />
    </div>
  )
}

// ── Tab content: Summary ─────────────────────────────────────────────────────

function SummaryContent() {
  const parseResult = useAppStore((s) => s.parseResult)

  if (!parseResult) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.4)' }}>
          No data available. Upload an EDI file.
        </p>
      </div>
    )
  }

  const data = (parseResult as any).data || parseResult
  const metadata = data.metadata || {}
  const loops   = data.loops   || {}
  const txnType = metadata.transaction_type

  // ──────────────────────────────────────────────────────────────────────────
  // 835 — Remittance Summary
  // ──────────────────────────────────────────────────────────────────────────
  if (txnType === '835') {
    // Prefer the pre-built remittance_summary emitted by the parser
    const remit: any[] = (parseResult as any).remittance_summary || data.remittance_summary || []

    // Fallback: reconstruct from raw CLP loop instances if remittance_summary is absent
    const clpInstances: any[] = (() => {
      const raw = loops['835_2100'] || []
      return Array.isArray(raw) ? raw : [raw]
    })()

    // Derive a display-ready record list from whichever source is available
    type ClaimRow = {
      claimId: string
      billed: number
      paid: number
      patResp: number
      checkEft: string
      adjustments: { group: string; reason: string; amount: number }[]
    }

    const rows: ClaimRow[] = remit.length > 0
      ? remit.map((r: any) => ({
          claimId:  String(r.claim_id   ?? 'N/A'),
          billed:   Number(r.billed     ?? 0),
          paid:     Number(r.paid       ?? 0),
          patResp:  Number(r.patient_responsibility ?? r.patient_resp ?? 0),
          checkEft: String(r.check_eft_number ?? r.check_number ?? 'N/A'),
          adjustments: (r.adjustments ?? []).map((a: any) => ({
            group:  String(a.group_code  ?? a.group  ?? ''),
            reason: String(a.reason_code ?? a.reason ?? ''),
            amount: Number(a.amount ?? 0),
          })),
        }))
      : clpInstances
          .filter((inst: any) => inst?.CLP)
          .map((inst: any) => {
            const clp = inst.CLP || {}
            const rd: string[] = clp.raw_data || []
            const casVal = inst.CAS
            const casList = Array.isArray(casVal) ? casVal : (casVal ? [casVal] : [])

            // Extract check/EFT from TRN in the same loop instance or header
            const trnInst = inst.TRN
            const trnRd: string[] = trnInst?.raw_data || []
            const checkEft = trnRd[2] || 'N/A'

            const adjustments = casList.flatMap((c: any) => {
              const crd: string[] = c.raw_data || []
              // CAS raw_data: [CAS, group, reason1, amt1, reason2, amt2, ...]
              const group = crd[1] || ''
              const adjs = []
              for (let i = 2; i + 1 < crd.length; i += 2) {
                if (crd[i]) adjs.push({ group, reason: crd[i], amount: Number(crd[i + 1]) || 0 })
              }
              return adjs
            })

            return {
              claimId:  rd[1] || 'N/A',
              billed:   Number(rd[3]) || 0,
              paid:     Number(rd[4]) || 0,
              patResp:  Number(rd[5]) || 0,
              checkEft,
              adjustments,
            } as ClaimRow
          })

    // ── Aggregate totals ────────────────────────────────────────────────────
    const totalBilled  = rows.reduce((s, r) => s + r.billed,  0)
    const totalPaid    = rows.reduce((s, r) => s + r.paid,    0)
    const totalPatResp = rows.reduce((s, r) => s + r.patResp, 0)

    const fmt = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // ── KPI cards ───────────────────────────────────────────────────────────
    const kpis = [
      { label: 'Total Billed',   value: `$${fmt(totalBilled)}`,  color: '#1A1A2E' },
      { label: 'Total Paid',     value: `$${fmt(totalPaid)}`,    color: '#4ECDC4' },
      { label: 'Pt Resp',        value: `$${fmt(totalPatResp)}`, color: '#FFE66D' },
      { label: 'Claims',         value: String(rows.length),     color: '#1A1A2E' },
    ]

    return (
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Nunito, sans-serif' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#4ECDC4',
            border: '2.5px solid #1A1A2E', boxShadow: '3px 3px 0px rgba(26,26,46,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>💸</div>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#1A1A2E' }}>
              835 Remittance Summary
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>
              {metadata.sender_id ? `Payer: ${metadata.sender_id}` : 'All CLP claim loops'}
              {metadata.control_number ? ` · Control: ${metadata.control_number}` : ''}
            </p>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {kpis.map((k) => (
            <div key={k.label} style={{
              flex: '1 1 130px', minWidth: 120, padding: '14px 16px',
              background: '#FFFFFF', border: '2px solid #1A1A2E', borderRadius: 10,
              boxShadow: '3px 3px 0px rgba(26,26,46,0.15)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(26,26,46,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                {k.label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Claims table ── */}
        {rows.length === 0 ? (
          <div style={{
            padding: '32px 24px', background: '#FFFFFF',
            border: '2px solid rgba(26,26,46,0.1)', borderRadius: 12,
            textAlign: 'center', color: 'rgba(26,26,46,0.4)', fontSize: 13,
          }}>
            No CLP claim loops found in this 835 file.
          </div>
        ) : (
          <div style={{
            background: '#FFFFFF', border: '2px solid #1A1A2E', borderRadius: 12,
            boxShadow: '4px 4px 0px rgba(26,26,46,0.08)', overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1A1A2E' }}>
                    {['Claim ID', 'Billed', 'Paid', 'Pt Resp', 'Check / EFT', 'Adjustments'].map((h) => (
                      <th key={h} style={{
                        padding: '11px 16px', textAlign: 'left', whiteSpace: 'nowrap',
                        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
                        color: '#4ECDC4', letterSpacing: '0.05em', textTransform: 'uppercase',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const adjText = row.adjustments.length > 0
                      ? row.adjustments.map((a) => `${a.group}-${a.reason} $${fmt(a.amount)}`).join(' · ')
                      : '—'
                    const isPaid = row.paid >= row.billed && row.billed > 0
                    const isDenied = row.paid === 0 && row.billed > 0

                    return (
                      <tr key={i} style={{
                        borderTop: '1.5px solid rgba(26,26,46,0.07)',
                        background: i % 2 === 0 ? '#FFFFFF' : 'rgba(78,205,196,0.03)',
                      }}>
                        {/* Claim ID */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                            background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)',
                            borderRadius: 5, padding: '2px 8px', color: '#1A1A2E',
                          }}>{row.claimId}</span>
                        </td>
                        {/* Billed */}
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(26,26,46,0.7)' }}>
                          ${fmt(row.billed)}
                        </td>
                        {/* Paid */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800,
                            color: isDenied ? '#FF6B6B' : isPaid ? '#27AE60' : '#4ECDC4',
                          }}>
                            ${fmt(row.paid)}
                          </span>
                        </td>
                        {/* Patient Responsibility */}
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: row.patResp > 0 ? '#B89000' : 'rgba(26,26,46,0.4)' }}>
                          ${fmt(row.patResp)}
                        </td>
                        {/* Check / EFT */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                            color: 'rgba(26,26,46,0.55)', background: 'rgba(26,26,46,0.05)',
                            padding: '2px 7px', borderRadius: 4,
                          }}>{row.checkEft}</span>
                        </td>
                        {/* Adjustments */}
                        <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(26,26,46,0.55)', maxWidth: 280, wordBreak: 'break-word' }}>
                          {row.adjustments.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {row.adjustments.map((a, ai) => (
                                <span key={ai} style={{
                                  background: a.group === 'CO' ? 'rgba(78,205,196,0.12)' :
                                              a.group === 'PR' ? 'rgba(255,230,109,0.25)' :
                                              a.group === 'OA' ? 'rgba(255,107,107,0.12)' : 'rgba(26,26,46,0.07)',
                                  color: a.group === 'CO' ? '#2B9B93' :
                                         a.group === 'PR' ? '#8A6F00' :
                                         a.group === 'OA' ? '#C0392B' : '#1A1A2E',
                                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                                  padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                                }}>
                                  {a.group}-{a.reason} ${fmt(a.amount)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(26,26,46,0.3)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Totals footer */}
                {rows.length > 1 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(26,26,46,0.04)', borderTop: '2px solid rgba(26,26,46,0.15)' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 800, fontSize: 12, color: 'rgba(26,26,46,0.5)' }}>TOTALS</td>
                      <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>${fmt(totalBilled)}</td>
                      <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#4ECDC4' }}>${fmt(totalPaid)}</td>
                      <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#B89000' }}>${fmt(totalPatResp)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 834 — Member Enrollment Roster  (unchanged logic, polished layout)
  // ──────────────────────────────────────────────────────────────────────────
  if (txnType === '834') {
    const memberLoops: any[] = (() => { const r = loops['834_2000'] || []; return Array.isArray(r) ? r : [r] })()
    const nameLoops:   any[] = (() => { const r = loops['834_2100A'] || []; return Array.isArray(r) ? r : [r] })()

    const MAINT: Record<string, { label: string; bg: string; color: string }> = {
      '021': { label: '021 — Addition',      bg: 'rgba(78,205,196,0.2)',  color: '#2B9B93' },
      '024': { label: '024 — Termination',   bg: 'rgba(255,107,107,0.2)', color: '#C92A2A' },
      '030': { label: '030 — Audit / Active',bg: 'rgba(255,230,109,0.3)', color: '#B89B00' },
      '001': { label: '001 — Change',        bg: 'rgba(26,26,46,0.07)',   color: '#1A1A2E' },
    }

    return (
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#FFE66D',
            border: '2.5px solid #1A1A2E', boxShadow: '3px 3px 0px rgba(26,26,46,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>🧑‍🤝‍🧑</div>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#1A1A2E' }}>834 Member Enrollment Roster</h2>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(26,26,46,0.45)' }}>{memberLoops.length} member{memberLoops.length !== 1 ? 's' : ''} found</p>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '2px solid #1A1A2E', borderRadius: 12, boxShadow: '4px 4px 0px rgba(26,26,46,0.08)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1A1A2E' }}>
                  {['Member ID', 'Name', 'Relationship', 'Maintenance Status'].map((h) => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: '#FFE66D', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberLoops.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'rgba(26,26,46,0.4)' }}>No Members Found</td></tr>
                )}
                {memberLoops.map((loop: any, i: number) => {
                  const ins = loop['INS'] || {}
                  const ref = loop['REF'] || {}
                  const nm1 = nameLoops[i]?.['NM1'] || {}
                  const memberId = ref.REF02 || (ref.raw_data?.[2]) || 'N/A'
                  const first = nm1.NM104 || nm1.raw_data?.[4] || ''
                  const last  = nm1.NM103 || nm1.raw_data?.[3] || ''
                  const name  = `${first} ${last}`.trim() || 'Unknown'
                  const relCode = ins.INS02 || ins.raw_data?.[2] || ''
                  const rel = relCode === '18' ? 'Self' : relCode === '01' ? 'Spouse' : relCode === '19' ? 'Child' : (relCode || 'Dep')
                  const maintCode = ins.INS03 || ins.raw_data?.[3] || '030'
                  const maint = MAINT[maintCode] || { label: maintCode, bg: 'rgba(26,26,46,0.07)', color: '#1A1A2E' }

                  return (
                    <tr key={i} style={{ borderTop: '1.5px solid rgba(26,26,46,0.07)', background: i % 2 === 0 ? '#FFFFFF' : 'rgba(255,230,109,0.03)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>{memberId}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{name}</td>
                      <td style={{ padding: '12px 16px', color: 'rgba(26,26,46,0.65)' }}>{rel}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: maint.bg, color: maint.color, padding: '4px 10px', borderRadius: 6, fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                          {maint.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 837 / Generic fallback
  // ──────────────────────────────────────────────────────────────────────────
  const rows = [
    { label: 'Transaction Type',    value: txnType || 'Unknown' },
    { label: 'Implementation Ref',  value: metadata.implementation_reference || 'N/A' },
    { label: 'Sender ID',           value: metadata.sender_id  || 'N/A' },
    { label: 'Receiver ID',         value: metadata.receiver_id || 'N/A' },
    { label: 'Control Number',      value: metadata.control_number || 'N/A' },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 20, borderRadius: 2, background: '#4ECDC4', flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: 15, color: '#1A1A2E' }}>File Overview</h2>
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', background: '#FFFFFF',
          border: '2px solid rgba(26,26,46,0.12)', borderRadius: 10,
          boxShadow: '3px 3px 0px rgba(26,26,46,0.06)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'rgba(26,26,46,0.55)' }}>{row.label}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Empty / No-file upload placeholder ───────────────────────────────────────

function EmptyDropzone() {
  const processFileInWorkspace = useAppStore((s) => s.processFileInWorkspace)
  const [loading, setLoading] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    await processFileInWorkspace(file)
    setLoading(false)
  }, [processFileInWorkspace])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleFile(files[0]),
    accept: {
      'text/plain': ['.edi', '.txt', '.dat', '.x12'],
      'application/octet-stream': ['.edi', '.dat', '.x12'],
    },
    multiple: false,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 40, gap: 24,
      }}
    >
      <div
        {...getRootProps()}
        style={{
          padding: '48px 64px',
          border: `2.5px dashed ${isDragActive ? '#4ECDC4' : 'rgba(26,26,46,0.2)'}`,
          borderRadius: 16, background: isDragActive ? 'rgba(78,205,196,0.05)' : '#FFFFFF',
          boxShadow: isDragActive ? '4px 4px 0px #4ECDC4' : '4px 4px 0px rgba(26,26,46,0.08)',
          cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease', maxWidth: 480, width: '100%',
        }}
      >
        <input {...getInputProps()} />
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="doodle-spinner" style={{ width: 40, height: 40 }} />
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>Parsing your file…</p>
          </div>
        ) : (
          <>
            <UploadCloud size={44} color="#4ECDC4" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 17, color: '#1A1A2E', marginBottom: 8 }}>
              {isDragActive ? 'Drop it right here! 🎉' : 'Drop your EDI file here'}
            </p>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.45)' }}>
              or click to browse · .edi .txt .dat .x12
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Main EditorArea ───────────────────────────────────────────────────────────

export default function EditorArea() {
  const parseResult = useAppStore((s) => s.parseResult)
  const ediFile = useAppStore((s) => s.ediFile)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const hasFile = !!(parseResult || ediFile.fileName)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FDFAF4', overflow: 'hidden' }}>
      <CenterTabBar />
      <div style={{ flex: 1, overflow: 'auto' }} className="custom-scrollbar">
        {!hasFile ? (
          <EmptyDropzone />
        ) : (
          <>
            {activeTabId === 'form' && <FormEditorView />}
            {activeTabId === 'raw' && <RawEDIContent />}
            {activeTabId === 'summary' && <SummaryContent />}
          </>
        )}
      </div>
    </div>
  )
}