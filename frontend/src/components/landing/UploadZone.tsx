import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import JSZip from 'jszip'
import useAppStore from '../../store/useAppStore'
import { SittingStickFigure } from './StickFigure'

const SAMPLE_FILES = [
  { label: '837P Sample', type: '837p' },
  { label: '837I Sample', type: '837i' },
  { label: '835 Sample', type: '835' },
  { label: '834 Sample', type: '834' },
]

const ALLOWED_EXTENSIONS = ['.edi', '.txt', '.dat', '.x12', '.zip']

function extensionValidator(file: File) {
  const name = file.name.toLowerCase()
  const isValid = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  if (!isValid) {
    return {
      code: 'file-invalid-type',
      message: 'Only EDI files are supported (.edi .txt .dat .x12 .zip)',
    }
  }
  return null
}

export default function UploadZone() {
  const navigate = useNavigate()

  const session = useAppStore((s) => s.session)
  const setEdiFile = useAppStore((s) => s.setEdiFile)
  const setFile = useAppStore((s) => s.setFile)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const setTransactionType = useAppStore((s) => s.setTransactionType)
  const setError = useAppStore((s) => s.setError)
  const setActiveMainView = useAppStore((s) => s.setActiveMainView)
  const processBatchZip = useAppStore((s) => s.processBatchZip)

  const [loading, setLoading] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)

      // ── Handle Zip Files (Batch Processing) ──
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = new JSZip()
          const contents = await zip.loadAsync(file)
          const unzippedFiles: File[] = []

          // Extract files, skipping directories and Mac metadata
          for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (!zipEntry.dir && !filename.startsWith('__MACOSX/')) {
              const blob = await zipEntry.async('blob')
              unzippedFiles.push(new File([blob], filename, { type: blob.type }))
            }
          }

          if (unzippedFiles.length === 0) {
            throw new Error("No usable files found in the ZIP archive.")
          }

          await processBatchZip(file, unzippedFiles)
          navigate('/workspace')

        } catch (err: any) {
          setError(err.message || 'An error occurred extracting the ZIP.')
        } finally {
          setLoading(false)
        }
        return
      }

      // ── Handle Single Files ──
      setEdiFile(file)
      setFile(file)

      if (session) {
        try {
          const formData = new FormData()
          formData.append('file', file)

          const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app';
          const response = await fetch(`${apiUrl}/api/v1/parse`, {
            method: 'POST',
            headers: { 'X-Internal-Bypass': 'frontend-ui-secret' },
            body: formData,
          })

          if (!response.ok) {
            throw new Error('Failed to parse EDI file. Backend might be down.')
          }

          const data = await response.json()

          // Unpack the data wrapper securely
          const innerTree = data.parsed_data || data.data || data
          setParseResult(innerTree)

          const type = innerTree.transaction_type ||
            innerTree.metadata?.transaction_type ||
            data.file_info?.transaction_type ||
            "EDI File";
          setTransactionType(type);

          setActiveMainView('dashboard')
          navigate('/workspace')
        } catch (err: any) {
          setError(err.message || 'An error occurred during parsing')
          setActiveMainView('dashboard')
          navigate('/workspace')
        } finally {
          setLoading(false)
        }
      } else {
        setTimeout(() => {
          navigate('/processing')
        }, 300)
      }
    },
    [session, setEdiFile, setFile, setParseResult, setTransactionType, setActiveMainView, setError, navigate, processBatchZip]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: (accepted) => accepted[0] && handleFile(accepted[0]),
    validator: extensionValidator,
    multiple: false,
  })

  const rejectionError = fileRejections[0]?.errors[0]?.message ?? null

  const handleSampleClick = async (type: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/samples/${type}.edi`)
      if (!res.ok) throw new Error('Sample not found')
      const blob = await res.blob()
      const file = new File([blob], `${type}-sample.edi`, { type: 'text/plain' })
      handleFile(file)
    } catch {
      const placeholder = new File(['ISA*00*...'], `${type}-sample.edi`, { type: 'text/plain' })
      handleFile(placeholder)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'end', marginBottom: -75, top: -58, left: -85, position: 'relative', zIndex: 2 }}>
        <SittingStickFigure size={75} />
      </div>

      <div
        {...getRootProps()}
        className={`upload-zone${isDragActive ? ' drag-over' : ''}${rejectionError ? ' upload-zone-error' : ''}`}
        style={{
          padding: '40px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
          borderColor: rejectionError ? '#FF6B6B' : '#4ECDC4',
          borderWidth: isDragActive ? 3 : 2.5,
          borderStyle: 'dashed',
          borderRadius: 16,
          background: isDragActive ? '#F0FFF4' : rejectionError ? '#FFF5F5' : '#FFFFFF',
          transform: isDragActive ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s ease',
        }}
      >
        <input {...getInputProps()} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="doodle-spinner" />
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 16, color: '#1A1A2E' }}>
              Reading your file…
            </p>
          </div>
        ) : (
          <>
            <UploadCloud
              size={48}
              color={rejectionError ? '#FF6B6B' : '#4ECDC4'}
              style={{ margin: '0 auto 12px' }}
            />
            <p
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 600,
                fontSize: 16,
                color: rejectionError ? '#FF6B6B' : '#1A1A2E',
                marginBottom: 6,
              }}
            >
              {isDragActive ? 'Drop it here! 🎉' : 'Tap or drag your EDI file here'}
            </p>
            {rejectionError ? (
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 13, color: '#FF6B6B' }}>
                ⚠️ {rejectionError}
              </p>
            ) : (
              <p
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 400,
                  fontSize: 13,
                  color: 'rgba(26,26,46,0.5)',
                }}
              >
                .edi · .txt · .dat · .x12 · .zip
              </p>
            )}
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 14,
          justifyContent: 'center',
        }}
      >
        {SAMPLE_FILES.map((s) => (
          <button
            key={s.type}
            className="doodle-pill"
            onClick={() => handleSampleClick(s.type)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}