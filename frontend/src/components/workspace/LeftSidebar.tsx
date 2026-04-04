import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EdiTreeNode {
  id: string
  label: string
  path: string
  type: 'loop' | 'segment' | 'value'
  icon?: string
  section?: string        // maps to form section id
  hasError?: boolean
  children?: EdiTreeNode[]
}

// ── EDI Schema — maps JSON keys → human-readable EDI labels ──────────────────

const EDI_LOOP_SCHEMA: Record<string, { label: string; icon: string; section: string }> = {
  loop_1000A:  { label: 'Loop 1000A — Submitter',          icon: '📤', section: 'submitter'  },
  loop_1000B:  { label: 'Loop 1000B — Receiver',           icon: '📥', section: 'submitter'  },
  loop_2000A:  { label: 'Loop 2000A — Billing HL',         icon: '📂', section: 'billing'    },
  loop_2010AA: { label: 'Loop 2010AA — Billing Provider',  icon: '🏥', section: 'billing'    },
  loop_2000B:  { label: 'Loop 2000B — Subscriber HL',      icon: '📂', section: 'subscriber' },
  loop_2010BA: { label: 'Loop 2010BA — Subscriber',        icon: '👤', section: 'subscriber' },
  loop_2300:   { label: 'Loop 2300 — Claim',               icon: '📋', section: 'claim'      },
  '2300':      { label: 'Loop 2300 — Claim',               icon: '📋', section: 'claim'      },
  loop_2400:   { label: 'Loop 2400 — Service Line',        icon: '💊', section: 'service'    },
  '2400':      { label: 'Loop 2400 — Service Line',        icon: '💊', section: 'service'    },
  // flat aliases that some parsers emit
  submitter:        { label: 'Loop 1000A — Submitter',         icon: '📤', section: 'submitter'  },
  receiver:         { label: 'Loop 1000B — Receiver',          icon: '📥', section: 'submitter'  },
  billing_provider: { label: 'Loop 2010AA — Billing Provider', icon: '🏥', section: 'billing'    },
  billingProvider:  { label: 'Loop 2010AA — Billing Provider', icon: '🏥', section: 'billing'    },
  subscriber:       { label: 'Loop 2010BA — Subscriber',       icon: '👤', section: 'subscriber' },
  claims:           { label: 'Loop 2300 — Claims',             icon: '📋', section: 'claim'      },
  claim_info:       { label: 'Loop 2300 — Claim',              icon: '📋', section: 'claim'      },
  service_lines:    { label: 'Loop 2400 — Service Lines',      icon: '💊', section: 'service'    },
  serviceLines:     { label: 'Loop 2400 — Service Lines',      icon: '💊', section: 'service'    },
}

const EDI_SEGMENT_SCHEMA: Record<string, { label: string; section: string }> = {
  NM1: { label: 'NM1 · Entity Name',        section: ''            },
  N3:  { label: 'N3  · Address',            section: ''            },
  N4:  { label: 'N4  · City / State / ZIP', section: ''            },
  CLM: { label: 'CLM · Claim Info',         section: 'claim'       },
  HI:  { label: 'HI  · Diagnosis Codes',   section: 'claim'       },
  DTP: { label: 'DTP · Service Date',       section: ''            },
  SV1: { label: 'SV1 · Procedure / Charge', section: 'service'     },
  DMG: { label: 'DMG · Demographics',       section: 'subscriber'  },
  REF: { label: 'REF · Reference ID',       section: 'billing'     },
  PER: { label: 'PER · Contact Info',       section: 'submitter'   },
  BPR: { label: 'BPR · Payment Info',       section: ''            },
  TRN: { label: 'TRN · Trace Number',       section: ''            },
  GS:  { label: 'GS  · Functional Group',  section: ''            },
  ST:  { label: 'ST  · Transaction Set',    section: ''            },
  SE:  { label: 'SE  · Tran. Set Trailer',  section: ''            },
  GE:  { label: 'GE  · Group Trailer',      section: ''            },
  IEA: { label: 'IEA · Interchange Trailer',section: ''            },
  ISA: { label: 'ISA · Interchange Ctrl',   section: ''            },
  SBR: { label: 'SBR · Subscriber Info',    section: 'subscriber'  },
  PAT: { label: 'PAT · Patient Info',       section: 'subscriber'  },
  HL:  { label: 'HL  · Hierarchical Level', section: ''            },
  PRV: { label: 'PRV · Provider Info',      section: 'billing'     },
  LX:  { label: 'LX  · Line Counter',       section: 'service'     },
}

// Keys to skip entirely (metadata, not EDI structure)
const SKIP_KEYS = new Set([
  'transaction_type', 'file_type', 'raw', 'raw_content',
  'metadata', 'file_info', 'validation_errors', 'errors',
  'status', 'filename', 'called_by', 'metrics', 'reference_versions', 'warnings'
])

// Segment key pattern: 2-3 uppercase letters + optional digits
const SEGMENT_KEY_RE = /^[A-Z]{2,3}\d*$/

// Check if a key maps to a known segment
function isSegment(key: string): boolean {
  return key in EDI_SEGMENT_SCHEMA || SEGMENT_KEY_RE.test(key)
}

// ── EDI-Aware Tree Builder ────────────────────────────────────────────────────

function buildEdiTree(
  data: Record<string, unknown>,
  errorElements: Set<string>,
  parentPath = '',
  depth = 0
): EdiTreeNode[] {
  if (!data || typeof data !== 'object') return []
  const nodes: EdiTreeNode[] = []

  for (const [key, value] of Object.entries(data)) {
    // 1. Skip all the root metadata fluff (Metrics, Warnings, etc.)
    if (SKIP_KEYS.has(key)) continue

    // 2. CRITICAL: Skip primitive values completely.
    // This stops the raw data (like "John Doe" or 35) from rendering as tree nodes.
    if (value === null || typeof value !== 'object') continue

    const path = parentPath ? `${parentPath}.${key}` : key
    
    let label = formatKey(key)
    let icon: string | undefined
    let section: string | undefined

    // Apply schema formatting
    if (key in EDI_LOOP_SCHEMA) {
      label = EDI_LOOP_SCHEMA[key].label
      icon = EDI_LOOP_SCHEMA[key].icon
      section = EDI_LOOP_SCHEMA[key].section
    } else if (key in EDI_SEGMENT_SCHEMA) {
      label = EDI_SEGMENT_SCHEMA[key].label
      section = EDI_SEGMENT_SCHEMA[key].section
    }

    const isSeg = isSegment(key)
    const nodeType = isSeg ? 'segment' : 'loop'
    const hasError = errorElements.has(key.toUpperCase())

    if (Array.isArray(value)) {
      // 3. CREATE THE WRAPPER FOLDER
      // This gives you the "▶ L Loop 1000A" parent folder
      const children: EdiTreeNode[] = []
      
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          const itemPath = `${path}[${i}]`
          const itemLabel = `${label} [${i + 1}]` // e.g., Loop 1000A [1]
          
          // Recurse into the array item
          const itemChildren = buildEdiTree(item as Record<string, unknown>, errorElements, itemPath, depth + 1)
          
          children.push({
            id: itemPath,
            label: itemLabel,
            path: itemPath,
            type: nodeType,
            icon,
            section,
            hasError,
            children: itemChildren.length > 0 ? itemChildren : undefined
          })
        }
      })

      // Only push the wrapper if it actually contains object children
      if (children.length > 0) {
        nodes.push({
          id: path,
          label: label,
          path: path,
          type: nodeType,
          icon,
          section,
          hasError,
          children: children
        })
      }
    } else {
      // 4. Single object handling (non-arrays)
      const children = buildEdiTree(value as Record<string, unknown>, errorElements, path, depth + 1)
      
      nodes.push({
        id: path,
        label,
        path,
        type: nodeType,
        icon,
        section,
        hasError,
        // If there are no children (because we ignored the primitive data inside), 
        // it renders as a flat segment "— S NM1" without the expansion arrow.
        children: children.length > 0 ? children : undefined 
      })
    }
  }

  return nodes
}

function formatKey(key: string): string {
  return key
    .replace(/^loop_/, 'Loop ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Tree connector constants ────────────────────────────────────────────────────
// Each depth level indents by INDENT_PX. The connector lines are drawn as
// absolutely-positioned pseudo-columns so we can handle both horizontal
// scroll (content wider than sidebar) and vertical scroll correctly.
const INDENT_PX = 16          // horizontal indent per depth level
const ROW_HEIGHT = 26         // approximate px per tree row (used for scroll)

// Badge styles
const BADGE_BASE: React.CSSProperties = {
  flexShrink: 0,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 8,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 3,
  border: '1px solid rgba(26,26,46,0.18)',
  lineHeight: '14px',
}

// ── EdiNode (recursive tree item) ─────────────────────────────────────────────

function EdiNode({
  node,
  depth = 0,
  defaultOpen = false,
  isLast = false,
  scrollContainer,
}: {
  node: EdiTreeNode
  depth?: number
  defaultOpen?: boolean
  isLast?: boolean
  scrollContainer?: React.RefObject<HTMLDivElement>
}) {
  const [open, setOpen] = useState(defaultOpen)
  const nodeRef          = useRef<HTMLDivElement>(null)
  const setSelectedPath  = useAppStore((s) => s.setSelectedPath)
  const setActiveTabId   = useAppStore((s) => s.setActiveTabId)
  const selectedPath     = useAppStore((s) => s.selectedPath)
  const hasChildren      = node.children && node.children.length > 0
  const isSelected       = selectedPath === node.path

  const isLoop    = node.type === 'loop'
  const isSegment = node.type === 'segment'

  // ── Scroll this node into view when it becomes selected ──
  useEffect(() => {
    if (!isSelected || !nodeRef.current || !scrollContainer?.current) return
    const timer = setTimeout(() => {
      const btn = nodeRef.current?.querySelector(
        `[data-node-path="${CSS.escape(node.path)}"]`
      ) as HTMLElement | null
      btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, 60)
    return () => clearTimeout(timer)
  }, [isSelected, node.path, scrollContainer])

  // ── Scroll last child into view after expansion ──
  useEffect(() => {
    if (!open || !hasChildren || !scrollContainer?.current) return
    // Wait for the animation (180 ms) to finish, then scroll
    const timer = setTimeout(() => {
      const lastChild = node.children![node.children!.length - 1]
      const el = scrollContainer.current?.querySelector(
        `[data-node-path="${CSS.escape(lastChild.path)}"]`
      ) as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, 240)
    return () => clearTimeout(timer)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    setSelectedPath(node.path)
    if (node.section) setActiveTabId('form')
    if (hasChildren) setOpen((v) => !v)
  }

  // ── Badge colors per type ──
  const badgeBg    = isLoop ? '#4ECDC4' : isSegment ? '#FFE66D' : 'rgba(26,26,46,0.12)'
  const badgeLabel = isLoop ? 'L' : isSegment ? 'S' : node.type[0].toUpperCase()

  // ── Row label color ──
  const labelColor = isSelected
    ? '#0D0D1A'
    : isLoop
    ? '#1A1A2E'
    : isSegment
    ? 'rgba(26,26,46,0.8)'
    : 'rgba(26,26,46,0.55)'

  // ── Connector geometry ──
  // The vertical guide line runs from the top of the row down to where the
  // last child ends. The horizontal connector is a short elbow from the
  // vertical guide to the node button.
  const GUIDE_X  = depth * INDENT_PX          // x where the vertical bar sits
  const ELBOW_W  = 10                          // horizontal elbow length

  return (
    <div ref={nodeRef} style={{ position: 'relative' }}>
      {/* ── Tree connectors ── */}
      {depth > 0 && (
        <>
          {/* Vertical connector — full height unless last child */}
          {!isLast && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: GUIDE_X - INDENT_PX,
                top: 0,
                bottom: 0,
                width: 1,
                borderLeft: '1.5px dashed rgba(78,205,196,0.45)',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Elbow connector — half-height vertical + short horizontal */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: GUIDE_X - INDENT_PX,
              top: 0,
              height: ROW_HEIGHT / 2,
              width: ELBOW_W + 1,
              borderLeft: '1.5px dashed rgba(78,205,196,0.45)',
              borderBottom: '1.5px dashed rgba(78,205,196,0.45)',
              borderBottomLeftRadius: 3,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* ── Node row button ── */}
      <button
        data-node-path={node.path}
        onClick={handleClick}
        title={node.path}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          width: 'max-content',
          minWidth: '100%',
          height: ROW_HEIGHT,
          paddingLeft: depth === 0 ? 10 : depth * INDENT_PX + ELBOW_W + 4,
          paddingRight: 14,
          background: isSelected ? 'rgba(78,205,196,0.18)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 4,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: isLoop ? 11 : 10.5,
          color: labelColor,
          fontWeight: isSelected ? 700 : isLoop ? 600 : 400,
          textAlign: 'left',
          transition: 'background 0.12s',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          borderLeft: isSelected ? '2.5px solid #4ECDC4' : '2.5px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(78,205,196,0.08)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Expand chevron or leaf dot */}
        {hasChildren ? (
          <span
            style={{
              fontSize: 7,
              opacity: 0.7,
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
              transition: 'transform 0.18s ease',
              flexShrink: 0,
              color: '#4ECDC4',
              marginRight: 1,
            }}
          >
            ▶
          </span>
        ) : (
          <span
            style={{
              width: 8,
              flexShrink: 0,
              display: 'inline-block',
              color: isSegment ? '#4ECDC4' : 'rgba(26,26,46,0.25)',
              fontSize: 9,
              marginRight: 1,
            }}
          >
            {isSegment ? '—' : '·'}
          </span>
        )}

        {/* Type badge: L / S / etc. */}
        <span style={{ ...BADGE_BASE, background: badgeBg, color: '#1A1A2E' }}>
          {badgeLabel}
        </span>

        {/* Loop emoji icon (only when schema provides one) */}
        {node.icon && (
          <span style={{ flexShrink: 0, fontSize: 11, lineHeight: 1 }}>
            {node.icon}
          </span>
        )}

        {/* Node label */}
        <span style={{ flex: 1 }}>{node.label}</span>

        {/* Error badge */}
        {node.hasError && (
          <span
            style={{ flexShrink: 0, fontSize: 9, color: '#FF6B6B', fontWeight: 800, marginLeft: 4 }}
            title="Has validation error"
          >
            ⚠
          </span>
        )}
      </button>

      {/* ── Children (animated) ── */}
      <AnimatePresence initial={false}>
        {open && hasChildren && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {node.children!.map((child, idx) => (
              <EdiNode
                key={child.id}
                node={child}
                depth={depth + 1}
                defaultOpen={false}
                isLast={idx === node.children!.length - 1}
                scrollContainer={scrollContainer}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function ExplorerEmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 14,
        padding: '28px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          border: '2px dashed rgba(26,26,46,0.2)',
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="3" width="22" height="22" rx="3" stroke="rgba(26,26,46,0.25)" strokeWidth="1.8" strokeDasharray="4 3" />
          <path d="M10 14h8M14 10v8" stroke="rgba(26,26,46,0.3)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <p
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 12,
          fontStyle: 'italic',
          color: 'rgba(26,26,46,0.4)',
          lineHeight: 1.6,
          maxWidth: 160,
        }}
      >
        No EDI data loaded.{' '}
        <span style={{ fontWeight: 700 }}>Upload a file</span> to explore the structure.
      </p>
    </div>
  )
}

// ── ExplorerView ───────────────────────────────────────────────────────────────

function ExplorerView({ onMinimize }: { onMinimize?: () => void }) {
  const parseResult   = useAppStore((s) => s.parseResult)
  const ediFile       = useAppStore((s) => s.ediFile)
  const selectedPath  = useAppStore((s) => s.selectedPath)
  const transactionType = useAppStore((s) => s.transactionType)
  const scrollRef     = useRef<HTMLDivElement>(null)

  const hasFile = !!(parseResult || ediFile.fileName)

  // Collect all element keys that have validation errors → for red ⚠ badges
  const errorElements = useMemo<Set<string>>(() => {
    if (!parseResult) return new Set()
    const data = parseResult as Record<string, unknown>
    const errs = (data.validation_errors ?? data.errors ?? []) as Array<{ element?: string; field?: string }>
    const keys = new Set<string>()
    errs.forEach((e) => {
      const el = e.element ?? e.field ?? ''
      if (el) keys.add(el.toUpperCase())
    })
    return keys
  }, [parseResult])

  // Build EDI-aware tree
  const tree = useMemo<EdiTreeNode[]>(() => {
    if (!parseResult) return []
    return buildEdiTree(parseResult as Record<string, unknown>, errorElements)
  }, [parseResult, errorElements])

  // Scroll is now handled inside each EdiNode via the scrollContainer ref prop.
  // This outer effect is a fallback for the very first render.
  useEffect(() => {
    if (!selectedPath || !scrollRef.current) return
    const timer = setTimeout(() => {
      const el = scrollRef.current?.querySelector(
        `[data-node-path="${CSS.escape(selectedPath)}"]`
      ) as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, 100)
    return () => clearTimeout(timer)
  }, [selectedPath])

  const txLabel = transactionType ? ` · ${transactionType}` : ''

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1.5px solid rgba(26,26,46,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 11,
              color: 'rgba(26,26,46,0.45)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Loop Explorer
          </span>
          {hasFile && tree.length > 0 && (
            <span
              style={{
                background: '#4ECDC4',
                color: '#1A1A2E',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                border: '1px solid rgba(26,26,46,0.15)',
              }}
            >
              {tree.length}
            </span>
          )}
        </div>
        {onMinimize && (
          <button
            onClick={onMinimize}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10" stroke="rgba(26,26,46,0.45)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Body — scrollable in both axes */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          padding: '6px 0',
          // Give the inner content room to be wider than the sidebar
          minWidth: 0,
        }}
        className="custom-scrollbar"
      >
        {/* Inner wrapper: min-width ensures horizontal scroll when content is wide */}
        <div style={{ minWidth: 'max-content', width: '100%' }}>
        {!hasFile || tree.length === 0 ? (
          <ExplorerEmptyState />
        ) : (
          <>
            {/* File label */}
            <div
              style={{
                padding: '4px 12px 8px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                fontWeight: 700,
                color: '#4ECDC4',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderBottom: '1px dashed rgba(78,205,196,0.2)',
                marginBottom: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="#4ECDC4" strokeWidth="1.5" />
                <line x1="4" y1="5" x2="10" y2="5" stroke="#4ECDC4" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="4" y1="8" x2="8" y2="8" stroke="#4ECDC4" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {ediFile.fileName || 'EDI File'}{txLabel}
            </div>

            {/* EDI tree legend */}
            <div
              style={{
                padding: '4px 12px 6px',
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                borderBottom: '1px solid rgba(26,26,46,0.05)',
                marginBottom: 2,
              }}
            >
              {[
                { bg: '#4ECDC4', label: 'Loop' },
                { bg: '#FFE66D', label: 'Segment' },
              ].map((b) => (
                <span
                  key={b.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 9,
                    color: 'rgba(26,26,46,0.45)',
                  }}
                >
                  <span
                    style={{
                      background: b.bg,
                      borderRadius: 2,
                      padding: '0 3px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 7,
                      fontWeight: 700,
                      color: '#1A1A2E',
                      border: '1px solid rgba(26,26,46,0.15)',
                    }}
                  >
                    {b.label[0]}
                  </span>
                  {b.label}
                </span>
              ))}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 9,
                  color: '#FF6B6B',
                }}
              >
                ⚠ Error
              </span>
            </div>

            {tree.map((node, i, arr) => (
              <EdiNode
                key={node.id}
                node={node}
                depth={0}
                defaultOpen={i < 2}
                isLast={i === arr.length - 1}
                scrollContainer={scrollRef as React.RefObject<HTMLDivElement>}
              />
            ))}
          </>
        )}
        </div>
      </div>
    </div>
  )
}

// ── HistoryView ────────────────────────────────────────────────────────────────

const PLACEHOLDER_HISTORY = [
  { id: 'h1', name: 'claim_837p_acme.edi', type: '837P', date: '2 hours ago' },
  { id: 'h2', name: 'remittance_835.edi',  type: '835',  date: 'Yesterday'   },
  { id: 'h3', name: 'enrollment_834.edi',  type: '834',  date: '3 days ago'  },
]

function HistoryView({ onMinimize }: { onMinimize?: () => void }) {
  const typeColors: Record<string, string> = { '837P': '#4ECDC4', '835': '#FFE66D', '834': '#FF6B6B' }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '8px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1.5px solid rgba(26,26,46,0.08)',
        }}
      >
        <span
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 800,
            fontSize: 11,
            color: 'rgba(26,26,46,0.45)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          File History
        </span>
        {onMinimize && (
          <button
            onClick={onMinimize}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10" stroke="rgba(26,26,46,0.45)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} className="custom-scrollbar">
        {PLACEHOLDER_HISTORY.map((file) => (
          <button
            key={file.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              width: '100%',
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(26,26,46,0.06)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(78,205,196,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: '#1A1A2E',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <span
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#1A1A2E',
                  background: typeColors[file.type] ?? '#e0e0e0',
                  borderRadius: 4,
                  padding: '1px 6px',
                  flexShrink: 0,
                  border: '1.5px solid rgba(26,26,46,0.2)',
                }}
              >
                {file.type}
              </span>
            </div>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: 'rgba(26,26,46,0.4)' }}>
              {file.date}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main LeftSidebar ───────────────────────────────────────────────────────────

export default function LeftSidebar({ onMinimize }: { onMinimize?: () => void }) {
  const activePanelView = useAppStore((s) => s.activePanelView)

  return (
    <div
      style={{
        height: '100%',
        background: '#FDFAF4',
        borderRight: '2.5px solid #1A1A2E',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {activePanelView === 'explorer' ? (
        <ExplorerView onMinimize={onMinimize} />
      ) : (
        <HistoryView onMinimize={onMinimize} />
      )}
    </div>
  )
}