import { useCallback, useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { ChevronDown, FileText } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

const ALLOWED_EXTENSIONS = ['.edi', '.txt', '.dat', '.x12', '.zip']

const SAMPLE_FILES = [
  {
    label: '834 — Benefit Enrollment',
    description: 'X12 005010X220A1 · 4 members',
    filename: '834-sample.txt',
    badge: '834',
    badgeColor: '#4ECDC4',
  },
  {
    label: '835 — Remittance Advice',
    description: 'X12 005010X221A1 · 3 claims',
    filename: '835-sample.txt',
    badge: '835',
    badgeColor: '#FFE66D',
  },
  {
    label: '837 — Professional Claim',
    description: 'X12 005010X222A1 · Out-of-network',
    filename: '837-sample.edi',
    badge: '837',
    badgeColor: '#FF6B6B',
  },
]

function extensionValidator(file: File) {
    const name = file.name.toLowerCase()
    const isValid = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
    if (!isValid) return { code: 'file-invalid-type', message: 'Only EDI files are supported (.edi .txt .dat .x12 .zip)' }
    return null
}

export default function WorkspaceWelcome() {
    const setEdiFile = useAppStore((s) => s.setEdiFile)
    const setFile = useAppStore((s) => s.setFile)
    const setLoading = useAppStore((s) => s.setLoading)
    const setParseResult = useAppStore((s) => s.setParseResult)
    const setTransactionType = useAppStore((s) => s.setTransactionType)
    const setError = useAppStore((s) => s.setError)
    const setActiveMainView = useAppStore((s) => s.setActiveMainView)
    const hasSeenWalkthrough = useAppStore((s) => s.hasSeenWalkthrough)
    const walkthroughStep = useAppStore((s) => s.walkthroughStep)
    const setWalkthroughStep = useAppStore((s) => s.setWalkthroughStep)

    const [isProcessing, setIsProcessing] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [loadingSample, setLoadingSample] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Auto-start walkthrough for first-time visitors
    useEffect(() => {
        if (!hasSeenWalkthrough && !walkthroughStep) {
            const timer = setTimeout(() => setWalkthroughStep('welcome-greeting'), 800)
            return () => clearTimeout(timer)
        }
    }, [hasSeenWalkthrough, walkthroughStep, setWalkthroughStep])

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        if (dropdownOpen) document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [dropdownOpen])

    const handleFile = useCallback(async (file: File) => {
        setIsProcessing(true)
        setLoading(true)

        setEdiFile(file)
        setFile(file)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app'
            const response = await fetch(`${apiUrl}/api/v1/parse`, {
                method: 'POST',
                headers: { 'X-Internal-Bypass': 'frontend-ui-secret' },
                body: formData,
            })

            if (!response.ok) throw new Error('Failed to parse EDI file. Backend might be down.')

            const data = await response.json()

            const innerTree = data.data || data
            const type =
                innerTree?.metadata?.transaction_type ||
                data.transaction_type ||
                'EDI File'

            setParseResult(innerTree)
            setTransactionType(type)

            if (walkthroughStep === 'upload-file') {
                setWalkthroughStep('overview-proceed')
            }

            setActiveMainView('dashboard')

        } catch (err: any) {
            setError(err.message || 'An error occurred during parsing')
        } finally {
            setIsProcessing(false)
            setLoading(false)
        }
    }, [setEdiFile, setFile, setActiveMainView, setLoading, setParseResult, setTransactionType, setError, walkthroughStep, setWalkthroughStep])

    const handleSampleClick = async (sample: typeof SAMPLE_FILES[number]) => {
        setDropdownOpen(false)
        setLoadingSample(sample.badge)
        try {
            const res = await fetch(`/samples/${sample.filename}`)
            if (!res.ok) throw new Error('Sample not found')
            const blob = await res.blob()
            const file = new File([blob], sample.filename, { type: 'text/plain' })
            await handleFile(file)
        } catch {
            setError(`Could not load sample file: ${sample.filename}`)
        } finally {
            setLoadingSample(null)
        }
    }

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        onDrop: (accepted) => accepted[0] && handleFile(accepted[0]),
        validator: extensionValidator,
        multiple: false,
    })

    const rejectionError = fileRejections[0]?.errors[0]?.message ?? null

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', padding: '40px', background: '#FDFAF4',
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}
            >
                <h1 data-tour="welcome-heading" style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(32px, 5vw, 48px)', color: '#1A1A2E', marginBottom: '24px', lineHeight: 1.2 }}>
                    Welcome to your{' '}
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ color: '#FF6B6B' }}>Workspace</span>
                        <svg viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"
                            style={{ position: 'absolute', left: 0, bottom: -8, width: '100%', height: 10, overflow: 'visible' }}>
                            <path d="M2,6 C18,1 36,10 52,5 C68,0 86,9 102,4 C118,0 136,9 152,5 C168,1 186,9 198,5"
                                fill="none" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                </h1>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: '16px', color: 'rgba(26,26,46,0.6)', marginBottom: '48px', lineHeight: 1.6 }}>
                    Drop your X12 EDI file below to instantly validate segments, identify errors, and generate your interactive dashboard.
                </p>

                <div
                    data-tour="upload-dropzone"
                    {...getRootProps()}
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '60px 24px',
                        background: isDragActive ? '#F0FFF4' : rejectionError ? '#FFF5F5' : '#FFFFFF',
                        border: `2.5px dashed ${rejectionError ? '#FF6B6B' : '#4ECDC4'}`,
                        borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s ease',
                        transform: isDragActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: '4px 4px 0px #1A1A2E',
                    }}
                >
                    <input {...getInputProps()} />

                    {isProcessing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div className="doodle-spinner" />
                            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 16, color: '#1A1A2E' }}>
                                {loadingSample ? `Parsing ${loadingSample} sample…` : 'Parsing your file...'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: '48px', marginBottom: '16px', transform: 'rotate(-8deg)' }}>📄</div>
                            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '20px', color: rejectionError ? '#FF6B6B' : '#1A1A2E', marginBottom: '8px' }}>
                                {isDragActive ? 'Drop it here!' : 'Drop your EDI file here'}
                            </h2>
                            {rejectionError ? (
                                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: '14px', color: '#FF6B6B' }}>
                                    ⚠️ {rejectionError}
                                </p>
                            ) : (
                                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: '14px', color: 'rgba(26,26,46,0.6)' }}>
                                    or click to browse from your computer
                                </p>
                            )}

                            <div style={{ marginTop: '24px' }}>
                                <span style={{
                                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '11px',
                                    background: '#FFE66D', border: '1.5px solid #1A1A2E', borderRadius: '4px',
                                    padding: '4px 10px', transform: 'rotate(1deg)', display: 'inline-block', color: '#1A1A2E'
                                }}>
                                    Supports 837P, 837I, 835, 834
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Sample Files Dropdown ── */}
                <div
                    ref={dropdownRef}
                    style={{ position: 'relative', marginTop: 20, display: 'flex', justifyContent: 'center' }}
                >
                    <button
                        type="button"
                        id="workspace-sample-files-trigger"
                        onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o) }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 20px',
                            background: '#FFFFFF',
                            border: '2px solid #1A1A2E',
                            borderRadius: 10,
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: 700,
                            fontSize: 14,
                            color: '#1A1A2E',
                            cursor: 'pointer',
                            boxShadow: dropdownOpen ? '2px 2px 0px #1A1A2E' : '4px 4px 0px #1A1A2E',
                            transform: dropdownOpen ? 'translate(2px, 2px)' : 'translate(0,0)',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                        }}
                    >
                        <FileText size={16} color="#4ECDC4" />
                        Try a Sample File
                        <ChevronDown
                            size={16}
                            color="#1A1A2E"
                            style={{
                                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                            }}
                        />
                    </button>

                    {dropdownOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#FFFFFF',
                                border: '2px solid #1A1A2E',
                                borderRadius: 12,
                                boxShadow: '5px 5px 0px #1A1A2E',
                                zIndex: 999,
                                minWidth: 280,
                                overflow: 'hidden',
                                animation: 'fadeSlideDown 0.15s ease',
                            }}
                        >
                            <div style={{ padding: '9px 14px 6px', borderBottom: '1.5px solid rgba(26,26,46,0.1)' }}>
                                <p style={{
                                    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
                                    color: 'rgba(26,26,46,0.45)', textTransform: 'uppercase',
                                    letterSpacing: '0.06em', margin: 0,
                                }}>
                                    Sample EDI Files — click to parse instantly
                                </p>
                            </div>
                            {SAMPLE_FILES.map((s) => (
                                <button
                                    key={s.badge}
                                    id={`workspace-sample-${s.badge.toLowerCase()}`}
                                    type="button"
                                    onClick={() => handleSampleClick(s)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid rgba(26,26,46,0.06)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.12s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FDFAF4')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 42,
                                            height: 28,
                                            background: s.badgeColor,
                                            border: '1.5px solid #1A1A2E',
                                            borderRadius: 6,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            color: '#1A1A2E',
                                        }}
                                    >
                                        {s.badge}
                                    </span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>
                                            {s.label}
                                        </span>
                                        <span style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: 12, color: 'rgba(26,26,46,0.5)' }}>
                                            {s.description}
                                        </span>
                                    </span>
                                    {loadingSample === s.badge ? (
                                        <div className="doodle-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                            <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="rgba(26,26,46,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}