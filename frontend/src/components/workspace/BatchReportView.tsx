import { useState } from 'react'
import { motion } from 'framer-motion'
import JSZip from 'jszip'
import useAppStore from '../../store/useAppStore'

export default function BatchReportView() {
    const batchResults = useAppStore((s) => s.batchResults)
    const processBatchZip = useAppStore((s) => s.processBatchZip)

    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setErrorMsg(null)

        try {
            const zip = new JSZip()
            const contents = await zip.loadAsync(file)
            const unzippedFiles: File[] = []

            for (const [filename, zipEntry] of Object.entries(contents.files)) {
                if (!zipEntry.dir && !filename.startsWith('__MACOSX/')) {
                    const blob = await zipEntry.async('blob')
                    unzippedFiles.push(new File([blob], filename, { type: blob.type }))
                }
            }

            if (unzippedFiles.length === 0) {
                throw new Error("No readable files found in the ZIP archive.")
            }

            await processBatchZip(file, unzippedFiles)

        } catch (err: any) {
            console.error(err)
            setErrorMsg(err.message || 'Failed to extract ZIP file.')
        } finally {
            setLoading(false)
            e.target.value = '' // reset
        }
    }

    const totalFiles = batchResults?.length || 0
    const errorFiles = batchResults?.filter(r => r.status === 'Invalid').length || 0

    return (
        <div style={{ padding: 'clamp(40px, 6vw, 60px)', background: '#FDFAF4', minHeight: '100%', overflowY: 'auto' }} className="custom-scrollbar">

            <div style={{ marginBottom: 40, borderBottom: '2px solid rgba(26,26,46,0.12)', paddingBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, color: '#1A1A2E', fontSize: 'clamp(28px, 4vw, 36px)', margin: '0 0 12px 0' }}>
                        Batch Zip Validation
                    </h1>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {totalFiles > 0 ? (
                            <>
                                <span className="doodle-pill" style={{ borderColor: '#1A1A2E', color: '#1A1A2E' }}>
                                    📦 {totalFiles} Files Processed
                                </span>
                                {errorFiles > 0 && (
                                    <span className="doodle-pill" style={{ borderColor: '#FF6B6B', color: '#FF6B6B', background: '#FFF0F0' }}>
                                        ❌ {errorFiles} Files with Errors
                                    </span>
                                )}
                            </>
                        ) : (
                            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, color: 'rgba(26,26,46,0.5)', margin: 0 }}>
                                Upload a ZIP file containing multiple EDI files to validate them at once.
                            </p>
                        )}
                    </div>
                </div>

                {/* Action / Upload Button */}
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 24px',
                        border: '2.5px solid #1A1A2E',
                        borderRadius: '12px',
                        background: '#4ECDC4',
                        boxShadow: '4px 4px 0px #1A1A2E',
                        cursor: loading ? 'wait' : 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        opacity: loading ? 0.8 : 1
                    }}
                    onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = '6px 6px 0px #1A1A2E'; } }}
                    onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.transform = 'translate(0px, 0px)'; e.currentTarget.style.boxShadow = '4px 4px 0px #1A1A2E'; } }}
                >
                    <input
                        type="file"
                        accept=".zip"
                        style={{ display: 'none' }}
                        onChange={handleZipUpload}
                        disabled={loading}
                    />
                    {loading ? (
                        <div className="doodle-spinner" style={{ width: 20, height: 20, borderTopColor: '#1A1A2E' }} />
                    ) : (
                        <span style={{ fontSize: 20 }}>📦</span>
                    )}
                    <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: '#1A1A2E' }}>
                        {loading ? 'Processing Batch...' : 'Upload New .zip'}
                    </span>
                </label>
            </div>

            {errorMsg && (
                <div style={{ padding: '16px 24px', background: '#FFF0F0', border: '2.5px solid #FF6B6B', borderRadius: 8, marginBottom: 24 }}>
                    <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 15, color: '#FF6B6B', margin: 0, fontWeight: 700 }}>
                        ⚠ {errorMsg}
                    </p>
                </div>
            )}

            {!batchResults || batchResults.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', border: '3px dashed rgba(26,26,46,0.15)', borderRadius: 20 }}>
                    <span style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🗂️</span>
                    <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: 'rgba(26,26,46,0.5)', fontSize: 18 }}>
                        No batch data loaded. Drop a .zip file above!
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {batchResults.map((result, i) => {
                        const isError = result.status === 'Invalid'
                        const rotationAngle = i % 2 === 0 ? '-0.3deg' : '0.3deg'

                        return (
                            <motion.div
                                key={result.fileName + i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5) }}
                                viewport={{ once: true, margin: '-20px' }}
                                whileHover={{
                                    y: -2,
                                    boxShadow: isError ? '6px 6px 0px #FF6B6B' : '6px 6px 0px #1A1A2E'
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '20px 24px',
                                    background: isError ? '#FFF0F0' : '#FFFFFF',
                                    border: `2.5px solid ${isError ? '#FF6B6B' : '#1A1A2E'}`,
                                    borderRadius: '12px',
                                    boxShadow: isError ? '3px 3px 0px #FF6B6B' : '3px 3px 0px #1A1A2E',
                                    transform: `rotate(${rotationAngle})`,
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ fontSize: 24 }}>📄</div>
                                    <div style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontWeight: 600,
                                        color: isError ? '#FF6B6B' : '#1A1A2E',
                                        fontSize: 16
                                    }}>
                                        {result.fileName}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                                    <div style={{
                                        fontFamily: 'Nunito, sans-serif',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        color: isError ? '#FF6B6B' : '#1A1A2E',
                                        background: isError ? '#FFFFFF' : '#4ECDC4',
                                        border: `2.5px solid ${isError ? '#FF6B6B' : '#1A1A2E'}`,
                                        borderRadius: '999px',
                                        padding: '4px 16px',
                                        transform: 'rotate(1deg)'
                                    }}>
                                        {isError ? '❌ Invalid' : '✅ Valid'}
                                    </div>

                                    <div style={{
                                        fontFamily: 'Nunito, sans-serif',
                                        fontWeight: 800,
                                        fontSize: 16,
                                        color: isError ? '#FF6B6B' : 'rgba(26,26,46,0.6)',
                                        minWidth: '90px',
                                        textAlign: 'right'
                                    }}>
                                        {result.errorCount === -1 ? 'Parse Fail' : `${result.errorCount} Error${result.errorCount === 1 ? '' : 's'}`}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}