import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Navigate } from 'react-router-dom'
import useAppStore from '../store/useAppStore'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

// ── helper: copy to clipboard ────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}

// ── Doodle card wrapper ──────────────────────────────────────────────────────
function DoodleCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#FDFAF4',
      border: '2.5px solid #1A1A2E',
      borderRadius: '14px 12px 16px 13px / 13px 16px 12px 14px',
      boxShadow: '5px 5px 0px #1A1A2E',
      padding: 28,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Code block with copy ─────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const { copied, copy } = useCopy()
  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: '#0D0D1A',
        color: '#4ECDC4',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        lineHeight: 1.8,
        padding: '20px 24px',
        borderRadius: 10,
        border: '2px solid #4ECDC4',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {code}
      </pre>
      <button
        onClick={() => copy(code)}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: copied ? '#4ECDC4' : 'rgba(78,205,196,0.15)',
          border: '1.5px solid #4ECDC4',
          borderRadius: 6,
          color: copied ? '#1A1A2E' : '#4ECDC4',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11,
          padding: '4px 10px', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  )
}

export default function DeveloperDashboard() {
  const navigate = useNavigate()
  const { session, authLoading } = useAppStore()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showModal, setShowModal] = useState(false)       // ← popup state
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [codeTab, setCodeTab] = useState<'curl' | 'python'>('curl')
  const [revoking, setRevoking] = useState<string | null>(null)

  // ── Fetch existing keys for this user ──────────────────────────────────────
  const fetchKeys = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch(`${API_URL}/api/v1/keys`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (res.ok) setKeys(await res.json())
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  // ── Generate new key ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!session || !newKeyName.trim()) return
    setGenerating(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/keys`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setRevealedKey(data.key)
        setNewKeyName('')
        setShowModal(false)      // close modal
        fetchKeys()
      }
    } finally {
      setGenerating(false)
    }
  }

  // ── Revoke key ─────────────────────────────────────────────────────────────
  const handleRevoke = async (keyId: string) => {
    if (!session) return
    setRevoking(keyId)
    try {
      await fetch(`${API_URL}/api/v1/keys/${keyId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      setKeys(prev => prev.filter(k => k.id !== keyId))
    } finally {
      setRevoking(null)
    }
  }

  // ── Code snippets ──────────────────────────────────────────────────────────
  const demoKey = revealedKey ?? (keys[0]?.key_prefix ?? 'sk_live_••••••••')
  const curlSnippet = `curl -X POST \\
  ${API_URL}/api/v1/parse \\
  -H "Authorization: Bearer ${demoKey}" \\
  -F "file=@your_835_file.edi"`

  const pythonSnippet = `import requests

API_KEY = "${demoKey}"
FILE_PATH = "your_835_file.edi"

with open(FILE_PATH, "rb") as f:
    response = requests.post(
        "${API_URL}/api/v1/parse",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"file": f},
    )

print(response.json())`

  // ── Auth guards ────────────────────────────────────────────────────────────
  if (authLoading) return null
  if (!session) return <Navigate to="/auth" replace />

  const displayName = (
    (session.user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? session.user?.email?.split('@')[0]
    ?? 'Developer'
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Nunito, sans-serif' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0,
        background: '#1A1A2E',
        display: 'flex', flexDirection: 'column',
        padding: '24px 12px', gap: 4,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 28 }}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="2" width="22" height="28" rx="3" fill="#FDFAF4" stroke="#4ECDC4" strokeWidth="2" />
            <line x1="9" y1="10" x2="20" y2="10" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="15" x2="18" y2="15" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="20" x2="16" y2="20" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="24" cy="24" r="7" fill="#4ECDC4" stroke="#FDFAF4" strokeWidth="2" />
            <circle cx="23" cy="23" r="4" fill="#1A1A2E" stroke="#4ECDC4" strokeWidth="1.5" />
            <line x1="28" y1="28" x2="33" y2="33" stroke="#FDFAF4" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#FDFAF4' }}>EdiFix</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(78,205,196,0.7)', marginTop: 1 }}>Developer API</div>
          </div>
        </div>

        {[
          { icon: '🏠', label: 'Workspace', path: '/workspace' },
          { icon: '🔑', label: 'API Keys', path: '/developer', active: true },
          { icon: '📚', label: 'API Docs', path: '/docs' },
          { icon: '➕', label: 'Parse File', path: '/' },
        ].map(item => (
          <button key={item.label} onClick={() => navigate(item.path)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '11px 16px',
            background: item.active ? 'rgba(78,205,196,0.15)' : 'none',
            border: item.active ? '1.5px solid rgba(78,205,196,0.3)' : 'none',
            cursor: 'pointer', borderRadius: 10,
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14,
            color: item.active ? '#4ECDC4' : 'rgba(253,250,244,0.85)',
            textAlign: 'left',
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ height: 1, background: 'rgba(253,250,244,0.1)', margin: '8px 0' }} />
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', padding: '11px 16px',
          background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10,
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14,
          color: '#FF6B6B', textAlign: 'left',
        }}>
          <span style={{ fontSize: 16 }}>←</span> Log Out
        </button>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, background: '#F5F2EC', overflow: 'auto', padding: '40px 48px',
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 36 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px',
            background: '#FFE66D', border: '2px solid #1A1A2E',
            borderRadius: 999, boxShadow: '3px 3px 0 #1A1A2E',
            fontWeight: 800, fontSize: 13, color: '#1A1A2E',
            marginBottom: 12, transform: 'rotate(-0.5deg)',
          }}>
            👋 Hi, {displayName}!
          </div>
          <h1 style={{ fontWeight: 900, fontSize: 32, color: '#1A1A2E', margin: 0 }}>
            Developer <span style={{ color: '#4ECDC4' }}>Dashboard</span>
          </h1>
          <p style={{ marginTop: 6, color: 'rgba(26,26,46,0.55)', fontSize: 15 }}>
            Manage your API keys and integrate EdiFix into your pipeline.
          </p>
        </motion.div>

        {/* ── One-time key reveal banner ─────────────────────────────── */}
        <AnimatePresence>
          {revealedKey && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{
                background: '#1A1A2E', border: '2.5px solid #4ECDC4',
                borderRadius: 12, padding: '18px 24px', marginBottom: 28,
                boxShadow: '5px 5px 0px #4ECDC4',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: '#FFE66D', fontWeight: 800, fontSize: 14 }}>
                  🎉 New key generated — copy it now, it won't be shown again!
                </span>
                <button onClick={() => setRevealedKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(253,250,244,0.5)', fontSize: 18 }}>×</button>
              </div>
              <CodeBlock code={revealedKey} />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* ── Left: API Key Manager ──────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <DoodleCard>
              <h2 style={{ fontWeight: 900, fontSize: 20, color: '#1A1A2E', margin: '0 0 20px' }}>
                🔑 API Keys
              </h2>

              {/* Generate new key — opens modal */}
              <div style={{ marginBottom: 24 }}>
                <motion.button
                  id="dev-generate-key-btn"
                  whileHover={{ y: -2, boxShadow: '5px 5px 0 #1A1A2E' }}
                  whileTap={{ y: 0, boxShadow: '2px 2px 0 #1A1A2E' }}
                  onClick={() => setShowModal(true)}
                  style={{
                    padding: '11px 22px',
                    background: '#4ECDC4',
                    border: '2.5px solid #1A1A2E',
                    borderRadius: '10px 12px 10px 11px / 11px 10px 12px 10px',
                    boxShadow: '4px 4px 0 #1A1A2E',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14,
                    color: '#1A1A2E', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    transform: 'rotate(-0.5deg)',
                  }}
                >
                  ⚡ Generate New API Key
                </motion.button>
              </div>

              {/* Key list */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'rgba(26,26,46,0.4)', fontSize: 14 }}>
                  Loading keys...
                </div>
              ) : keys.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '28px 16px',
                  border: '2px dashed rgba(26,26,46,0.2)', borderRadius: 10,
                  color: 'rgba(26,26,46,0.4)', fontSize: 14,
                }}>
                  No keys yet. Generate your first key above!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {keys.map(k => (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px',
                        background: '#F5F2EC', border: '2px solid rgba(26,26,46,0.15)',
                        borderRadius: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#1A1A2E' }}>{k.name}</div>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          color: 'rgba(26,26,46,0.5)', marginTop: 3,
                        }}>
                          {k.key_prefix}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(26,26,46,0.4)', marginTop: 2 }}>
                          Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        style={{
                          padding: '7px 14px',
                          background: '#FF6B6B', border: '2px solid #1A1A2E',
                          borderRadius: 8, boxShadow: '3px 3px 0 #1A1A2E',
                          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12,
                          color: '#FDFAF4', cursor: 'pointer',
                        }}
                      >
                        {revoking === k.id ? '...' : 'Revoke'}
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}
            </DoodleCard>
          </motion.div>

          {/* ── Right: Interactive Docs ────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{
              background: '#1A1A2E',
              border: '2.5px solid #4ECDC4',
              borderRadius: '14px 12px 16px 13px / 13px 16px 12px 14px',
              boxShadow: '5px 5px 0px #4ECDC4',
              padding: 28,
            }}>
              <h2 style={{ fontWeight: 900, fontSize: 20, color: '#FDFAF4', margin: '0 0 6px' }}>
                📡 Send your first request
              </h2>
              <p style={{ color: 'rgba(253,250,244,0.5)', fontSize: 13, marginBottom: 20 }}>
                POST an EDI file with your key in the Authorization header.
              </p>

              {/* Language toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {(['curl', 'python'] as const).map(tab => (
                  <button key={tab} onClick={() => setCodeTab(tab)} style={{
                    padding: '6px 18px',
                    background: codeTab === tab ? '#4ECDC4' : 'rgba(78,205,196,0.1)',
                    border: '1.5px solid #4ECDC4',
                    borderRadius: 8,
                    color: codeTab === tab ? '#1A1A2E' : '#4ECDC4',
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {tab === 'curl' ? 'cURL' : 'Python'}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={codeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <CodeBlock code={codeTab === 'curl' ? curlSnippet : pythonSnippet} />
                </motion.div>
              </AnimatePresence>

              {/* Endpoint reference */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(78,205,196,0.2)' }}>
                <div style={{ color: 'rgba(253,250,244,0.5)', fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Endpoints
                </div>
                {[
                  { method: 'POST', path: '/api/v1/parse', desc: 'Parse an EDI file' },
                  { method: 'GET', path: '/api/v1/keys', desc: 'List your keys' },
                  { method: 'DELETE', path: '/api/v1/keys/{key_id}', desc: 'Revoke a key' },
                ].map(ep => (
                  <div key={ep.path} style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                      color: ep.method === 'POST' ? '#4ECDC4' : ep.method === 'DELETE' ? '#FF6B6B' : '#FFE66D',
                      minWidth: 48,
                    }}>{ep.method}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(253,250,244,0.7)' }}>{ep.path}</span>
                    <span style={{ fontSize: 11, color: 'rgba(253,250,244,0.35)' }}>— {ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Generate Key Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowModal(false); setNewKeyName('') }}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(26,26,46,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#FDFAF4',
                border: '3px solid #1A1A2E',
                borderRadius: '16px 14px 18px 15px / 15px 18px 14px 16px',
                boxShadow: '8px 8px 0 #1A1A2E',
                padding: '36px 40px',
                width: '100%',
                maxWidth: 440,
                position: 'relative',
              }}
            >
              {/* Close button */}
              <button
                id="dev-modal-close-btn"
                onClick={() => { setShowModal(false); setNewKeyName('') }}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 22, color: 'rgba(26,26,46,0.4)', lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FF6B6B')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(26,26,46,0.4)')}
              >×</button>

              {/* Yellow SECRET tag */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#FFE66D', border: '2px solid #1A1A2E',
                borderRadius: 6, padding: '3px 12px',
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                fontSize: 11, color: '#1A1A2E',
                marginBottom: 16, transform: 'rotate(-0.8deg)',
                boxShadow: '2px 2px 0 #1A1A2E',
              }}>🔑 NEW API KEY</div>

              <h2 style={{
                fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                fontSize: 24, color: '#1A1A2E', margin: '0 0 8px',
              }}>Name your key</h2>
              <p style={{
                fontFamily: 'Nunito, sans-serif', fontSize: 14,
                color: 'rgba(26,26,46,0.55)', marginBottom: 24, lineHeight: 1.5,
              }}>
                Pick a descriptive name so you remember what this key is for.
                You'll only see the full key once after creation.
              </p>

              <input
                id="dev-modal-keyname-input"
                autoFocus
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder='e.g. "Production Billing App"'
                style={{
                  width: '100%', padding: '12px 16px',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 15,
                  border: '2.5px solid #1A1A2E',
                  borderRadius: '10px 12px 10px 11px / 11px 10px 12px 10px',
                  background: '#FFFFFF', color: '#1A1A2E',
                  outline: 'none', boxSizing: 'border-box',
                  boxShadow: 'inset 1px 1px 0 rgba(26,26,46,0.06)',
                }}
              />

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <motion.button
                  id="dev-modal-generate-btn"
                  whileHover={{ y: -2, boxShadow: '5px 5px 0 #1A1A2E' }}
                  whileTap={{ y: 0, boxShadow: '2px 2px 0 #1A1A2E' }}
                  onClick={handleGenerate}
                  disabled={generating || !newKeyName.trim()}
                  style={{
                    flex: 1, padding: '13px 0',
                    background: generating || !newKeyName.trim() ? 'rgba(78,205,196,0.35)' : '#4ECDC4',
                    border: '2.5px solid #1A1A2E',
                    borderRadius: '10px 12px 10px 11px / 11px 10px 12px 10px',
                    boxShadow: '4px 4px 0 #1A1A2E',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15,
                    color: '#1A1A2E',
                    cursor: generating || !newKeyName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? '⏳ Generating...' : '⚡ Generate Key'}
                </motion.button>
                <button
                  onClick={() => { setShowModal(false); setNewKeyName('') }}
                  style={{
                    padding: '13px 20px',
                    background: 'transparent',
                    border: '2px solid rgba(26,26,46,0.25)',
                    borderRadius: 10,
                    fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15,
                    color: 'rgba(26,26,46,0.5)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
