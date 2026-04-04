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

// ── EDI data accessor helpers ─────────────────────────────────────────────────

function getErrors(errors: ValidationError[], targetLoop: string, ...elementKeys: string[]): ValidationError[] {
  return errors.filter((e) => {
    if (e.loop && !e.loop.toUpperCase().startsWith(targetLoop.toUpperCase())) return false
    const el = (e.element ?? e.field ?? '').toUpperCase()
    const typ = (e.type ?? '').toUpperCase()
    return elementKeys.some((k) => el.includes(k.toUpperCase()) || typ.includes(k.toUpperCase()))
  })
}

function isFieldActive(activePath: string | null, targetLoop: string, fieldKey: string): boolean {
  if (!activePath) return false
  const path = activePath.toUpperCase()
  if (!path.includes(targetLoop.toUpperCase())) return false
  return path.replace(/_/g, '').replace(/\./g, '').includes(fieldKey.toUpperCase().replace(/_/g, ''))
}

// ── Shared styled input ─────────────────────────────────────────────────────

interface FieldProps {
  id: string; label: string; value: string
  onCommit: (v: string) => void
  errors?: ValidationError[]; isActive?: boolean; mono?: boolean
  hint?: string; techRef?: string
}

function FormField({ id, label, value, onCommit, errors = [], isActive, mono, hint, techRef }: FieldProps) {
  const [localVal, setLocalVal] = useState(value)
  useEffect(() => { setLocalVal(value) }, [value])
  const hasError = errors.length > 0
  const errorMsg = errors[0]?.message ?? errors[0]?.msg ?? ''
  const isDirty = localVal !== value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <label htmlFor={id} style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: hasError ? '#FF6B6B' : 'rgba(26,26,46,0.6)', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0, maxWidth: '100%', lineHeight: 1.3 }}>
          {label}
        </label>
        {techRef && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(26,26,46,0.3)', flexShrink: 0 }}>{techRef}</span>
        )}
        {hasError && !isDirty && (
          <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 9, fontWeight: 800, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)', border: '1.5px solid #FF6B6B', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>⚠ ERROR</span>
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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#1A1A2E', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>{title}</h2>
          {description && (
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 11, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.02em', fontStyle: 'italic' }}>— {description}</span>
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

// ── Loop titles & descriptions ──────────────────────────────────────────────

const LOOP_META: Record<string, { title: string; icon: string; desc: string }> = {
  HEADER:      { title: 'Interchange Envelope',       icon: '📨', desc: 'ISA/GS/ST envelope containing sender, receiver, and control information' },
  '1000A':     { title: 'Submitter Information',       icon: '📤', desc: 'Organization or entity submitting this transaction' },
  '1000B':     { title: 'Receiver Information',        icon: '📥', desc: 'Organization or entity receiving this transaction' },
  '2000A':     { title: 'Billing Provider',            icon: '🏥', desc: 'Hierarchical level for the billing/rendering provider' },
  '2000B':     { title: 'Subscriber',                  icon: '👤', desc: 'Hierarchical level for the insurance subscriber' },
  '2000C':     { title: 'Patient',                     icon: '🧑‍⚕️', desc: 'Hierarchical level for the patient (if different from subscriber)' },
  '2010AA':    { title: 'Billing Provider Details',    icon: '🏥', desc: 'Name, address, NPI, and Tax ID of the billing provider' },
  '2010AB':    { title: 'Pay-To Provider',             icon: '💰', desc: 'Provider to whom payment should be sent (if different)' },
  '2010BA':    { title: 'Subscriber Name & Info',      icon: '👤', desc: 'Subscriber name, member ID, address, and demographics' },
  '2010BB':    { title: 'Payer Information',           icon: '🏦', desc: 'Insurance payer name and identification' },
  '2010CA':    { title: 'Patient Name & Info',         icon: '🧑', desc: 'Patient name, address, and demographics' },
  '2010CB':    { title: 'Responsible Party',           icon: '👥', desc: 'Responsible party when different from patient' },
  '2300':      { title: 'Claim Information',           icon: '📋', desc: 'Claim ID, total charge, facility code, and diagnosis codes' },
  '2310A':     { title: 'Referring Provider',          icon: '🩺', desc: 'Provider who referred the patient for services' },
  '2310B':     { title: 'Rendering Provider',          icon: '🩺', desc: 'Provider who rendered the services on the claim' },
  '2310E':     { title: 'Service Facility',            icon: '🏢', desc: 'Location where services were performed' },
  '2320':      { title: 'Other Subscriber',            icon: '👥', desc: 'Secondary/tertiary payer information for coordination of benefits' },
  '2400':      { title: 'Service Line Items',          icon: '💊', desc: 'Individual procedure codes, charges, units, and service dates' },
  '2420A':     { title: 'Rendering Provider (Line)',   icon: '🩺', desc: 'Rendering provider at the service line level' },
  '2420B':     { title: 'Purchased Service Provider',  icon: '🔗', desc: 'Provider from whom services were purchased' },
  '835_HEADER':{ title: 'Payment Header',              icon: '💳', desc: 'Payment amount, method (ACH/check), and trace number' },
  '835_1000A': { title: 'Payer Identification',        icon: '🏦', desc: 'Insurance payer name and address' },
  '835_1000B': { title: 'Payee Identification',        icon: '🏥', desc: 'Provider/payee name and address' },
  '835_2000':  { title: 'Claim Summary',               icon: '📊', desc: 'Header-level claim summary grouping' },
  '835_2100':  { title: 'Claim Payment Detail',        icon: '📋', desc: 'Claim ID, billed amount, paid amount, and patient responsibility' },
  '835_2110':  { title: 'Service Line Payments',       icon: '💊', desc: 'Service-level payment, adjustments, and procedure codes' },
  '834_HEADER':{ title: 'Enrollment File Header',      icon: '📨', desc: 'BGN segment with file purpose, date, and action code' },
  '834_1000A': { title: 'Sponsor / Employer',          icon: '🏢', desc: 'Employer or plan sponsor identification' },
  '834_1000B': { title: 'Insurance Payer',             icon: '🏦', desc: 'Insurance carrier identification' },
  '834_1000C': { title: 'TPA / Broker',                icon: '🤝', desc: 'Third-party administrator or broker information' },
  '834_2000':  { title: 'Member Enrollment',           icon: '👤', desc: 'INS segment with maintenance type, relationship, and benefit status' },
  '834_2100A': { title: 'Member Name & Demographics',  icon: '🪪', desc: 'Member name, DOB, gender, address, and ID numbers' },
  '834_2100B': { title: 'Incorrect Member Name',       icon: '✏️', desc: 'Previous/incorrect member name being corrected' },
  '834_2100C': { title: 'Member Mailing Address',      icon: '📬', desc: 'Mailing address if different from residence' },
  '834_2300':  { title: 'Health Coverage',              icon: '🛡️', desc: 'HD segment with insurance line, plan description, and coverage dates' },
  '834_2320':  { title: 'COB Information',             icon: '🔄', desc: 'Coordination of benefits / other insurance information' },
  '834_2700':  { title: 'Reporting Categories',        icon: '📊', desc: 'Member reporting and classification data' },
  UNASSIGNED:  { title: 'General Segments',            icon: '📄', desc: 'Segments not assigned to a specific loop' },
}

// ── Human-readable field label mapping ──────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  // ISA
  ISA_01: 'Authorization Qualifier', ISA_02: 'Authorization Info',
  ISA_03: 'Security Qualifier', ISA_04: 'Security Info',
  ISA_05: 'Sender ID Qualifier', ISA_06: 'Sender ID',
  ISA_07: 'Receiver ID Qualifier', ISA_08: 'Receiver ID',
  ISA_09: 'Interchange Date', ISA_10: 'Interchange Time',
  ISA_11: 'Repetition Separator', ISA_12: 'Version Number',
  ISA_13: 'Control Number', ISA_14: 'Ack Requested', ISA_15: 'Usage Indicator',
  // GS
  GS_01: 'Functional ID Code', GS_02: 'Application Sender',
  GS_03: 'Application Receiver', GS_04: 'Date', GS_05: 'Time',
  GS_06: 'Group Control Number', GS_07: 'Agency Code', GS_08: 'Version Code',
  // ST / SE
  ST_01: 'Transaction Set ID', ST_02: 'Control Number', ST_03: 'Implementation Reference',
  SE_01: 'Segment Count', SE_02: 'Control Number',
  // BHT
  BHT_01: 'Hierarchical Structure', BHT_02: 'Transaction Purpose',
  BHT_03: 'Reference ID', BHT_04: 'Date', BHT_05: 'Time', BHT_06: 'Claim Type',
  // HL
  HL_01: 'Hierarchical ID', HL_02: 'Parent ID', HL_03: 'Level Code', HL_04: 'Has Child Code',
  // NM1
  NM1_01: 'Entity ID Code', NM1_02: 'Entity Type',
  NM1_03: 'Last / Org Name', NM1_04: 'First Name', NM1_05: 'Middle Name',
  NM1_06: 'Prefix', NM1_07: 'Suffix', NM1_08: 'ID Qualifier', NM1_09: 'ID Number',
  // N1
  N1_01: 'Entity ID Code', N1_02: 'Name', N1_03: 'ID Qualifier', N1_04: 'ID Number',
  // N3 / N4
  N3_01: 'Street Address', N3_02: 'Address Line 2',
  N4_01: 'City', N4_02: 'State', N4_03: 'ZIP Code', N4_04: 'Country Code',
  // PER
  PER_01: 'Contact Function', PER_02: 'Contact Name',
  PER_03: 'Communication Type', PER_04: 'Phone / Email', PER_05: 'Comm Type 2', PER_06: 'Number 2',
  // REF
  REF_01: 'Reference Qualifier', REF_02: 'Reference ID', REF_03: 'Description',
  // DMG
  DMG_01: 'Date Format', DMG_02: 'Date of Birth', DMG_03: 'Gender Code',
  // DTP
  DTP_01: 'Date Qualifier', DTP_02: 'Date Format', DTP_03: 'Date Value',
  // DTM
  DTM_01: 'Date Qualifier', DTM_02: 'Date Value',
  // SBR
  SBR_01: 'Payer Responsibility', SBR_02: 'Relationship Code',
  SBR_03: 'Group/Policy Number', SBR_04: 'Group Name', SBR_09: 'Claim Filing Code',
  // PRV
  PRV_01: 'Provider Code', PRV_02: 'Qualifier', PRV_03: 'Taxonomy Code',
  // PAT
  PAT_01: 'Relationship Code',
  // CLM
  CLM_01: 'Patient Control Number', CLM_02: 'Total Charge Amount',
  CLM_03: 'Claim Type', CLM_05: 'Place of Service / Frequency',
  CLM_06: 'Provider Signature', CLM_07: 'Assignment of Benefits',
  CLM_08: 'Release of Information', CLM_09: 'Prior Auth',
  // HI
  HI_01: 'Diagnosis Code 1 (Primary)', HI_02: 'Diagnosis Code 2',
  HI_03: 'Diagnosis Code 3', HI_04: 'Diagnosis Code 4',
  HI_05: 'Diagnosis Code 5', HI_06: 'Diagnosis Code 6',
  // LX
  LX_01: 'Service Line Number',
  // SV1
  SV1_01: 'Procedure Code', SV1_02: 'Charge Amount', SV1_03: 'Unit of Measure',
  SV1_04: 'Quantity / Units', SV1_05: 'Facility Code', SV1_07: 'Diagnosis Pointer',
  // SV2
  SV2_01: 'Revenue Code', SV2_02: 'Procedure Code', SV2_03: 'Charge Amount',
  SV2_04: 'Unit of Measure', SV2_05: 'Units',
  // AMT / QTY
  AMT_01: 'Amount Qualifier', AMT_02: 'Amount',
  QTY_01: 'Quantity Qualifier', QTY_02: 'Quantity',
  // CL1
  CL1_01: 'Admission Type', CL1_02: 'Admission Source', CL1_03: 'Patient Status',
  // HCP
  HCP_01: 'Pricing Method', HCP_02: 'Amount',
  // BPR
  BPR_01: 'Transaction Code', BPR_02: 'Payment Amount',
  BPR_03: 'Credit/Debit', BPR_04: 'Payment Method', BPR_16: 'Payment Date',
  // TRN
  TRN_01: 'Trace Type', TRN_02: 'Check / EFT Trace Number', TRN_03: 'Payer ID',
  // CLP
  CLP_01: 'Claim ID', CLP_02: 'Claim Status Code', CLP_03: 'Total Billed',
  CLP_04: 'Total Paid', CLP_05: 'Patient Responsibility',
  CLP_06: 'Filing Indicator', CLP_07: 'Payer Control Number',
  CLP_08: 'Facility Code', CLP_09: 'Frequency Code',
  // SVC
  SVC_01: 'Procedure Code', SVC_02: 'Submitted Amount', SVC_03: 'Paid Amount',
  SVC_04: 'Revenue Code', SVC_05: 'Units',
  // CAS
  CAS_01: 'Adjustment Group', CAS_02: 'Reason Code', CAS_03: 'Adjustment Amount',
  CAS_04: 'Quantity', CAS_05: 'Reason Code 2', CAS_06: 'Amount 2',
  // INS
  INS_01: 'Subscriber Indicator', INS_02: 'Relationship Code',
  INS_03: 'Maintenance Type', INS_04: 'Benefit Status',
  INS_05: 'Medicare Plan', INS_06: 'COBRA Event', INS_07: 'Employment Status',
  INS_08: 'Student Status',
  // BGN
  BGN_01: 'Purpose Code', BGN_02: 'Reference ID',
  BGN_03: 'Date', BGN_04: 'Time', BGN_08: 'Action Code',
  // HD
  HD_01: 'Maintenance Type', HD_03: 'Insurance Line',
  HD_04: 'Plan Description', HD_05: 'Coverage Level',
  // COB
  COB_01: 'Payer Responsibility', COB_02: 'Reference ID', COB_03: 'COB Code',
}

/**
 * Given a segment ID and a raw field key from the parser output,
 * produce a clean, readable label.
 *
 * Priority:
 *  1. Direct lookup in FIELD_LABELS  e.g.  "NM1_03"
 *  2. Schema-generated prop names    e.g.  "LineItemChargeAmount_02" → try "SV1_02"
 *  3. PascalCase split fallback      e.g.  "BillingProviderName" → "Billing Provider Name"
 */
function humanLabel(segId: string, fieldKey: string): string {
  // 1. Try segment-qualified key
  const idxMatch = fieldKey.match(/_?(\d{2,})$/)
  if (idxMatch) {
    const qualified = `${segId}_${idxMatch[1]}`
    if (FIELD_LABELS[qualified]) return FIELD_LABELS[qualified]
  }
  // 2. Try fieldKey directly
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey]
  // 3. PascalCase split
  const stripped = fieldKey.replace(/_?\d{2,}$/, '')
  return stripped
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim() || fieldKey
}

function getLoopMeta(loopKey: string): { title: string; icon: string; desc: string } {
  if (LOOP_META[loopKey]) return LOOP_META[loopKey]
  // Fallback: clean the key for display
  return {
    title: loopKey.replace(/_/g, ' '),
    icon: '📁',
    desc: `Loop ${loopKey}`,
  }
}

// ── Dynamic Form Renderer ────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['Segment_ID', 'raw_data'])
const ROTATIONS = [-0.3, 0.3, -0.4, 0.4, 0, -0.2, 0.2]

interface LoopCardProps {
  loopKey: string
  instances: Record<string, unknown>[]
  errors: ValidationError[]
  handleCommit: (seg: Record<string, unknown>, keys: string[], val: string) => void
  activeFieldPath: string | null
  loopIndex: number
  isHighlighted: boolean
  sectionRef: React.RefObject<HTMLDivElement | null>
}

function LoopCard({ loopKey, instances, errors, handleCommit, activeFieldPath, loopIndex, isHighlighted, sectionRef }: LoopCardProps) {
  const meta = getLoopMeta(loopKey)
  const rotation = ROTATIONS[loopIndex % ROTATIONS.length]
  const isRepeatable = instances.length > 1

  return (
    <SectionCard sectionRef={sectionRef} isHighlighted={isHighlighted}>
      <SectionHeader title={meta.title} description={meta.desc} icon={meta.icon} rotate={rotation} />

      {/* Loop key badge */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {instances.map((inst, idx) => (
            <InstanceBlock
              key={idx} instance={inst} instanceIndex={idx} loopKey={loopKey}
              errors={errors} handleCommit={handleCommit} activeFieldPath={activeFieldPath}
              totalInstances={instances.length}
            />
          ))}
        </div>
      ) : (
        <InstanceFields
          instance={instances[0]} loopKey={loopKey}
          errors={errors} handleCommit={handleCommit} activeFieldPath={activeFieldPath}
          idSuffix=""
        />
      )}
    </SectionCard>
  )
}

function InstanceBlock({ instance, instanceIndex, loopKey, errors, handleCommit, activeFieldPath, totalInstances }: {
  instance: Record<string, unknown>; instanceIndex: number; loopKey: string
  errors: ValidationError[]; handleCommit: (seg: Record<string, unknown>, keys: string[], val: string) => void
  activeFieldPath: string | null; totalInstances: number
}) {
  return (
    <div style={{
      border: '1.5px solid rgba(26,26,46,0.1)', borderRadius: 10,
      padding: '16px 18px', background: instanceIndex % 2 === 0 ? '#FDFAF4' : '#FFFFFF',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 800,
          color: '#4ECDC4', background: 'rgba(78,205,196,0.1)',
          border: '1.5px solid rgba(78,205,196,0.3)', borderRadius: 6, padding: '2px 8px',
        }}>
          #{instanceIndex + 1} of {totalInstances}
        </span>
      </div>
      <InstanceFields
        instance={instance} loopKey={loopKey}
        errors={errors} handleCommit={handleCommit} activeFieldPath={activeFieldPath}
        idSuffix={`-${instanceIndex}`}
      />
    </div>
  )
}

function InstanceFields({ instance, loopKey, errors, handleCommit, activeFieldPath, idSuffix }: {
  instance: Record<string, unknown>; loopKey: string
  errors: ValidationError[]; handleCommit: (seg: Record<string, unknown>, keys: string[], val: string) => void
  activeFieldPath: string | null; idSuffix: string
}) {
  if (!instance || typeof instance !== 'object') return null

  const allFields: Array<{
    segObj: Record<string, unknown>; fieldKey: string; fieldId: string
    label: string; techRef: string; segId: string
  }> = []

  // Each key in an instance is a segment ID (e.g. "NM1", "N3", "REF")
  // whose value is either a segment object or an array of segment objects.
  // We must go INTO each segment to find the scalar fields.
  for (const segId of Object.keys(instance)) {
    const rawSeg = instance[segId]
    const segList = Array.isArray(rawSeg) ? rawSeg : [rawSeg]

    for (let si = 0; si < segList.length; si++) {
      const seg = segList[si]
      if (!seg || typeof seg !== 'object') continue
      const segObj = seg as Record<string, unknown>

      for (const fieldKey of Object.keys(segObj)) {
        if (SKIP_KEYS.has(fieldKey)) continue
        const val = segObj[fieldKey]

        // Convert arrays (composite elements like ["HC","99213"]) to joined string
        // Skip nested objects that aren't arrays (shouldn't happen, but safety)
        if (Array.isArray(val)) {
          // array composites are fine — will be joined at render time
        } else if (val != null && typeof val !== 'object') {
          // scalar — fine
        } else {
          continue
        }

        const label = humanLabel(segId, fieldKey)
        const techRef = `${segId}.${fieldKey}`
        allFields.push({
          segObj, fieldKey,
          fieldId: `dyn-${loopKey}-${segId}-${fieldKey}${si > 0 ? `-${si}` : ''}${idSuffix}`,
          label, techRef, segId,
        })
      }
    }
  }

  if (allFields.length === 0) {
    return (
      <div style={{ padding: '16px', border: '1.5px dashed rgba(26,26,46,0.15)', borderRadius: 8, textAlign: 'center', fontStyle: 'italic', fontFamily: 'Nunito, sans-serif', color: 'rgba(26,26,46,0.35)', fontSize: 12 }}>
        No editable fields in this loop.
      </div>
    )
  }

  return (
    <FieldGrid cols={2}>
      {allFields.map(({ segObj, fieldKey, fieldId, label, techRef, segId }) => {
        const raw = segObj[fieldKey]
        const displayVal = Array.isArray(raw) ? raw.join(':') : String(raw ?? '')
        return (
          <div key={fieldId} style={{ minWidth: 0, overflow: 'hidden' }}>
            <FormField
              id={fieldId}
              label={label}
              techRef={techRef}
              mono
              value={displayVal}
              onCommit={(v) => {
                // If original was array (composite), split back on ':'
                if (Array.isArray(segObj[fieldKey])) {
                  segObj[fieldKey] = v.includes(':') ? v.split(':') : [v]
                } else {
                  segObj[fieldKey] = v
                }
                handleCommit(segObj, [fieldKey], v)
              }}
              errors={getErrors(errors, loopKey, fieldKey, segId)}
              isActive={isFieldActive(activeFieldPath, loopKey, fieldKey)}
            />
          </div>
        )
      })}
    </FieldGrid>
  )
}

// ── Main FormEditorView ───────────────────────────────────────────────────────

export default function FormEditorView() {
  const parseResult = useAppStore((s) => s.parseResult)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const selectedPath = useAppStore((s) => s.selectedPath)
  const isLoading = useAppStore((s) => s.isLoading)
  const transactionType = useAppStore((s) => s.transactionType)

  const sectionRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({})
  const [highlightedLoop, setHighlightedLoop] = useState<string | null>(null)
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null)

  // Scroll-to-section on tree click
  useEffect(() => {
    if (!selectedPath) return
    const upper = selectedPath.toUpperCase()
    // Find matching loop key
    const loops = (parseResult as Record<string, unknown>)?.loops as Record<string, unknown> || {}
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
    let updated = false

    for (const fk of targetKeys) {
      if (segment[fk] !== undefined) {
        segment[fk] = newValue
        updated = true
        break
      }
    }

    if (!updated) {
      const rawData = segment.raw_data
      if (Array.isArray(rawData)) {
        for (const fk of targetKeys) {
          const match = fk.match(/0*(\d+)$/)
          if (match) {
            const idx = parseInt(match[1], 10)
            if (rawData.length > idx) { rawData[idx] = newValue; updated = true; break }
          }
        }
      }
    }

    const newParseResult = structuredClone(parseResult) as Record<string, unknown>
    const clearErrors = (arr: unknown[]) => arr ? arr.filter((e: unknown) => {
      const err = e as ValidationError
      const el = (err.element || err.field || '').toUpperCase()
      return !targetKeys.some(k => el.includes(k.toUpperCase()))
    }) : arr

    if (Array.isArray(newParseResult.errors)) newParseResult.errors = clearErrors(newParseResult.errors)
    const inner = newParseResult.data as Record<string, unknown> | undefined
    if (inner && Array.isArray(inner.errors)) inner.errors = clearErrors(inner.errors)
    setParseResult(newParseResult)
  }, [parseResult, setParseResult])

  if (isLoading) return null
  if (!parseResult) return <FormEmptyState />

  const rootData = parseResult as Record<string, unknown>
  const loops = (rootData.loops || (rootData.data as Record<string, unknown>)?.loops || {}) as Record<string, unknown>
  const errors: ValidationError[] = (rootData.errors || (rootData.data as Record<string, unknown>)?.errors || []) as ValidationError[]
  const txType = String(transactionType || (rootData.metadata as Record<string, unknown>)?.transaction_type as string || (rootData.data as Record<string, unknown>)?.metadata && ((rootData.data as Record<string, unknown>).metadata as Record<string, unknown>)?.transaction_type as string || 'unknown')
  const loopKeys = Object.keys(loops)

  if (loopKeys.length === 0) return <FormEmptyState />

  // Ensure refs exist for all loops
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
              : (raw && typeof raw === 'object' ? [raw as Record<string, unknown>] : [])

            if (instances.length === 0) return null

            return (
              <LoopCard
                key={loopKey}
                loopKey={loopKey}
                instances={instances}
                errors={errors}
                handleCommit={handleCommit}
                activeFieldPath={activeFieldPath}
                loopIndex={li}
                isHighlighted={highlightedLoop === loopKey}
                sectionRef={sectionRefs.current[loopKey]!}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}