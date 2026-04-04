import { useState } from 'react'
import type { JSX } from 'react'
import useAppStore from '../../store/useAppStore'
import type { ActivePanelView } from '../../store/useAppStore'

const INACTIVE = 'rgba(255,255,255,0.5)'
const ACTIVE   = '#4ECDC4'

function WelcomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ExplorerIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h6l2 2h10v14H3z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="13" y2="14" />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function ScaleIcon({ active }: { active: boolean }) {
  const c = active ? '#FFE66D' : INACTIVE
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="6" x2="4" y2="10" />
      <line x1="12" y1="6" x2="20" y2="10" />
      <path d="M4 10 C2 12 2 14 4 14 C6 14 6 12 4 10" />
      <path d="M20 10 C18 12 18 14 20 14 C22 14 22 12 20 10" />
    </svg>
  )
}

function ChangeReport834Icon({ active }: { active: boolean }) {
  const c = active ? '#95E1D3' : INACTIVE
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function ExportIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

interface ActivityItem {
  id: ActivePanelView | 'search' | 'dashboard' | 'welcome' | 'export'
  label: string
  icon: (active: boolean) => JSX.Element
  isMainViewToggle?: boolean
  collapsesBar?: boolean   // clicking this item collapses the sidebar
  accentColor?: string
}

// ── Nav row ───────────────────────────────────────────────────────────────────

function NavItem({
  id, label, icon, isActive, showLabel, accentColor = ACTIVE, onClick,
}: {
  id: string; label: string; icon: JSX.Element
  isActive: boolean; showLabel: boolean; accentColor?: string; onClick: () => void
}) {
  return (
    <button
      id={`sidebar-${id}`}
      onClick={onClick}
      title={showLabel ? undefined : label}   // tooltip only when collapsed
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: showLabel ? 12 : 0,
        padding: showLabel ? '9px 16px' : '10px 0',
        justifyContent: showLabel ? 'flex-start' : 'center',
        background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Active left-edge indicator */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: 6, bottom: 6,
          width: 3, background: accentColor, borderRadius: '0 2px 2px 0',
          flexShrink: 0,
        }} />
      )}

      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>

      {/* Label — hidden (width 0, opacity 0) when collapsed */}
      <span style={{
        fontFamily: 'Nunito, sans-serif',
        fontWeight: isActive ? 700 : 500,
        fontSize: 13,
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
        maxWidth: showLabel ? 140 : 0,
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.22s ease, opacity 0.18s ease',
      }}>
        {label}
      </span>
    </button>
  )
}

// ── Main ActivityBar ──────────────────────────────────────────────────────────

export default function ActivityBar() {
  const activeMainView       = useAppStore((s) => s.activeMainView)
  const setActiveMainView    = useAppStore((s) => s.setActiveMainView)
  const activePanelView      = useAppStore((s) => s.activePanelView)
  const setActivePanelView   = useAppStore((s) => s.setActivePanelView)
  const isLeftSidebarOpen    = useAppStore((s) => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useAppStore((s) => s.setIsLeftSidebarOpen)
  const session              = useAppStore((s) => s.session)

  // ── Collapse state ────────────────────────────────────────────────────────
  // collapsed = true  →  icon-strip (64 px), triggered by Explorer click
  // hovered          →  temporarily re-expand while mouse is over the bar
  const [collapsed, setCollapsed] = useState(false)
  const [hovered,   setHovered]   = useState(false)

  const showLabel = !collapsed || hovered   // show labels if expanded OR temporarily hovered

  const currentWidth = showLabel ? 200 : 64

  const BASE_ITEMS: ActivityItem[] = [
    { id: 'welcome',   label: 'Home',      icon: (a) => <WelcomeIcon active={a} />,   isMainViewToggle: true },
    { id: 'dashboard', label: 'Dashboard', icon: (a) => <DashboardIcon active={a} />, isMainViewToggle: true },
    { id: 'explorer',  label: 'Explorer',  icon: (a) => <ExplorerIcon active={a} />,  collapsesBar: true },
    { id: 'history',   label: 'History',   icon: (a) => <HistoryIcon active={a} /> },
    { id: 'export',    label: 'Export',    icon: (a) => <ExportIcon active={a} />,    isMainViewToggle: true },
  ]

  const ITEMS = session ? BASE_ITEMS : BASE_ITEMS.filter((item) => item.id !== 'welcome')

  const isReconcileActive    = activeMainView === 'reconcile'
  const isChangeReportActive = activeMainView === 'change-report'

  return (
    <div
      style={{
        width: currentWidth,
        flexShrink: 0,
        background: '#1A1A2E',
        borderRight: '2.5px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingTop: 10,
        zIndex: 10,
        overflowX: 'hidden',
        overflowY: 'auto',
        transition: 'width 0.22s ease',
      }}
      onMouseEnter={() => { if (collapsed) setHovered(true) }}
      onMouseLeave={() => { if (collapsed) setHovered(false) }}
    >
      {ITEMS.map((item) => {
        const isActive = item.isMainViewToggle
          ? activeMainView === item.id
          : activeMainView === 'editor' && activePanelView === item.id

        return (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon(isActive)}
            isActive={isActive}
            showLabel={showLabel}
            onClick={() => {
              if (item.collapsesBar) {
                // Explorer: open the panel AND collapse the bar
                setCollapsed(true)
                setHovered(false)
                setActiveMainView('editor')
                if (isActive) {
                  setIsLeftSidebarOpen(!isLeftSidebarOpen)
                } else {
                  setActivePanelView(item.id as ActivePanelView)
                  setIsLeftSidebarOpen(true)
                }
              } else if (item.isMainViewToggle) {
                // Home / Dashboard / Export: expand bar back
                setCollapsed(false)
                setActiveMainView(item.id as 'welcome' | 'dashboard' | 'export')
              } else {
                setActiveMainView('editor')
                if (isActive) {
                  setIsLeftSidebarOpen(!isLeftSidebarOpen)
                } else {
                  setActivePanelView(item.id as ActivePanelView)
                  setIsLeftSidebarOpen(true)
                }
              }
            }}
          />
        )
      })}

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.09)', margin: '6px 16px' }} />

      {/* ── Reconcile 835 ── */}
      <NavItem
        id="reconcile-835"
        label="Reconcile 835"
        icon={<ScaleIcon active={isReconcileActive} />}
        isActive={isReconcileActive}
        showLabel={showLabel}
        accentColor="#FFE66D"
        onClick={() => { setCollapsed(false); setActiveMainView('reconcile') }}
      />

      {/* ── 834 Change Report ── */}
      <NavItem
        id="change-report-834"
        label="Change Report"
        icon={<ChangeReport834Icon active={isChangeReportActive} />}
        isActive={isChangeReportActive}
        showLabel={showLabel}
        accentColor="#95E1D3"
        onClick={() => { setCollapsed(false); setActiveMainView('change-report') }}
      />
    </div>
  )
}