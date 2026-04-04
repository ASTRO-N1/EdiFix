import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ValidationError {
  element?: string
  field?: string
  message?: string
  msg?: string
  code?: string
  type?: 'error' | 'warning'
  loop?: string
}

interface FieldDef {
  id: string
  label: string
  hint?: string
  mono?: boolean
  keys: string[]
  loopName: string
  errorKeys?: string[]
  aiPrompt?: string
  span?: number
}

interface SegmentDef {
  segKeys: string[]
  fields: FieldDef[]
}

interface SectionDef {
  id: string
  title: string
  icon: string
  rotate?: number
  loopKeys: string[]
  segments: SegmentDef[]
  repeatable?: boolean
}

// ── EDI data accessor helpers ─────────────────────────────────────────────────

function findLoop(rootData: any, ...keys: string[]): any {
  if (!rootData) return null
  const ediData = rootData.data?.loops || rootData.loops || rootData.data || rootData
  if (!ediData) return null
  for (const k of keys) { if (ediData[k]) return ediData[k] }
  return null
}

function findSegment(loop: any, ...segKeys: string[]): any {
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

function getVal(seg: any, ...fieldKeys: string[]): string {
  if (!seg) return ''
  const keys = Object.keys(seg)
  for (const fk of fieldKeys) {
    if (seg[fk] != null && seg[fk] !== '') return String(seg[fk])
    const suffixMatch = fk.match(/\d{2}$/)
    if (suffixMatch) {
      const suffix = `_${suffixMatch[0]}`
      for (const k of keys) {
        if (k.endsWith(suffix) && seg[k] != null && seg[k] !== '') {
          if (Array.isArray(seg[k])) return seg[k].join(':')
          return String(seg[k])
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

function getErrors(errors: ValidationError[], targetLoop: string, ...elementKeys: string[]): ValidationError[] {
  return errors.filter((e) => {
    if (e.loop && !e.loop.toUpperCase().startsWith(targetLoop.toUpperCase())) return false
    const el = (e.element ?? e.field ?? '').toUpperCase()
    const typ = (e.type ?? '').toUpperCase()
    return elementKeys.some((k) => el.includes(k.toUpperCase()) || typ.includes(k.toUpperCase()))
  })
}

function isFieldActive(activePath: string | null, targetLoop: string, ...elementKeys: string[]): boolean {
  if (!activePath) return false
  const path = activePath.toUpperCase()
  if (!path.includes(targetLoop.toUpperCase())) return false
  return elementKeys.some(key => {
    const k = key.toUpperCase().replace('_', '')
    return path.replace(/_/g, '').replace(/\./g, '').endsWith(k)
  })
}

// ── Shared styled input ─────────────────────────────────────────────────────

interface FieldProps {
  id: string; label: string; value: string
  onCommit: (v: string) => void
  errors?: ValidationError[]; isActive?: boolean; mono?: boolean
  hint?: string; onAskAI?: () => void
}

function FormField({ id, label, value, onCommit, errors = [], isActive, mono, hint, onAskAI }: FieldProps) {
  const [localVal, setLocalVal] = useState(value)
  useEffect(() => { setLocalVal(value) }, [value])
  const hasError = errors.length > 0
  const errorMsg = errors[0]?.message ?? errors[0]?.msg ?? ''
  const isDirty = localVal !== value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor={id} style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: hasError ? '#FF6B6B' : 'rgba(26,26,46,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0, maxWidth: '100%' }}>
          {label}
        </label>
        {hasError && !isDirty && (
          <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 9, fontWeight: 800, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)', border: '1.5px solid #FF6B6B', borderRadius: 4, padding: '1px 6px' }}>⚠ ERROR</span>
        )}
        {onAskAI && (
          <button type="button" onClick={onAskAI} style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: 10, background: '#FFE66D', border: '1.5px solid #1A1A2E', borderRadius: 6, boxShadow: '2px 2px 0px #1A1A2E', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 800, color: '#1A1A2E', transform: 'rotate(-0.5deg)' }}>
            ✦ Ask AI to Fix
          </button>
        )}
      </div>
      <input
        id={id} type="text" value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setLocalVal(value); if (e.key === 'Enter' && isDirty) onCommit(localVal) }}
        placeholder={hint ?? `Enter ${label.toLowerCase()}…`}
        style={{
          width: '100%', padding: '9px 13px',
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'Nunito, sans-serif',
          fontSize: mono ? 12 : 13, color: '#1A1A2E',
          background: hasError && !isDirty ? 'rgba(255,107,107,0.04)' : '#FFFFFF',
          border: isDirty ? '2px solid #FFE66D' : hasError ? '2px dashed #FF6B6B' : isActive ? '2px solid #4ECDC4' : '2px solid rgba(26,26,46,0.18)',
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          boxShadow: isDirty ? '0 0 0 3px rgba(255,230,109,0.2), 2px 2px 0px #FFE66D' : hasError ? '3px 3px 0px rgba(255,107,107,0.3)' : isActive ? '0 0 0 3px rgba(78,205,196,0.2), 3px 3px 0px #4ECDC4' : '2px 2px 0px rgba(26,26,46,0.08)',
          outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
        }}
      />
      <AnimatePresence>
        {isDirty && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <button onClick={() => onCommit(localVal)} style={{ padding: '4px 12px', background: '#4ECDC4', border: '2px solid #1A1A2E', color: '#1A1A2E', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, borderRadius: 6, boxShadow: '3px 3px 0px #1A1A2E', cursor: 'pointer' }}>Save Change</button>
            <button onClick={() => setLocalVal(value)} style={{ padding: '4px 8px', background: 'transparent', color: '#1A1A2E', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, border: '2px solid #1A1A2E', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}
      </AnimatePresence>
      {hasError && !isDirty && errorMsg && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: '#FF6B6B', fontWeight: 600, lineHeight: 1.4, paddingLeft: 2, margin: 0 }}>
          {errorMsg}
        </motion.p>
      )}
    </div>
  )
}

// ── Layout Components ─────────────────────────────────────────────────────────

function SectionHeader({ title, icon, rotate = 0, description }: { title: string; icon: string; rotate?: number; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, transform: `rotate(${rotate}deg)`, transformOrigin: 'left center' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#1A1A2E', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>{title}</h2>
          {description && (
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 11, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.02em', fontStyle: 'italic' }}>{description}</span>
          )}
        </div>
        <div style={{ height: 3, width: '100%', background: 'linear-gradient(90deg, #4ECDC4, transparent)', borderRadius: 999, marginTop: 3 }} />
      </div>
    </div>
  )
}

function SectionCard({ children, sectionRef, isHighlighted }: { children: React.ReactNode; sectionRef?: React.RefObject<HTMLDivElement | null>; isHighlighted?: boolean }) {
  return (
    <motion.div
      ref={sectionRef as React.RefObject<HTMLDivElement>}
      animate={isHighlighted ? { boxShadow: ['4px 4px 0px #4ECDC4', '6px 6px 0px #4ECDC4', '4px 4px 0px #4ECDC4'] } : { boxShadow: '4px 4px 0px #1A1A2E' }}
      transition={{ duration: 0.6, repeat: isHighlighted ? 2 : 0 }}
      style={{ background: '#FFFFFF', border: isHighlighted ? '2px solid #4ECDC4' : '2px solid #1A1A2E', borderRadius: 12, padding: '24px 24px 28px', position: 'relative', transition: 'border-color 0.3s' }}
    >
      {children}
    </motion.div>
  )
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px 20px', minWidth: 0 }} className="form-field-grid">
      {children}
    </div>
  )
}

function FormEmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
      <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: '#1A1A2E' }}>No parsed data found.</p>
    </div>
  )
}

// ── Transaction-type badge ────────────────────────────────────────────────────

const TX_META: Record<string, { label: string; color: string; bg: string }> = {
  '837': { label: '837 — Healthcare Claim', color: '#1A1A2E', bg: '#4ECDC4' },
  '835': { label: '835 — Remittance Advice', color: '#1A1A2E', bg: '#FFE66D' },
  '834': { label: '834 — Benefit Enrollment', color: '#FFFFFF', bg: '#6C63FF' },
}

function TxBadge({ type }: { type: string }) {
  const meta = TX_META[type] ?? { label: `${type} — EDI Transaction`, color: '#1A1A2E', bg: 'rgba(26,26,46,0.1)' }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: meta.bg, color: meta.color, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, borderRadius: 20, border: '1.5px solid #1A1A2E', boxShadow: '2px 2px 0px #1A1A2E', letterSpacing: '0.04em', marginBottom: 20 }}>
      <span style={{ fontSize: 13 }}>📄</span> {meta.label}
    </div>
  )
}

// ── Schema definitions per transaction type ───────────────────────────────────

const SCHEMA_837: SectionDef[] = [
  {
    id: 'submitter', title: 'Submitter & Receiver', icon: '📤', rotate: -0.4,
    loopKeys: ['1000A', 'loop_1000A'],
    segments: [
      {
        segKeys: ['NM1'],
        fields: [
          { id: 'submitter-name', label: 'Submitter Name', hint: 'ACME Billing Inc.', keys: ['NM103', 'name', 'submitter_name', 'NM1_03'], loopName: '1000A', errorKeys: ['NM103', 'NM1_03'] },
          { id: 'submitter-id', label: 'Submitter ID', mono: true, hint: '123456789', keys: ['NM109', 'id', 'submitter_id', 'NM1_09'], loopName: '1000A', errorKeys: ['NM109', 'NM1_09'] },
        ],
      },
      {
        segKeys: ['__loop_1000B_NM1__'], // special: resolved from 1000B loop
        fields: [
          { id: 'receiver-name', label: 'Receiver Name', hint: 'BCBS Clearinghouse', keys: ['NM103', 'name', 'receiver_name', 'NM1_03'], loopName: '1000B', errorKeys: ['NM103'] },
          { id: 'receiver-id', label: 'Receiver ID', mono: true, hint: '987654321', keys: ['NM109', 'id', 'receiver_id', 'NM1_09'], loopName: '1000B', errorKeys: ['NM109'] },
        ],
      },
    ],
  },
  {
    id: 'billing', title: 'Billing Provider', icon: '🏥', rotate: 0.3,
    loopKeys: ['2010AA', 'loop_2010AA'],
    segments: [
      {
        segKeys: ['NM1'],
        fields: [
          { id: 'billing-name', label: 'Provider Name', hint: 'Metro Medical Group', keys: ['NM103', 'name', 'provider_name', 'NM1_03'], loopName: '2010A', errorKeys: ['NM103'] },
          { id: 'billing-npi', label: 'NPI (National Provider ID)', mono: true, hint: '1234567890', keys: ['NM109', 'npi', 'NPI', 'NM1_09'], loopName: '2010A', errorKeys: ['NM109', 'NPI', 'InvalidNPI'], aiPrompt: 'The Billing Provider NPI appears to be invalid. Can you validate and suggest a fix?' },
        ],
      },
      {
        segKeys: ['N3'],
        fields: [
          { id: 'billing-address', label: 'Address', hint: '123 Main St', keys: ['N301', 'address', 'address_line'], loopName: '2010A', errorKeys: ['N301'] },
        ],
      },
      {
        segKeys: ['REF'],
        fields: [
          { id: 'billing-taxid', label: 'Tax ID / EIN', mono: true, hint: 'XX-XXXXXXX', keys: ['REF02', 'tax_id', 'ein', 'REF_02'], loopName: '2010A', errorKeys: ['REF02', 'TaxID'] },
        ],
      },
      {
        segKeys: ['N4'],
        fields: [
          { id: 'billing-city', label: 'City', hint: 'Chicago', keys: ['N401', 'city'], loopName: '2010A', errorKeys: ['N401'] },
          { id: 'billing-state', label: 'State', hint: 'IL', keys: ['N402', 'state'], loopName: '2010A', errorKeys: ['N402'] },
          { id: 'billing-zip', label: 'ZIP', mono: true, hint: '60601', keys: ['N403', 'zip', 'postal_code'], loopName: '2010A', errorKeys: ['N403'] },
        ],
      },
    ],
  },
  {
    id: 'subscriber', title: 'Subscriber / Patient', icon: '👤', rotate: -0.3,
    loopKeys: ['2010BA', 'loop_2010BA'],
    segments: [
      {
        segKeys: ['NM1'],
        fields: [
          { id: 'sub-member-id', label: 'Member ID', mono: true, hint: 'A123456789', keys: ['NM109', 'member_id', 'MemberID', 'NM1_09'], loopName: '2010B', errorKeys: ['NM109'] },
          { id: 'sub-last-name', label: 'Last Name', hint: 'Smith', keys: ['NM103', 'last_name', 'NM1_03'], loopName: '2010B', errorKeys: ['NM103'] },
          { id: 'sub-first-name', label: 'First Name', hint: 'Jane', keys: ['NM104', 'first_name', 'NM1_04'], loopName: '2010B', errorKeys: ['NM104'] },
        ],
      },
      {
        segKeys: ['DMG'],
        fields: [
          { id: 'sub-dob', label: 'Date of Birth', mono: true, hint: 'YYYYMMDD', keys: ['DMG02', 'dob', 'birth_date'], loopName: '2010B', errorKeys: ['DMG02', 'DOB'] },
          { id: 'sub-gender', label: 'Gender Code', hint: 'M / F / U', keys: ['DMG03', 'gender', 'sex'], loopName: '2010B', errorKeys: ['DMG03'] },
        ],
      },
    ],
  },
  {
    id: 'claim', title: 'Claim Information', icon: '📋', rotate: 0.4,
    loopKeys: ['2300', 'loop_2300'],
    segments: [
      {
        segKeys: ['CLM'],
        fields: [
          { id: 'clm-id', label: 'Patient Control Number', mono: true, hint: 'CLM-2024-001', keys: ['CLM01', 'claim_id', 'control_number', 'CLM_01'], loopName: '2300', errorKeys: ['CLM01'] },
          { id: 'clm-amount', label: 'Total Charge Amount ($)', mono: true, hint: '1500.00', keys: ['CLM02', 'total_charge', 'amount', 'CLM_02'], loopName: '2300', errorKeys: ['CLM02', 'AmountMismatch'] },
          { id: 'clm-facility', label: 'Facility Code', mono: true, hint: '11 (Office)', keys: ['CLM05_1', 'facility_code', 'place_of_service'], loopName: '2300', errorKeys: ['CLM05'] },
        ],
      },
      {
        segKeys: ['DTP'],
        fields: [
          { id: 'clm-service-date', label: 'Service Date', mono: true, hint: 'YYYYMMDD', keys: ['DTP03', 'service_date', 'date'], loopName: '2300', errorKeys: ['DTP03'] },
        ],
      },
    ],
  },
  {
    id: 'service', title: 'Service Line Items', icon: '💊', rotate: -0.4,
    loopKeys: ['2400', 'loop_2400'],
    repeatable: true,
    segments: [
      {
        segKeys: ['SV1'],
        fields: [
          { id: 'svc-proc', label: 'Procedure Code', mono: true, hint: 'HC:99213', keys: ['SV101', 'procedure_code', 'SV1_01'], loopName: '2400', errorKeys: ['SV101'] },
          { id: 'svc-amount', label: 'Charge ($)', mono: true, hint: '150.00', keys: ['SV102', 'charge', 'amount', 'SV1_02'], loopName: '2400', errorKeys: ['SV102'] },
          { id: 'svc-units', label: 'Units', mono: true, hint: '1', keys: ['SV104', 'units', 'SV1_04'], loopName: '2400', errorKeys: ['SV104'] },
          { id: 'svc-modifier', label: 'Modifier', mono: true, hint: '25', keys: ['SV101_2', 'modifier', 'SV1_01_2'], loopName: '2400', errorKeys: ['modifier'] },
          { id: 'svc-diagptr', label: 'Diagnosis Pointer', mono: true, hint: '1', keys: ['SV107', 'diagnosis_pointer', 'SV1_07'], loopName: '2400', errorKeys: ['SV107'] },
        ],
      },
      {
        segKeys: ['DTP'],
        fields: [
          { id: 'svc-date', label: 'Service Date', mono: true, hint: 'YYYYMMDD', keys: ['DTP03', 'service_date', 'date'], loopName: '2400', errorKeys: ['DTP03'] },
        ],
      },
    ],
  },
]

const SCHEMA_835: SectionDef[] = [
  {
    id: 'payer', title: 'Payer Information', icon: '🏦', rotate: -0.3,
    loopKeys: ['835_1000A'],
    segments: [
      {
        segKeys: ['N1'],
        fields: [
          { id: 'payer-name', label: 'Payer Name', hint: 'BCBS of Illinois', keys: ['N102', 'name', 'N1_02'], loopName: '835_1000A', errorKeys: ['N102'] },
          { id: 'payer-id', label: 'Payer ID', mono: true, hint: 'SH-12345', keys: ['N104', 'id', 'N1_04'], loopName: '835_1000A', errorKeys: ['N104'] },
        ],
      },
      {
        segKeys: ['N3'],
        fields: [
          { id: 'payer-address', label: 'Address', hint: '300 E Randolph St', keys: ['N301', 'address'], loopName: '835_1000A', errorKeys: ['N301'] },
        ],
      },
      {
        segKeys: ['N4'],
        fields: [
          { id: 'payer-city', label: 'City', hint: 'Chicago', keys: ['N401', 'city'], loopName: '835_1000A', errorKeys: ['N401'] },
          { id: 'payer-state', label: 'State', hint: 'IL', keys: ['N402', 'state'], loopName: '835_1000A', errorKeys: ['N402'] },
          { id: 'payer-zip', label: 'ZIP', mono: true, hint: '60601', keys: ['N403', 'zip'], loopName: '835_1000A', errorKeys: ['N403'] },
        ],
      },
    ],
  },
  {
    id: 'payee', title: 'Payee (Provider)', icon: '🏥', rotate: 0.3,
    loopKeys: ['835_1000B'],
    segments: [
      {
        segKeys: ['N1'],
        fields: [
          { id: 'payee-name', label: 'Payee Name', hint: 'Metro Medical Group', keys: ['N102', 'name', 'N1_02'], loopName: '835_1000B', errorKeys: ['N102'] },
          { id: 'payee-id', label: 'Payee ID / NPI', mono: true, hint: '1234567890', keys: ['N104', 'id', 'npi', 'N1_04'], loopName: '835_1000B', errorKeys: ['N104'] },
        ],
      },
    ],
  },
  {
    id: 'payment', title: 'Payment Information', icon: '💳', rotate: -0.4,
    loopKeys: ['835_HEADER', 'HEADER'],
    segments: [
      {
        segKeys: ['BPR'],
        fields: [
          { id: 'bpr-amount', label: 'Payment Amount ($)', mono: true, hint: '1250.00', keys: ['BPR02', 'payment_amount', 'BPR_02'], loopName: '835_HEADER', errorKeys: ['BPR02'] },
          { id: 'bpr-method', label: 'Payment Method', hint: 'ACH / CHK', keys: ['BPR04', 'payment_method', 'BPR_04'], loopName: '835_HEADER', errorKeys: ['BPR04'] },
          { id: 'bpr-date', label: 'Payment Date', mono: true, hint: 'YYYYMMDD', keys: ['BPR16', 'payment_date', 'BPR_16'], loopName: '835_HEADER', errorKeys: ['BPR16'] },
        ],
      },
      {
        segKeys: ['TRN'],
        fields: [
          { id: 'trn-trace', label: 'Check / EFT Trace Number', mono: true, hint: '1234567890', keys: ['TRN02', 'trace_number', 'TRN_02'], loopName: '835_HEADER', errorKeys: ['TRN02'] },
          { id: 'trn-payer-id', label: 'Payer ID (TRN)', mono: true, hint: '1234567890', keys: ['TRN03', 'payer_id', 'TRN_03'], loopName: '835_HEADER', errorKeys: ['TRN03'] },
        ],
      },
    ],
  },
  {
    id: 'claim_payment', title: 'Claim Payment Details', icon: '📋', rotate: 0.4,
    loopKeys: ['835_2100'],
    repeatable: true,
    segments: [
      {
        segKeys: ['CLP'],
        fields: [
          { id: 'clp-id', label: 'Claim ID', mono: true, hint: 'CLM-001', keys: ['CLP01', 'claim_id', 'CLP_01'], loopName: '835_2100', errorKeys: ['CLP01'] },
          { id: 'clp-status', label: 'Claim Status Code', mono: true, hint: '1=Processed', keys: ['CLP02', 'status_code', 'CLP_02'], loopName: '835_2100', errorKeys: ['CLP02'] },
          { id: 'clp-billed', label: 'Billed Amount ($)', mono: true, hint: '1500.00', keys: ['CLP03', 'billed', 'CLP_03'], loopName: '835_2100', errorKeys: ['CLP03'] },
          { id: 'clp-paid', label: 'Paid Amount ($)', mono: true, hint: '1250.00', keys: ['CLP04', 'paid', 'CLP_04'], loopName: '835_2100', errorKeys: ['CLP04'] },
          { id: 'clp-patient-resp', label: 'Patient Responsibility ($)', mono: true, hint: '250.00', keys: ['CLP05', 'patient_responsibility', 'CLP_05'], loopName: '835_2100', errorKeys: ['CLP05'] },
        ],
      },
      {
        segKeys: ['NM1'],
        fields: [
          { id: 'clp-patient-name', label: 'Patient Last Name', hint: 'Smith', keys: ['NM103', 'last_name', 'NM1_03'], loopName: '835_2100', errorKeys: ['NM103'] },
          { id: 'clp-patient-first', label: 'Patient First Name', hint: 'Jane', keys: ['NM104', 'first_name', 'NM1_04'], loopName: '835_2100', errorKeys: ['NM104'] },
        ],
      },
    ],
  },
]

const SCHEMA_834: SectionDef[] = [
  {
    id: 'sponsor', title: 'Sponsor / Employer', icon: '🏢', rotate: -0.4,
    loopKeys: ['834_1000A'],
    segments: [
      {
        segKeys: ['N1'],
        fields: [
          { id: 'sponsor-name', label: 'Sponsor Name', hint: 'Acme Corp', keys: ['N102', 'name', 'N1_02'], loopName: '834_1000A', errorKeys: ['N102'] },
          { id: 'sponsor-id', label: 'Sponsor ID / EIN', mono: true, hint: 'XX-XXXXXXX', keys: ['N104', 'id', 'N1_04'], loopName: '834_1000A', errorKeys: ['N104'] },
        ],
      },
    ],
  },
  {
    id: 'payer834', title: 'Insurance Payer', icon: '🏦', rotate: 0.3,
    loopKeys: ['834_1000B'],
    segments: [
      {
        segKeys: ['N1'],
        fields: [
          { id: 'payer834-name', label: 'Payer Name', hint: 'BlueCross BlueShield', keys: ['N102', 'name', 'N1_02'], loopName: '834_1000B', errorKeys: ['N102'] },
          { id: 'payer834-id', label: 'Payer ID', mono: true, hint: 'BCBS-001', keys: ['N104', 'id', 'N1_04'], loopName: '834_1000B', errorKeys: ['N104'] },
        ],
      },
    ],
  },
  {
    id: 'member', title: 'Member Enrollment', icon: '👤', rotate: -0.3,
    loopKeys: ['834_2000'],
    repeatable: true,
    segments: [
      {
        segKeys: ['INS'],
        fields: [
          { id: 'ins-rel', label: 'Subscriber Indicator', hint: 'Y=Subscriber', keys: ['INS01', 'subscriber_indicator', 'INS_01'], loopName: '834_2000', errorKeys: ['INS01'] },
          { id: 'ins-relationship', label: 'Relationship Code', hint: '18=Self', keys: ['INS02', 'relationship_code', 'INS_02'], loopName: '834_2000', errorKeys: ['INS02'] },
          { id: 'ins-maint-type', label: 'Maintenance Type', hint: '021=Change', keys: ['INS03', 'maintenance_type', 'INS_03'], loopName: '834_2000', errorKeys: ['INS03'] },
          { id: 'ins-benefit-status', label: 'Benefit Status Code', hint: 'A=Active', keys: ['INS04', 'benefit_status', 'INS_04'], loopName: '834_2000', errorKeys: ['INS04'] },
        ],
      },
      {
        segKeys: ['REF'],
        fields: [
          { id: 'ins-member-id', label: 'Member ID (REF)', mono: true, hint: 'MBR-001', keys: ['REF02', 'member_id', 'REF_02'], loopName: '834_2000', errorKeys: ['REF02'] },
        ],
      },
      {
        segKeys: ['DTP'],
        fields: [
          { id: 'ins-eff-date', label: 'Coverage Effective Date', mono: true, hint: 'YYYYMMDD', keys: ['DTP03', 'effective_date', 'date', 'DTP_03'], loopName: '834_2000', errorKeys: ['DTP03'] },
        ],
      },
    ],
  },
  {
    id: 'member_demo', title: 'Member Demographics', icon: '🪪', rotate: 0.4,
    loopKeys: ['834_2100A'],
    segments: [
      {
        segKeys: ['NM1'],
        fields: [
          { id: 'mem-last', label: 'Last Name', hint: 'Smith', keys: ['NM103', 'last_name', 'NM1_03'], loopName: '834_2100A', errorKeys: ['NM103'] },
          { id: 'mem-first', label: 'First Name', hint: 'Jane', keys: ['NM104', 'first_name', 'NM1_04'], loopName: '834_2100A', errorKeys: ['NM104'] },
          { id: 'mem-id-num', label: 'Member ID Number', mono: true, hint: 'MBR-001', keys: ['NM109', 'member_id', 'NM1_09'], loopName: '834_2100A', errorKeys: ['NM109'] },
        ],
      },
      {
        segKeys: ['DMG'],
        fields: [
          { id: 'mem-dob', label: 'Date of Birth', mono: true, hint: 'YYYYMMDD', keys: ['DMG02', 'dob', 'birth_date'], loopName: '834_2100A', errorKeys: ['DMG02', 'DOB'] },
          { id: 'mem-gender', label: 'Gender Code', hint: 'M / F', keys: ['DMG03', 'gender', 'sex'], loopName: '834_2100A', errorKeys: ['DMG03'] },
        ],
      },
      {
        segKeys: ['N3'],
        fields: [
          { id: 'mem-address', label: 'Address', hint: '123 Main St', keys: ['N301', 'address'], loopName: '834_2100A', errorKeys: ['N301'] },
        ],
      },
      {
        segKeys: ['N4'],
        fields: [
          { id: 'mem-city', label: 'City', hint: 'Chicago', keys: ['N401', 'city'], loopName: '834_2100A', errorKeys: ['N401'] },
          { id: 'mem-state', label: 'State', hint: 'IL', keys: ['N402', 'state'], loopName: '834_2100A', errorKeys: ['N402'] },
          { id: 'mem-zip', label: 'ZIP', mono: true, hint: '60601', keys: ['N403', 'zip'], loopName: '834_2100A', errorKeys: ['N403'] },
        ],
      },
    ],
  },
]

// ── Schema registry ───────────────────────────────────────────────────────────

function getSchema(txType: string | null): SectionDef[] | null {
  if (!txType) return null
  if (txType === '837') return SCHEMA_837
  if (txType === '835') return SCHEMA_835
  if (txType === '834') return SCHEMA_834
  return null
}

// ── PATH → SECTION dynamic builder ───────────────────────────────────────────

function buildPathToSection(schema: SectionDef[]): Array<[RegExp, string]> {
  return schema.map((s) => {
    const patterns = s.loopKeys.map(k => k.replace('_', '[_]?'))
    return [new RegExp(patterns.join('|'), 'i'), s.id] as [RegExp, string]
  })
}

function resolveSection(path: string | null, pathMap: Array<[RegExp, string]>): string | null {
  if (!path) return null
  for (const [pattern, section] of pathMap) {
    if (pattern.test(path)) return section
  }
  return null
}

// ── Generic loop renderer (fallback) ─────────────────────────────────────────

// Loop ID → short human description
const LOOP_DESCRIPTIONS: Record<string, string> = {
  HEADER: 'Interchange Envelope',
  '1000A': 'Submitter Information',
  '1000B': 'Receiver Information',
  '2000A': 'Billing Provider Hierarchy',
  '2000B': 'Subscriber Hierarchy',
  '2000C': 'Patient Hierarchy',
  '2010AA': 'Billing Provider Name & Address',
  '2010AB': 'Pay-To Provider',
  '2010BA': 'Subscriber Name & Demographics',
  '2010BB': 'Payer Information',
  '2010CA': 'Patient Name & Demographics',
  '2010CB': 'Responsible Party',
  '2300': 'Claim Information',
  '2310A': 'Referring Provider',
  '2310B': 'Rendering Provider',
  '2310E': 'Service Facility Location',
  '2400': 'Service Line Items',
  '2420A': 'Rendering Provider (Service Level)',
  '2420B': 'Purchased Service Provider',
  '835_HEADER': 'Payment Header',
  '835_1000A': 'Payer Identification',
  '835_1000B': 'Payee Identification',
  '835_2000': 'Claim Summary',
  '835_2100': 'Claim Payment Detail',
  '835_2110': 'Service Payment & Adjustments',
  '834_HEADER': 'Enrollment File Header',
  '834_1000A': 'Sponsor / Employer',
  '834_1000B': 'Insurance Payer',
  '834_2000': 'Member Enrollment Record',
  '834_2100A': 'Member Name & Demographics',
  '834_2100B': 'Incorrect Member Name',
  '834_2300': 'Health Coverage',
  '834_2700': 'Member Reporting Categories',
  UNASSIGNED: 'General Segments',
}

// Field key → plain English label  (handles schema-generated prop names like AssignedNumber_01)
const FIELD_HUMAN_LABELS: Record<string, string> = {
  // LX
  LX_01: 'Service Line Number',
  // SV1
  SV1_01: 'Procedure Code', SV1_02: 'Charge Amount', SV1_03: 'Unit of Measurement',
  SV1_04: 'Units / Quantity', SV1_05: 'Facility Code', SV1_06: 'Service Type Code',
  SV1_07: 'Diagnosis Code Pointer',
  // SV2
  SV2_01: 'Revenue Code', SV2_02: 'Procedure Code', SV2_03: 'Charge Amount',
  SV2_05: 'Unit of Measurement', SV2_06: 'Units / Quantity',
  // NM1
  NM1_01: 'Entity ID Code', NM1_02: 'Entity Type', NM1_03: 'Last / Organization Name',
  NM1_04: 'First Name', NM1_05: 'Middle Name', NM1_06: 'Name Prefix',
  NM1_07: 'Name Suffix', NM1_08: 'ID Qualifier', NM1_09: 'ID Number',
  // N1
  N1_01: 'Entity ID Code', N1_02: 'Name', N1_03: 'ID Qualifier', N1_04: 'ID Number',
  // N3 / N4
  N3_01: 'Street Address', N3_02: 'Address Line 2',
  N4_01: 'City', N4_02: 'State', N4_03: 'Postal Code', N4_04: 'Country Code',
  // DTP
  DTP_01: 'Date Qualifier', DTP_02: 'Date Format', DTP_03: 'Date',
  // CLM
  CLM_01: 'Patient Control Number', CLM_02: 'Total Charge Amount',
  CLM_03: 'Claim Type', CLM_05: 'Place of Service',
  CLM_06: 'Provider Signature', CLM_07: 'Assignment of Benefits',
  CLM_08: 'Release of Info', CLM_09: 'Prior Auth Required',
  // HI
  HI_01: 'Primary Diagnosis Code', HI_02: 'Diagnosis Code 2',
  HI_03: 'Diagnosis Code 3', HI_04: 'Diagnosis Code 4',
  HI_05: 'Diagnosis Code 5', HI_06: 'Diagnosis Code 6',
  // REF
  REF_01: 'Reference ID Qualifier', REF_02: 'Reference ID', REF_03: 'Description',
  // DMG
  DMG_01: 'Date Format', DMG_02: 'Date of Birth', DMG_03: 'Gender Code',
  // PER
  PER_01: 'Contact Function', PER_02: 'Contact Name',
  PER_03: 'Contact Type', PER_04: 'Contact Number', PER_06: 'Contact Number 2',
  // HL
  HL_01: 'Hierarchical ID', HL_02: 'Parent ID',
  HL_03: 'Hierarchical Level', HL_04: 'Has Child',
  // ISA
  ISA_01: 'Authorization Qualifier', ISA_02: 'Authorization Info',
  ISA_03: 'Security Qualifier', ISA_04: 'Security Info',
  ISA_05: 'Sender ID Qualifier', ISA_06: 'Sender ID',
  ISA_07: 'Receiver ID Qualifier', ISA_08: 'Receiver ID',
  ISA_09: 'Date', ISA_10: 'Time',
  ISA_12: 'Version Number', ISA_13: 'Control Number',
  ISA_14: 'Acknowledgment Requested', ISA_15: 'Usage Indicator',
  // GS
  GS_01: 'Functional Identifier', GS_02: 'Application Sender ID',
  GS_03: 'Application Receiver ID', GS_04: 'Date', GS_05: 'Time',
  GS_06: 'Group Control Number', GS_07: 'Agency Code', GS_08: 'Version Code',
  // ST / BHT
  ST_01: 'Transaction Set ID', ST_02: 'Control Number', ST_03: 'Implementation Reference',
  BHT_01: 'Hierarchical Structure Code', BHT_02: 'Transaction Type',
  BHT_03: 'Reference ID', BHT_04: 'Date', BHT_05: 'Time', BHT_06: 'Claim Type',
  // SBR / PRV
  SBR_01: 'Payer Responsibility', SBR_02: 'Relationship Code',
  SBR_03: 'Group ID', SBR_04: 'Group Name', SBR_09: 'Claim Filing Indicator',
  PRV_01: 'Provider Code', PRV_02: 'Taxonomy Qualifier', PRV_03: 'Taxonomy Code',
  // BPR / TRN (835)
  BPR_01: 'Transaction Code', BPR_02: 'Total Payment Amount',
  BPR_03: 'Credit/Debit Flag', BPR_04: 'Payment Method', BPR_16: 'Payment Date',
  TRN_01: 'Trace Type', TRN_02: 'Trace / Check Number', TRN_03: 'Originating Company ID',
  // CLP / SVC / CAS (835)
  CLP_01: 'Claim ID', CLP_02: 'Claim Status Code', CLP_03: 'Total Billed Amount',
  CLP_04: 'Total Paid Amount', CLP_05: 'Patient Responsibility',
  CLP_06: 'Claim Filing Indicator', CLP_07: 'Payer Control Number',
  SVC_01: 'Procedure Code', SVC_02: 'Line Paid Amount', SVC_03: 'Line Billed Amount',
  CAS_01: 'Adjustment Group Code', CAS_02: 'Reason Code', CAS_03: 'Adjustment Amount',
  // INS / BGN / HD (834)
  INS_01: 'Subscriber Indicator', INS_02: 'Relationship Code',
  INS_03: 'Maintenance Type', INS_04: 'Benefit Status',
  INS_08: 'Employment Status', INS_09: 'Student Status',
  BGN_01: 'Purpose Code', BGN_02: 'Reference ID',
  BGN_03: 'Date', BGN_04: 'Time', BGN_08: 'Action Code',
  HD_01: 'Maintenance Type', HD_03: 'Insurance Line', HD_04: 'Plan Description', HD_05: 'Coverage Type',
  // PAT / AMT / QTY
  PAT_01: 'Patient Relationship Code',
  AMT_01: 'Amount Qualifier', AMT_02: 'Amount',
  QTY_01: 'Quantity Qualifier', QTY_02: 'Quantity',
}

// Convert a schema prop name (e.g. "LineItemChargeAmount_02", "LX_01") to a human label.
// Priority: FIELD_HUMAN_LABELS by Seg+Element key, then by just element pattern, then PascalCase split.
function resolveFieldLabel(segId: string, fieldKey: string): string {
  // 1. Try segment-qualified key like "NM1_03" or "SV1_02" (last numeric index from fieldKey)
  const idxMatch = fieldKey.match(/_?(\d{2,})$/)
  if (idxMatch) {
    const qualifier = `${segId}_${idxMatch[1]}`
    if (FIELD_HUMAN_LABELS[qualifier]) return FIELD_HUMAN_LABELS[qualifier]
  }
  // 2. Try the fieldKey directly (e.g. DTP_01)
  if (FIELD_HUMAN_LABELS[fieldKey]) return FIELD_HUMAN_LABELS[fieldKey]
  // 3. Fallback: split PascalCase, strip trailing index
  const withoutIndex = fieldKey.replace(/_?\d{2,}$/, '')
  return withoutIndex
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim() || fieldKey
}

function GenericFormView({ rootData, handleCommit, activeFieldPath }: {
  rootData: any; handleCommit: Function; activeFieldPath: string | null
}) {
  const loops = rootData?.data?.loops || rootData?.loops || {}
  const loopKeys = Object.keys(loops)

  if (loopKeys.length === 0) return <FormEmptyState />

  const SKIP_KEYS = new Set(['Segment_ID', 'raw_data'])
  const rotations = [-0.3, 0.3, -0.4, 0.4, 0]
  const icons = ['📁', '📂', '📄', '🗂️', '📑']

  return (
    <>
      {loopKeys.map((loopKey, li) => {
        const loopArr: any[] = Array.isArray(loops[loopKey]) ? loops[loopKey] : [loops[loopKey]]
        const firstInstance = loopArr[0]
        if (!firstInstance) return null
        const segIds = Object.keys(firstInstance)
        const allFields: Array<{ seg: any; fieldKey: string; fieldId: string; label: string; fullLabel: string }> = []

        for (const segId of segIds) {
          const rawSeg = firstInstance[segId]
          const seg = Array.isArray(rawSeg) ? rawSeg[0] : rawSeg
          if (!seg || typeof seg !== 'object') continue
          for (const fieldKey of Object.keys(seg)) {
            if (SKIP_KEYS.has(fieldKey)) continue
            const val = seg[fieldKey]
            if (typeof val === 'object') continue
            const humanLabel = resolveFieldLabel(segId, fieldKey)
            // Full tooltip still shows raw technical reference
            const fullLabel = `${segId} › ${fieldKey}: ${humanLabel}`
            allFields.push({
              seg, fieldKey,
              fieldId: `generic-${loopKey}-${segId}-${fieldKey}`,
              label: humanLabel,
              fullLabel,
            })
          }
        }

        if (allFields.length === 0) return null

        const loopDesc = LOOP_DESCRIPTIONS[loopKey]

        return (
          <SectionCard key={loopKey}>
            <SectionHeader
              title={loopKey}
              description={loopDesc}
              icon={icons[li % icons.length]}
              rotate={rotations[li % rotations.length]}
            />
            <FieldGrid cols={2}>
              {allFields.map(({ seg, fieldKey, fieldId, label, fullLabel }) => (
                <div key={fieldId} style={{ minWidth: 0, overflow: 'hidden' }} title={fullLabel}>
                  <FormField
                    id={fieldId} label={label} mono
                    value={String(seg[fieldKey] ?? '')}
                    onCommit={(v) => handleCommit(seg, [fieldKey], v)}
                    isActive={isFieldActive(activeFieldPath, loopKey, fieldKey)}
                  />
                </div>
              ))}
            </FieldGrid>
          </SectionCard>
        )
      })}
    </>
  )
}

// ── Schema-driven renderer ────────────────────────────────────────────────────

function renderSchemaFields(
  segmentDefs: SegmentDef[],
  loopData: any,
  errors: ValidationError[],
  handleCommit: Function,
  activeFieldPath: string | null,
  askAI: Function,
  idSuffix = ''
) {
  const fields: React.ReactNode[] = []

  for (const segDef of segmentDefs) {
    // Special case: cross-loop lookup (e.g. 1000B inside submitter section)
    let seg: any = null
    if (segDef.segKeys[0] === '__loop_1000B_NM1__') {
      // Will be handled by parent passing preresolved segment
      continue
    }
    seg = findSegment(loopData, ...segDef.segKeys)

    for (const field of segDef.fields) {
      const fid = `${field.id}${idSuffix}`
      const errKeys = field.errorKeys ?? field.keys
      fields.push(
        <FormField
          key={fid} id={fid} label={field.label} hint={field.hint} mono={field.mono}
          value={getVal(seg, ...field.keys)}
          onCommit={(v) => handleCommit(seg, field.keys, v)}
          errors={getErrors(errors, field.loopName, ...errKeys)}
          isActive={isFieldActive(activeFieldPath, field.loopName, ...errKeys)}
          onAskAI={field.aiPrompt ? () => askAI(field.aiPrompt!) : undefined}
        />
      )
    }
  }

  return fields
}

// ── ICD-10 block (837 special case) ──────────────────────────────────────────

function ICD10Block({ loopData, errors, handleCommit, activeFieldPath }: {
  loopData: any; errors: ValidationError[]; handleCommit: Function; activeFieldPath: string | null
}) {
  const hiSeg = findSegment(loopData, 'HI')
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px dashed rgba(26,26,46,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: 'rgba(26,26,46,0.6)', textTransform: 'uppercase' }}>Diagnosis Codes (ICD-10)</span>
      </div>
      <FieldGrid cols={3}>
        {(['HI01_2', 'HI02_2', 'HI03_2', 'HI04_2', 'HI05_2', 'HI06_2'] as const).map((key, i) => (
          <FormField
            key={key} id={`dx-code-${i + 1}`} label={`Dx Code ${i + 1}${i === 0 ? ' (Primary)' : ''}`} mono hint="J18.9"
            value={getVal(hiSeg, key, `code_${i + 1}`, i === 0 ? 'primary_dx' : `dx_${i + 1}`)}
            onCommit={(v) => handleCommit(hiSeg, [key, `code_${i + 1}`, i === 0 ? 'primary_dx' : `dx_${i + 1}`], v)}
            errors={getErrors(errors, '2300', key, 'HI0', 'ICD')}
            isActive={isFieldActive(activeFieldPath, '2300', key, 'HI0', 'ICD')}
          />
        ))}
      </FieldGrid>
    </div>
  )
}

// ── Main FormEditorView ───────────────────────────────────────────────────────

export default function FormEditorView() {
  const parseResult = useAppStore((s) => s.parseResult)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const selectedPath = useAppStore((s) => s.selectedPath)
  const setIsAIPanelOpen = useAppStore((s) => s.setIsAIPanelOpen)
  const setAiPromptContext = useAppStore((s) => s.setAiPromptContext)
  const isLoading = useAppStore((s) => s.isLoading)
  const transactionType = useAppStore((s) => s.transactionType)

  const schema = getSchema(transactionType)
  const pathMap = schema ? buildPathToSection(schema) : []

  const sectionRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({})
  if (schema) {
    for (const s of schema) {
      if (!sectionRefs.current[s.id]) sectionRefs.current[s.id] = { current: null }
    }
  }

  const [highlightedSection, setHighlightedSection] = useState<string | null>(null)
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPath) return
    const section = resolveSection(selectedPath, pathMap)
    if (!section) return
    const ref = sectionRefs.current[section]
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightedSection(section)
      setActiveFieldPath(selectedPath)
      const t = setTimeout(() => { setHighlightedSection(null); setActiveFieldPath(null) }, 2000)
      return () => clearTimeout(t)
    }
  }, [selectedPath])

  const handleCommit = useCallback((segment: any, targetKeys: string[], newValue: string) => {
    if (!parseResult || !segment) return
    let updated = false
    const keys = Object.keys(segment)

    for (const fk of targetKeys) {
      if (segment[fk] !== undefined) { segment[fk] = newValue; updated = true; break }
      const suffixMatch = fk.match(/\d{2}$/)
      if (suffixMatch) {
        const suffix = `_${suffixMatch[0]}`
        for (const k of keys) {
          if (k.endsWith(suffix) && segment[k] !== undefined) {
            segment[k] = Array.isArray(segment[k]) ? (newValue.includes(':') ? newValue.split(':') : [newValue]) : newValue
            updated = true; break
          }
        }
      }
      if (updated) break
    }

    if (!updated && segment.raw_data && Array.isArray(segment.raw_data)) {
      for (const fk of targetKeys) {
        const match = fk.match(/0*(\d+)$/)
        if (match) {
          const idx = parseInt(match[1], 10)
          if (segment.raw_data.length > idx) { segment.raw_data[idx] = newValue; updated = true; break }
        }
      }
    }

    const newParseResult = structuredClone(parseResult) as any
    const clearErrors = (arr: any[]) => arr ? arr.filter((e: any) => {
      const el = (e.element || e.field || '').toUpperCase()
      return !targetKeys.some(k => el.includes(k.toUpperCase()))
    }) : arr

    if (newParseResult.errors) newParseResult.errors = clearErrors(newParseResult.errors)
    if (newParseResult.data?.errors) newParseResult.data.errors = clearErrors(newParseResult.data.errors)
    setParseResult(newParseResult)
  }, [parseResult, setParseResult])

  const askAI = useCallback((context: string) => {
    setAiPromptContext(context)
    setIsAIPanelOpen(true)
  }, [setAiPromptContext, setIsAIPanelOpen])

  if (isLoading) return null
  if (!parseResult) return <FormEmptyState />

  const rootData = parseResult as Record<string, any>
  const errors: ValidationError[] = (rootData.errors || rootData.data?.errors || []) as ValidationError[]
  const txType = transactionType || rootData.data?.metadata?.transaction_type || rootData.metadata?.transaction_type || 'unknown'

  // ── No known schema → generic renderer ────────────────────────────────────
  if (!schema) {
    return (
      <>
        <style>{`
          @media (max-width: 640px) { .form-field-grid { grid-template-columns: 1fr !important; } }
          .form-editor-scroll::-webkit-scrollbar { width: 6px; }
          .form-editor-scroll::-webkit-scrollbar-thumb { background: rgba(78,205,196,0.35); border-radius: 3px; }
          .form-field-grid > * { min-width: 0; overflow: hidden; }
        `}</style>
        <div className="form-editor-scroll" style={{ height: '100%', overflowY: 'auto', padding: '0 0 40px', background: '#FDFAF4' }}>
          <div style={{ padding: '28px 28px 0', display: 'flex', flexDirection: 'column', gap: 28 }}>
            <TxBadge type={txType} />
            <GenericFormView rootData={rootData} handleCommit={handleCommit} activeFieldPath={activeFieldPath} />
          </div>
        </div>
      </>
    )
  }

  // ── Schema-driven renderer ─────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media (max-width: 640px) { .form-field-grid { grid-template-columns: 1fr !important; } }
        .form-editor-scroll::-webkit-scrollbar { width: 6px; }
        .form-editor-scroll::-webkit-scrollbar-thumb { background: rgba(78,205,196,0.35); border-radius: 3px; }
        .form-field-grid > * { min-width: 0; overflow: hidden; }
      `}</style>

      <div className="form-editor-scroll" style={{ height: '100%', overflowY: 'auto', padding: '0 0 40px', background: '#FDFAF4' }}>
        <div style={{ padding: '28px 28px 0', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <TxBadge type={txType} />

          {schema.map((sectionDef) => {
            const loopData = findLoop(rootData, ...sectionDef.loopKeys)
            const isHighlighted = highlightedSection === sectionDef.id
            const sectionRef = sectionRefs.current[sectionDef.id] ?? { current: null }

            // ── Repeatable section (e.g. service lines, claim payments) ──────
            if (sectionDef.repeatable) {
              const loopArr: any[] = loopData
                ? (Array.isArray(loopData) && Array.isArray(loopData[0]) ? loopData : [loopData])
                : []

              return (
                <div
                  key={sectionDef.id}
                  ref={sectionRef as React.RefObject<HTMLDivElement>}
                  style={{ background: '#FFFFFF', border: isHighlighted ? '2px solid #4ECDC4' : '2px solid #1A1A2E', borderRadius: 12, padding: '24px 24px 28px' }}
                >
                  <SectionHeader title={sectionDef.title} icon={sectionDef.icon} rotate={sectionDef.rotate} />
                  {loopArr.length === 0 ? (
                    <div style={{ padding: '24px', border: '1.5px dashed rgba(26,26,46,0.2)', borderRadius: 8, textAlign: 'center', fontStyle: 'italic', fontFamily: 'Nunito, sans-serif', color: 'rgba(26,26,46,0.4)' }}>
                      No data found in loop {sectionDef.loopKeys[0]}.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {loopArr.map((lineData, idx) => {
                        const lineFields = renderSchemaFields(sectionDef.segments, lineData, errors, handleCommit, activeFieldPath, askAI, `-${idx}`)
                        if (lineFields.length === 0) return null
                        return (
                          <div key={idx} style={{ border: '1.5px solid rgba(26,26,46,0.1)', borderRadius: 10, padding: '16px 18px', background: idx % 2 === 0 ? '#FDFAF4' : '#FFFFFF' }}>
                            <FieldGrid cols={3}>{lineFields}</FieldGrid>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // ── Standard (non-repeatable) section ─────────────────────────

            // Special case: submitter section needs receiver data from sibling loop
            const isSubmitter = sectionDef.id === 'submitter'
            const l1000B = isSubmitter ? findLoop(rootData, '1000B', 'loop_1000B') : null
            const nm1_1000B = l1000B ? findSegment(l1000B, 'NM1') : null

            const normalSegments = sectionDef.segments.filter(s => s.segKeys[0] !== '__loop_1000B_NM1__')
            const crossLoopSegments = sectionDef.segments.filter(s => s.segKeys[0] === '__loop_1000B_NM1__')

            const fields = renderSchemaFields(normalSegments, loopData, errors, handleCommit, activeFieldPath, askAI)

            // Resolve cross-loop fields manually
            const crossFields: React.ReactNode[] = []
            for (const segDef of crossLoopSegments) {
              for (const field of segDef.fields) {
                const errKeys = field.errorKeys ?? field.keys
                crossFields.push(
                  <FormField
                    key={field.id} id={field.id} label={field.label} hint={field.hint} mono={field.mono}
                    value={getVal(nm1_1000B, ...field.keys)}
                    onCommit={(v) => handleCommit(nm1_1000B, field.keys, v)}
                    errors={getErrors(errors, field.loopName, ...errKeys)}
                    isActive={isFieldActive(activeFieldPath, field.loopName, ...errKeys)}
                  />
                )
              }
            }

            const allFields = [...fields, ...crossFields]

            return (
              <SectionCard
                key={sectionDef.id}
                sectionRef={sectionRef as React.RefObject<HTMLDivElement>}
                isHighlighted={isHighlighted}
              >
                <SectionHeader title={sectionDef.title} icon={sectionDef.icon} rotate={sectionDef.rotate} />
                <FieldGrid cols={2}>{allFields}</FieldGrid>

                {/* ICD-10 codes — 837 claim section only */}
                {sectionDef.id === 'claim' && txType === '837' && (
                  <ICD10Block loopData={loopData} errors={errors} handleCommit={handleCommit} activeFieldPath={activeFieldPath} />
                )}
              </SectionCard>
            )
          })}
        </div>
      </div>
    </>
  )
}