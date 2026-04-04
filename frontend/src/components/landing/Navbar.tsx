import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import { useIsMobile } from '../../hooks/useWindowWidth'

function LogoIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-label="EDI Inspector logo icon">
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

/** Sketchy three-bar menu icon — wobbly lines matching the doodle theme */
function SketchMenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
      {open ? (
        // X close — two slightly wobbly crossing lines
        <>
          <line x1="3" y1="3.5" x2="25" y2="19" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="3.5" x2="3" y2="19" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        // Three slightly uneven lines
        <>
          <line x1="2" y1="4"  x2="26" y2="3.5" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="3" y1="11" x2="24" y2="11.5" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="4" y1="18" x2="25" y2="17.5" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const { session } = useAppStore()
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close drawer when resizing to desktop
  useEffect(() => {
    if (!isMobile) setMenuOpen(false)
  }, [isMobile])

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const navBg = scrolled
    ? 'linear-gradient(to left, rgb(253, 250, 244), rgb(232, 220, 220))'
    : 'transparent'

  const navShadow = scrolled
    ? '0 1px 0 rgba(26, 26, 46, 0.18), 0 2px 12px rgba(26, 26, 46, 0.10)'
    : 'none'

  const navBackdrop = scrolled ? 'blur(8px) saturate(1.2)' : 'none'

  return (
    <div ref={drawerRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
      <nav
        style={{
          padding: scrolled
            ? (isMobile ? '12px 20px' : '14px 52px')
            : (isMobile ? '16px 20px' : '24px 52px'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: navBg,
          boxShadow: navShadow,
          backdropFilter: navBackdrop,
          WebkitBackdropFilter: navBackdrop,
          transition: 'background 0.45s ease, box-shadow 0.45s ease, padding 0.35s ease, backdrop-filter 0.45s ease',
          willChange: 'background, padding',
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#1A1A2E' }}
        >
          <span className="bounce-gentle" style={{ display: 'flex' }}>
            <LogoIcon />
          </span>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: isMobile ? 24 : 30, color: '#1A1A2E', letterSpacing: '-0.3px' }}>
            EdiFix
          </span>
        </a>

        {/* Desktop nav items */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              id="navbar-for-developers-btn"
              onClick={() => {
                const el = document.getElementById('for-developers')
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="btn-sticker"
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, color: '#1A1A2E', background: '#FFE66D', border: '2.5px solid #1A1A2E', cursor: 'pointer', transform: 'rotate(0.5deg)' }}
            >
              For Devs ⚡
            </button>

            <a
              href="https://github.com/ASTRO-N1/EDI-PARSER"
              target="_blank" rel="noopener noreferrer"
              className="btn-sticker"
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 18, color: '#1A1A2E', background: '#ffffff', textDecoration: 'none' }}
            >
              View on GitHub
            </a>

            {session ? (
              <button onClick={() => navigate('/workspace')} className="btn-sticker"
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 18, color: '#1A1A2E', background: '#4ECDC4', border: '2.5px solid #1A1A2E', cursor: 'pointer', transform: 'rotate(0.5deg)' }}>
                My Workspace →
              </button>
            ) : (
              <button onClick={() => navigate('/auth')} className="btn-sticker"
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 18, color: '#1A1A2E', background: '#4ECDC4', border: '2.5px solid #1A1A2E', cursor: 'pointer', transform: 'rotate(1deg)' }}>
                Join Now ✦
              </button>
            )}
          </div>
        )}

        {/* Mobile three-bar sketch icon */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', minHeight: 44, minWidth: 44, justifyContent: 'center' }}
          >
            <SketchMenuIcon open={menuOpen} />
          </button>
        )}
      </nav>

      {/* Mobile slide-down drawer */}
      <AnimatePresence>
        {isMobile && menuOpen && (
          <motion.div
            key="mobile-drawer"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{
              background: 'rgba(253,250,244,0.98)',
              borderBottom: '2.5px solid #1A1A2E',
              boxShadow: '0 6px 24px rgba(26,26,46,0.12)',
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 20px 20px',
              gap: 6,
            }}
          >
            <button
              onClick={() => { const el = document.getElementById('for-developers'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMenuOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', minHeight: 44, width: '100%', background: '#FFE66D', border: '2px solid #1A1A2E', borderRadius: 8, padding: '0 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, color: '#1A1A2E', cursor: 'pointer', transform: 'rotate(0.3deg)' }}
            >
              For Devs ⚡
            </button>

            <a
              href="https://github.com/ASTRO-N1/EDI-PARSER"
              target="_blank" rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, color: '#1A1A2E', textDecoration: 'none', borderRadius: 8, border: '2px solid rgba(26,26,46,0.15)', background: '#fff' }}
            >
              View on GitHub
            </a>

            {session ? (
              <button onClick={() => { navigate('/workspace'); setMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', minHeight: 44, width: '100%', background: '#4ECDC4', border: '2px solid #1A1A2E', borderRadius: 8, padding: '0 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, color: '#1A1A2E', cursor: 'pointer' }}>
                My Workspace →
              </button>
            ) : (
              <button onClick={() => { navigate('/auth'); setMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', minHeight: 44, width: '100%', background: '#4ECDC4', border: '2px solid #1A1A2E', borderRadius: 8, padding: '0 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, color: '#1A1A2E', cursor: 'pointer' }}>
                Join Now ✦
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
