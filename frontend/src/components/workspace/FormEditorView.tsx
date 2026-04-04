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

function findLoop(rootData: any, ...keys: string[]): any {
  if (!rootData) return null
  const ediData = rootData.data?.loops || rootData.loops || rootData.data || rootData
  if (!ediData) return null

  for (const k of keys) {
    if (ediData[k]) return ediData[k]
  }
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
        if (seg.raw_data[idx] != null && seg.raw_data[idx] !== '') {
          return String(seg.raw_data[idx])
        }
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
  const loop = targetLoop.toUpperCase()
  
  if (!path.includes(loop)) return false
  
  return elementKeys.some(key => {
    const k = key.toUpperCase().replace('_', '')
    const normalizedPath = path.replace(/_/g, '').replace(/\./g, '')
    return normalizedPath.endsWith(k)
  })
}


// ── Shared styled input ────────────────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  value: string
  onCommit: (newValue: string) => void
  errors?: ValidationError[]
  isActive?: boolean
  mono?: boolean
  hint?: string
  onAskAI?: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

function FormField({ id, label, value, onCommit, errors = [], isActive, mono, hint, onAskAI, inputRef }: FieldProps) {
  const [localVal, setLocalVal] = useState(value)

  // Sync local state if external value updates
  useEffect(() => {
    setLocalVal(value)
  }, [value])

  const hasError = errors.length > 0
  const errorMsg = errors[0]?.message ?? errors[0]?.msg ?? ''
  const isDirty = localVal !== value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          htmlFor={id}
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 11,
            color: hasError ? '#FF6B6B' : 'rgba(26,26,46,0.6)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {label}
        </label>
        {hasError && !isDirty && (
          <span
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontSize: 9,
              fontWeight: 800,
              color: '#FF6B6B',
              background: 'rgba(255,107,107,0.1)',
              border: '1.5px solid #FF6B6B',
              borderRadius: 4,
              padding: '1px 6px',
            }}
          >
            ⚠ ERROR
          </span>
        )}
        {onAskAI && (
          <button
            type="button"
            onClick={onAskAI}
            style={{
              marginLeft: 'auto',
              padding: '2px 10px',
              fontSize: 10,
              background: '#FFE66D',
              border: '1.5px solid #1A1A2E',
              borderRadius: 6,
              boxShadow: '2px 2px 0px #1A1A2E',
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              color: '#1A1A2E',
              transform: 'rotate(-0.5deg)',
            }}
          >
            ✦ Ask AI to Fix
          </button>
        )}
      </div>

      <input
        id={id}
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setLocalVal(value) // Cancel
          if (e.key === 'Enter' && isDirty) onCommit(localVal) // Save
        }}
        placeholder={hint ?? `Enter ${label.toLowerCase()}…`}
        style={{
          width: '100%',
          padding: '9px 13px',
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'Nunito, sans-serif',
          fontSize: mono ? 12 : 13,
          color: '#1A1A2E',
          background: hasError && !isDirty ? 'rgba(255,107,107,0.04)' : '#FFFFFF',
          border: isDirty 
            ? '2px solid #FFE66D' 
            : hasError
            ? '2px dashed #FF6B6B'
            : isActive
            ? '2px solid #4ECDC4'
            : '2px solid rgba(26,26,46,0.18)',
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          boxShadow: isDirty
            ? '0 0 0 3px rgba(255,230,109,0.2), 2px 2px 0px #FFE66D'
            : hasError
            ? '3px 3px 0px rgba(255,107,107,0.3)'
            : isActive
            ? '0 0 0 3px rgba(78,205,196,0.2), 3px 3px 0px #4ECDC4'
            : '2px 2px 0px rgba(26,26,46,0.08)',
          outline: 'none',
          transition: 'all 0.2s',
          boxSizing: 'border-box',
        }}
      />

      <AnimatePresence>
        {isDirty && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <button
            onClick={() => onCommit(localVal)} // This pushes the change to the main file!
            style={{
              padding: '4px 12px',
              background: '#4ECDC4', 
              border: '2px solid #1A1A2E',
              color: '#1A1A2E',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              borderRadius: 6,
              boxShadow: '3px 3px 0px #1A1A2E',
              cursor: 'pointer',
            }}
          >
            Save Change
          </button>
          
          <button
            onClick={() => setLocalVal(value)} // This reverts the input back to the original!
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: '#1A1A2E',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 11,              
              border: '2px solid #1A1A2E',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}
      </AnimatePresence>

      {hasError && !isDirty && errorMsg && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontSize: 11,
            color: '#FF6B6B',
            fontWeight: 600,
            lineHeight: 1.4,
            paddingLeft: 2,
            margin: 0
          }}
        >
          {errorMsg}
        </motion.p>
      )}
    </div>
  )
}

// ── Section Header & Layout Components ────────────────────────────────────────

function SectionHeader({ title, icon, rotate = 0 }: { title: string; icon: string; rotate?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, transform: `rotate(${rotate}deg)`, transformOrigin: 'left center' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#1A1A2E', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>
          {title}
        </h2>
        <div style={{ height: 3, width: '100%', background: 'linear-gradient(90deg, #4ECDC4, transparent)', borderRadius: 999, marginTop: 3 }} />
      </div>
    </div>
  )
}

function SectionCard({ children, sectionRef, isHighlighted }: { children: React.ReactNode, sectionRef?: React.RefObject<HTMLDivElement | null>, isHighlighted?: boolean }) {
  return (
    <motion.div
      ref={sectionRef as React.RefObject<HTMLDivElement>}
      animate={ isHighlighted ? { boxShadow: ['4px 4px 0px #4ECDC4', '6px 6px 0px #4ECDC4', '4px 4px 0px #4ECDC4'] } : { boxShadow: '4px 4px 0px #1A1A2E' } }
      transition={{ duration: 0.6, repeat: isHighlighted ? 2 : 0 }}
      style={{ background: '#FFFFFF', border: isHighlighted ? '2px solid #4ECDC4' : '2px solid #1A1A2E', borderRadius: 12, padding: '24px 24px 28px', position: 'relative', transition: 'border-color 0.3s' }}
    >
      {children}
    </motion.div>
  )
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px 20px' }} className="form-field-grid">
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

// ── PATH → SECTION mapping ─────────────────────────────────────────────────────

const PATH_TO_SECTION: Array<[RegExp, string]> = [
  [/1000[AB]/i, 'submitter'],
  [/2010AA|billing_provider/i, 'billing'],
  [/2010BA|subscriber/i, 'subscriber'],
  [/2300|claim/i, 'claim'],
  [/2400|service/i, 'service'],
]

function resolveSection(path: string | null): string | null {
  if (!path) return null
  for (const [pattern, section] of PATH_TO_SECTION) {
    if (pattern.test(path)) return section
  }
  return null
}

// ── Main FormEditorView ────────────────────────────────────────────────────────

export default function FormEditorView() {
  const parseResult = useAppStore((s) => s.parseResult)
  const setParseResult = useAppStore((s) => s.setParseResult)
  const selectedPath = useAppStore((s) => s.selectedPath)
  const setIsAIPanelOpen = useAppStore((s) => s.setIsAIPanelOpen)
  const setAiPromptContext = useAppStore((s) => s.setAiPromptContext)
  const isLoading = useAppStore((s) => s.isLoading)
  const sectionRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({
    submitter: { current: null }, billing: { current: null }, subscriber: { current: null }, claim: { current: null }, service: { current: null },
  })

  const [highlightedSection, setHighlightedSection] = useState<string | null>(null)
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPath) return
    const section = resolveSection(selectedPath)
    if (!section) return
    const ref = sectionRefs.current[section]
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightedSection(section)
      setActiveFieldPath(selectedPath)
      const timer = setTimeout(() => { setHighlightedSection(null); setActiveFieldPath(null) }, 2000)
      return () => clearTimeout(timer)
    }
  }, [selectedPath])

  // Smart Committer - Finds the exact dynamic key and updates it, then clears errors.
  const handleCommit = useCallback((segment: any, targetKeys: string[], newValue: string) => {
    if (!parseResult || !segment) return

    let updated = false
    const keys = Object.keys(segment)

    for (const fk of targetKeys) {
      if (segment[fk] !== undefined) {
        segment[fk] = newValue
        updated = true
        break
      }

      const suffixMatch = fk.match(/\d{2}$/)
      if (suffixMatch) {
        const suffix = `_${suffixMatch[0]}`
        for (const k of keys) {
          if (k.endsWith(suffix) && segment[k] !== undefined) {
            if (Array.isArray(segment[k])) {
              segment[k] = newValue.includes(':') ? newValue.split(':') : [newValue]
            } else {
              segment[k] = newValue
            }
            updated = true
            break
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
          if (segment.raw_data.length > idx) {
            segment.raw_data[idx] = newValue
            updated = true
            break
          }
        }
      }
    }

    // Clone to trigger re-render and clear local validation errors
    const newParseResult = structuredClone(parseResult) as any

    const clearErrors = (errArray: any[]) => {
      if (!errArray) return errArray
      return errArray.filter((e: any) => {
        const el = (e.element || e.field || '').toUpperCase()
        return !targetKeys.some(k => el.includes(k.toUpperCase()))
      })
    }

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

  const l1000A = findLoop(rootData, '1000A', 'loop_1000A')
  const nm1_1000A = findSegment(l1000A, 'NM1')
  
  const l1000B = findLoop(rootData, '1000B', 'loop_1000B')
  const nm1_1000B = findSegment(l1000B, 'NM1')

  const l2010AA = findLoop(rootData, '2010AA', 'loop_2010AA')
  const nm1_2010AA = findSegment(l2010AA, 'NM1')
  const n3_billing  = findSegment(l2010AA, 'N3')
  const n4_billing  = findSegment(l2010AA, 'N4')
  const ref_billing = findSegment(l2010AA, 'REF') // Pulled REF separately for Tax ID

  const l2010BA = findLoop(rootData, '2010BA', 'loop_2010BA')
  const nm1_sub = findSegment(l2010BA, 'NM1')
  const dmg_sub = findSegment(l2010BA, 'DMG')

  const l2300 = findLoop(rootData, '2300', 'loop_2300')
  const clmSeg = findSegment(l2300, 'CLM')
  const dtpSeg = findSegment(l2300, 'DTP')
  const hiSeg  = findSegment(l2300, 'HI')

  const l2400 = findLoop(rootData, '2400', 'loop_2400')
  const serviceLines = (Array.isArray(l2400) && Array.isArray(l2400[0])) ? l2400 : (l2400 ? [l2400] : [])

  return (
    <>
      <style>{`
        @media (max-width: 640px) { .form-field-grid { grid-template-columns: 1fr !important; } }
        .form-editor-scroll::-webkit-scrollbar { width: 6px; }
        .form-editor-scroll::-webkit-scrollbar-thumb { background: rgba(78,205,196,0.35); border-radius: 3px; }
      `}</style>

      <div className="form-editor-scroll" style={{ height: '100%', overflowY: 'auto', padding: '0 0 40px', background: '#FDFAF4' }}>
        <div style={{ padding: '28px 28px 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Section 1: Submitter & Receiver ── */}
          <SectionCard sectionRef={sectionRefs.current.submitter as React.RefObject<HTMLDivElement>} isHighlighted={highlightedSection === 'submitter'}>
            <SectionHeader title="Submitter & Receiver" icon="📤" rotate={-0.4} />
            <FieldGrid cols={2}>
              <FormField
                id="submitter-name" label="Submitter Name" hint="ACME Billing Inc."
                value={getVal(nm1_1000A, 'NM103', 'name', 'submitter_name', 'NM1_03')}
                onCommit={(v) => handleCommit(nm1_1000A, ['NM103', 'name', 'submitter_name', 'NM1_03'], v)}
                errors={getErrors(errors, '1000A', 'NM103', 'NM1_03')}
                isActive={isFieldActive(activeFieldPath, '1000A', 'NM103', 'NM1_03')}
              />
              <FormField
                id="submitter-id" label="Submitter ID" mono hint="123456789"
                value={getVal(nm1_1000A, 'NM109', 'id', 'submitter_id', 'NM1_09')}
                onCommit={(v) => handleCommit(nm1_1000A, ['NM109', 'id', 'submitter_id', 'NM1_09'], v)}
                errors={getErrors(errors, '1000A', 'NM109', 'NM1_09')}
                isActive={isFieldActive(activeFieldPath, '1000A', 'NM109', 'NM1_09')}
              />
              <FormField
                id="receiver-name" label="Receiver Name" hint="BCBS Clearinghouse"
                value={getVal(nm1_1000B, 'NM103', 'name', 'receiver_name', 'NM1_03')}
                onCommit={(v) => handleCommit(nm1_1000B, ['NM103', 'name', 'receiver_name', 'NM1_03'], v)}
                errors={getErrors(errors, '1000B', 'NM103')}
                isActive={isFieldActive(activeFieldPath, '1000B', 'NM103')}
              />
              <FormField
                id="receiver-id" label="Receiver ID" mono hint="987654321"
                value={getVal(nm1_1000B, 'NM109', 'id', 'receiver_id', 'NM1_09')}
                onCommit={(v) => handleCommit(nm1_1000B, ['NM109', 'id', 'receiver_id', 'NM1_09'], v)}
                errors={getErrors(errors, '1000B', 'NM109')}
                isActive={isFieldActive(activeFieldPath, '1000B', 'NM109')}
              />
            </FieldGrid>
          </SectionCard>

          {/* ── Section 2: Billing Provider ── */}
          <SectionCard sectionRef={sectionRefs.current.billing as React.RefObject<HTMLDivElement>} isHighlighted={highlightedSection === 'billing'}>
            <SectionHeader title="Billing Provider" icon="🏥" rotate={0.3} />
            <FieldGrid cols={2}>
              <FormField
                id="billing-name" label="Provider Name" hint="Metro Medical Group"
                value={getVal(nm1_2010AA, 'NM103', 'name', 'provider_name', 'NM1_03')}
                onCommit={(v) => handleCommit(nm1_2010AA, ['NM103', 'name', 'provider_name', 'NM1_03'], v)}
                errors={getErrors(errors, '2010A', 'NM103')}
                isActive={isFieldActive(activeFieldPath, '2010A', 'NM103')}
              />
              <FormField
                id="billing-npi" label="NPI (National Provider ID)" mono hint="1234567890"
                value={getVal(nm1_2010AA, 'NM109', 'npi', 'NPI', 'NM1_09')}
                onCommit={(v) => handleCommit(nm1_2010AA, ['NM109', 'npi', 'NPI', 'NM1_09'], v)}
                errors={getErrors(errors, '2010A', 'NM109', 'NPI', 'InvalidNPI')}
                onAskAI={() => askAI('The Billing Provider NPI appears to be invalid. Can you validate and suggest a fix?')}
                isActive={isFieldActive(activeFieldPath, '2010A', 'NM109', 'NPI')}
              />
              <FormField
                id="billing-address" label="Address" hint="123 Main St"
                value={getVal(n3_billing, 'N301', 'address', 'address_line')}
                onCommit={(v) => handleCommit(n3_billing, ['N301', 'address', 'address_line'], v)}
                errors={getErrors(errors, '2010A', 'N301')}
                isActive={isFieldActive(activeFieldPath, '2010A', 'N301')}
              />
              <FormField
                id="billing-taxid" label="Tax ID / EIN" mono hint="XX-XXXXXXX"
                value={getVal(ref_billing, 'REF02', 'tax_id', 'ein', 'REF_02')}
                onCommit={(v) => handleCommit(ref_billing, ['REF02', 'tax_id', 'ein', 'REF_02'], v)}
                errors={getErrors(errors, '2010A', 'REF02', 'TaxID')}
                isActive={isFieldActive(activeFieldPath, '2010A', 'REF02', 'TaxID')}
              />
              <FormField
                id="billing-city" label="City" hint="Chicago"
                value={getVal(n4_billing, 'N401', 'city')}
                onCommit={(v) => handleCommit(n4_billing, ['N401', 'city'], v)}
                errors={getErrors(errors, '2010A', 'N401')}
                isActive={isFieldActive(activeFieldPath, '2010A', 'N401')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField
                  id="billing-state" label="State" hint="IL"
                  value={getVal(n4_billing, 'N402', 'state')}
                  onCommit={(v) => handleCommit(n4_billing, ['N402', 'state'], v)}
                  errors={getErrors(errors, '2010A', 'N402')}
                  isActive={isFieldActive(activeFieldPath, '2010A', 'N402')}
                />
                <FormField
                  id="billing-zip" label="ZIP" mono hint="60601"
                  value={getVal(n4_billing, 'N403', 'zip', 'postal_code')}
                  onCommit={(v) => handleCommit(n4_billing, ['N403', 'zip', 'postal_code'], v)}
                  errors={getErrors(errors, '2010A', 'N403')}
                  isActive={isFieldActive(activeFieldPath, '2010A', 'N403')}
                />
              </div>
            </FieldGrid>
          </SectionCard>

          {/* ── Section 3: Subscriber ── */}
          <SectionCard sectionRef={sectionRefs.current.subscriber as React.RefObject<HTMLDivElement>} isHighlighted={highlightedSection === 'subscriber'}>
            <SectionHeader title="Subscriber / Patient" icon="👤" rotate={-0.3} />
            <FieldGrid cols={2}>
              <FormField
                id="sub-member-id" label="Member ID" mono hint="A123456789"
                value={getVal(nm1_sub, 'NM109', 'member_id', 'MemberID', 'NM1_09')}
                onCommit={(v) => handleCommit(nm1_sub, ['NM109', 'member_id', 'MemberID', 'NM1_09'], v)}
                errors={getErrors(errors, '2010B', 'NM109')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'NM109')}
              />
              <FormField
                id="sub-last-name" label="Last Name" hint="Smith"
                value={getVal(nm1_sub, 'NM103', 'last_name', 'NM1_03')}
                onCommit={(v) => handleCommit(nm1_sub, ['NM103', 'last_name', 'NM1_03'], v)}
                errors={getErrors(errors, '2010B', 'NM103')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'NM103')}
              />
              <FormField
                id="sub-first-name" label="First Name" hint="Jane"
                value={getVal(nm1_sub, 'NM104', 'first_name', 'NM1_04')}
                onCommit={(v) => handleCommit(nm1_sub, ['NM104', 'first_name', 'NM1_04'], v)}
                errors={getErrors(errors, '2010B', 'NM104')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'NM104')}
              />
              <FormField
                id="sub-dob" label="Date of Birth" mono hint="YYYYMMDD"
                value={getVal(dmg_sub, 'DMG02', 'dob', 'birth_date')}
                onCommit={(v) => handleCommit(dmg_sub, ['DMG02', 'dob', 'birth_date'], v)}
                errors={getErrors(errors, '2010B', 'DMG02', 'DOB')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'DMG02', 'DOB')}
              />
              <FormField
                id="sub-gender" label="Gender Code" hint="M / F / U"
                value={getVal(dmg_sub, 'DMG03', 'gender', 'sex')}
                onCommit={(v) => handleCommit(dmg_sub, ['DMG03', 'gender', 'sex'], v)}
                errors={getErrors(errors, '2010B', 'DMG03')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'DMG03')}
              />
              <FormField
                id="sub-plan" label="Insurance Plan Name" hint="BlueCross PPO"
                value={getVal(l2010BA, 'plan_name', 'insurance_plan', 'INS03')}
                onCommit={(v) => handleCommit(l2010BA, ['plan_name', 'insurance_plan', 'INS03'], v)}
                errors={getErrors(errors, '2010B', 'INS03', 'plan_name')}
                isActive={isFieldActive(activeFieldPath, '2010B', 'INS03', 'plan_name')}
              />
            </FieldGrid>
          </SectionCard>

          {/* ── Section 4: Claim Information ── */}
          <SectionCard sectionRef={sectionRefs.current.claim as React.RefObject<HTMLDivElement>} isHighlighted={highlightedSection === 'claim'}>
            <SectionHeader title="Claim Information" icon="📋" rotate={0.4} />
            <FieldGrid cols={2}>
              <FormField
                id="clm-id" label="Patient Control Number" mono hint="CLM-2024-001"
                value={getVal(clmSeg, 'CLM01', 'claim_id', 'control_number', 'CLM_01')}
                onCommit={(v) => handleCommit(clmSeg, ['CLM01', 'claim_id', 'control_number', 'CLM_01'], v)}
                errors={getErrors(errors, '2300', 'CLM01')}
                isActive={isFieldActive(activeFieldPath, '2300', 'CLM01')}
              />
              <FormField
                id="clm-amount" label="Total Charge Amount ($)" mono hint="1500.00"
                value={getVal(clmSeg, 'CLM02', 'total_charge', 'amount', 'CLM_02')}
                onCommit={(v) => handleCommit(clmSeg, ['CLM02', 'total_charge', 'amount', 'CLM_02'], v)}
                errors={getErrors(errors, '2300', 'CLM02', 'AmountMismatch')}
                isActive={isFieldActive(activeFieldPath, '2300', 'CLM02', 'AmountMismatch')}
              />
              <FormField
                id="clm-service-date" label="Service Date" mono hint="YYYYMMDD"
                value={getVal(dtpSeg, 'DTP03', 'service_date', 'date')}
                onCommit={(v) => handleCommit(dtpSeg, ['DTP03', 'service_date', 'date'], v)}
                errors={getErrors(errors, '2300', 'DTP03')}
                isActive={isFieldActive(activeFieldPath, '2300', 'DTP03')}
              />
              <FormField
                id="clm-facility" label="Facility Code" mono hint="11 (Office)"
                value={getVal(clmSeg, 'CLM05_1', 'facility_code', 'place_of_service')}
                onCommit={(v) => handleCommit(clmSeg, ['CLM05_1', 'facility_code', 'place_of_service'], v)}
                errors={getErrors(errors, '2300', 'CLM05')}
                isActive={isFieldActive(activeFieldPath, '2300', 'CLM05')}
              />
            </FieldGrid>

            {/* ICD-10 Diagnosis Codes */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px dashed rgba(26,26,46,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: 'rgba(26,26,46,0.6)', textTransform: 'uppercase' }}>Diagnosis Codes (ICD-10)</span>
              </div>
              <FieldGrid cols={3}>
                {['HI01_2', 'HI02_2', 'HI03_2', 'HI04_2', 'HI05_2', 'HI06_2'].map((key, i) => {
                  return (
                    <FormField
                      key={key} id={`dx-code-${i + 1}`} label={`Dx Code ${i + 1}${i === 0 ? ' (Primary)' : ''}`} mono hint="J18.9"
                      value={getVal(hiSeg, key, `code_${i + 1}`, i === 0 ? 'primary_dx' : `dx_${i + 1}`)}
                      onCommit={(v) => handleCommit(hiSeg, [key, `code_${i + 1}`, i === 0 ? 'primary_dx' : `dx_${i + 1}`], v)}
                      errors={getErrors(errors, '2300', key, 'HI0', 'ICD')}
                      isActive={isFieldActive(activeFieldPath, '2300', key, 'HI0', 'ICD')}
                    />
                  )
                })}
              </FieldGrid>
            </div>
          </SectionCard>

          {/* ── Section 5: Service Lines ── */}
          <div ref={sectionRefs.current.service as React.RefObject<HTMLDivElement>} style={{ background: '#FFFFFF', border: highlightedSection === 'service' ? '2px solid #4ECDC4' : '2px solid #1A1A2E', borderRadius: 12, padding: '24px 24px 28px' }}>
            <SectionHeader title="Service Line Items" icon="💊" rotate={-0.4} />
            {serviceLines.length === 0 ? (
              <div style={{ padding: '24px', border: '1.5px dashed rgba(26,26,46,0.2)', borderRadius: 8, textAlign: 'center', fontStyle: 'italic' }}>
                No service lines found in Loop 2400.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {serviceLines.map((line, idx) => {
                  const sv1 = findSegment(line, 'SV1') ?? line
                  const dtpLine = findSegment(line, 'DTP')

                  return (
                    <div key={idx} style={{ border: `1.5px solid rgba(26,26,46,0.1)`, borderRadius: 10, padding: '16px 18px', background: idx % 2 === 0 ? '#FDFAF4' : '#FFFFFF', position: 'relative' }}>
                      <FieldGrid cols={3}>
                        <FormField
                          id={`svc-${idx}-proc`} label="Procedure Code" mono hint="HC:99213"
                          value={getVal(sv1, 'SV101', 'procedure_code', 'SV1_01')}
                          onCommit={(v) => handleCommit(sv1, ['SV101', 'procedure_code', 'SV1_01'], v)}
                          errors={getErrors(errors, '2400', 'SV101')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'SV101')}
                        />
                        <FormField
                          id={`svc-${idx}-amount`} label="Charge ($)" mono hint="150.00"
                          value={getVal(sv1, 'SV102', 'charge', 'amount', 'SV1_02')}
                          onCommit={(v) => handleCommit(sv1, ['SV102', 'charge', 'amount', 'SV1_02'], v)}
                          errors={getErrors(errors, '2400', 'SV102')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'SV102')}
                        />
                        <FormField
                          id={`svc-${idx}-units`} label="Units" mono hint="1"
                          value={getVal(sv1, 'SV104', 'units', 'SV1_04')}
                          onCommit={(v) => handleCommit(sv1, ['SV104', 'units', 'SV1_04'], v)}
                          errors={getErrors(errors, '2400', 'SV104')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'SV104')}
                        />
                        <FormField
                          id={`svc-${idx}-modifier`} label="Modifier" mono hint="25"
                          value={getVal(sv1, 'SV101_2', 'modifier', 'SV1_01_2')}
                          onCommit={(v) => handleCommit(sv1, ['SV101_2', 'modifier', 'SV1_01_2'], v)}
                          errors={getErrors(errors, '2400', 'modifier')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'modifier')}
                        />
                        <FormField
                          id={`svc-${idx}-date`} label="Service Date" mono hint="YYYYMMDD"
                          value={getVal(dtpLine, 'DTP03', 'service_date', 'date')}
                          onCommit={(v) => handleCommit(dtpLine, ['DTP03', 'service_date', 'date'], v)}
                          errors={getErrors(errors, '2400', 'DTP03')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'DTP03')}
                        />
                        <FormField
                          id={`svc-${idx}-diagptr`} label="Diagnosis Pointer" mono hint="1"
                          value={getVal(sv1, 'SV107', 'diagnosis_pointer', 'SV1_07')}
                          onCommit={(v) => handleCommit(sv1, ['SV107', 'diagnosis_pointer', 'SV1_07'], v)}
                          errors={getErrors(errors, '2400', 'SV107')}
                          isActive={isFieldActive(activeFieldPath, '2400', 'SV107')}
                        />
                      </FieldGrid>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}