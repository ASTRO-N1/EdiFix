import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationError {
  element?: string
  field?: string
  message?: string
  msg?: string
  code?: string
  type?: 'error' | 'warning'
  loop?: string
}

// ── EDI helpers ───────────────────────────────────────────────────────────────

function isFieldActive(activePath: string | null, targetLoop: string, fieldKey: string): boolean {
  if (!activePath) return false
  const path = activePath.toUpperCase()
  if (!path.includes(targetLoop.toUpperCase())) return false
  return path.replace(/_/g, '').replace(/\./g, '').includes(fieldKey.toUpperCase().replace(/_/g, ''))
}

// ── FormField ─────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string; label: string; value: string
  onCommit: (v: string) => void
  errors?: ValidationError[]; isActive?: boolean; mono?: boolean
  hint?: string; techRef?: string
}

function FormField({ id, label, value, onCommit, errors = [], isActive, mono, hint, techRef }: FieldProps) {
  const [localVal, setLocalVal] = useState(value)
  const focusFieldId = useAppStore((s) => s.focusFieldId)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => { setLocalVal(value) }, [value])
  
  // Auto-scroll and focus when this field is targeted
  useEffect(() => {
    if (focusFieldId === id && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [focusFieldId, id])
  
  const hasError = errors.length > 0
  const errorMsg = errors[0]?.message ?? errors[0]?.msg ?? ''
  const isDirty = localVal !== value
  const isFocused = focusFieldId === id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
        <label htmlFor={id} style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: hasError ? '#FF6B6B' : 'rgba(26,26,46,0.6)', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.3 }}>
          {label}
        </label>
        {techRef && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(26,26,46,0.28)', flexShrink: 0 }}>{techRef}</span>
        )}
        {hasError && !isDirty && (
          <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 9, fontWeight: 800, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)', border: '1.5px solid #FF6B6B', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>⚠ ERROR</span>
        )}
      </div>
      <input
        ref={inputRef}
        id={id} type="text" value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setLocalVal(value); if (e.key === 'Enter' && isDirty) onCommit(localVal) }}
        placeholder={hint ?? `Enter ${label.toLowerCase()}…`}
        style={{
          width: '100%', padding: '9px 13px',
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'Nunito, sans-serif',
          fontSize: mono ? 12 : 13, color: '#1A1A2E',
          background: hasError && !isDirty ? 'rgba(255,107,107,0.04)' : '#FFFFFF',
          border: isDirty ? '2px solid #FFE66D' : hasError ? '2px dashed #FF6B6B' : (isActive || isFocused) ? '2px solid #4ECDC4' : '2px solid rgba(26,26,46,0.18)',
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          boxShadow: isDirty ? '0 0 0 3px rgba(255,230,109,0.2), 2px 2px 0px #FFE66D' : hasError ? '3px 3px 0px rgba(255,107,107,0.3)' : (isActive || isFocused) ? '0 0 0 3px rgba(78,205,196,0.2), 3px 3px 0px #4ECDC4' : '2px 2px 0px rgba(26,26,46,0.08)',
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

// ── Layout helpers ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, rotate = 0, description }: { title: string; icon: string; rotate?: number; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, transform: `rotate(${rotate}deg)`, transformOrigin: 'left center' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#1A1A2E', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>{title}</h2>
          {description && (
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 11, color: 'rgba(26,26,46,0.45)', fontStyle: 'italic' }}>— {description}</span>
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

// ── Badges ────────────────────────────────────────────────────────────────────

const TX_META: Record<string, { label: string; color: string; bg: string }> = {
  '837': { label: '837 — Healthcare Claim',   color: '#1A1A2E', bg: '#4ECDC4' },
  '835': { label: '835 — Remittance Advice',  color: '#1A1A2E', bg: '#FFE66D' },
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

// ── Loop metadata ─────────────────────────────────────────────────────────────

const LOOP_META: Record<string, { title: string; icon: string; desc: string }> = {
  HEADER:       { title: 'Interchange Envelope',       icon: '📨', desc: 'ISA/GS/ST envelope — sender, receiver, and control info' },
  '1000A':      { title: 'Submitter',                  icon: '📤', desc: 'Organization or entity submitting this transaction' },
  '1000B':      { title: 'Receiver',                   icon: '📥', desc: 'Organization or entity receiving this transaction' },
  '2000A':      { title: 'Billing Provider Hierarchy', icon: '🏥', desc: 'HL level for the billing/rendering provider' },
  '2000B':      { title: 'Subscriber Hierarchy',       icon: '👤', desc: 'HL level for the insurance subscriber' },
  '2000C':      { title: 'Patient Hierarchy',          icon: '🧑‍⚕️', desc: 'HL level for the patient (when different from subscriber)' },
  '2010AA':     { title: 'Billing Provider',           icon: '🏥', desc: 'Name, address, NPI, and Tax ID of the billing provider' },
  '2010AB':     { title: 'Pay-To Provider',            icon: '💰', desc: 'Provider to whom payment should be sent (if different)' },
  '2010BA':     { title: 'Subscriber',                 icon: '👤', desc: 'Subscriber name, member ID, address, and demographics' },
  '2010BB':     { title: 'Payer',                      icon: '🏦', desc: 'Insurance payer name and identification' },
  '2010CA':     { title: 'Patient',                    icon: '🧑', desc: 'Patient name, address, and demographics' },
  '2010CB':     { title: 'Responsible Party',          icon: '👥', desc: 'Responsible party when different from patient' },
  '2300':       { title: 'Claim Information',          icon: '📋', desc: 'Claim ID, total charge, facility code, and diagnosis codes' },
  '2310A':      { title: 'Referring Provider',         icon: '🩺', desc: 'Provider who referred the patient for services' },
  '2310B':      { title: 'Rendering Provider',         icon: '🩺', desc: 'Provider who rendered the services on the claim' },
  '2310E':      { title: 'Service Facility',           icon: '🏢', desc: 'Location where services were performed' },
  '2320':       { title: 'Other Subscriber',           icon: '👥', desc: 'Secondary/tertiary payer — coordination of benefits' },
  '2400':       { title: 'Service Lines',              icon: '💊', desc: 'Procedure codes, charges, units, and service dates' },
  '2420A':      { title: 'Rendering Provider (Line)',  icon: '🩺', desc: 'Rendering provider at the service line level' },
  '2420B':      { title: 'Purchased Service Provider', icon: '🔗', desc: 'Provider from whom services were purchased' },
  '835_HEADER': { title: 'Payment Header',             icon: '💳', desc: 'Payment amount, method (ACH/check), and trace number' },
  '835_1000A':  { title: 'Payer',                      icon: '🏦', desc: 'Insurance payer name and address' },
  '835_1000B':  { title: 'Payee',                      icon: '🏥', desc: 'Provider/payee name and address' },
  '835_2000':   { title: 'Claim Summary',              icon: '📊', desc: 'Header-level claim summary grouping' },
  '835_2100':   { title: 'Claim Payment',              icon: '📋', desc: 'Claim ID, billed, paid, and patient responsibility' },
  '835_2110':   { title: 'Service Payment',            icon: '💊', desc: 'Service-level payment, adjustments, and procedure codes' },
  '834_HEADER': { title: 'Enrollment Header',          icon: '📨', desc: 'BGN segment — file purpose, date, and action code' },
  '834_1000A':  { title: 'Sponsor / Employer',         icon: '🏢', desc: 'Employer or plan sponsor identification' },
  '834_1000B':  { title: 'Insurance Payer',            icon: '🏦', desc: 'Insurance carrier identification' },
  '834_1000C':  { title: 'TPA / Broker',               icon: '🤝', desc: 'Third-party administrator or broker information' },
  '834_2000':   { title: 'Member Enrollment',          icon: '👤', desc: 'INS — maintenance type, relationship, and benefit status' },
  '834_2100A':  { title: 'Member Name & Demographics', icon: '🪪', desc: 'Member name, DOB, gender, address, and ID numbers' },
  '834_2100B':  { title: 'Incorrect Member Name',      icon: '✏️', desc: 'Previous/incorrect member name being corrected' },
  '834_2100C':  { title: 'Member Mailing Address',     icon: '📬', desc: 'Mailing address if different from residence' },
  '834_2300':   { title: 'Health Coverage',            icon: '🛡️', desc: 'HD — insurance line, plan description, and coverage dates' },
  '834_2320':   { title: 'COB Information',            icon: '🔄', desc: 'Coordination of benefits / other insurance information' },
  '834_2700':   { title: 'Reporting Categories',       icon: '📊', desc: 'Member reporting and classification data' },
  UNASSIGNED:   { title: 'General Segments',           icon: '📄', desc: 'Segments not assigned to a specific loop' },
}

function getLoopMeta(loopKey: string): { title: string; icon: string; desc: string } {
  return LOOP_META[loopKey] ?? { title: loopKey.replace(/_/g, ' '), icon: '📁', desc: `Loop ${loopKey}` }
}

// ── Field label map ───────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  ISA_01: 'Authorization Qualifier', ISA_02: 'Authorization Info',
  ISA_03: 'Security Qualifier',      ISA_04: 'Security Info',
  ISA_05: 'Sender ID Qualifier',     ISA_06: 'Sender ID',
  ISA_07: 'Receiver ID Qualifier',   ISA_08: 'Receiver ID',
  ISA_09: 'Interchange Date',        ISA_10: 'Interchange Time',
  ISA_11: 'Repetition Separator',    ISA_12: 'Version Number',
  ISA_13: 'Control Number',          ISA_14: 'Ack Requested', ISA_15: 'Usage Indicator', ISA_16: 'Subelement Separator',
  GS_01: 'Functional ID Code', GS_02: 'Application Sender', GS_03: 'Application Receiver',
  GS_04: 'Date', GS_05: 'Time', GS_06: 'Group Control Number', GS_07: 'Agency Code', GS_08: 'Version Code',
  ST_01: 'Transaction Set ID', ST_02: 'Control Number', ST_03: 'Implementation Reference',
  SE_01: 'Segment Count', SE_02: 'Control Number',
  IEA_01: 'Number of Groups', IEA_02: 'Control Number',
  GE_01: 'Number of Transaction Sets', GE_02: 'Group Control Number',
  BHT_01: 'Hierarchical Structure', BHT_02: 'Transaction Purpose',
  BHT_03: 'Reference ID', BHT_04: 'Date', BHT_05: 'Time', BHT_06: 'Claim Type',
  HL_01: 'Hierarchical ID', HL_02: 'Parent ID', HL_03: 'Level Code', HL_04: 'Has Child Code',
  NM1_01: 'Entity ID Code',  NM1_02: 'Entity Type',
  NM1_03: 'Last / Org Name', NM1_04: 'First Name',   NM1_05: 'Middle Name',
  NM1_06: 'Prefix',          NM1_07: 'Suffix',        NM1_08: 'ID Qualifier', NM1_09: 'ID Number',
  N1_01: 'Entity ID Code', N1_02: 'Name', N1_03: 'ID Qualifier', N1_04: 'ID Number',
  N3_01: 'Street Address', N3_02: 'Address Line 2',
  N4_01: 'City', N4_02: 'State', N4_03: 'ZIP Code', N4_04: 'Country Code',
  PER_01: 'Contact Function', PER_02: 'Contact Name',
  PER_03: 'Communication Type', PER_04: 'Phone / Email',
  PER_05: 'Comm Type 2',  PER_06: 'Number 2',
  PER_07: 'Comm Type 3',  PER_08: 'Number 3',
  REF_01: 'Reference Qualifier', REF_02: 'Reference ID', REF_03: 'Description',
  DMG_01: 'Date Format',  DMG_02: 'Date of Birth', DMG_03: 'Gender Code',
  DTP_01: 'Date Qualifier', DTP_02: 'Date Format', DTP_03: 'Date Value',
  DTM_01: 'Date Qualifier', DTM_02: 'Date Value',
  SBR_01: 'Payer Responsibility', SBR_02: 'Relationship Code',
  SBR_03: 'Group/Policy Number',  SBR_04: 'Group Name',
  SBR_05: 'Insurance Type',       SBR_06: 'COB Code',
  SBR_07: 'Condition Code',       SBR_08: 'Employment Status', SBR_09: 'Claim Filing Code',
  PRV_01: 'Provider Code',   PRV_02: 'Qualifier',    PRV_03: 'Taxonomy Code',
  PAT_01: 'Relationship Code', PAT_02: 'Location Code',
  PAT_03: 'Employment Status', PAT_04: 'Student Status',
  PAT_05: 'Date Format',       PAT_06: 'Date of Death',
  PAT_07: 'Unit of Measure',   PAT_08: 'Weight',       PAT_09: 'Pregnancy Indicator',
  CLM_01: 'Patient Control Number',   CLM_02: 'Total Charge Amount',
  CLM_03: 'Claim Filing Indicator',   CLM_04: 'Non-Institutional Claim Type',
  CLM_05: 'Place of Service / Frequency',
  CLM_06: 'Provider Signature',       CLM_07: 'Assignment of Benefits',
  CLM_08: 'Benefits Assignment Cert.',CLM_09: 'Release of Information',
  CLM_10: 'Patient Signature Source', CLM_11: 'Related Causes',
  CLM_12: 'Special Program',          CLM_20: 'Delay Reason Code',
  HI_01: 'Diagnosis Code 1 (Primary)', HI_02: 'Diagnosis Code 2',
  HI_03: 'Diagnosis Code 3',  HI_04: 'Diagnosis Code 4',
  HI_05: 'Diagnosis Code 5',  HI_06: 'Diagnosis Code 6',
  HI_07: 'Diagnosis Code 7',  HI_08: 'Diagnosis Code 8',
  HI_09: 'Diagnosis Code 9',  HI_10: 'Diagnosis Code 10',
  HI_11: 'Diagnosis Code 11', HI_12: 'Diagnosis Code 12',
  LX_01: 'Service Line Number',
  SV1_01: 'Procedure Code',    SV1_02: 'Charge Amount',  SV1_03: 'Unit of Measure',
  SV1_04: 'Quantity / Units',  SV1_05: 'Facility Code',  SV1_06: 'Service Type',
  SV1_07: 'Diagnosis Pointer', SV1_09: 'Emergency Indicator',
  SV1_10: 'Multiple Procedure',SV1_11: 'EPSDT Indicator',SV1_12: 'Family Planning',
  SV2_01: 'Revenue Code',      SV2_02: 'Procedure Code', SV2_03: 'Charge Amount',
  SV2_04: 'Unit of Measure',   SV2_05: 'Units',
  SV2_06: 'Unit Rate',         SV2_07: 'Non-Covered Amount',
  AMT_01: 'Amount Qualifier',  AMT_02: 'Amount',
  QTY_01: 'Quantity Qualifier',QTY_02: 'Quantity',
  CL1_01: 'Admission Type',    CL1_02: 'Admission Source', CL1_03: 'Patient Status',
  HCP_01: 'Pricing Method',         HCP_02: 'Repriced Allowed Amount',
  HCP_03: 'Repriced Saving Amount', HCP_04: 'Repricing Org ID',
  HCP_05: 'Per Diem Rate',          HCP_06: 'Approved DRG',
  HCP_07: 'Approved Amount',        HCP_08: 'Product/Service ID',
  HCP_09: 'Procedure Qualifier',    HCP_10: 'Procedure Code',
  HCP_11: 'Unit of Measure',        HCP_12: 'Quantity',
  HCP_13: 'Reject Reason Code',     HCP_14: 'Compliance Code', HCP_15: 'Exception Code',
  BPR_01: 'Transaction Code',   BPR_02: 'Payment Amount',
  BPR_03: 'Credit/Debit',       BPR_04: 'Payment Method',
  BPR_05: 'Payment Format',     BPR_06: 'ID Qualifier (Sender)',
  BPR_07: 'Sender DFI ID',      BPR_08: 'Account Type (Sender)',
  BPR_09: 'Sender Account',     BPR_10: 'Originator Company ID',
  BPR_12: 'ID Qualifier (Receiver)', BPR_13: 'Receiver DFI ID',
  BPR_14: 'Account Type (Receiver)', BPR_15: 'Receiver Account', BPR_16: 'Payment Date',
  TRN_01: 'Trace Type',         TRN_02: 'Check / EFT Number',
  TRN_03: 'Originator Company', TRN_04: 'Reference ID',
  CLP_01: 'Claim ID',           CLP_02: 'Claim Status Code',  CLP_03: 'Total Billed',
  CLP_04: 'Total Paid',         CLP_05: 'Patient Responsibility',
  CLP_06: 'Filing Indicator',   CLP_07: 'Payer Control Number',
  CLP_08: 'Facility Code',      CLP_09: 'Frequency Code',
  SVC_01: 'Procedure Code',     SVC_02: 'Billed Amount',  SVC_03: 'Paid Amount',
  SVC_04: 'Revenue Code',       SVC_05: 'Units',
  SVC_06: 'Original Procedure', SVC_07: 'Original Units',
  CAS_01: 'Adjustment Group',   CAS_02: 'Reason Code',    CAS_03: 'Adjustment Amount',
  CAS_04: 'Quantity',           CAS_05: 'Reason Code 2',  CAS_06: 'Amount 2',
  CAS_07: 'Quantity 2',         CAS_08: 'Reason Code 3',  CAS_09: 'Amount 3',
  CAS_10: 'Quantity 3',         CAS_11: 'Reason Code 4',  CAS_12: 'Amount 4',
  INS_01: 'Subscriber Indicator',  INS_02: 'Relationship Code',
  INS_03: 'Maintenance Type',      INS_04: 'Maintenance Reason',
  INS_05: 'Benefit Status',        INS_06: 'Medicare Plan',
  INS_07: 'COBRA Event',           INS_08: 'Employment Status',
  INS_09: 'Student Status',        INS_10: 'Handicap Indicator',
  BGN_01: 'Purpose Code',    BGN_02: 'Reference ID',
  BGN_03: 'Date',            BGN_04: 'Time',
  BGN_05: 'Time Zone',       BGN_06: 'Reference ID 2',
  BGN_07: 'Transaction Type',BGN_08: 'Action Code',
  HD_01: 'Maintenance Type', HD_02: 'Reserved',
  HD_03: 'Insurance Line',   HD_04: 'Plan Description', HD_05: 'Coverage Level',
  COB_01: 'Payer Responsibility', COB_02: 'Reference ID',
  COB_03: 'COB Code',             COB_04: 'Service Type Code',
}

function humanLabel(segId: string, fieldKey: string): string {
  const idxMatch = fieldKey.match(/_?(\d{2,})$/)
  if (idxMatch) {
    const qualified = `${segId}_${idxMatch[1]}`
    if (FIELD_LABELS[qualified]) return FIELD_LABELS[qualified]
  }
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey]
  const stripped = fieldKey.replace(/_?\d{2,}$/, '')
  return stripped
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim() || fieldKey
}

// ── Qualifier-driven context labels ───────────────────────────────────────────

const DTP_QUALIFIER_LABELS: Record<string, string> = {
  '007': 'Coverage Effective',
  '036': 'Coverage Expiration',
  '096': 'Discharge Time',
  '150': 'Service Period Start',
  '151': 'Service Period End',
  '232': 'Claim Statement Period Start',
  '233': 'Claim Statement Period End',
  '290': 'Claim Received Date',
  '297': 'Certification Revision Date',
  '304': 'Latest Visit or Consultation Date',
  '314': 'Last X-Ray Date',
  '330': 'Evaluation Date',
  '356': 'Coverage Effective Date',
  '357': 'Coverage Expiration Date',
  '360': 'Discharge Date',
  '382': 'Last Menstrual Period',
  '383': 'Last Seen Date',
  '386': 'Last Worked Date',
  '431': 'Onset of Current Symptoms',
  '434': 'Statement Dates',
  '435': 'Admission Date / Time',
  '439': 'Accident Date',
  '440': 'Date of Onset',
  '441': 'Date of Injury',
  '442': 'Date of Disability Begin',
  '443': 'Date of Disability End',
  '444': 'Initial Treatment Date',
  '445': 'Last Visit Date',
  '446': 'Prescription Date',
  '447': 'Begin Therapy Date',
  '448': 'Last Certification Date',
  '449': 'Latest Visit Date',
  '450': 'Retirement Date',
  '451': 'Signature Date',
  '452': 'Date of Last Contact',
  '453': 'Acute Manifestation Date',
  '454': 'Initial Disability Period Start',
  '455': 'Initial Disability Period End',
  '471': 'Prescription Fill Date',
  '472': 'Date of Service',
  '473': 'Authorization Date',
  '474': 'Begin Anesthesia Admin.',
  '475': 'End Anesthesia Admin.',
  '476': 'Claim Adjudication Date',
  '484': 'Coverage Expiration Date',
}

const REF_QUALIFIER_LABELS: Record<string, string> = {
  '0B':  'State License Number',
  '0F':  'Member Identification Number',
  '17':  'Client Number',
  '1A':  'Blue Cross Provider Number',
  '1B':  'Blue Shield Provider Number',
  '1C':  'Medicare Provider Number',
  '1D':  'Medicaid Provider Number',
  '1G':  'Provider UPIN',
  '1H':  'CHAMPUS Identification Number',
  '1J':  'Facility ID Number',
  '1K':  'Payer Claim Control Number',
  '1L':  'Group/Plan Number',
  '1S':  'Ambulatory Patient Group',
  '1W':  'Member ID',
  '23':  'Client Number',
  '28':  'Employee ID',
  '2U':  'Payer ID',
  '4N':  'Special Payment Reference',
  '6R':  'Provider Commercial Number',
  '9A':  'Repriced Claim Reference Number',
  '9C':  'Adjusted Repriced Claim Reference Number',
  '9F':  'Referral Number',
  '9I':  'Attachment Report Type Code',
  '9K':  'Payment Adjustment Number',
  '9Y':  'Plan Network ID',
  'A6':  'Employee Plan Enrollment Number',
  'ABB': 'Rollover Account Number',
  'BB':  'Authorization Number',
  'CE':  'Class of Contract Code',
  'D9':  'Claim Adjustment Number',
  'DK':  'Policy Number',
  'DN':  'Diagnosis Code',
  'EA':  'Medical Record ID',
  'EI':  'Employer ID (EIN)',
  'EW':  'Mammography Certification Number',
  'F4':  'Prior Authorization Number',
  'F5':  'Provider Site Number',
  'F8':  'Original Reference Number',
  'G1':  'Prior Authorization Number',
  'G3':  'Predetermination Number',
  'G4':  'Peer Review Authorization',
  'G6':  'Group Number',
  'HPI': 'National Provider ID (NPI)',
  'IG':  'Insurance Policy Number',
  'LU':  'Location Number',
  'MI':  'Member ID',
  'MR':  'Medical Record Number',
  'NF':  'NUBC Revenue Code',
  'P4':  'Project Code',
  'PQ':  'Payee Identification',
  'SY':  'Social Security Number (SSN)',
  'T4':  'Single Drug Prior Auth. Number',
  'TJ':  'Federal Taxpayer ID',
  'XZ':  'Pharmacy Prescription Number',
  'ZZ':  'Provider Taxonomy Code',
}

const AMT_QUALIFIER_LABELS: Record<string, string> = {
  '100': 'Patient Amount Due',
  '110': 'Estimated Responsibility',
  '122': 'Service Tax Amount',
  '130': 'Part B Coinsurance',
  '131': 'Patient Responsibility Amount',
  '132': 'New Coverage Not Implemented by HMO',
  '141': 'Patient Estimated Responsibility',
  '144': 'Tax Amount',
  '150': 'Medicare Amount Due',
  '153': 'Medicare A Cost Covered',
  '166': 'Provider Penalty Amount',
  '171': 'Withholding Amount',
  '193': 'Negative Ledger Balance',
  '194': 'Positive Ledger Balance',
  'A1':  'Medicare Allowed Amount',
  'A2':  'Medicare Paid Amount',
  'A3':  'Medicare Deductible Amount',
  'A4':  'Medicare Out of Pocket Amount',
  'A8':  'Co-Insurance Amount',
  'AU':  'Coverage Amount',
  'B6':  'Allowed Amount',
  'B7':  'Deductible Amount',
  'B8':  'Copay Amount',
  'B9':  'Out of Pocket Amount',
  'D8':  'Discount Amount',
  'DY':  'Per Day Limit',
  'F2':  'Tax Amount',
  'F3':  'Billed Amount (Institutional)',
  'F4':  'Claim Total Submitted Charges',
  'F5':  'Claim Total Covered Charges',
  'NL':  'Negative Ledger Amount',
  'T':   'Tax Amount',
  'T2':  'Total Claim Before Taxes',
  'YU':  'Additional Amount',
  'ZK':  'Federal Medicare Medicaid Amount',
}

function getSegmentContext(segObj: Record<string, unknown>, segId: string): string | null {
  const rawArr = segObj.raw_data as unknown[] | undefined
  if (!rawArr || rawArr.length < 2) return null
  const q = String(rawArr[1] ?? '').trim().toUpperCase()
  if (!q) return null

  if (segId === 'DTP') return DTP_QUALIFIER_LABELS[q] ?? `Date (${q})`
  if (segId === 'REF') return REF_QUALIFIER_LABELS[q] ?? `Ref (${q})`
  if (segId === 'AMT') return AMT_QUALIFIER_LABELS[q] ?? `Amount (${q})`
  return null
}

// ── Field extraction ──────────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['Segment_ID', 'raw_data'])

interface ExtractedField {
  segObj: Record<string, unknown>
  fieldKey: string
  fieldId: string
  label: string
  techRef: string
  segId: string
}

function extractSegmentFields(
  segObj: Record<string, unknown>,
  segId: string,
  segIndex: number,
  loopKey: string,
  idSuffix: string,
): ExtractedField[] {
  const fields: ExtractedField[] = []
  let hasNamedFields = false
  const segContext = getSegmentContext(segObj, segId)

  for (const fieldKey of Object.keys(segObj)) {
    if (SKIP_KEYS.has(fieldKey)) continue
    const val = segObj[fieldKey]
    if (Array.isArray(val)) {
      if (val.every(v => String(v ?? '').trim() === '')) continue
    } else if (val != null && typeof val !== 'object') {
      if (String(val).trim() === '') continue
    } else {
      continue
    }
    hasNamedFields = true
    const baseLabel = humanLabel(segId, fieldKey)
    const posMatch = fieldKey.match(/_?(\d{2,})$/)
    const posNum = posMatch ? parseInt(posMatch[1], 10) : null
    const label = segContext && posNum !== null && posNum > 1
      ? `${segContext} — ${baseLabel}`
      : baseLabel

    fields.push({
      segObj, fieldKey,
      fieldId: `dyn-${loopKey}-${segId}-${fieldKey}${segIndex > 0 ? `-${segIndex}` : ''}${idSuffix}`,
      label,
      techRef: `${segId}.${fieldKey}`,
      segId,
    })
  }

  if (!hasNamedFields && Array.isArray(segObj.raw_data)) {
    const rawArr = segObj.raw_data as unknown[]
    for (let ri = 1; ri < rawArr.length; ri++) {
      if (String(rawArr[ri] ?? '').trim() === '') continue
      const padIdx = String(ri).padStart(2, '0')
      const baseLabel = humanLabel(segId, `${segId}_${padIdx}`)
      const label = segContext && ri > 1
        ? `${segContext} — ${baseLabel}`
        : baseLabel
      fields.push({
        segObj,
        fieldKey: `__raw_${ri}`,
        fieldId: `dyn-${loopKey}-${segId}-raw${ri}${segIndex > 0 ? `-${segIndex}` : ''}${idSuffix}`,
        label,
        techRef: `${segId}*${ri}`,
        segId,
      })
    }
  }
  return fields
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

const ANCHOR_SEGS: Record<string, string> = {
  '2400':      'LX',  '835_2100': 'CLP', '835_2110': 'SVC',
  '834_2000':  'INS', '834_2300': 'HD',  '834_2700': 'LX',
  '2300':      'CLM', '2320':     'SBR',
}

function flattenLoopInstances(
  instances: Record<string, unknown>[],
  loopKey: string,
  errors: ValidationError[],
  handleCommit: (seg: Record<string, unknown>, keys: string[], val: string) => void,
  activeFieldPath: string | null,
): { fields: React.ReactNode[]; isRepeatable: boolean; instanceCount: number } {
  const anchorSeg = ANCHOR_SEGS[loopKey]
  const anchoredInstances = anchorSeg
    ? instances.filter(inst => inst[anchorSeg] !== undefined)
    : instances
  const isRepeatable = anchoredInstances.length > 1

  if (!isRepeatable) {
    const allFields: ExtractedField[] = []
    instances.forEach((inst, ii) => {
      Object.keys(inst).forEach((segId) => {
        const rawSeg = inst[segId]
        const segList = Array.isArray(rawSeg) ? rawSeg : [rawSeg]
        segList.forEach((seg, si) => {
          if (!seg || typeof seg !== 'object') return
          extractSegmentFields(seg as Record<string, unknown>, segId, si, loopKey, `-inst${ii}`)
            .forEach(f => allFields.push(f))
        })
      })
    })
    return {
      isRepeatable: false,
      instanceCount: 1,
      fields: allFields.map(f => renderField(f, loopKey, errors, handleCommit, activeFieldPath)),
    }
  }

  const groups = anchoredInstances.map((inst, groupIdx) => {
    const groupFields: ExtractedField[] = []
    Object.keys(inst).forEach((segId) => {
      const rawSeg = inst[segId]
      const segList = Array.isArray(rawSeg) ? rawSeg : [rawSeg]
      segList.forEach((seg, si) => {
        if (!seg || typeof seg !== 'object') return
        extractSegmentFields(seg as Record<string, unknown>, segId, si, loopKey, `-g${groupIdx}`)
          .forEach(f => groupFields.push(f))
      })
    })
    const renderedFields = groupFields.map(f => renderField(f, loopKey, errors, handleCommit, activeFieldPath))
    return (
      <div key={groupIdx} style={{
        border: '1.5px solid rgba(26,26,46,0.1)', borderRadius: 10,
        padding: '16px 18px', background: groupIdx % 2 === 0 ? '#FDFAF4' : '#FFFFFF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 800,
            color: '#4ECDC4', background: 'rgba(78,205,196,0.1)',
            border: '1.5px solid rgba(78,205,196,0.3)', borderRadius: 6, padding: '2px 8px',
          }}>
            #{groupIdx + 1} of {anchoredInstances.length}
          </span>
        </div>
        <FieldGrid cols={2}>{renderedFields}</FieldGrid>
      </div>
    )
  })

  return { isRepeatable: true, instanceCount: anchoredInstances.length, fields: groups }
}

function renderField(
  f: ExtractedField,
  loopKey: string,
  errors: ValidationError[],
  handleCommit: (seg: Record<string, unknown>, keys: string[], val: string) => void,
  activeFieldPath: string | null,
): React.ReactNode {
  let displayVal: string
  if (f.fieldKey.startsWith('__raw_')) {
    const ri = parseInt(f.fieldKey.replace('__raw_', ''), 10)
    const rawArr = f.segObj.raw_data as unknown[]
    displayVal = String(rawArr?.[ri] ?? '')
  } else {
    const raw = f.segObj[f.fieldKey]
    displayVal = Array.isArray(raw) ? raw.join(':') : String(raw ?? '')
  }

  const narrowKey = f.fieldKey.startsWith('__raw_')
    ? `${f.segId}${f.fieldKey.replace('__raw_', '').padStart(2, '0')}`
    : `${f.segId}${f.fieldKey.replace(/^.*?_(\d+)$/, '$1').padStart(2, '0')}`

  const fieldErrors = errors.filter((e) => {
    if (e.loop && !e.loop.toUpperCase().startsWith(loopKey.toUpperCase())) return false
    const el = (e.element ?? e.field ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    return el === narrowKey.toUpperCase()
  })

  return (
    <div key={f.fieldId} style={{ minWidth: 0, overflow: 'hidden' }}>
      <FormField
        id={f.fieldId}
        label={f.label}
        techRef={f.techRef}
        mono
        value={displayVal}
        onCommit={(v) => {
          if (f.fieldKey.startsWith('__raw_')) {
            const ri = parseInt(f.fieldKey.replace('__raw_', ''), 10)
            const rawArr = f.segObj.raw_data as unknown[]
            if (rawArr && rawArr.length > ri) rawArr[ri] = v
          } else if (Array.isArray(f.segObj[f.fieldKey])) {
            f.segObj[f.fieldKey] = v.includes(':') ? v.split(':') : [v]
          } else {
            f.segObj[f.fieldKey] = v
          }
          handleCommit(f.segObj, [f.fieldKey], v)
        }}
        errors={fieldErrors}
        isActive={isFieldActive(activeFieldPath, loopKey, f.fieldKey)}
      />
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROTATIONS = [-0.3, 0.3, -0.4, 0.4, 0, -0.2, 0.2]

// ── Auto-scroll to focused field ──────────────────────────────────────────────

function useFocusFieldScroll() {
  const focusFieldId = useAppStore((s) => s.focusFieldId)
  const setFocusFieldId = useAppStore((s) => s.setFocusFieldId)

  useEffect(() => {
    if (!focusFieldId) return
    
    const timer = setTimeout(() => {
      const el = document.getElementById(focusFieldId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
        
        // Clear focus after animation
        setTimeout(() => setFocusFieldId(null), 2000)
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [focusFieldId, setFocusFieldId])
}

// ── Main FormEditorView ───────────────────────────────────────────────────────

export default function FormEditorView() {
  const parseResult    = useAppStore((s) => s.parseResult)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const selectedPath   = useAppStore((s) => s.selectedPath)
  const isLoading      = useAppStore((s) => s.isLoading)
  const transactionType = useAppStore((s) => s.transactionType)

  // Call the focus field scroll hook
  useFocusFieldScroll()

  const sectionRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({})
  const [highlightedLoop, setHighlightedLoop] = useState<string | null>(null)
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPath || !parseResult) return
    const upper = selectedPath.toUpperCase()
    const rootData = parseResult as Record<string, unknown>
    const loops = (rootData.loops || (rootData.data as Record<string, unknown>)?.loops || {}) as Record<string, unknown>
    const matchKey = Object.keys(loops).find(k => upper.includes(k.toUpperCase()))
    if (!matchKey) return
    if (!sectionRefs.current[matchKey]) sectionRefs.current[matchKey] = { current: null }
    const ref = sectionRefs.current[matchKey]
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightedLoop(matchKey)
      setActiveFieldPath(selectedPath)
      const t = setTimeout(() => { setHighlightedLoop(null); setActiveFieldPath(null) }, 2000)
      return () => clearTimeout(t)
    }
  }, [selectedPath, parseResult])

  const handleCommit = useCallback((segment: Record<string, unknown>, targetKeys: string[], newValue: string) => {
    if (!parseResult || !segment) return
    for (const fk of targetKeys) {
      if (fk.startsWith('__raw_')) {
        const ri = parseInt(fk.replace('__raw_', ''), 10)
        const rawArr = segment.raw_data as unknown[] | undefined
        if (rawArr && rawArr.length > ri) { rawArr[ri] = newValue; break }
      } else if (segment[fk] !== undefined) {
        segment[fk] = newValue; break
      }
    }
    const newResult = structuredClone(parseResult) as Record<string, unknown>
    const clearErrors = (arr: unknown[]) => arr?.filter((e: unknown) => {
      const err = e as ValidationError
      const el = (err.element || err.field || '').toUpperCase()
      return !targetKeys.some(k => el.includes(k.replace('__raw_', '').toUpperCase()))
    }) ?? arr
    if (Array.isArray(newResult.errors)) newResult.errors = clearErrors(newResult.errors)
    const inner = newResult.data as Record<string, unknown> | undefined
    if (inner && Array.isArray(inner.errors)) inner.errors = clearErrors(inner.errors)
    setParseResult(newResult)
  }, [parseResult, setParseResult])

  if (isLoading) return null
  if (!parseResult) return <FormEmptyState />

  const rootData = parseResult as Record<string, unknown>
  const loops  = (rootData.loops  || (rootData.data as Record<string, unknown>)?.loops  || {}) as Record<string, unknown>
  const errors = (rootData.errors || (rootData.data as Record<string, unknown>)?.errors || []) as ValidationError[]
  const meta   = (rootData.metadata || (rootData.data as Record<string, unknown>)?.metadata || {}) as Record<string, unknown>
  const txType = String(transactionType || meta.transaction_type || 'unknown')

  const loopKeys = Object.keys(loops)
  if (loopKeys.length === 0) return <FormEmptyState />

  for (const k of loopKeys) {
    if (!sectionRefs.current[k]) sectionRefs.current[k] = { current: null }
  }

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

          {loopKeys.map((loopKey, li) => {
            const raw = loops[loopKey]
            const instances: Record<string, unknown>[] = Array.isArray(raw)
              ? (raw as Record<string, unknown>[]).filter(inst => inst && typeof inst === 'object')
              : raw && typeof raw === 'object' ? [raw as Record<string, unknown>] : []

            if (instances.length === 0) return null

            const isHighlighted = highlightedLoop === loopKey
            const loopMeta = getLoopMeta(loopKey)
            const rotation = ROTATIONS[li % ROTATIONS.length]

            const { fields, isRepeatable } = flattenLoopInstances(
              instances, loopKey, errors, handleCommit, activeFieldPath
            )

            if (fields.length === 0) return null
            if (!sectionRefs.current[loopKey]) sectionRefs.current[loopKey] = { current: null }

            return (
              <SectionCard
                key={loopKey}
                sectionRef={sectionRefs.current[loopKey]}
                isHighlighted={isHighlighted}
              >
                <SectionHeader
                  title={loopMeta.title}
                  description={loopMeta.desc}
                  icon={loopMeta.icon}
                  rotate={rotation}
                />
                <div style={{ position: 'absolute', top: 12, right: 14 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                    color: 'rgba(26,26,46,0.35)', background: 'rgba(26,26,46,0.04)',
                    border: '1px solid rgba(26,26,46,0.1)', borderRadius: 4, padding: '2px 8px',
                  }}>
                    {loopKey}
                  </span>
                </div>
                {isRepeatable ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{fields}</div>
                ) : (
                  <FieldGrid cols={2}>{fields}</FieldGrid>
                )}
              </SectionCard>
            )
          })}
        </div>
      </div>
    </>
  )
}