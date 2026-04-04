import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import LandingPage from './pages/LandingPage'
import ProcessingPage from './pages/ProcessingPage'
import DashboardPage from './pages/DashboardPage'
import AuthPage from './pages/AuthPage'
import WorkspacePage from './pages/WorkspacePage'
import DeveloperDashboard from './pages/DeveloperDashboard'
import DocsPage from './pages/DocsPage'
import { ThemeProvider } from './theme/ThemeContext'
import useAppStore from './store/useAppStore'
import { supabase } from './lib/supabase'
import './index.css'

function AuthListener() {
  const setSession = useAppStore(s => s.setSession)
  const setAuthLoading = useAppStore(s => s.setAuthLoading)

  useEffect(() => {
    // Check for existing session first, then mark loading done
    supabase.auth.getSession().then((result: { data: { session: Session | null }, error: Error | null }) => {
      setSession(result.data.session)
      setAuthLoading(false)
    })

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session)
      setAuthLoading(false)          // ← also mark done on any change
    })

    return () => subscription.unsubscribe()
  }, [setSession, setAuthLoading])

  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthListener />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/dashboard/*" element={<DashboardPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/developer" element={<DeveloperDashboard />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
