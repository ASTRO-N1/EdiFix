import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// ─── Key icon ────────────────────────────────────────────────────
function KeyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="18" cy="20" r="10" fill="#FFE66D" stroke="#1A1A2E" strokeWidth="2.5" />
      <circle cx="18" cy="20" r="5" fill="none" stroke="#1A1A2E" strokeWidth="2" />
      <line x1="27" y1="27" x2="44" y2="44" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <line x1="37" y1="37" x2="37" y2="43" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="41" x2="41" y2="44" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 4 L40 12 L40 26 C40 34 24 44 24 44 C24 44 8 34 8 26 L8 12 Z" fill="#4ECDC4" fillOpacity="0.2" stroke="#1A1A2E" strokeWidth="2.5" />
      <path d="M16 24 L21 29 L32 18" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <polygon points="26,4 12,26 22,26 20,44 36,22 26,22" fill="#FF6B6B" fillOpacity="0.2" stroke="#FF6B6B" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Tiny stick figure for decoration ────────────────────────────
function DevFigure() {
  return (
    <svg width="50" height="70" viewBox="0 0 50 70" fill="none" aria-hidden="true">
      <circle cx="25" cy="10" r="8" stroke="#4ECDC4" strokeWidth="2" fill="none" />
      <circle cx="22" cy="9" r="1.2" fill="#4ECDC4" />
      <circle cx="28" cy="9" r="1.2" fill="#4ECDC4" />
      <path d="M22 13 Q25 16 28 13" stroke="#4ECDC4" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Body */}
      <line x1="25" y1="18" x2="25" y2="46" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      {/* Left arm — down */}
      <line x1="25" y1="26" x2="10" y2="38" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      {/* Right arm — up, pointing at terminal */}
      <line x1="25" y1="26" x2="42" y2="14" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="42" cy="14" r="2" fill="#4ECDC4" />
      {/* Legs */}
      <line x1="25" y1="46" x2="14" y2="64" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <line x1="25" y1="46" x2="36" y2="64" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const CURL_SNIPPET = `curl -X POST https://api.edifix.app/v1/parse \\
  -H "X-API-Key: sk_live_••••8f9a" \\
  -H "Content-Type: application/octet-stream" \\
  --data-binary @claim.edi`

const PYTHON_SNIPPET = `import requests

with open("claim.edi", "rb") as f:
    resp = requests.post(
        "https://api.edifix.app/v1/parse",
        headers={"X-API-Key": "sk_live_••••8f9a"},
        data=f,
    )
print(resp.json())`

const FEATURES = [
  {
    icon: <KeyIcon />,
    title: 'Long-lived API Keys',
    desc: 'Generate named API keys for each integration. Keys are hashed server-side — only you see the secret.',
    rotate: '-1deg',
  },
  {
    icon: <ShieldIcon />,
    title: 'Zero-config Auth',
    desc: 'Pass your key in the X-API-Key header. Invalid or revoked keys return 401 — no surprises.',
    rotate: '0.5deg',
  },
  {
    icon: <BoltIcon />,
    title: 'Sub-second Parsing',
    desc: 'Every EDI segment decoded and validated in under a second. JSON, error report, or corrected EDI back in one call.',
    rotate: '-0.5deg',
  },
]

export default function ForDevelopers() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  const [tab, setTab] = useState<'curl' | 'python'>('curl')
  const [copied, setCopied] = useState(false)

  const snippet = tab === 'curl' ? CURL_SNIPPET : PYTHON_SNIPPET

  function handleCopy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section
      id="for-developers"
      ref={ref}
      style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        background: '#FDFAF4',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faint grid doodle background */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.035, pointerEvents: 'none' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="dev-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1A2E" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dev-grid)" />
      </svg>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 64, position: 'relative' }}
      >
        {/* Yellow sticky badge */}
        <span
          style={{
            display: 'inline-block',
            background: '#FFE66D',
            border: '2px solid #1A1A2E',
            borderRadius: 6,
            padding: '3px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: 12,
            color: '#1A1A2E',
            marginBottom: 16,
            transform: 'rotate(-1deg)',
            boxShadow: '3px 3px 0 #1A1A2E',
          }}
        >
          FOR DEVELOPERS
        </span>

        <h2 className="section-heading" style={{ marginBottom: 10 }}>
          Integrate in minutes.
        </h2>
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 18,
            color: 'rgba(26,26,46,0.6)',
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          EdiFix is a headless microservice. Plug it into your billing pipeline with a single HTTP call.
        </p>
      </motion.div>

      {/* Two-column layout */}
      <div
        style={{
          maxWidth: 1060,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 40,
          alignItems: 'start',
          position: 'relative',
        }}
      >

        {/* ── Left: feature cards ─────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -30 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 + 0.2 }}
            >
              <div
                className="doodle-card"
                style={{
                  padding: '22px 24px',
                  display: 'flex',
                  gap: 20,
                  alignItems: 'flex-start',
                  transform: `rotate(${f.rotate})`,
                  background: '#FFFFFF',
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>{f.icon}</div>
                <div>
                  <h3
                    style={{
                      fontFamily: 'Nunito, sans-serif',
                      fontWeight: 800,
                      fontSize: 17,
                      color: '#1A1A2E',
                      marginBottom: 6,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'Nunito, sans-serif',
                      fontWeight: 400,
                      fontSize: 14,
                      color: 'rgba(26,26,46,0.65)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.7 }}
            style={{ marginTop: 8 }}
          >
            <button
              id="dev-get-api-key-btn"
              onClick={() => navigate('/auth')}
              className="btn-sticker"
              style={{
                padding: '12px 28px',
                borderRadius: 10,
                fontSize: 15,
                color: '#1A1A2E',
                background: '#4ECDC4',
                border: '2.5px solid #1A1A2E',
                cursor: 'pointer',
                transform: 'rotate(-0.5deg)',
              }}
            >
              Get your free API key →
            </button>
          </motion.div>
        </div>

        {/* ── Right: dark terminal card ────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.25 }}
          style={{ position: 'relative' }}
        >
          {/* Stick figure decoration */}
          <div
            style={{
              position: 'absolute',
              top: -52,
              right: 24,
              transform: 'rotate(8deg)',
              pointerEvents: 'none',
            }}
          >
            <DevFigure />
          </div>

          <div
            style={{
              background: '#1A1A2E',
              border: '2.5px solid #1A1A2E',
              borderRadius: 14,
              boxShadow: '6px 6px 0 #4ECDC4',
              overflow: 'hidden',
            }}
          >
            {/* Terminal bar */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '2px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF6B6B', display: 'block' }} />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFE66D', display: 'block' }} />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ECDC4', display: 'block' }} />
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: 'rgba(253,250,244,0.4)',
                  marginLeft: 8,
                }}
              >
                Send your first request
              </span>
            </div>

            {/* Tab toggle + copy button */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                padding: '14px 20px 0',
                borderBottom: '1.5px solid rgba(255,255,255,0.08)',
                alignItems: 'center',
              }}
            >
              {(['curl', 'python'] as const).map((t) => (
                <button
                  key={t}
                  id={`dev-tab-${t}`}
                  onClick={() => setTab(t)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: tab === t ? '2.5px solid #FFE66D' : '2.5px solid transparent',
                    color: tab === t ? '#FFE66D' : 'rgba(253,250,244,0.45)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: tab === t ? 700 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '0 12px 10px',
                    marginBottom: -1.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t === 'curl' ? 'cURL' : 'Python'}
                </button>
              ))}

              {/* Copy button — sits in the tab bar, no overlap */}
              <button
                id="dev-copy-snippet-btn"
                onClick={handleCopy}
                className="btn-sticker"
                style={{
                  marginLeft: 'auto',
                  marginBottom: 8,
                  padding: '4px 12px',
                  borderRadius: 7,
                  fontSize: 12,
                  color: copied ? '#4ECDC4' : '#1A1A2E',
                  background: copied ? '#1A1A2E' : '#FFE66D',
                  border: '2px solid #FFE66D',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 #FFE66D',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            {/* Code block */}
            <div style={{ position: 'relative', padding: '20px 20px' }}>
              <pre
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: '#FDFAF4',
                  lineHeight: 1.8,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {snippet.split('\n').map((line, li) => {
                  // Highlight the API key portion
                  if (line.includes('X-API-Key')) {
                    const parts = line.split(/(sk_live_••••8f9a)/)
                    return (
                      <span key={li}>
                        {parts.map((p, pi) =>
                          p === 'sk_live_••••8f9a' ? (
                            <span key={pi} style={{ color: '#FFE66D', fontWeight: 700 }}>{p}</span>
                          ) : (
                            <span key={pi} style={{ color: '#4ECDC4' }}>{p}</span>
                          )
                        )}
                        {'\n'}
                      </span>
                    )
                  }
                  if (line.includes('https://')) {
                    return (
                      <span key={li}>
                        <span style={{ color: 'rgba(253,250,244,0.5)' }}>{line.split('https://')[0]}</span>
                        <span style={{ color: '#FF6B6B' }}>https://{line.split('https://')[1]}</span>
                        {'\n'}
                      </span>
                    )
                  }
                  if (line.startsWith('import') || line.startsWith('with') || line.startsWith('print')) {
                    return <span key={li} style={{ color: '#4ECDC4' }}>{line}{'\n'}</span>
                  }
                  return <span key={li}>{line}{'\n'}</span>
                })}
              </pre>
            </div>

            {/* Footer hint */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1.5px solid rgba(255,255,255,0.08)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'rgba(253,250,244,0.3)',
              }}
            >
              POST /v1/parse · returns JSON · 401 on bad key
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
