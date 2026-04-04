import type { JSX } from 'react'
import useAppStore from '../../store/useAppStore'
import type { ActivePanelView } from '../../store/useAppStore'

function WelcomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4ECDC4' : 'rgba(26,26,46,0.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4ECDC4' : 'rgba(26,26,46,0.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ExplorerIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4ECDC4' : 'rgba(26,26,46,0.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h6l2 2h10v14H3z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="13" y2="14" />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4ECDC4' : 'rgba(26,26,46,0.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function ExportIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#4ECDC4' : 'rgba(26,26,46,0.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
}

export default function ActivityBar() {
  const activeMainView = useAppStore((s) => s.activeMainView)
  const setActiveMainView = useAppStore((s) => s.setActiveMainView)
  const activePanelView = useAppStore((s) => s.activePanelView)
  const setActivePanelView = useAppStore((s) => s.setActivePanelView)
  const isLeftSidebarOpen = useAppStore((s) => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useAppStore((s) => s.setIsLeftSidebarOpen)
  const session = useAppStore((s) => s.session)

  // Declare all base items
  const BASE_ITEMS: ActivityItem[] = [
    { id: 'welcome', label: 'Welcome', icon: (a: boolean) => <WelcomeIcon active={a} />, isMainViewToggle: true },
    { id: 'dashboard', label: 'Dashboard', icon: (a: boolean) => <DashboardIcon active={a} />, isMainViewToggle: true },
    { id: 'explorer', label: 'Explorer', icon: (a: boolean) => <ExplorerIcon active={a} /> },
    { id: 'history', label: 'History', icon: (a: boolean) => <HistoryIcon active={a} /> },
    { id: 'export', label: 'Export', icon: (a: boolean) => <ExportIcon active={a} />, isMainViewToggle: true },
  ]

  // Filter out the Welcome tab if the user is a guest
  const ITEMS = session ? BASE_ITEMS : BASE_ITEMS.filter((item) => item.id !== 'welcome')

  return (
    <div style={{ width: 48, flexShrink: 0, background: '#FDFAF4', borderRight: '2.5px solid #1A1A2E', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, zIndex: 10 }}>
      {ITEMS.map((item) => {
        const isActive = item.isMainViewToggle
          ? activeMainView === item.id
          : activeMainView === 'editor' && activePanelView === item.id

        return (
          <button
            key={item.id}
            title={item.label}
            onClick={() => {
              if (item.isMainViewToggle) {
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
            style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(78,205,196,0.12)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s ease', marginBottom: 2 }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(26,26,46,0.06)' }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            {isActive && (!item.isMainViewToggle ? isLeftSidebarOpen : true) && (
              <div style={{ position: 'absolute', left: -4, top: 8, bottom: 8, width: 3, background: '#4ECDC4', borderRadius: 2 }} />
            )}
            {item.icon(isActive)}
          </button>
        )
      })}
    </div>
  )
}