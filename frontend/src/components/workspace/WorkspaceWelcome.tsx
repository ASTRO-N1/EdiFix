import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

const ALLOWED_EXTENSIONS = ['.edi', '.txt', '.dat', '.x12', '.zip']

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

    // Auto-start walkthrough for first-time visitors
    useEffect(() => {
        if (!hasSeenWalkthrough && !walkthroughStep) {
            const timer = setTimeout(() => setWalkthroughStep('welcome-greeting'), 800)
            return () => clearTimeout(timer)
        }
    }, [hasSeenWalkthrough, walkthroughStep, setWalkthroughStep])

    const handleFile = useCallback(async (file: File) => {
        setIsProcessing(true)
        setLoading(true)

        // Save to store immediately
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

            // data = { status, filename, data: { metadata, loops, errors, ... } }
            const innerTree = data.data || data
            const type =
                innerTree?.metadata?.transaction_type ||
                data.transaction_type ||
                'EDI File'

            setParseResult(innerTree)
            setTransactionType(type)

            // Advance walkthrough to overview step if active
            if (walkthroughStep === 'upload-file') {
                setWalkthroughStep('overview-proceed')
            }

            // Redirect to dashboard instead of editor
            setActiveMainView('dashboard')

        } catch (err: any) {
            setError(err.message || 'An error occurred during parsing')
        } finally {
            setIsProcessing(false)
            setLoading(false)
        }
    }, [setEdiFile, setFile, setActiveMainView, setLoading, setParseResult, setTransactionType, setError, walkthroughStep, setWalkthroughStep])

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
                                Parsing your file...
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
            </motion.div>
        </div>
    )
}