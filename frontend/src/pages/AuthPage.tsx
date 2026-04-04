import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useWindowWidth'

// ── Google "G" icon ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

// ── Squiggly divider SVG ─────────────────────────────────────────────────────
function SquigglyDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', width: '100%' }}>
      <svg style={{ flex: 1 }} height="12" viewBox="0 0 80 12" preserveAspectRatio="none" fill="none">
        <path d="M0 6 Q10 0 20 6 Q30 12 40 6 Q50 0 60 6 Q70 12 80 6" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3" />
      </svg>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 13, color: 'rgba(26,26,46,0.45)', whiteSpace: 'nowrap' }}>or</span>
      <svg style={{ flex: 1 }} height="12" viewBox="0 0 80 12" preserveAspectRatio="none" fill="none">
        <path d="M0 6 Q10 12 20 6 Q30 0 40 6 Q50 12 60 6 Q70 0 80 6" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3" />
      </svg>
    </div>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleGoogleLogin = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setError(error.message)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (tab === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setMessage('Check your email for a confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontFamily: 'Nunito, sans-serif',
    fontWeight: 600,
    fontSize: 15,
    color: '#1A1A2E',
    background: '#FDFAF4',
    border: '2px solid #1A1A2E',
    borderRadius: '10px 12px 8px 11px / 11px 8px 12px 10px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    minHeight: 44,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FDFAF4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        position: 'relative',
      }}
    >
      {/* Background doodle stars */}
      <svg width="40" height="40" style={{ position: 'absolute', top: '12%', left: '8%', opacity: 0.15 }} viewBox="0 0 40 40" fill="none">
        <path d="M20 4 L23 16 L36 20 L23 24 L20 36 L17 24 L4 20 L17 16 Z" stroke="#FF6B6B" strokeWidth="2" fill="none" />
      </svg>
      <svg width="28" height="28" style={{ position: 'absolute', bottom: '15%', right: '10%', opacity: 0.12 }} viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="10" stroke="#4ECDC4" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
      <svg width="32" height="32" style={{ position: 'absolute', top: '20%', right: '12%', opacity: 0.12 }} viewBox="0 0 32 32" fill="none">
        <path d="M16 2 L18 12 L28 16 L18 20 L16 30 L14 20 L4 16 L14 12 Z" stroke="#FFE66D" strokeWidth="2" fill="none" />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 440, position: 'relative' }}
      >
        {/* Notebook card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2.5px solid #1A1A2E',
            borderRadius: '16px 14px 15px 16px / 14px 16px 14px 15px',
            boxShadow: '8px 8px 0px #1A1A2E',
            padding: isMobile ? '24px 20px 28px' : '32px 36px 36px',
            position: 'relative',
          }}
        >
          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '2px solid rgba(26,26,46,0.1)', paddingBottom: 0 }}>
            {(['signup', 'login'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setMessage(null) }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: tab === t ? 800 : 600,
                  fontSize: 16,
                  color: tab === t ? '#1A1A2E' : 'rgba(26,26,46,0.4)',
                  position: 'relative',
                  transition: 'color 0.2s ease',
                }}
              >
                {t === 'signup' ? 'Sign Up' : 'Log In'}
                {tab === t && (
                  <motion.div
                    layoutId="tab-underline"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: '10%',
                      width: '80%',
                      height: 3,
                      background: '#4ECDC4',
                      borderRadius: 2,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Google OAuth button */}
          <button
            onClick={handleGoogleLogin}
            className="btn-sticker"
            style={{
              width: '100%',
              padding: '13px 20px',
              background: '#FFFFFF',
              borderRadius: '10px 12px 8px 11px / 11px 8px 12px 10px',
              fontSize: 15,
              gap: 10,
              marginBottom: 4,
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <SquigglyDivider />

          {/* Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AnimatePresence mode="wait">
              {tab === 'signup' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <label style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#4ECDC4'; e.target.style.boxShadow = '2px 2px 0px #1A1A2E' }}
                    onBlur={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.boxShadow = 'none' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#4ECDC4'; e.target.style.boxShadow = '2px 2px 0px #1A1A2E' }}
                onBlur={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#4ECDC4'; e.target.style.boxShadow = '2px 2px 0px #1A1A2E' }}
                onBlur={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Error / success messages */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 8, padding: '10px 14px', fontFamily: 'Nunito, sans-serif', fontSize: 13, color: '#FF6B6B', fontWeight: 600 }}
                >
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ background: '#F0FFFC', border: '2px solid #4ECDC4', borderRadius: 8, padding: '10px 14px', fontFamily: 'Nunito, sans-serif', fontSize: 13, color: '#1A1A2E', fontWeight: 600 }}
                >
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="btn-sticker"
              style={{
                width: '100%',
                padding: '14px 20px',
                background: '#4ECDC4',
                borderRadius: '10px 12px 8px 11px / 11px 8px 12px 10px',
                fontSize: 16,
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
                minHeight: 44,
              }}
            >
              {loading ? '...' : tab === 'signup' ? 'Create My Account →' : 'Log In →'}
            </button>
          </form>

          {/* Footer switcher */}
          <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'rgba(26,26,46,0.5)' }}>
            {tab === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => { setTab(tab === 'signup' ? 'login' : 'signup'); setError(null); setMessage(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ECDC4', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}
            >
              {tab === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
