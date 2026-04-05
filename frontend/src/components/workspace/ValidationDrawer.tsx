import useAppStore from '../../store/useAppStore'
import { useState, useRef } from 'react'

// ── Error → EDI path + form field mapping ─────────────────────────────────────
interface NormalisedError {
  id: number | string
  type: 'error' | 'warning'
  code: string
  element: string
  loop: string
  msg: string
}

/**
 * Comprehensive resolver: maps error → tree path for loop explorer navigation
 */
function resolveTreePath(err: NormalisedError): string {
  const el = (err.element ?? '').toUpperCase()
  const loop = (err.loop ?? '').toUpperCase()

  // ── 837 Loops ──
  if (loop.includes('1000A')) return 'loop_1000A.NM1'
  if (loop.includes('1000B')) return 'loop_1000B.NM1'
  if (loop.includes('2000A')) return 'loop_2000A'
  if (loop.includes('2010AA')) return 'loop_2010AA.NM1'
  if (loop.includes('2010AB')) return 'loop_2010AB.NM1'
  if (loop.includes('2000B')) return 'loop_2000B'
  if (loop.includes('2010BA')) return 'loop_2010BA.NM1'
  if (loop.includes('2010BB')) return 'loop_2010BB.NM1'
  if (loop.includes('2000C')) return 'loop_2000C'
  if (loop.includes('2010CA')) return 'loop_2010CA.NM1'
  if (loop.includes('2300')) return 'loop_2300.CLM'
  if (loop.includes('2310A')) return 'loop_2310A.NM1'
  if (loop.includes('2310B')) return 'loop_2310B.NM1'
  if (loop.includes('2320')) return 'loop_2320.SBR'
  if (loop.includes('2400')) return 'loop_2400[0].SV1'

  // ── 835 Loops ──
  if (loop.includes('835_HEADER')) return '835_HEADER.BPR'
  if (loop.includes('835_1000A')) return '835_1000A.N1'
  if (loop.includes('835_1000B')) return '835_1000B.N1'
  if (loop.includes('835_2100')) return '835_2100.CLP'
  if (loop.includes('835_2110')) return '835_2110.SVC'

  // ── 834 Loops ──
  if (loop.includes('834_HEADER')) return '834_HEADER.BGN'
  if (loop.includes('834_1000A')) return '834_1000A.N1'
  if (loop.includes('834_1000B')) return '834_1000B.N1'
  if (loop.includes('834_1000C')) return '834_1000C.N1'
  if (loop.includes('834_2000')) return '834_2000.INS'
  if (loop.includes('834_2100A')) return '834_2100A.NM1'
  if (loop.includes('834_2300')) return '834_2300.HD'
  if (loop.includes('834_2320')) return '834_2320.COB'

  // Fallback: use segment from error
  if (el.startsWith('NM1')) return 'loop_2010AA.NM1'
  if (el.startsWith('CLM')) return 'loop_2300.CLM'
  if (el.startsWith('SV')) return 'loop_2400[0].SV1'
  if (el.startsWith('BPR')) return '835_HEADER.BPR'
  if (el.startsWith('CLP')) return '835_2100.CLP'
  if (el.startsWith('SVC')) return '835_2110.SVC'
  if (el.startsWith('INS')) return '834_2000.INS'
  if (el.startsWith('HD')) return '834_2300.HD'

  return 'loop_2300'
}

/**
 * Comprehensive resolver: maps error → form field ID for input highlighting
 */
function resolveFormField(err: NormalisedError): string {
  const el = (err.element ?? '').toUpperCase()
  const loop = (err.loop ?? '').toUpperCase()
  const code = (err.code ?? '').toLowerCase()
  const msg = (err.msg ?? '').toLowerCase()

  // ── 837 Field Mappings ──
  // Submitter (1000A)
  if (loop.includes('1000A')) {
    if (el.includes('NM103') || msg.includes('submitter name')) return 'dyn-1000A-NM1-NM1_03'
    if (el.includes('NM109') || msg.includes('submitter id')) return 'dyn-1000A-NM1-NM1_09'
    if (el.includes('PER02')) return 'dyn-1000A-PER-PER_02'
    if (el.includes('PER04')) return 'dyn-1000A-PER-PER_04'
  }

  // Receiver (1000B)
  if (loop.includes('1000B')) {
    if (el.includes('NM103') || msg.includes('receiver name')) return 'dyn-1000B-NM1-NM1_03'
    if (el.includes('NM109') || msg.includes('receiver id')) return 'dyn-1000B-NM1-NM1_09'
  }

  // Billing Provider (2010AA)
  if (loop.includes('2010AA') || code.includes('npi') || msg.includes('billing provider')) {
    if (el.includes('NM103') || msg.includes('billing name')) return 'dyn-2010AA-NM1-NM1_03'
    if (el.includes('NM109') || code.includes('npi')) return 'dyn-2010AA-NM1-NM1_09'
    if (el.includes('N301') || msg.includes('address')) return 'dyn-2010AA-N3-N3_01'
    if (el.includes('N401') || msg.includes('city')) return 'dyn-2010AA-N4-N4_01'
    if (el.includes('N402') || msg.includes('state')) return 'dyn-2010AA-N4-N4_02'
    if (el.includes('N403') || msg.includes('zip')) return 'dyn-2010AA-N4-N4_03'
    if (el.includes('REF02') || msg.includes('tax id') || msg.includes('ein')) return 'dyn-2010AA-REF-REF_02'
  }

  // Subscriber (2010BA)
  if (loop.includes('2010BA') || loop.includes('2000B')) {
    if (el.includes('NM103') || msg.includes('subscriber last')) return 'dyn-2010BA-NM1-NM1_03'
    if (el.includes('NM104') || msg.includes('subscriber first')) return 'dyn-2010BA-NM1-NM1_04'
    if (el.includes('NM109') || msg.includes('member id') || msg.includes('subscriber id')) return 'dyn-2010BA-NM1-NM1_09'
    if (el.includes('DMG02') || msg.includes('dob') || msg.includes('date of birth')) return 'dyn-2010BA-DMG-DMG_02'
    if (el.includes('DMG03') || msg.includes('gender')) return 'dyn-2010BA-DMG-DMG_03'
    if (el.includes('N301')) return 'dyn-2010BA-N3-N3_01'
    if (el.includes('N401')) return 'dyn-2010BA-N4-N4_01'
    if (el.includes('N402')) return 'dyn-2010BA-N4-N4_02'
    if (el.includes('N403')) return 'dyn-2010BA-N4-N4_03'
  }

  // Payer (2010BB)
  if (loop.includes('2010BB')) {
    if (el.includes('NM103')) return 'dyn-2010BB-NM1-NM1_03'
    if (el.includes('NM109')) return 'dyn-2010BB-NM1-NM1_09'
  }

  // Patient (2010CA)
  if (loop.includes('2010CA')) {
    if (el.includes('NM103')) return 'dyn-2010CA-NM1-NM1_03'
    if (el.includes('NM104')) return 'dyn-2010CA-NM1-NM1_04'
    if (el.includes('DMG02')) return 'dyn-2010CA-DMG-DMG_02'
    if (el.includes('DMG03')) return 'dyn-2010CA-DMG-DMG_03'
  }

  // Claim (2300)
  if (loop.includes('2300') || el.startsWith('CLM') || el.startsWith('HI') || (el.startsWith('DTP') && !loop.includes('2400'))) {
    if (el.includes('CLM01') || msg.includes('patient control') || msg.includes('claim id')) return 'dyn-2300-CLM-CLM_01'
    if (el.includes('CLM02') || msg.includes('charge amount') || msg.includes('total claim')) return 'dyn-2300-CLM-CLM_02'
    if (el.includes('CLM05')) return 'dyn-2300-CLM-CLM_05'
    if (el.includes('HI01') || msg.includes('diagnosis') || msg.includes('icd')) return 'dyn-2300-HI-HI_01'
    if (el.includes('DTP03') || msg.includes('service date')) return 'dyn-2300-DTP-DTP_03'
  }

  // Service Line (2400)
  if (loop.includes('2400') || el.startsWith('SV1') || el.startsWith('SV2') || el.startsWith('LX')) {
    if (el.includes('LX01')) return 'dyn-2400-LX-LX_01-g0'
    if (el.includes('SV101') || msg.includes('procedure code')) return 'dyn-2400-SV1-SV1_01-g0'
    if (el.includes('SV102') || msg.includes('line charge')) return 'dyn-2400-SV1-SV1_02-g0'
    if (el.includes('SV103')) return 'dyn-2400-SV1-SV1_03-g0'
    if (el.includes('SV104')) return 'dyn-2400-SV1-SV1_04-g0'
    if (el.includes('DTP03')) return 'dyn-2400-DTP-DTP_03-g0'
  }

  // ── 835 Field Mappings ──
  if (loop.includes('835_HEADER') || el.startsWith('BPR') || el.startsWith('TRN')) {
    if (el.includes('BPR02') || msg.includes('payment amount')) return 'dyn-835_HEADER-BPR-BPR_02'
    if (el.includes('BPR16') || msg.includes('payment date')) return 'dyn-835_HEADER-BPR-BPR_16'
    if (el.includes('TRN02') || msg.includes('check number') || msg.includes('trace')) return 'dyn-835_HEADER-TRN-TRN_02'
  }

  if (loop.includes('835_1000A')) {
    if (el.includes('N102') || msg.includes('payer name')) return 'dyn-835_1000A-N1-N1_02'
    if (el.includes('N104') || msg.includes('payer id')) return 'dyn-835_1000A-N1-N1_04'
  }

  if (loop.includes('835_1000B')) {
    if (el.includes('N102') || msg.includes('payee name')) return 'dyn-835_1000B-N1-N1_02'
    if (el.includes('N104') || msg.includes('payee id')) return 'dyn-835_1000B-N1-N1_04'
  }

  if (loop.includes('835_2100') || el.startsWith('CLP')) {
    if (el.includes('CLP01') || msg.includes('claim id')) return 'dyn-835_2100-CLP-CLP_01-g0'
    if (el.includes('CLP02') || msg.includes('status code')) return 'dyn-835_2100-CLP-CLP_02-g0'
    if (el.includes('CLP03') || msg.includes('billed')) return 'dyn-835_2100-CLP-CLP_03-g0'
    if (el.includes('CLP04') || msg.includes('paid')) return 'dyn-835_2100-CLP-CLP_04-g0'
    if (el.includes('CLP05') || msg.includes('patient responsibility')) return 'dyn-835_2100-CLP-CLP_05-g0'
  }

  if (loop.includes('835_2110') || el.startsWith('SVC') || el.startsWith('CAS')) {
    if (el.includes('SVC01') || msg.includes('procedure')) return 'dyn-835_2110-SVC-SVC_01-g0'
    if (el.includes('SVC02') || msg.includes('submitted')) return 'dyn-835_2110-SVC-SVC_02-g0'
    if (el.includes('SVC03')) return 'dyn-835_2110-SVC-SVC_03-g0'
    if (el.includes('CAS02') || msg.includes('carc') || msg.includes('reason code')) return 'dyn-835_2110-CAS-CAS_02-g0'
    if (el.includes('CAS03') || msg.includes('adjustment amount')) return 'dyn-835_2110-CAS-CAS_03-g0'
  }

  // ── 834 Field Mappings ──
  if (loop.includes('834_HEADER') || el.startsWith('BGN')) {
    if (el.includes('BGN01') || msg.includes('purpose code')) return 'dyn-834_HEADER-BGN-BGN_01'
    if (el.includes('BGN02') || msg.includes('reference')) return 'dyn-834_HEADER-BGN-BGN_02'
    if (el.includes('BGN03') || msg.includes('date')) return 'dyn-834_HEADER-BGN-BGN_03'
  }

  if (loop.includes('834_1000A')) {
    if (el.includes('N102') || msg.includes('sponsor name') || msg.includes('employer')) return 'dyn-834_1000A-N1-N1_02'
    if (el.includes('N104')) return 'dyn-834_1000A-N1-N1_04'
  }

  if (loop.includes('834_1000B')) {
    if (el.includes('N102') || msg.includes('payer name') || msg.includes('carrier')) return 'dyn-834_1000B-N1-N1_02'
    if (el.includes('N104')) return 'dyn-834_1000B-N1-N1_04'
  }

  if (loop.includes('834_2000') || el.startsWith('INS')) {
    if (el.includes('INS01') || msg.includes('subscriber indicator')) return 'dyn-834_2000-INS-INS_01-g0'
    if (el.includes('INS02') || msg.includes('relationship')) return 'dyn-834_2000-INS-INS_02-g0'
    if (el.includes('INS03') || msg.includes('maintenance type')) return 'dyn-834_2000-INS-INS_03-g0'
    if (el.includes('INS04') || msg.includes('maintenance reason')) return 'dyn-834_2000-INS-INS_04-g0'
    if (el.includes('INS05') || msg.includes('benefit status')) return 'dyn-834_2000-INS-INS_05-g0'
    if (el.includes('REF02') || msg.includes('member id')) return 'dyn-834_2000-REF-REF_02-g0'
    if (el.includes('DTP03') || msg.includes('effective date')) return 'dyn-834_2000-DTP-DTP_03-g0'
  }

  if (loop.includes('834_2100A')) {
    if (el.includes('NM103') || msg.includes('last name')) return 'dyn-834_2100A-NM1-NM1_03-g0'
    if (el.includes('NM104') || msg.includes('first name')) return 'dyn-834_2100A-NM1-NM1_04-g0'
    if (el.includes('N301') || msg.includes('address')) return 'dyn-834_2100A-N3-N3_01-g0'
    if (el.includes('N401') || msg.includes('city')) return 'dyn-834_2100A-N4-N4_01-g0'
    if (el.includes('N402') || msg.includes('state')) return 'dyn-834_2100A-N4-N4_02-g0'
    if (el.includes('N403') || msg.includes('zip')) return 'dyn-834_2100A-N4-N4_03-g0'
    if (el.includes('DMG02') || msg.includes('dob')) return 'dyn-834_2100A-DMG-DMG_02-g0'
    if (el.includes('DMG03') || msg.includes('gender')) return 'dyn-834_2100A-DMG-DMG_03-g0'
  }

  if (loop.includes('834_2300') || el.startsWith('HD')) {
    if (el.includes('HD01') || msg.includes('maintenance type')) return 'dyn-834_2300-HD-HD_01-g0'
    if (el.includes('HD03') || msg.includes('insurance line')) return 'dyn-834_2300-HD-HD_03-g0'
    if (el.includes('HD04') || msg.includes('plan description')) return 'dyn-834_2300-HD-HD_04-g0'
    if (el.includes('HD05') || msg.includes('coverage level')) return 'dyn-834_2300-HD-HD_05-g0'
    if (el.includes('DTP03') || msg.includes('coverage date')) return 'dyn-834_2300-DTP-DTP_03-g0'
  }

  if (loop.includes('834_2320') || el.startsWith('COB')) {
    if (el.includes('COB01') || msg.includes('payer responsibility')) return 'dyn-834_2320-COB-COB_01-g0'
    if (el.includes('COB02')) return 'dyn-834_2320-COB-COB_02-g0'
    if (el.includes('COB03') || msg.includes('cob code')) return 'dyn-834_2320-COB-COB_03-g0'
  }

  // Fallback logic by segment prefix
  if (el.startsWith('NM109')) return 'dyn-2010AA-NM1-NM1_09'
  if (el.startsWith('CLM02')) return 'dyn-2300-CLM-CLM_02'
  if (el.startsWith('CLM01')) return 'dyn-2300-CLM-CLM_01'
  if (el.startsWith('HI')) return 'dyn-2300-HI-HI_01'
  if (el.startsWith('SV101')) return 'dyn-2400-SV1-SV1_01-g0'
  if (el.startsWith('SV102')) return 'dyn-2400-SV1-SV1_02-g0'
  if (el.startsWith('DTP03') && loop.includes('2300')) return 'dyn-2300-DTP-DTP_03'
  if (el.startsWith('DTP03') && loop.includes('2400')) return 'dyn-2400-DTP-DTP_03-g0'
  if (el.startsWith('BPR02')) return 'dyn-835_HEADER-BPR-BPR_02'
  if (el.startsWith('CLP01')) return 'dyn-835_2100-CLP-CLP_01-g0'
  if (el.startsWith('SVC01')) return 'dyn-835_2110-SVC-SVC_01-g0'
  if (el.startsWith('INS')) return 'dyn-834_2000-INS-INS_01-g0'
  if (el.startsWith('HD')) return 'dyn-834_2300-HD-HD_03-g0'

  return 'dyn-2300-CLM-CLM_01'
}

function normaliseErrors(errs: unknown[], warns: unknown[]): NormalisedError[] {
  const normE = errs.map((e: any, i) => ({
    id: `e-${e.id ?? i}`,
    type: 'error' as const,
    code: e.code ?? e.error_code ?? e.type ?? 'ValidationError',
    element: e.element ?? e.field ?? e.segment ?? '',
    loop: e.loop ?? e.loop_id ?? e.location ?? '',
    msg: e.message ?? e.msg ?? e.description ?? 'Validation error.',
  }))
  const normW = warns.map((e: any, i) => ({
    id: `w-${e.id ?? i}`,
    type: 'warning' as const,
    code: e.code ?? e.error_code ?? e.type ?? 'Warning',
    element: e.element ?? e.field ?? e.segment ?? '',
    loop: e.loop ?? e.loop_id ?? e.location ?? '',
    msg: e.message ?? e.msg ?? e.description ?? 'Validation warning.',
  }))
  return [...normE, ...normW]
}

const PLACEHOLDER_ERRORS: NormalisedError[] = [
  { id: 1, type: 'error', code: 'InvalidNPI', element: 'NM109', loop: '2010AA', msg: 'Billing Provider NPI is missing or invalid format (must be 10 digits).' },
  { id: 2, type: 'warning', code: 'AmountMismatch', element: 'CLM02', loop: '2300', msg: 'Total claim charge amount does not equal sum of service lines (SV102).' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ValidationDrawer() {
  const parseResult = useAppStore((s) => s.parseResult)
  const ediFile = useAppStore((s) => s.ediFile)
  const setSelectedPath = useAppStore((s) => s.setSelectedPath)
  const setFocusFieldId = useAppStore((s) => s.setFocusFieldId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const [isMinimized, setIsMinimized] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState(220)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(220)

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) return
    dragStartY.current = e.clientY
    dragStartHeight.current = expandedHeight
    setIsDragging(true)
    e.preventDefault()

    const onMouseMove = (ev: MouseEvent) => {
      const delta = dragStartY.current - ev.clientY
      const newHeight = Math.max(80, Math.min(600, dragStartHeight.current + delta))
      setExpandedHeight(newHeight)
    }
    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const hasFile = !!(parseResult || ediFile.fileName)

  const errors: NormalisedError[] = (() => {
    if (!parseResult) return PLACEHOLDER_ERRORS
    const root = parseResult as Record<string, any>
    const nested = root.data || {}
    const e = root.errors ?? nested.errors ?? []
    const w = root.warnings ?? nested.warnings ?? []

    if (e.length === 0 && w.length === 0) return []
    return normaliseErrors(e, w)
  })()

  const errorCount = errors.filter((e) => e.type === 'error').length
  const warningCount = errors.filter((e) => e.type === 'warning').length

  const handleErrorClick = (err: NormalisedError) => {
    const treePath = resolveTreePath(err)
    const fieldId = resolveFormField(err)
    
    console.log('Error clicked:', { err, treePath, fieldId })
    
    setSelectedPath(treePath)
    setFocusFieldId(fieldId)
    setActiveTabId('form')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#FDFAF4',
        overflow: 'hidden',
        flexShrink: 0,
        height: isMinimized ? 44 : expandedHeight,
        transition: isDragging ? 'none' : 'height 0.3s ease-in-out',
      }}
    >
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          height: 5,
          flexShrink: 0,
          cursor: isMinimized ? 'default' : 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid rgba(26,26,46,0.1)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => {
          if (!isMinimized) e.currentTarget.style.background = 'rgba(78,205,196,0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
        }}
      />
      {/* Drawer Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FF6B6B',
        borderBottom: '2.5px solid #1A1A2E',
        padding: '6px 16px',
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: 8, marginTop: -2 }}>
          <path d="M8 1L15 14H1L8 1Z" stroke="#1A1A2E" strokeWidth="2" strokeLinejoin="round" />
          <line x1="8" y1="6" x2="8" y2="10" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="12.5" r="1" fill="#1A1A2E" />
        </svg>
        <span style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 800,
          fontSize: 12,
          color: '#1A1A2E',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Validation Problems
        </span>

        {hasFile && (
          <span style={{
            marginLeft: 10,
            fontFamily: 'Nunito, sans-serif',
            fontSize: 10,
            color: 'rgba(26,26,46,0.55)',
            fontStyle: 'italic',
            fontWeight: 600,
          }}>
            · click any error to navigate
          </span>
        )}

        <div style={{ flex: 1 }} />
        <button
          onClick={() => setIsMinimized(v => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            transition: 'transform 0.3s ease',
            transform: isMinimized ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }} className="custom-scrollbar">
        {!hasFile ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'Nunito, sans-serif',
            fontSize: 12,
            color: 'rgba(26,26,46,0.3)',
            fontStyle: 'italic',
          }}>
            No validation data. Upload a file to see errors.
          </div>
        ) : errors.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'Nunito, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: '#4ECDC4',
          }}>
            ✨ All checks passed. No errors or warnings found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {errors.map((err) => (
              <button
                key={err.id}
                onClick={() => handleErrorClick(err)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '8px 12px',
                  background: '#FFFFFF',
                  border: '1.5px solid rgba(26,26,46,0.1)',
                  borderRadius: 6,
                  boxShadow: '1px 1px 0px rgba(26,26,46,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.1s, box-shadow 0.1s, transform 0.1s',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(78,205,196,0.07)'
                  e.currentTarget.style.boxShadow = '2px 2px 0px rgba(78,205,196,0.3)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF'
                  e.currentTarget.style.boxShadow = '1px 1px 0px rgba(26,26,46,0.05)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>
                  {err.type === 'error' ? '🔴' : '🟡'}
                </span>

                <div style={{ minWidth: 110, flexShrink: 0 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1A1A2E',
                  }}>
                    {err.code}
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: 'rgba(26,26,46,0.45)',
                  }}>
                    {err.loop ? `Loop ${err.loop}` : '—'} · {err.element || '—'}
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 13,
                  color: 'rgba(26,26,46,0.7)',
                  lineHeight: 1.4,
                }}>
                  {err.msg}
                </div>

                <div style={{ flexShrink: 0, opacity: 0.35 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="#1A1A2E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{
        padding: '4px 16px',
        background: '#FFFFFF',
        borderTop: '1px solid rgba(26,26,46,0.1)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: 'rgba(26,26,46,0.5)',
        display: 'flex',
        gap: 16,
      }}>
        {hasFile && (
          <>
            <span>🔴 {errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
            <span>🟡 {warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
    </div>
  )
}