import { useEffect, useRef } from 'react'
import { Panel, Group as PanelGroup } from 'react-resizable-panels'
import useAppStore from '../store/useAppStore'

// IDE Components
import WorkspaceTopNav from '../components/workspace/WorkspaceTopNav'
import ActivityBar from '../components/workspace/ActivityBar'
import LeftSidebar from '../components/workspace/LeftSidebar'
import EditorArea from '../components/workspace/EditorArea'
import ValidationDrawer from '../components/workspace/ValidationDrawer'
import AIPanel from '../components/workspace/AIPanel'
import DoodleResizeHandle from '../components/workspace/DoodleResizeHandle'
import OverviewPage from '../components/dashboard/overview/OverviewPage'
import WorkspaceWelcome from '../components/workspace/WorkspaceWelcome'
import ExportPage from '../components/workspace/ExportPage'

const FlexPanelGroup = PanelGroup as any

export default function WorkspacePage() {
  const { authLoading, activeMainView, setActiveMainView, session, ediFile, isLoading } = useAppStore()
  const isLeftSidebarOpen = useAppStore(s => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useAppStore(s => s.setIsLeftSidebarOpen)
  const isAIPanelOpen = useAppStore(s => s.isAIPanelOpen)
  const setIsAIPanelOpen = useAppStore(s => s.setIsAIPanelOpen)

  const hasInitialized = useRef(false)

  // ── One-Time Routing Logic ─────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!hasInitialized.current) {
      hasInitialized.current = true
      // On initial load, route to 'welcome' if logged in and no file exists
      if (session && !ediFile.file) {
        setActiveMainView('welcome')
      }
      // If guest accidentally got set to welcome, push to dashboard standard view
      else if (!session && activeMainView === 'welcome') {
        setActiveMainView('dashboard')
      }
    }
  }, [authLoading, session, ediFile.file, activeMainView, setActiveMainView])

  // ── While auth is initializing ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF4', flexDirection: 'column', gap: 16 }}>
        <div className="doodle-spinner" style={{ width: 48, height: 48 }} />
        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: 'rgba(26,26,46,0.5)' }}>Loading your workspace...</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative',display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#FDFAF4' }}>

      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(253, 250, 244, 0.7)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="doodle-spinner" style={{ width: 48, height: 48 }} />
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, color: '#1A1A2E', marginTop: 16 }}>
            Parsing your file...
          </p>
        </div>
      )}
      {/* Top Navbar */}
      <WorkspaceTopNav />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar />

        {activeMainView === 'welcome' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <WorkspaceWelcome />
          </div>
        ) : activeMainView === 'dashboard' ? (
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
            <OverviewPage />
          </div>
        ) : activeMainView === 'export' ? (
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
            <ExportPage />
          </div>
        ) : (
          <FlexPanelGroup orientation="horizontal" autoSaveId="workspace-layout-v1">
            {isLeftSidebarOpen && (
              <>
                <Panel id="left-sidebar" defaultSize={300} minSize={12} collapsible>
                  <LeftSidebar onMinimize={() => setIsLeftSidebarOpen(false)} />
                </Panel>
                <DoodleResizeHandle />
              </>
            )}

            <Panel id="center-column" minSize={30}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <EditorArea />
                </div>
                <ValidationDrawer />
              </div>
            </Panel>

            {isAIPanelOpen && <DoodleResizeHandle />}

            {isAIPanelOpen && (
              <Panel id="ai-panel" defaultSize={320} minSize={15} collapsible>
                <AIPanel />
              </Panel>
            )}
          </FlexPanelGroup>
        )}
      </div>

      {activeMainView !== 'welcome' && !isAIPanelOpen && (
        <button
          onClick={() => setIsAIPanelOpen(true)}
          style={{
            position: 'fixed', right: -2, top: '50%', transform: 'translateY(-50%)', zIndex: 100,
            background: '#4ECDC4', border: '2.5px solid #1A1A2E', borderRadius: '8px 0 0 8px',
            padding: '16px 6px', boxShadow: '-3px 3px 0px #1A1A2E', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, right 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.right = '0px'; e.currentTarget.style.boxShadow = '-5px 5px 0px #1A1A2E' }}
          onMouseLeave={(e) => { e.currentTarget.style.right = '-2px'; e.currentTarget.style.boxShadow = '-3px 3px 0px #1A1A2E' }}
        >
          <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#1A1A2E', letterSpacing: '0.05em' }}>
            Ask Me Anything ✨
          </div>
        </button>
      )}
    </div>
  )
}