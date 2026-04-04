import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import type { HistoryItem } from '../../store/useAppStore'

type ExportFormat = 'edi' | 'txt'
type SourceOption = 'current' | string  // 'current' or a history item ID

export default function ExportPage() {
  const parseResult = useAppStore((s) => s.parseResult)
  const ediFile = useAppStore((s) => s.ediFile)
  const historyItems = useAppStore((s) => s.historyItems)
  const fetchHistory = useAppStore((s) => s.fetchHistory)
  const session = useAppStore((s) => s.session)

  const [selectedSource, setSelectedSource] = useState<SourceOption>(parseResult ? 'current' : '')
  const [format, setFormat] = useState<ExportFormat>('edi')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Fetch history on mount if logged in
  useEffect(() => {
    if (session) fetchHistory()
  }, [session, fetchHistory])

  // Get the JSON tree for the selected source
  const getSelectedTree = useCallback((): { tree: Record<string, unknown>; fileName: string } | null => {
    if (selectedSource === 'current') {
      if (!parseResult) return null
      // The parse result may have the tree nested under 'data'
      const tree = (parseResult as any).data || parseResult
      return { tree, fileName: ediFile.fileName || 'export' }
    }
    // Find from history
    const item = historyItems.find((h: HistoryItem) => h.id === selectedSource)
    if (!item) return null
    const tree = (item.parse_result as any).data || item.parse_result
    return { tree, fileName: item.file_name || 'export' }
  }, [selectedSource, parseResult, ediFile.fileName, historyItems])

  const handleExport = useCallback(async () => {
    setExportError(null)
    setExportSuccess(false)

    const selected = getSelectedTree()
    if (!selected) {
      setExportError('Please select a source to export.')
      return
    }

    setIsExporting(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app'

      const response = await fetch(`${apiUrl}/api/v1/generate/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected.tree),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || 'Generation failed')
      }

      const data = await response.json()

      if (data.status !== 'success' || !data.edi_string) {
        throw new Error(data.detail || 'Generator returned no EDI string')
      }

      // Build the download
      const ext = format === 'edi' ? '.edi' : '.txt'
      const baseName = selected.fileName.replace(/\.[^/.]+$/, '')  // strip existing extension
      const downloadName = `${baseName}_export${ext}`

      const blob = new Blob([data.edi_string], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err: any) {
      setExportError(err.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [getSelectedTree, format])

  const hasCurrentFile = !!parseResult
  const hasHistory = historyItems.length > 0
  const hasSelection = selectedSource !== ''

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: 40,
      background: '#FDFAF4',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ maxWidth: 520, width: '100%' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12, transform: 'rotate(-4deg)', display: 'inline-block' }}>📦</div>
          <h1 style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 900,
            fontSize: 'clamp(28px, 4vw, 40px)', color: '#1A1A2E',
            marginBottom: 8, lineHeight: 1.1,
          }}>
            Export EDI
          </h1>
          <p style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 400,
            fontSize: 15, color: 'rgba(26,26,46,0.55)', lineHeight: 1.6,
          }}>
            Generate a clean X12 EDI file from your parsed data.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#FFFFFF', border: '2.5px solid #1A1A2E',
          borderRadius: 16, padding: 32,
          boxShadow: '4px 4px 0px #1A1A2E',
        }}>
          {/* Source Selector */}
          <label style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 800,
            fontSize: 13, color: '#1A1A2E', letterSpacing: '0.04em',
            textTransform: 'uppercase', display: 'block', marginBottom: 8,
          }}>
            Source
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px',
              fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 14,
              color: '#1A1A2E', background: '#FFFFFF',
              border: '2px solid rgba(26,26,46,0.12)', borderRadius: 10,
              outline: 'none', cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%231A1A2E' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#4ECDC4'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(26,26,46,0.12)'}
          >
            <option value="" disabled>Select a workspace...</option>
            {hasCurrentFile && (
              <option value="current">
                📄 Current — {ediFile.fileName || 'Untitled'}
              </option>
            )}
            {hasHistory && (
              <optgroup label="Saved Workspaces">
                {historyItems.map((item: HistoryItem) => (
                  <option key={item.id} value={item.id}>
                    {item.file_name} — {item.transaction_type || item.file_type} — {new Date(item.created_at).toLocaleDateString()}
                  </option>
                ))}
              </optgroup>
            )}
            {!hasCurrentFile && !hasHistory && (
              <option value="" disabled>No workspaces available</option>
            )}
          </select>

          {/* Format Selector */}
          <label style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 800,
            fontSize: 13, color: '#1A1A2E', letterSpacing: '0.04em',
            textTransform: 'uppercase', display: 'block',
            marginTop: 24, marginBottom: 10,
          }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['edi', 'txt'] as ExportFormat[]).map((f) => {
              const isActive = format === f
              return (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    flex: 1, padding: '12px 0',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14,
                    color: isActive ? '#1A1A2E' : 'rgba(26,26,46,0.45)',
                    background: isActive ? '#FFE66D' : '#FFFFFF',
                    border: `2px solid ${isActive ? '#1A1A2E' : 'rgba(26,26,46,0.12)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    boxShadow: isActive ? '2px 2px 0px #1A1A2E' : 'none',
                    transition: 'all 0.15s ease',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}
                >
                  .{f}
                </button>
              )
            })}
          </div>

          {/* Error / Success messages */}
          {exportError && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(255,107,107,0.08)', border: '1.5px solid #FF6B6B',
              borderRadius: 8, fontFamily: 'Nunito, sans-serif', fontWeight: 600,
              fontSize: 13, color: '#FF6B6B',
            }}>
              ⚠️ {exportError}
            </div>
          )}

          {exportSuccess && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(78,205,196,0.08)', border: '1.5px solid #4ECDC4',
              borderRadius: 8, fontFamily: 'Nunito, sans-serif', fontWeight: 600,
              fontSize: 13, color: '#1A1A2E',
            }}>
              ✅ File exported successfully!
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={!hasSelection || isExporting}
            style={{
              width: '100%', marginTop: 24, padding: '14px 0',
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16,
              color: (!hasSelection || isExporting) ? 'rgba(26,26,46,0.35)' : '#1A1A2E',
              background: (!hasSelection || isExporting) ? 'rgba(26,26,46,0.06)' : '#4ECDC4',
              border: `2.5px solid ${(!hasSelection || isExporting) ? 'rgba(26,26,46,0.12)' : '#1A1A2E'}`,
              borderRadius: 12, cursor: (!hasSelection || isExporting) ? 'not-allowed' : 'pointer',
              boxShadow: (!hasSelection || isExporting) ? 'none' : '3px 3px 0px #1A1A2E',
              transition: 'all 0.15s ease',
              letterSpacing: '0.03em',
            }}
            onMouseEnter={(e) => {
              if (hasSelection && !isExporting) {
                e.currentTarget.style.transform = 'translate(-1px, -1px)'
                e.currentTarget.style.boxShadow = '5px 5px 0px #1A1A2E'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(0, 0)'
              e.currentTarget.style.boxShadow = hasSelection && !isExporting ? '3px 3px 0px #1A1A2E' : 'none'
            }}
          >
            {isExporting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div className="doodle-spinner" style={{ width: 18, height: 18 }} />
                Generating...
              </span>
            ) : (
              `Export as .${format}`
            )}
          </button>
        </div>

        {/* Footer hint */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          fontSize: 11, color: 'rgba(26,26,46,0.35)',
        }}>
          Generates a valid X12 EDI string from your parsed JSON tree
        </p>
      </motion.div>
    </div>
  )
}