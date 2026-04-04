import React from 'react'

function LogoIconSmall() {
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="22" height="28" rx="3" fill="rgba(253,250,244,0.1)" stroke="rgba(253,250,244,0.6)" strokeWidth="2" />
      <line x1="9" y1="10" x2="20" y2="10" stroke="rgba(253,250,244,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="15" x2="18" y2="15" stroke="rgba(253,250,244,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="7" fill="#4ECDC4" opacity="0.5" stroke="#4ECDC4" strokeWidth="1.5" />
      <circle cx="23" cy="23" r="4" fill="none" stroke="rgba(253,250,244,0.7)" strokeWidth="1.5" />
      <line x1="28" y1="28" x2="33" y2="33" stroke="rgba(253,250,244,0.8)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const linkStyle: React.CSSProperties = {
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 600,
  fontSize: 14,
  color: 'rgba(253,250,244,0.6)',
  textDecoration: 'none',
  transition: 'color 0.15s ease',
}

export default function Footer() {
  return (
    <footer
      style={{
        background: '#1A1A2E',
        padding: 'clamp(40px, 5vw, 60px) clamp(24px, 6vw, 80px) 0',
      }}
    >
      {/* Main footer content */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'clamp(32px, 4vw, 48px)',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        {/* Left: Logo + tagline */}
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <LogoIconSmall />
            <span
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: '#FDFAF4',
              }}
            >
              EdiFix
            </span>
          </div>
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 400,
              fontSize: 13,
              color: 'rgba(253,250,244,0.5)',
            }}
          >
            Open source X12 validator
          </p>
        </div>

        {/* Center: Links */}
        <div style={{ flex: '1 1 160px' }}>
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              fontSize: 12,
              color: 'rgba(253,250,244,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            Links
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href="https://github.com/ASTRO-N1/EDI-PARSER" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              GitHub
            </a>
            <a href="#" style={linkStyle}>Docs</a>
            <a href="/samples" style={linkStyle}>Sample Files</a>
          </div>
        </div>

        {/* Right: Built with */}
        <div style={{ flex: '1 1 220px' }}>
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              color: 'rgba(253,250,244,0.7)',
              marginBottom: 8,
            }}
          >
            Built with ♥ for healthcare interoperability
          </p>
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 400,
              fontSize: 12,
              color: 'rgba(253,250,244,0.4)',
            }}
          >
            Reference data: CMS · CDC · X12.org · NPPES
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(253,250,244,0.1)',
          padding: '16px 0',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 12,
            color: 'rgba(253,250,244,0.3)',
          }}
        >
          MIT License · Not affiliated with X12.org, CMS, or AMA
        </p>
      </div>
    </footer>
  )
}
