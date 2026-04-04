import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '../components/dashboard/Sidebar'
import TopBar from '../components/dashboard/TopBar'
import OverviewPage from '../components/dashboard/overview/OverviewPage'
import ComingSoon from '../components/dashboard/ComingSoon'
import AIChatPanel from '../components/dashboard/AIChatPanel'
import RoughDivider from '../components/dashboard/RoughDivider'
import { useTheme } from '../theme/ThemeContext'
import { useIsMobile } from '../hooks/useWindowWidth'

export default function DashboardPage() {
  const { t } = useTheme()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <div style={{
      display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden',
      alignItems: 'stretch', background: t.bg, transition: 'background 0.2s',
    }}>

      {/* ── Desktop: Left Sidebar ── */}
      {!isMobile && (
        <>
          <Sidebar />
          <RoughDivider orientation="vertical" />
        </>
      )}

      {/* ── Mobile: Sidebar drawer backdrop ── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            key="db-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mobile-drawer-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {isMobile && sidebarOpen && (
          <motion.div
            key="db-sidebar"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200, width: 260 }}
          >
            <Sidebar onMobileClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Middle Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* TopBar — passes onMenuClick for mobile */}
        <TopBar onMenuClick={isMobile ? () => setSidebarOpen(o => !o) : undefined} menuOpen={sidebarOpen} />
        <RoughDivider orientation="horizontal" />

        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview"   element={<OverviewPage />} />
            <Route path="segments"   element={<ComingSoon feature="Segment Explorer" />} />
            <Route path="validation" element={<ComingSoon feature="Validation Report" />} />
            <Route path="loops"      element={<ComingSoon feature="Loop Structure" />} />
            <Route path="export"     element={<ComingSoon feature="Export & Reports" />} />
            <Route path="ai"         element={<ComingSoon feature="AI Insights Center" />} />
          </Routes>
        </main>
      </div>

      {/* ── Desktop: AI Chat Panel ── */}
      {!isMobile && (
        <>
          <RoughDivider orientation="vertical" />
          <AIChatPanel />
        </>
      )}

      {/* ── Mobile: floating AI button ── */}
      {isMobile && (
        <button
          onClick={() => setAiOpen(o => !o)}
          aria-label="Open AI Assistant"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 180,
            width: 52, height: 52, borderRadius: '50%',
            background: '#4ECDC4', border: '2.5px solid #1A1A2E',
            boxShadow: '3px 3px 0 #1A1A2E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, cursor: 'pointer',
          }}
        >
          🤖
        </button>
      )}

      {/* ── Mobile: AI bottom sheet ── */}
      <AnimatePresence>
        {isMobile && aiOpen && (
          <>
            <motion.div
              key="ai-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-drawer-backdrop"
              onClick={() => setAiOpen(false)}
            />
            <motion.div
              key="ai-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
                height: '72vh', borderRadius: '16px 16px 0 0', overflow: 'hidden',
              }}
            >
              <AIChatPanel onMobileClose={() => setAiOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
