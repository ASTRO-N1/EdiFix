import { useState } from 'react'
import type { JSX } from 'react'
import useAppStore from '../../store/useAppStore'
import type { ActivePanelView } from '../../store/useAppStore'

const INACTIVE = 'rgba(255,255,255,0.5)'
const ACTIVE = '#4ECDC4'

function WelcomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ExplorerIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h6l2 2h10v14H3z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="13" y2="14" />
    </svg>
  )
}

function BatchIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function ScaleIcon({ active }: { active: boolean }) {
  const c = active ? '#FFE66D' : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function ExportIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function EligibilityIcon({ active }: { active: boolean }) {
  const c = active ? '#FFE66D' : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  )
}

interface ActivityItem {
  id: ActivePanelView | 'search' | 'dashboard' | 'welcome' | 'export' | 'batch'
  label: string
  icon: (active: boolean) => JSX.Element
  isMainViewToggle?: boolean
  collapsesBar?: boolean
  accentColor?: string
}

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
      title={showLabel ? undefined : label}
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
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: 6, bottom: 6,
          width: 3, background: accentColor, borderRadius: '0 2px 2px 0',
          flexShrink: 0,
        }} />
      )}

      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>

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

function SubNavItem({
  id, label, icon, isActive, showLabel, accentColor = ACTIVE, onClick,
}: {
  id: string; label: string; icon: JSX.Element
  isActive: boolean; showLabel: boolean; accentColor?: string; onClick: () => void
}) {
  return (
    <button
      id={`sidebar-${id}`}
      onClick={onClick}
      title={showLabel ? undefined : label}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: showLabel ? 10 : 0,
        padding: showLabel ? '8px 16px 8px 32px' : '8px 0',
        justifyContent: showLabel ? 'flex-start' : 'center',
        background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: 6, bottom: 6,
          width: 3, background: accentColor, borderRadius: '0 2px 2px 0',
          flexShrink: 0,
        }} />
      )}
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{
        fontFamily: 'Nunito, sans-serif',
        fontWeight: isActive ? 700 : 400,
        fontSize: 12,
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
        maxWidth: showLabel ? 130 : 0,
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.22s ease, opacity 0.18s ease',
      }}>
        {label}
      </span>
    </button>
  )
}

export default function ActivityBar() {
  const activeMainView = useAppStore((s) => s.activeMainView)
  const setActiveMainView = useAppStore((s) => s.setActiveMainView)
  const activePanelView = useAppStore((s) => s.activePanelView)
  const setActivePanelView = useAppStore((s) => s.setActivePanelView)
  const isLeftSidebarOpen = useAppStore((s) => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useAppStore((s) => s.setIsLeftSidebarOpen)
  const session = useAppStore((s) => s.session)

  const [hovered, setHovered] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)

  const isAlwaysExpanded = activeMainView === 'welcome' || activeMainView === 'export' || activeMainView === 'batch'
  const showLabel = isAlwaysExpanded || hovered
  const currentWidth = showLabel ? 200 : 64

  const BASE_ITEMS: ActivityItem[] = [
    { id: 'welcome', label: 'Home', icon: (a) => <WelcomeIcon active={a} />, isMainViewToggle: true },
    { id: 'dashboard', label: 'Dashboard', icon: (a) => <DashboardIcon active={a} />, isMainViewToggle: true },
    { id: 'explorer', label: 'Explorer', icon: (a) => <ExplorerIcon active={a} />, collapsesBar: true },
    { id: 'batch', label: 'Batch Zip', icon: (a) => <BatchIcon active={a} />, isMainViewToggle: true },
    { id: 'history', label: 'History', icon: (a) => <HistoryIcon active={a} />, collapsesBar: true },
    { id: 'export', label: 'Export', icon: (a) => <ExportIcon active={a} />, isMainViewToggle: true },
  ]

  const ITEMS = session ? BASE_ITEMS : BASE_ITEMS.filter((item) => item.id !== 'welcome')

  const isReconcileActive = activeMainView === 'reconcile'
  const isChangeReportActive = activeMainView === 'change-report'
  const isEligibilityActive = activeMainView === 'eligibility-scrubber'
  const isAnyOtherActive = isReconcileActive || isChangeReportActive || isEligibilityActive

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        if (!isAlwaysExpanded) setOtherOpen(false)
      }}
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
              if (item.isMainViewToggle) {
                setActiveMainView(item.id as 'welcome' | 'dashboard' | 'export' | 'batch')
              } else if (item.collapsesBar) {
                setActiveMainView('editor')
                if (isActive) {
                  setIsLeftSidebarOpen(!isLeftSidebarOpen)
                } else {
                  setActivePanelView(item.id as ActivePanelView)
                  setIsLeftSidebarOpen(true)
                }
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

      <div style={{ height: 1, background: 'rgba(255,255,255,0.09)', margin: '6px 16px' }} />

      <button
        id="sidebar-other-services"
        title={showLabel ? undefined : 'Other Services'}
        onClick={() => setOtherOpen((prev) => !prev)}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: showLabel ? 10 : 0,
          padding: showLabel ? '9px 16px' : '10px 0',
          justifyContent: showLabel ? 'flex-start' : 'center',
          background: isAnyOtherActive ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = isAnyOtherActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}
      >
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={isAnyOtherActive ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="3" />
            <circle cx="15" cy="9" r="3" />
            <circle cx="9" cy="15" r="3" />
            <circle cx="15" cy="15" r="3" />
          </svg>
        </span>
        <span style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: isAnyOtherActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
          flex: 1,
          textAlign: 'left',
          maxWidth: showLabel ? 120 : 0,
          opacity: showLabel ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-width 0.22s ease, opacity 0.18s ease',
        }}>
          Other Services
        </span>
        <span style={{
          maxWidth: showLabel ? 16 : 0,
          opacity: showLabel ? 1 : 0,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          transition: 'max-width 0.22s ease, opacity 0.18s ease',
          transform: otherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <div style={{
        overflow: 'hidden',
        maxHeight: otherOpen ? 200 : 0,
        transition: 'max-height 0.28s ease',
      }}>
        <SubNavItem
          id="reconcile-835"
          label="Reconcile 835"
          icon={<ScaleIcon active={isReconcileActive} />}
          isActive={isReconcileActive}
          showLabel={showLabel}
          accentColor="#FFE66D"
          onClick={() => setActiveMainView('reconcile')}
        />
        <SubNavItem
          id="change-report-834"
          label="Change Report"
          icon={<ChangeReport834Icon active={isChangeReportActive} />}
          isActive={isChangeReportActive}
          showLabel={showLabel}
          accentColor="#95E1D3"
          onClick={() => setActiveMainView('change-report')}
        />
        <SubNavItem
          id="eligibility-scrubber"
          label="Eligibility Check"
          icon={<EligibilityIcon active={isEligibilityActive} />}
          isActive={isEligibilityActive}
          showLabel={showLabel}
          accentColor="#FFE66D"
          onClick={() => setActiveMainView('eligibility-scrubber')}
        />
      </div>
    </div>
  )
}