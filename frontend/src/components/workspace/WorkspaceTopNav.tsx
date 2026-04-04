import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'

function LogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
      <rect x="4" y="2" width="22" height="28" rx="3" fill="#FDFAF4" stroke="#1A1A2E" strokeWidth="2" />
      <line x1="9" y1="10" x2="20" y2="10" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="15" x2="18" y2="15" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="20" x2="16" y2="20" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="7" fill="#4ECDC4" stroke="#1A1A2E" strokeWidth="2" />
      <circle cx="23" cy="23" r="4" fill="#FDFAF4" stroke="#1A1A2E" strokeWidth="1.5" />
      <line x1="28" y1="28" x2="33" y2="33" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function WorkspaceTopNav() {
  const navigate = useNavigate()

  // Bring in saveCurrentWorkspace from the store
  const { session, parseResult, ediFile, clearFile, setActiveMainView, processFileInWorkspace, saveCurrentWorkspace } = useAppStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFileInWorkspace(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const fullName = session?.user?.user_metadata?.full_name as string | undefined
  const email = session?.user?.email ?? ''
  const displayName = fullName ? fullName.split(' ')[0] : email.split('@')[0]
  const avatarLetter = displayName.charAt(0).toUpperCase()

  const hasFile = !!parseResult || !!ediFile.fileName

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // ── Smart routing for the New Parse button ──
  const handleNewParse = () => {
    clearFile() // Clear current file data

    if (session) {
      // Logged in users stay in the workspace and see the welcome screen
      setActiveMainView('welcome')
      navigate('/workspace')
    } else {
      // Guest users fall back to the landing page
      navigate('/')
    }
  }

  // ── Handle Saving the Workspace ──
  const handleSave = async () => {
    setIsSaving(true)
    await saveCurrentWorkspace()
    setIsSaving(false)
  }

  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        background: '#FDFAF4',
        borderBottom: '2.5px solid #1A1A2E',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        zIndex: 100,
        position: 'relative',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <LogoIcon />
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15, color: '#1A1A2E' }}>
          EdiFix
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(26,26,46,0.4)', marginLeft: 2 }}>
          workspace
        </span>
      </div>

      {/* Breadcrumb / filename */}
      {hasFile && (
        <>
          <span style={{ color: 'rgba(26,26,46,0.3)', fontSize: 14 }}>/</span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#4ECDC4',
              background: 'rgba(78,205,196,0.1)',
              border: '1.5px solid rgba(78,205,196,0.4)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            {ediFile.fileName || 'file.edi'}
          </span>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* HIDDEN FILE INPUT */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".edi,.txt,.dat,.x12,.zip"
      />

      {/* SAVE PROGRESS BUTTON */}
      {session && hasFile && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
            background: isSaving ? '#e0e0e0' : '#FFE66D', 
            border: '2px solid #1A1A2E', borderRadius: 8,
            boxShadow: '3px 3px 0px #1A1A2E', fontFamily: 'Nunito, sans-serif',
            fontWeight: 800, fontSize: 13, color: '#1A1A2E', 
            cursor: isSaving ? 'wait' : 'pointer',
            flexShrink: 0, transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => { if(!isSaving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '4px 4px 0px #1A1A2E' } }}
          onMouseLeave={e => { if(!isSaving) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' } }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M11 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3l-2-2zM10 13V8H4v5M4 1h5v3H4V1z" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {isSaving ? 'Saving...' : 'Save Progress'}
        </button>
      )}

      {/* TRIGGER BUTTON */}
      <button
        onClick={handleNewParse}
        // onClick={() => fileInputRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
          background: '#4ECDC4', border: '2px solid #1A1A2E', borderRadius: 8,
          boxShadow: '3px 3px 0px #1A1A2E', fontFamily: 'Nunito, sans-serif',
          fontWeight: 800, fontSize: 13, color: '#1A1A2E', cursor: 'pointer',
          flexShrink: 0, transition: 'transform 0.1s, box-shadow 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '4px 4px 0px #1A1A2E' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" /></svg>
        New Parse
      </button>

      {/* Avatar + dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px 4px 4px',
            background: 'transparent',
            border: '2px solid rgba(26,26,46,0.2)',
            borderRadius: 999,
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#1A1A2E')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,26,46,0.2)')}
        >
          {/* Avatar circle */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: session ? '#FFE66D' : '#9CA3AF',
            border: '2px solid #1A1A2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 900,
            fontSize: 13,
            color: session ? '#1A1A2E' : '#FFFFFF',
            flexShrink: 0,
          }}>
            {session ? avatarLetter : 'G'}
          </div>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>
            {session ? displayName : 'Guest'}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
            <path d="M2 4l4 4 4-4" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#FDFAF4',
            border: '2.5px solid #1A1A2E',
            borderRadius: 12,
            boxShadow: '5px 5px 0px #1A1A2E',
            padding: '6px',
            minWidth: 170,
            zIndex: 200,
          }}>
            {session ? (
              <>
                {[
                  { label: 'Settings', icon: '⚙️', action: () => setDropdownOpen(false) },
                  { label: 'Developer API', icon: '🔑', action: () => { navigate('/developer'); setDropdownOpen(false) } },
                  { label: 'API Docs', icon: '📚', action: () => { navigate('/docs'); setDropdownOpen(false) } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 12px',
                      background: 'transparent', border: 'none',
                      borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Nunito, sans-serif', fontWeight: 700,
                      fontSize: 13, color: '#1A1A2E', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(78,205,196,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(26,26,46,0.1)', margin: '4px 8px' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 12px',
                    background: 'transparent', border: 'none',
                    borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 700,
                    fontSize: 13, color: '#FF6B6B', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 15 }}>←</span>
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => { navigate('/auth'); setDropdownOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 12px',
                  background: '#4ECDC4', border: '2px solid #1A1A2E',
                  borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 800,
                  fontSize: 13, color: '#1A1A2E', textAlign: 'left',
                  boxShadow: '2px 2px 0px #1A1A2E',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #1A1A2E' }}
              >
                <span style={{ fontSize: 15 }}>✨</span>
                Sign Up / Log In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}