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
import ReconcileView from '../components/workspace/ReconcileView'
import ExportPage from '../components/workspace/ExportPage'
import ChangeReport834View from '../components/workspace/ChangeReport834View'
import EligibilityScrubberView from '../components/workspace/EligibilityScrubberView'

const FlexPanelGroup = PanelGroup as any

export default function WorkspacePage() {
  const { authLoading, activeMainView, setActiveMainView, session, ediFile, isLoading } = useAppStore()
  const isLeftSidebarOpen = useAppStore(s => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useAppStore(s => s.setIsLeftSidebarOpen)
  const isAIPanelOpen = useAppStore(s => s.isAIPanelOpen)
  const setIsAIPanelOpen = useAppStore(s => s.setIsAIPanelOpen)
  const activePanelView = useAppStore(s => s.activePanelView)

  const hasInitialized = useRef(false)

  // ── One-Time Routing Logic ─────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!hasInitialized.current) {
      hasInitialized.current = true
      if (session && !ediFile.file) {
        setActiveMainView('welcome')
      } else if (!session && activeMainView === 'welcome') {
        setActiveMainView('dashboard')
      }
    }
  }, [authLoading, session, ediFile.file, activeMainView, setActiveMainView])

  // ── While auth is initializing ─────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF4', flexDirection: 'column', gap: 16 }}>
        <div className="doodle-spinner" style={{ width: 48, height: 48 }} />
        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: 'rgba(26,26,46,0.5)' }}>Loading your workspace...</p>
      </div>
    )
  }

  // ── Determine what the center area renders ─────────────────────────────────
  const isFullPageView = activeMainView === 'welcome' || activeMainView === 'dashboard' || activeMainView === 'reconcile' || activeMainView === 'change-report'

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#FDFAF4' }}>

      {/* Global parse-loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(253,250,244,0.7)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="doodle-spinner" style={{ width: 48, height: 48 }} />
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, color: '#1A1A2E', marginTop: 16 }}>
            Parsing your file…
          </p>
        </div>
      )}

      {/* Top Navbar */}
      <WorkspaceTopNav />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar />

        {/* Loop Explorer pull-tab — sits right after ActivityBar, visible when sidebar is closed */}
        {activeMainView === 'editor' && !isLeftSidebarOpen && (
          <button
            id="loop-explorer-pull-tab"
            onClick={() => setIsLeftSidebarOpen(true)}
            style={{
              alignSelf: 'center',
              marginTop: '-30px',
              width: '40px',
              flexShrink: 0,
              background: '#FFE66D',
              border: '2.5px solid #1A1A2E',
              borderRadius: '0 8px 8px 0',
              padding: '16px 6px',
              boxShadow: '3px 3px 0px #1A1A2E',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              zIndex: 10,
              transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '5px 5px 0px #1A1A2E' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' }}
          >
            <div style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 14,
              color: '#1A1A2E',
              letterSpacing: '0.05em',
            }}>
              {activePanelView === 'history' ? 'File History 📂' : 'Loop Explorer 🔍'}
            </div>
          </button>
        )}

        {/* ── Full-page views (no left sidebar, no tabs) ── */}
        {activeMainView === 'welcome' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <WorkspaceWelcome />
          </div>
        )}

        {activeMainView === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
            <OverviewPage />
          </div>
        )}

        {/* ── Reconcile page — full area, no left sidebar, no tabs ── */}
        {activeMainView === 'reconcile' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ReconcileView />
          </div>
        )}

        {/* ── 834 Change Report page — full area ── */}
        {activeMainView === 'change-report' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChangeReport834View />
          </div>
        )}

        {/* ── Eligibility Scrubber page — full area ── */}
        {activeMainView === 'eligibility-scrubber' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <EligibilityScrubberView />
          </div>
        )}

        {/* ── Editor / Export views (left sidebar + tabs + validation drawer) ── */}
        {activeMainView === 'export' ? (
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
            <ExportPage />
          </div>
        ) : activeMainView === 'editor' ? (
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
        ) : null}
      </div>

      {/* AI Co-Pilot pull tab — hidden on welcome view */}
      {!isFullPageView || activeMainView === 'reconcile' ? null : null}
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