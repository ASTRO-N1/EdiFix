import React, { useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { annotate } from 'rough-notation'

interface FeatureCard {
  icon: React.ReactNode
  title: string
  desc: string
  tag: string
  rotation: string
}

function NpiIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="32" height="24" rx="4" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="2" />
      <circle cx="14" cy="18" r="4" fill="#FF6B6B" opacity="0.6" />
      <line x1="22" y1="16" x2="32" y2="16" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="20" x2="28" y2="20" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 26 L32 30 M32 26 L28 30" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="28" r="6" stroke="#4ECDC4" strokeWidth="1.5" fill="none" opacity="0.3" />
    </svg>
  )
}

function IcdIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="22" height="28" rx="3" fill="#FFF8E8" stroke="#FF6B6B" strokeWidth="2" />
      <line x1="11" y1="12" x2="22" y2="12" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="17" x2="22" y2="17" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="22" x2="18" y2="22" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="30" cy="30" r="8" fill="#FF6B6B" opacity="0.15" stroke="#FF6B6B" strokeWidth="2" />
      <line x1="27" y1="30" x2="33" y2="30" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="27" x2="30" y2="33" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <line x1="20" y1="6" x2="20" y2="34" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="14" x2="30" y2="14" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 14 L6 24" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 14 L34 24" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="8" cy="25" rx="5" ry="3" fill="#FFE66D" stroke="#FF6B6B" strokeWidth="1.5" />
      <ellipse cx="32" cy="25" rx="5" ry="3" fill="#FFE66D" stroke="#FF6B6B" strokeWidth="1.5" />
      <line x1="12" y1="34" x2="28" y2="34" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="8" y="4" width="24" height="32" rx="3" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="2" />
      <path d="M8 36 L12 32 L16 36 L20 32 L24 36 L28 32 L32 36" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="20" y="22" textAnchor="middle" style={{ fontSize: 16, fontWeight: 700, fill: '#FF6B6B', fontFamily: 'sans-serif' }}>$</text>
      <line x1="14" y1="12" x2="26" y2="12" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="16" x2="22" y2="16" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="6" stroke="#FF6B6B" strokeWidth="2" fill="none" />
      <circle cx="26" cy="14" r="6" stroke="#FF6B6B" strokeWidth="2" fill="none" />
      <circle cx="20" cy="14" r="6" stroke="#FF6B6B" strokeWidth="2" fill="#FFE8E8" />
      <path d="M4 34 Q14 26 20 28 Q26 26 36 34" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function AiChatIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="28" height="20" rx="6" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="2" />
      <path d="M10 28 L6 34 L16 28" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 14 L32 10 L32 20 L28 18" fill="#FFE66D" stroke="#FF6B6B" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="25" cy="10" r="5" fill="#FFE66D" stroke="#FF6B6B" strokeWidth="1.5" />
      <path d="M23 10 L24.5 12 L28 8" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="11" y1="15" x2="21" y2="15" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="20" x2="18" y2="20" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const CARDS: FeatureCard[] = [
  {
    icon: <NpiIcon />,
    title: 'NPI Luhn Validation',
    desc: 'Every NPI validated against the CMS 80840 Luhn algorithm. Catches transposition errors before they hit the payer.',
    tag: 'Layer 1',
    rotation: 'rotate(-1deg)',
  },
  {
    icon: <IcdIcon />,
    title: 'ICD-10-CM Existence Check',
    desc: '97,572 FY2026 diagnosis codes loaded from CMS. Format AND existence validated. Not just regex.',
    tag: 'Layer 2',
    rotation: 'rotate(1deg)',
  },
  {
    icon: <ScaleIcon />,
    title: 'Claim Amount Reconciliation',
    desc: 'CLM02 cross-checked against the sum of every SV1 service line. Financial discrepancies caught post-parse.',
    tag: 'Cross-segment',
    rotation: 'rotate(-0.5deg)',
  },
  {
    icon: <ReceiptIcon />,
    title: '835 CLP Reconciliation',
    desc: 'Paid + patient responsibility + adjustments must equal billed. Every CAS group code validated against X12.org.',
    tag: '835',
    rotation: 'rotate(0.5deg)',
  },
  {
    icon: <GroupIcon />,
    title: '834 Duplicate Member Detection',
    desc: 'Member registry tracks every INS/REF combination. Duplicate enrollments flagged before they cause coverage gaps.',
    tag: '834',
    rotation: 'rotate(-1deg)',
  },
  {
    icon: <AiChatIcon />,
    title: 'AI-Powered Fix Assistant',
    desc: 'Every error has a plain-English explanation and a suggested fix. Powered by Gemini 1.5 Flash with your full file as context.',
    tag: 'AI',
    rotation: 'rotate(1deg)',
  },
]

function HipaaHeading() {
  const ref = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLHeadingElement>(null)
  const inView = useInView(containerRef, { once: true, margin: '-100px' })

  useEffect(() => {
    let timeoutId: number
    let annotation: any

    if (inView && ref.current) {
      const run = () => {
        if (!ref.current) return
        annotation = annotate(ref.current, {
          type: 'circle',
          color: '#FF6B6B',
          strokeWidth: 3,
          animate: true,
          animationDuration: 800,
          padding: 8,
        })
        annotation.show()
      }

      // Wait for fonts + layout to be fully ready
      document.fonts.ready.then(() => {
        timeoutId = window.setTimeout(run, 100) // small delay lets layout settle
      })

      return () => {
        window.clearTimeout(timeoutId)
        if (annotation) {
          annotation.remove()
        }
      }
    }
  }, [inView])

  return (
    <h2
      ref={containerRef}
      className="section-heading"
      style={{ marginBottom: 12 }}
    >
      Everything the{' '}
      <span ref={ref} style={{ display: 'inline-block', padding: '0 4px' }}>
        HIPAA
      </span>{' '}
      guides require.
    </h2>
  )
}

export default function Features() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        background: '#FDFAF4',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 56 }}
        >
          <HipaaHeading />
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 400,
              fontSize: 18,
              color: 'rgba(26,26,46,0.6)',
              marginTop: 8,
            }}
          >
            Built for billing teams, QA engineers, and clearinghouses.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 28,
          }}
        >
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div
                className="doodle-card"
                style={{
                  padding: '28px 24px 44px',
                  position: 'relative',
                  transform: card.rotation,
                  cursor: 'default',
                }}
              >
                <div style={{ marginBottom: 14 }}>{card.icon}</div>
                <h3
                  style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 800,
                    fontSize: 18,
                    color: '#1A1A2E',
                    marginBottom: 8,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 400,
                    fontSize: 14,
                    color: 'rgba(26,26,46,0.65)',
                    lineHeight: 1.6,
                  }}
                >
                  {card.desc}
                </p>
                <span className="corner-tag">{card.tag}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
