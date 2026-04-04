import { useRef, Fragment } from 'react'
import { motion, useInView } from 'framer-motion'
import { useIsMobile } from '../../hooks/useWindowWidth'

function UploadIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="8" y="18" width="40" height="28" rx="6" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="2.5" />
      <path d="M28 12 L28 32 M20 19 L28 11 L36 19" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="38" x2="40" y2="38" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="43" x2="36" y2="43" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function MagnifyIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="28" height="34" rx="4" fill="#E8F8FF" stroke="#4ECDC4" strokeWidth="2.5" />
      <line x1="12" y1="15" x2="28" y2="15" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="21" x2="24" y2="21" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="27" x2="26" y2="27" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="38" r="12" fill="#4ECDC4" opacity="0.2" stroke="#4ECDC4" strokeWidth="2.5" />
      <circle cx="36" cy="36" r="7" fill="none" stroke="#4ECDC4" strokeWidth="2" />
      <line x1="41" y1="41" x2="47" y2="47" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      {/* Wrench head */}
      <circle cx="40" cy="14" r="9" fill="#FFE8E8" stroke="#FF6B6B" strokeWidth="2" />
      <circle cx="40" cy="14" r="4" fill="#FF6B6B" opacity="0.4" />
      {/* Wrench handle */}
      <path d="M33 21 L16 38" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round" />
      <path d="M33 21 L16 38" stroke="#FFE8E8" strokeWidth="2" strokeLinecap="round" />
      {/* Download arrow */}
      <line x1="14" y1="46" x2="34" y2="46" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 40 L24 46 L28 40" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="24" y1="32" x2="24" y2="46" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Three static pointing stick figures, one per step ───

// Figure 1 — coral, leans slightly right, right arm points down at step 1
function Figure1() {
  return (
    <svg width={52} height={72} viewBox="0 0 52 72" fill="none" aria-hidden="true">
      {/* Head */}
      <circle cx="26" cy="10" r="9" stroke="#FF6B6B" strokeWidth="2" fill="none" />
      <circle cx="22.5" cy="9" r="1.2" fill="#FF6B6B" />
      <circle cx="29.5" cy="9" r="1.2" fill="#FF6B6B" />
      <path d="M23 13 Q26 16 29 13" stroke="#FF6B6B" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Body — tilted slightly right */}
      <line x1="24" y1="19" x2="28" y2="48" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      {/* Left arm — relaxed, hangs left */}
      <line x1="24" y1="28" x2="9" y2="36" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      {/* Right arm — pointing down-right at the card */}
      <line x1="27" y1="27" x2="44" y2="44" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="44" r="2" fill="#FF6B6B" />
      {/* Legs */}
      <line x1="28" y1="48" x2="16" y2="68" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="48" x2="40" y2="68" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Figure 2 — teal, leans slightly left, left arm points down at step 2, right arm raised
function Figure2() {
  return (
    <svg width={52} height={72} viewBox="0 0 52 72" fill="none" aria-hidden="true">
      {/* Head */}
      <circle cx="26" cy="10" r="9" stroke="#4ECDC4" strokeWidth="2" fill="none" />
      <circle cx="22.5" cy="9" r="1.2" fill="#4ECDC4" />
      <circle cx="29.5" cy="9" r="1.2" fill="#4ECDC4" />
      <path d="M23 13 Q26 17 29 13" stroke="#4ECDC4" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Body — tilted slightly left */}
      <line x1="28" y1="19" x2="24" y2="48" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      {/* Left arm — points DOWN-LEFT at the card (static) */}
      <line x1="24" y1="27" x2="8" y2="44" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="44" r="2" fill="#4ECDC4" />
      {/* Right arm — raised up, excited (static) */}
      <line x1="28" y1="26" x2="44" y2="13" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      {/* Legs */}
      <line x1="24" y1="48" x2="13" y2="68" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="48" x2="36" y2="66" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Figure 3 — gold, leans forward, ONE arm pointing upward-left
function Figure3() {
  return (
    <svg width={52} height={72} viewBox="0 0 52 72" fill="none" aria-hidden="true">
      {/* Head */}
      <circle cx="26" cy="10" r="9" stroke="#B8A000" strokeWidth="2" fill="none" />
      <circle cx="22.5" cy="9" r="1.2" fill="#B8A000" />
      <circle cx="29.5" cy="9" r="1.2" fill="#B8A000" />
      <path d="M23 13 Q26 17 29 13" stroke="#B8A000" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Body — leaning forward */}
      <line x1="24" y1="19" x2="29" y2="48" stroke="#B8A000" strokeWidth="2" strokeLinecap="round" />
      {/* Left arm — relaxed, hangs down */}
      <line x1="21" y1="27" x2="10" y2="42" stroke="#B8A000" strokeWidth="2" strokeLinecap="round" />
      {/* Right arm — pointing upward-left (the only pointing arm) */}
      <line x1="28" y1="26" x2="10" y2="10" stroke="#B8A000" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="2" fill="#B8A000" />
      {/* Legs */}
      <line x1="29" y1="48" x2="15" y2="66" stroke="#B8A000" strokeWidth="2" strokeLinecap="round" />
      <line x1="29" y1="48" x2="42" y2="66" stroke="#B8A000" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function AnimatedArrow({ delay = 0 }: { delay?: number }) {
  const ref = useRef<SVGPathElement>(null)
  const inView = useInView({ current: ref.current?.ownerSVGElement ?? null }, { once: true, margin: '-80px' })

  return (
    <svg
      width="100"
      height="60"
      viewBox="0 0 100 60"
      fill="none"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        display: 'block',
        marginTop: 55,
        opacity: 0.7,
      }}
    >
      <style>{`
        @keyframes draw-arrow-${delay} {
          from { stroke-dashoffset: 160; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <path
        ref={ref}
        d="M8 30 C20 10, 60 10, 80 30"
        stroke="#1A1A2E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="160"
        strokeDashoffset={inView ? 0 : 160}
        fill="none"
        style={{
          transition: `stroke-dashoffset 0.8s ease ${delay}s`,
        }}
      />
      <path
        d="M74 22 L80 30 L71 32"
        stroke="#1A1A2E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          opacity: inView ? 1 : 0,
          transition: `opacity 0.3s ease ${delay + 0.6}s`,
        }}
      />
    </svg>
  )
}



const STEPS = [
  {
    number: '01',
    icon: <UploadIcon />,
    title: 'Upload your file',
    desc: 'Drop any .edi, .txt, .dat, .x12, or .zip file. Transaction type auto-detected from the ISA envelope.',
  },
  {
    number: '02',
    icon: <MagnifyIcon />,
    title: 'Instant validation',
    desc: 'Full loop hierarchy parsed. Every segment decoded. NPI, ICD-10, CARC, RARC, ZIP, dates — all validated in under a second.',
  },
  {
    number: '03',
    icon: <WrenchIcon />,
    title: 'Fix and export',
    desc: 'Accept suggested fixes, ask the AI anything, download the corrected EDI, error report PDF, or parsed JSON.',
  },
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const isMobile = useIsMobile()

  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        background: '#F5F0E8',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 64 }}
      >
        <h2 className="section-heading" style={{ marginBottom: 8 }}>
          How it works.
        </h2>
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 18,
            color: 'rgba(26,26,46,0.6)',
          }}
        >
          Three steps. No account needed.
        </p>
      </motion.div>

      {/* Steps area — position:relative so figures can be absolute here */}
      <div style={{ position: 'relative', maxWidth: 1000, margin: '0 auto' }}>

        {/* Stick figures — desktop only (absolute-positioned, overlap stacked cards on mobile) */}
        {!isMobile && (
          <>
            {/* ── Figure 1 (coral) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              style={{ position: 'absolute', left: -22, top: 110, transform: 'rotate(-8deg)', pointerEvents: 'none', zIndex: 2 }}
            >
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}>
                <Figure1 />
              </motion.div>
            </motion.div>

            {/* ── Figure 2 (teal) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 }}
              style={{ position: 'absolute', left: 'calc(50% + 80px)', top: 90, transform: 'rotate(6deg)', pointerEvents: 'none', zIndex: 2 }}
            >
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, delay: 0.4 }}>
                <Figure2 />
              </motion.div>
            </motion.div>

            {/* ── Figure 3 (gold) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.7 }}
              style={{ position: 'absolute', right: -28, top: 240, transform: 'rotate(-5deg)', pointerEvents: 'none', zIndex: 2 }}
            >
              <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, delay: 0.8 }}>
                <Figure3 />
              </motion.div>
            </motion.div>
          </>
        )}

        {/* Steps flex row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {STEPS.map((step, i) => (
            <Fragment key={step.number}>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.2 + 0.3 }}
                style={{
                  flex: '0 0 auto',               // stop flex from squeezing the cards
                  maxWidth: isMobile ? '100%' : 300,
                  width: isMobile ? '100%' : 300,
                  position: 'relative',
                  textAlign: 'center',
                  padding: isMobile ? '0 24px' : '0 16px',
                  margin: isMobile ? '0 0 48px 0' : '0 40px'
                }}
              >
                {/* Big background number */}
                <div
                  className="step-number"
                  style={{
                    position: 'relative',
                    color: '#FF6B6B',
                    opacity: 0.08,
                    fontSize: isMobile ? 80 : 120,
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 900,
                    lineHeight: 1,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    marginBottom: isMobile ? 12 : -30,
                  }}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  {step.icon}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 800,
                    fontSize: 20,
                    color: '#1A1A2E',
                    marginBottom: 10,
                  }}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 400,
                    fontSize: 14,
                    color: 'rgba(26,26,46,0.65)',
                    lineHeight: 1.6,
                  }}
                >
                  {step.desc}
                </p>
              </motion.div>

              {/* Curved arrow between steps — desktop only */}
              {i < STEPS.length - 1 && !isMobile && (
                <AnimatedArrow delay={i * 0.4 + 0.5} />
              )}
              {/* Vertical dot divider on mobile between stacked steps */}
              {i < STEPS.length - 1 && isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                  <svg width="8" height="32" viewBox="0 0 8 32" fill="none" aria-hidden="true">
                    <circle cx="4" cy="6" r="2.5" fill="#4ECDC4" opacity="0.5" />
                    <circle cx="4" cy="16" r="2.5" fill="#4ECDC4" opacity="0.35" />
                    <circle cx="4" cy="26" r="2.5" fill="#4ECDC4" opacity="0.2" />
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
