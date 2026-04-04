import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import useAppStore from '../../../store/useAppStore'
import { useTheme } from '../../../theme/ThemeContext'

const MonoPill = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTheme()
  return (
    <span style={{
      background: t.bgHighlight,
      padding: '3px 8px',
      borderRadius: 6,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12,
      color: t.ink,
      display: 'inline-block',
    }}>
      {children}
    </span>
  )
}

const Row = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => {
  const { t } = useTheme()
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: `1px dashed ${t.borderDash}`,
    }}>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 13, color: t.inkMuted }}>{label}</span>
      {mono ? (
        <MonoPill>{value ?? '--'}</MonoPill>
      ) : (
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: t.ink }}>
          {(value as string) ?? '--'}
        </span>
      )}
    </div>
  )
}

// ── Helpers (mirror FormEditorView logic) ─────────────────────────────────

function getNestedVal(seg: any, ...fieldKeys: string[]): string {
  if (!seg) return ''
  for (const fk of fieldKeys) {
    if (seg[fk] != null && seg[fk] !== '') return String(seg[fk])
    // numeric suffix fallback e.g. "NM103" → look for key ending in "_03"
    const suffixMatch = fk.match(/\d{2}$/)
    if (suffixMatch) {
      const suffix = `_${suffixMatch[0]}`
      for (const k of Object.keys(seg)) {
        if (k.endsWith(suffix) && seg[k] != null && seg[k] !== '') {
          return Array.isArray(seg[k]) ? seg[k].join(':') : String(seg[k])
        }
      }
    }
  }
  if (seg.raw_data && Array.isArray(seg.raw_data)) {
    for (const fk of fieldKeys) {
      const match = fk.match(/0*(\d+)$/)
      if (match) {
        const idx = parseInt(match[1], 10)
        if (seg.raw_data[idx] != null && seg.raw_data[idx] !== '') return String(seg.raw_data[idx])
      }
    }
  }
  return ''
}

function findLoopData(rootData: any, ...keys: string[]): any {
  if (!rootData) return null
  // Try rootData.data?.loops, then rootData.loops, then rootData.data, then rootData
  const ediData = rootData.data?.loops || rootData.loops || rootData.data || rootData
  for (const k of keys) {
    if (ediData[k]) return ediData[k]
  }
  return null
}

function findSegData(loop: any, ...segKeys: string[]): any {
  if (!loop) return null
  const loopArr = Array.isArray(loop) ? loop : [loop]
  for (const segKey of segKeys) {
    for (const item of loopArr) {
      if (item && typeof item === 'object' && item[segKey]) {
        const seg = item[segKey]
        return Array.isArray(seg) ? seg[0] : seg
      }
    }
  }
  return null
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ClaimCard() {
  const { parseResult } = useAppStore()
  const { t, isDark } = useTheme()
  const roughRef = useRef<SVGSVGElement>(null)
  const underlineRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const root = parseResult as Record<string, any> | null

  // Metadata may live at root level OR inside root.data
  const metadata: Record<string, any> =
    (root?.metadata ?? root?.data?.metadata ?? {}) as Record<string, any>

  // ISA header fields
  const controlNumber = String(metadata?.control_number ?? metadata?.isa_control_number ?? '').trim() || '--'
  const rawIsaDate    = String(metadata?.isa_date ?? '').trim()
  const isaDate = rawIsaDate.length === 6
    ? `20${rawIsaDate.slice(0,2)}-${rawIsaDate.slice(2,4)}-${rawIsaDate.slice(4,6)}`
    : rawIsaDate.length === 8
      ? `${rawIsaDate.slice(0,4)}-${rawIsaDate.slice(4,6)}-${rawIsaDate.slice(6,8)}`
      : rawIsaDate || '--'
  const rawIsaTime = String(metadata?.isa_time ?? '').trim()
  const isaTime = rawIsaTime.length === 4
    ? `${rawIsaTime.slice(0,2)}:${rawIsaTime.slice(2,4)}`
    : rawIsaTime || '--'

  // GS group control / sender / receiver
  const functionalGroups = String(metadata?.gs_control ?? metadata?.group_control_number ?? '').trim() || '--'

  const l1000A = findLoopData(root, '1000A', 'loop_1000A')
  const nm1_1000A = findSegData(l1000A, 'NM1')
  const submitterId = getNestedVal(nm1_1000A, 'NM109', 'id', 'submitter_id', 'NM1_09')

  const l1000B = findLoopData(root, '1000B', 'loop_1000B')
  const nm1_1000B = findSegData(l1000B, 'NM1')
  const receiverNm1Id = getNestedVal(nm1_1000B, 'NM109', 'id', 'receiver_id', 'NM1_09')

  const isaSender = String(metadata?.sender_id ?? metadata?.isa_sender_id ?? '').trim()
  const isaReceiver = String(metadata?.receiver_id ?? metadata?.isa_receiver_id ?? '').trim()

  const senderId = submitterId || isaSender || '--'
  const receiverId = receiverNm1Id || isaReceiver || '--'

  // Transaction type — probe root.transaction_type, root.data.transaction_type, metadata.transaction_type
  const txType = String(
    root?.transaction_type ??
    (root?.data as any)?.transaction_type ??
    metadata?.transaction_type ??
    '--'
  )
  const TX_DESC: Record<string, string> = {
    '837': 'Professional Claim',
    '835': 'Payment Remittance',
    '834': 'Benefit Enrollment',
    '820': 'Payment Order',
    '270': 'Eligibility Inquiry',
    '271': 'Eligibility Response',
  }
  const description = TX_DESC[txType] ?? 'EDI Transaction'

  // ── Claim / patient info — use same findLoop/findSeg pattern as FormEditorView ──
  const l2300   = findLoopData(root, '2300', 'loop_2300')
  const clmSeg  = findSegData(l2300, 'CLM')
  const dtpSeg  = findSegData(l2300, 'DTP')

  const claimAmount   = getNestedVal(clmSeg, 'CLM02', 'TotalClaimChargeAmount_02', 'total_charge', 'amount', 'CLM_02')
  const claimId       = getNestedVal(clmSeg, 'CLM01', 'claim_id', 'control_number', 'CLM_01')
  const serviceDate   = getNestedVal(dtpSeg, 'DTP03', 'service_date', 'date')

  const l2010BA  = findLoopData(root, '2010BA', 'loop_2010BA')
  const nm1Sub   = findSegData(l2010BA, 'NM1')
  const patientName = (() => {
    const last  = getNestedVal(nm1Sub, 'NM103', 'Lastname_03', 'last_name', 'NM1_03')
    const first = getNestedVal(nm1Sub, 'NM104', 'Firstname_04', 'first_name', 'NM1_04')
    if (last || first) return [first, last].filter(Boolean).join(' ')
    return ''
  })()

  // Diagnosis count from HI segment in loop 2300
  const hiSeg   = findSegData(l2300, 'HI')
  const diagCount = hiSeg ? Object.keys(hiSeg).filter(k => !k.startsWith('raw') && (k.startsWith('HI') || k.includes('02'))).length : 0

  useEffect(() => {
    if (!roughRef.current || !containerRef.current) return
    const container = containerRef.current
    const draw = () => {
      if (!roughRef.current) return
      const svg = roughRef.current
      svg.innerHTML = ''
      const rc = rough.svg(svg)
      const w = container.offsetWidth
      const h = container.offsetHeight
      if (!w || !h) return
      svg.setAttribute('width', String(w))
      svg.setAttribute('height', String(h))
      svg.appendChild(rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: isDark ? 1.2 : 1.8,
        strokeWidth: isDark ? 1.5 : 2,
        stroke: isDark ? 'rgba(240,235,225,0.35)' : t.roughStroke,
        fill: 'none',
      }))
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [isDark, t.roughStroke])

  useEffect(() => {
    if (!underlineRef.current) return
    const svg = underlineRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    svg.appendChild(rc.line(0, 3, 120, 3, { roughness: 2, strokeWidth: 2.5, stroke: t.teal }))
  }, [t.teal])

  return (
    <div
      ref={containerRef}
      style={{
        background: t.bgCard,
        borderRadius: 14,
        padding: '20px 24px',
        boxShadow: `4px 4px 0px ${t.shadow}`,
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'background 0.2s ease',
      }}
    >
      <svg ref={roughRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: t.ink }}>
          📋 Claim Details
        </div>
        <svg ref={underlineRef} width={130} height={8} style={{ display: 'block', marginTop: 2 }} />
      </div>

      <Row label="Transaction Type" value={txType} mono />
      <Row label="Description" value={description} />
      <Row label="ISA Control Number" value={controlNumber} mono />
      <Row label="Date" value={isaDate} />
      <Row label="Time" value={isaTime} />
      <Row label="Functional Groups" value={functionalGroups} />
      <Row label="Sender ID" value={senderId} mono />
      <Row label="Receiver ID" value={receiverId} mono />
      {claimId && <Row label="Patient Control No." value={claimId} mono />}
      {claimAmount && <Row label="Claim Amount ($)" value={claimAmount} />}
      {serviceDate && <Row label="Service Date" value={serviceDate} />}
      {patientName && <Row label="Patient Name" value={patientName} />}
      {diagCount > 0 && (
        <Row label="Diagnosis Codes" value={`${diagCount} code(s)`} />
      )}
    </div>
  )
}
