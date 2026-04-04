import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

// ── Floppy disk icon ─────────────────────────────────────────────────────────
function FloppyDiskIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Body */}
      <rect x="4" y="4" width="32" height="32" rx="4" fill="#FDFAF4" stroke="#1A1A2E" strokeWidth="2.5" />
      {/* Label area */}
      <rect x="10" y="18" width="20" height="13" rx="2" fill="#4ECDC4" stroke="#1A1A2E" strokeWidth="2" />
      {/* Write-protect notch */}
      <rect x="22" y="4" width="10" height="10" rx="2" fill="#FFE66D" stroke="#1A1A2E" strokeWidth="2" />
      {/* Shutter slot */}
      <rect x="17" y="4" width="3" height="8" rx="1" fill="#1A1A2E" />
    </svg>
  )
}

export default function GuestUpsellCard() {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  // Bring in the session state
  const session = useAppStore((s) => s.session)

  // If the user is logged in, do not render the guest upsell card
  if (session) {
    return null
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ marginBottom: 32 }}
        >
          <div
            className="doodle-card rotate-neg-1"
            style={{
              padding: '22px 24px',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 18,
              transform: 'rotate(-1deg)',
            }}
          >
            {/* GUEST MODE sticky tag — top right */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 44,
                background: '#FFE66D',
                border: '1.5px solid #1A1A2E',
                padding: '2px 10px',
                borderRadius: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 700,
                color: '#1A1A2E',
                transform: 'rotate(1.5deg)',
              }}
            >
              GUEST MODE
            </div>

            {/* Dismiss button — top right corner */}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: 'rgba(26,26,46,0.35)',
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FF6B6B')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(26,26,46,0.35)')}
            >
              ✕
            </button>

            {/* Floppy disk icon */}
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <FloppyDiskIcon />
            </div>

            {/* Text content */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 800,
                  fontSize: 18,
                  color: '#1A1A2E',
                  marginBottom: 6,
                }}
              >
                Don't lose your work!
              </div>
              <p
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 400,
                  fontSize: 14,
                  color: 'rgba(26,26,46,0.65)',
                  lineHeight: 1.5,
                  marginBottom: 16,
                  maxWidth: 440,
                }}
              >
                Sign up for a free workspace to save your parsed EDI files, history, and custom validation rules.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="btn-sticker"
                style={{
                  padding: '9px 20px',
                  background: '#FF6B6B',
                  color: '#FDFAF4',
                  borderRadius: 8,
                  fontSize: 14,
                  transform: 'rotate(0.5deg)',
                }}
              >
                Save my progress →
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}