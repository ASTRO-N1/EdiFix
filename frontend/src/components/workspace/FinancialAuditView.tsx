/**
 * FinancialAuditView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-tier 835-to-837 Reconciliation Dashboard
 *
 * Section A — Line-Item Procedure Grid
 * Section B — Claim-Level KPI Cards
 * Section C — Verdict Alert Box
 *
 * Design system: #FDFAF4 cream bg, #1A1A2E ink, #4ECDC4 teal,
 *                #FFE66D yellow, #FF6B6B coral, Nunito + JetBrains Mono
 */

import { useState } from 'react'
import useAppStore from '../../store/useAppStore'

// ── Types ──────────────────────────────────────────────────────────────────

interface Adjustment {
  group_code: string
  reason_code: string
  amount: number
  description: string
}

interface LineItem {
  procedure_code: string
  qualifier: string
  description: string
  billed: number
  allowed: number
  paid: number
  difference: number
  adjustments: Adjustment[]
  adjustments_by_group: Record<string, number>
  integrity_ok: boolean
  pr_amount: number
  co_amount: number
  oa_pi_amount: number
}

interface ClaimLevelAdjustment {
  group_code: string
  reason_code: string
  amount: number
  description: string
}

interface ClaimSummary {
  total_billed: number
  total_paid: number
  total_patient_responsibility: number
  total_contractual_adjustment: number
  total_oa_pi: number
  total_adjustments: number
  difference: number
  integrity_check_passed: boolean
  claim_level_adjustments: ClaimLevelAdjustment[]
  clp_patient_responsibility: number
}

interface Verdict {
  status: string
  label: string
  color: 'green' | 'yellow' | 'red'
  summary: string
}

interface ReconciliationReport {
  matched: boolean
  pcn: string
  line_items: LineItem[]
  claim_summary: ClaimSummary
  verdict: Verdict
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '$0.00'
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function GroupBadge({ group }: { group: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    CO: { bg: 'rgba(78,205,196,0.15)', color: '#1A9B93', label: 'CO' },
    PR: { bg: 'rgba(255,230,109,0.25)', color: '#B89000', label: 'PR' },
    OA: { bg: 'rgba(255,107,107,0.15)', color: '#C0392B', label: 'OA' },
    PI: { bg: 'rgba(255,107,107,0.15)', color: '#C0392B', label: 'PI' },
  }
  const s = styles[group] ?? { bg: 'rgba(26,26,46,0.08)', color: 'rgba(26,26,46,0.55)', label: group }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: s.bg, color: s.color,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
      padding: '2px 6px', borderRadius: 4,
      border: `1px solid ${s.bg}`,
    }}>
      {s.label}
    </span>
  )
}

function SectionHeader({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 16,
    }}>
      {accent && (
        <div style={{ width: 4, height: 20, background: accent, borderRadius: 2, flexShrink: 0 }} />
      )}
      <h2 style={{
        fontFamily: 'Nunito, sans-serif', fontWeight: 900,
        fontSize: 15, color: '#1A1A2E', margin: 0,
        letterSpacing: '0.01em', textTransform: 'uppercase',
      }}>
        {children}
      </h2>
    </div>
  )
}

// ── Section A: Line-Item Grid ──────────────────────────────────────────────

function LineItemGrid({ items }: { items: LineItem[] }) {
  const [sortCol, setSortCol] = useState<keyof LineItem>('procedure_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = [...items].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    const dir = sortDir === 'asc' ? 1 : -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  const onSort = (col: keyof LineItem) => {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const TH = ({ label, col }: { label: string; col?: keyof LineItem }) => (
    <th
      onClick={() => col && onSort(col)}
      style={{
        padding: '11px 14px', textAlign: 'left',
        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11,
        color: '#4ECDC4', background: '#1A1A2E',
        cursor: col ? 'pointer' : 'default',
        whiteSpace: 'nowrap', userSelect: 'none',
        letterSpacing: '0.06em',
      }}
    >
      {label}{col && sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  if (items.length === 0) {
    return (
      <div style={{
        padding: '32px 24px', textAlign: 'center',
        background: '#FFFFFF', border: '2px solid rgba(26,26,46,0.1)',
        borderRadius: 12, boxShadow: '3px 3px 0 rgba(26,26,46,0.06)',
      }}>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.45)', fontStyle: 'italic' }}>
          No procedure-level service lines (SVC) found in this 835.
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '2.5px solid #1A1A2E', boxShadow: '4px 4px 0 rgba(26,26,46,0.12)' }} className="custom-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
        <thead>
          <tr>
            <TH label="Procedure" col="procedure_code" />
            <TH label="Description" />
            <TH label="Billed" col="billed" />
            <TH label="Allowed" col="allowed" />
            <TH label="Paid" col="paid" />
            <TH label="Adjustments" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => {
            const rowKey = `${item.procedure_code}-${idx}`
            const isExp = expanded === rowKey
            const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#FDFAF4'
            return (
              <>
                <tr
                  key={rowKey}
                  style={{
                    background: rowBg,
                    borderTop: idx > 0 ? '1px solid rgba(26,26,46,0.06)' : 'none',
                    cursor: item.adjustments.length > 0 ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => {
                    if (item.adjustments.length > 0) setExpanded(isExp ? null : rowKey)
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(78,205,196,0.06)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = rowBg }}
                >
                  {/* Procedure Code */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.adjustments.length > 0 && (
                        <span style={{ fontSize: 8, color: 'rgba(26,26,46,0.3)', transition: 'transform 0.15s', display: 'inline-block', transform: isExp ? 'rotate(90deg)' : 'none' }}>▶</span>
                      )}
                      <code style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                        color: '#1A1A2E',
                        background: 'rgba(78,205,196,0.1)', padding: '2px 7px', borderRadius: 4,
                      }}>
                        {item.qualifier ? `${item.qualifier}:` : ''}{item.procedure_code}
                      </code>
                    </div>
                  </td>
                  {/* Description */}
                  <td style={{ padding: '12px 14px', fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.7)', maxWidth: 260 }}>
                    {item.description}
                  </td>
                  {/* Billed */}
                  <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: '#1A1A2E', whiteSpace: 'nowrap' }}>
                    {fmt(item.billed)}
                  </td>
                  {/* Allowed */}
                  <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'rgba(26,26,46,0.6)', whiteSpace: 'nowrap' }}>
                    {fmt(item.allowed)}
                  </td>
                  {/* Paid */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800,
                      color: item.paid === 0 ? '#FF6B6B' : item.paid >= item.billed ? '#2ECC71' : '#4ECDC4',
                    }}>
                      {fmt(item.paid)}
                    </span>
                  </td>
                  {/* Adjustment Summary */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(item.adjustments_by_group).map(([group, amt]) => (
                        <span key={group} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <GroupBadge group={group} />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(26,26,46,0.6)' }}>
                            {fmt(amt)}
                          </span>
                        </span>
                      ))}
                      {item.adjustments.length === 0 && (
                        <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.3)', fontStyle: 'italic' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded adjustment detail rows */}
                {isExp && item.adjustments.map((adj, ai) => (
                  <tr key={`${rowKey}-adj-${ai}`} style={{ background: '#F7F4EE', borderTop: '1px solid rgba(26,26,46,0.04)' }}>
                    <td colSpan={2} style={{ padding: '8px 14px 8px 44px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 10, color: 'rgba(26,26,46,0.35)' }}>↳</span>
                        <GroupBadge group={adj.group_code} />
                        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(26,26,46,0.55)' }}>
                          CARC-{adj.reason_code}
                        </code>
                      </div>
                    </td>
                    <td colSpan={3} style={{ padding: '8px 14px', fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.6)', fontStyle: 'italic' }}>
                      {adj.description}
                    </td>
                    <td style={{ padding: '8px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: 'rgba(26,26,46,0.7)', textAlign: 'right' }}>
                      {fmt(adj.amount)}
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Section B: KPI Cards ───────────────────────────────────────────────────

function KPICard({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent: string; icon: string
}) {
  return (
    <div
      className="kpi-card"
      style={{
        flex: '1 1 160px', minWidth: 150,
        background: '#FFFFFF',
        border: '2.5px solid #1A1A2E',
        borderRadius: 12,
        boxShadow: '4px 4px 0 rgba(26,26,46,0.1)',
        padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 22, color: accent }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function KPISection({ summary }: { summary: ClaimSummary }) {
  const {
    total_billed, total_paid,
    total_patient_responsibility, total_contractual_adjustment,
    total_oa_pi, claim_level_adjustments,
  } = summary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KPICard
          label="Total Billed" value={fmt(total_billed)} accent="#1A1A2E"
          icon="🧾" sub="From 837 CLM02 / SV102"
        />
        <KPICard
          label="Total Paid" value={fmt(total_paid)} accent="#4ECDC4"
          icon="💳" sub="From 835 CLP04"
        />
        <KPICard
          label="Patient Responsibility" value={fmt(total_patient_responsibility)} accent="#B89000"
          icon="👤" sub="PR adjustments (ded/copay)"
        />
        <KPICard
          label="Contractual Write-Off" value={fmt(total_contractual_adjustment)} accent="rgba(26,26,46,0.5)"
          icon="✍️" sub="CO adjustments (fee schedule)"
        />
        {total_oa_pi > 0 && (
          <KPICard
            label="Flagged (OA/PI)" value={fmt(total_oa_pi)} accent="#FF6B6B"
            icon="⚠️" sub="Requires review"
          />
        )}
      </div>

      {/* Integrity check banner */}
      {!summary.integrity_check_passed && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(255,107,107,0.08)',
          border: '1.5px solid rgba(255,107,107,0.3)',
          borderRadius: 8,
          fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#C0392B',
        }}>
          ⚠️ <strong>Integrity check failed:</strong> The sum of all adjustments does not equal the billed-minus-paid difference. This may indicate a missing CAS segment or a data encoding issue.
        </div>
      )}

      {/* Claim-level adjustments table */}
      {claim_level_adjustments.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Claim-Level Adjustments
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {claim_level_adjustments.map((adj, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: '#FFFFFF', borderRadius: 8,
                  border: '1.5px solid rgba(26,26,46,0.08)',
                  boxShadow: '2px 2px 0 rgba(26,26,46,0.04)',
                }}
              >
                <GroupBadge group={adj.group_code} />
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(26,26,46,0.5)' }}>
                  CARC-{adj.reason_code}
                </code>
                <span style={{ flex: 1, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.65)' }}>
                  {adj.description}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>
                  {fmt(adj.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section C: Verdict ─────────────────────────────────────────────────────

function VerdictBox({ verdict }: { verdict: Verdict }) {
  const palettes = {
    green: {
      bg: 'rgba(46, 204, 113, 0.08)',
      border: 'rgba(46, 204, 113, 0.5)',
      accent: '#27AE60',
      badge_bg: 'rgba(46,204,113,0.15)',
      badge_text: '#1E8449',
      icon: '✅',
    },
    yellow: {
      bg: 'rgba(255, 230, 109, 0.12)',
      border: 'rgba(255, 200, 0, 0.4)',
      accent: '#B89000',
      badge_bg: 'rgba(255,230,109,0.3)',
      badge_text: '#7D6200',
      icon: '⚖️',
    },
    red: {
      bg: 'rgba(255, 107, 107, 0.08)',
      border: 'rgba(255, 107, 107, 0.4)',
      accent: '#C0392B',
      badge_bg: 'rgba(255,107,107,0.15)',
      badge_text: '#922B21',
      icon: '🚨',
    },
  }

  const p = palettes[verdict.color] ?? palettes.yellow

  return (
    <div style={{
      background: p.bg,
      border: `2px solid ${p.border}`,
      borderRadius: 14,
      padding: '22px 24px',
      boxShadow: `3px 3px 0 ${p.border}`,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 26 }}>{p.icon}</span>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: p.badge_bg, color: p.badge_text,
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12,
            padding: '4px 12px', borderRadius: 20,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            Verdict: {verdict.label}
          </div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: 13, color: p.accent, lineHeight: 1.6 }}>
            {verdict.summary}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)', fontStyle: 'italic',
        borderTop: `1px solid ${p.border}`, paddingTop: 10,
      }}>
        This analysis is automatically generated based on EDI X12 835/837 data. Consult with your billing team before taking financial action.
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function FinancialAuditView() {
  const reconciliationResult = useAppStore((s) => s.reconciliationResult)
  const setIsReconcileModalOpen = useAppStore((s) => s.setIsReconcileModalOpen)
  const setReconciliationResult = useAppStore((s) => s.setReconciliationResult)
  const setAuditParsed835 = useAppStore((s) => s.setAuditParsed835)
  const setAuditParsed837 = useAppStore((s) => s.setAuditParsed837)

  // No result yet → show prompt to upload
  if (!reconciliationResult) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 40,
      }}>
        <div style={{
          width: 80, height: 80,
          border: '2.5px dashed rgba(26,26,46,0.2)',
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>
          ⚖️
        </div>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, color: '#1A1A2E', textAlign: 'center' }}>
          Financial Audit Ready
        </p>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.5)', textAlign: 'center', maxWidth: 380 }}>
          Upload an 837 Claim file and its corresponding 835 Remittance to run the reconciliation engine.
        </p>
        <button
          onClick={() => setIsReconcileModalOpen(true)}
          style={{
            background: '#FFE66D', color: '#1A1A2E',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14,
            border: '2.5px solid #1A1A2E', borderRadius: 10,
            padding: '10px 22px', cursor: 'pointer',
            boxShadow: '3px 3px 0 rgba(26,26,46,0.25)',
            transition: 'all 0.1s ease',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 rgba(26,26,46,0.25)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 rgba(26,26,46,0.25)' }}
        >
          ⚖️ Upload Files & Reconcile
        </button>
      </div>
    )
  }

  const report = reconciliationResult as unknown as ReconciliationReport

  // Unmatched error state
  if (!report.matched) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          padding: '20px 24px',
          background: 'rgba(255,107,107,0.08)',
          border: '2px solid rgba(255,107,107,0.4)',
          borderRadius: 12,
          boxShadow: '3px 3px 0 rgba(255,107,107,0.2)',
        }}>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#C0392B', marginBottom: 8 }}>
            🚨 Reconciliation Failed
          </p>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.7)' }}>
            {report.error || 'PCN matching failed. The Patient Control Numbers do not match across the two files.'}
          </p>
          <button
            onClick={() => {
              setReconciliationResult(null)
              setAuditParsed837(null)
              setAuditParsed835(null)
              setIsReconcileModalOpen(true)
            }}
            style={{
              marginTop: 14,
              background: '#FF6B6B', color: '#FFFFFF',
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
              border: '2px solid #1A1A2E', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer',
              boxShadow: '2px 2px 0 rgba(26,26,46,0.2)',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const { line_items, claim_summary, verdict, pcn } = report

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 36,
      background: '#FDFAF4',
    }} className="custom-scrollbar">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22,
            color: '#1A1A2E', margin: 0, marginBottom: 6,
          }}>
            Financial Audit Report
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: 'rgba(26,26,46,0.45)' }}>
              Patient Control Number:
            </span>
            <code style={{
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12,
              background: 'rgba(78,205,196,0.12)', color: '#1A1A2E',
              padding: '2px 8px', borderRadius: 5,
              border: '1px solid rgba(78,205,196,0.25)',
            }}>
              {pcn}
            </code>
          </div>
        </div>
        <button
          id="rerun-reconcile-btn"
          onClick={() => {
            setReconciliationResult(null)
            setAuditParsed837(null)
            setAuditParsed835(null)
            setIsReconcileModalOpen(true)
          }}
          style={{
            background: 'transparent', color: 'rgba(26,26,46,0.55)',
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12,
            border: '1.5px solid rgba(26,26,46,0.2)', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4ECDC4'; e.currentTarget.style.color = '#1A1A2E' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,26,46,0.2)'; e.currentTarget.style.color = 'rgba(26,26,46,0.55)' }}
        >
          ↺ Re-run Reconciliation
        </button>
      </div>

      {/* ── Section C: Verdict (shown first for immediate impact) ─────── */}
      <section>
        <SectionHeader accent="#FFE66D">Outcome Summary</SectionHeader>
        <VerdictBox verdict={verdict} />
      </section>

      {/* ── Section B: KPI Cards ──────────────────────────────────────── */}
      <section>
        <SectionHeader accent="#4ECDC4">Claim-Level Summary</SectionHeader>
        <KPISection summary={claim_summary} />
      </section>

      {/* ── Section A: Line-Item Grid ─────────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionHeader accent="#1A1A2E">Procedure-Level Detail</SectionHeader>
          {line_items.length > 0 && (
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11,
              color: 'rgba(26,26,46,0.4)', fontStyle: 'italic',
            }}>
              Click a row to expand adjustment details
            </span>
          )}
        </div>
        <LineItemGrid items={line_items} />
      </section>
    </div>
  )
}
