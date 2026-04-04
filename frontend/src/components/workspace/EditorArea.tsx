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
      <div style={{ padding: 24 }}>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)' }}>
          No data available. Upload an EDI file.
        </p>
      </div>
    )
  }

  const data = (parseResult as any).data || parseResult
  const metadata = data.metadata || {}
  const loops = data.loops || {}
  const txnType = metadata.transaction_type

  if (txnType === '835') {
    const clpLoops = loops['835_2100'] || []
    const headerLoop = loops['835_HEADER']?.[0] || {}
    const trn = headerLoop['TRN'] || data.envelope?.TRN
    const checkNumber = trn?.TRN02 || 'N/A'

    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, margin: 0, color: '#1A1A2E' }}>
          835 Remittance Summary
        </h3>
        <div style={{ overflowX: 'auto', background: '#FFFFFF', border: '2px solid rgba(26,26,46,0.12)', borderRadius: 10, boxShadow: '3px 3px 0px rgba(26,26,46,0.06)' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: 13, textAlign: 'left' }}>
            <thead style={{ background: '#1A1A2E', color: '#4ECDC4' }}>
              <tr>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Claim ID</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Billed</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Paid</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Pt Resp</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Check/EFT</th>
                <th style={{ padding: '12px 16px' }}>Adj Reasons</th>
              </tr>
            </thead>
            <tbody>
              {clpLoops.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' }}>No Claims Found</td></tr>
              )}
              {clpLoops.map((loop: any, i: number) => {
                const clp = loop['CLP'] || {}
                const cas = loop['CAS']
                const casList = Array.isArray(cas) ? cas : (cas ? [cas] : [])
                const adjs = casList.map((c: any) => `${c.CAS01 || ''}:${c.CAS02 || ''}`).filter(Boolean).join(', ') || 'None'

                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(26,26,46,0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{clp.CLP01 || 'Unknown'}</td>
                    <td style={{ padding: '12px 16px' }}>${parseFloat(clp.CLP03 || '0').toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', color: '#4ECDC4', fontWeight: 800 }}>${parseFloat(clp.CLP04 || '0').toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>${parseFloat(clp.CLP05 || '0').toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>{checkNumber}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(26,26,46,0.6)' }}>{adjs}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (txnType === '834') {
    const memberLoops = loops['834_2000'] || []
    const nameLoops = loops['834_2100A'] || []

    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, margin: 0, color: '#1A1A2E' }}>
          834 Member Enrollment Roster
        </h3>
        <div style={{ overflowX: 'auto', background: '#FFFFFF', border: '2px solid rgba(26,26,46,0.12)', borderRadius: 10, boxShadow: '3px 3px 0px rgba(26,26,46,0.06)' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: 13, textAlign: 'left' }}>
            <thead style={{ background: '#1A1A2E', color: '#FFE66D' }}>
              <tr>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Member ID</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Rel</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status / Maintenance</th>
              </tr>
            </thead>
            <tbody>
              {memberLoops.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center' }}>No Members Found</td></tr>
              )}
              {memberLoops.map((loop: any, i: number) => {
                const ins = loop['INS'] || {}
                const ref = loop['REF'] || {}
                const nm1 = nameLoops[i]?.['NM1'] || {}

                const memberId = ref.REF02 || 'N/A'
                const name = `${nm1.NM104 || ''} ${nm1.NM103 || ''}`.trim() || 'Unknown'
                const rel = ins.INS02 === '18' ? 'Self' : (ins.INS02 || 'Dep')
                const maintCode = ins.INS03 || '030'

                let maintColor = '#1A1A2E'
                let bg = '#EEEEEE'
                let label = maintCode
                if (maintCode === '021') { bg = 'rgba(78,205,196,0.2)'; maintColor = '#2B9B93'; label = '021 - Addition' }
                if (maintCode === '024') { bg = 'rgba(255,107,107,0.2)'; maintColor = '#C92A2A'; label = '024 - Termination' }
                if (maintCode === '030') { bg = 'rgba(255,230,109,0.3)'; maintColor = '#B89B00'; label = '030 - Audit/Active' }
                if (maintCode === '001') { bg = '#E0F7FA'; maintColor = '#006064'; label = '001 - Change' }

                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(26,26,46,0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{memberId}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{name}</td>
                    <td style={{ padding: '12px 16px' }}>{rel}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: bg, color: maintColor, padding: '4px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic' }}>
        File Overview Summary
      </p>
      {[
        { label: 'Transaction Type', value: txnType || 'Unknown' },
        { label: 'Implementation Ref', value: metadata.implementation_reference || 'N/A' },
        { label: 'Sender ID', value: metadata.sender_id || 'N/A' },
        { label: 'Receiver ID', value: metadata.receiver_id || 'N/A' },
      ].map((row) => (
        <div key={row.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: '#FFFFFF',
          border: '2px solid rgba(26,26,46,0.12)', borderRadius: 10,
          boxShadow: '3px 3px 0px rgba(26,26,46,0.06)',
        }}>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: 'rgba(26,26,46,0.55)' }}>{row.label}</span>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#1A1A2E' }}>{row.value}</span>
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