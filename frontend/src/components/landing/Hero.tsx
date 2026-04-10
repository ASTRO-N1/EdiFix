import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import UploadZone from './UploadZone'
import HeroIllustration from './HeroIllustration'
import { StarDoodle, SmallStar, DotCluster, ScribbleUnderline, SparkleIcon } from './DoodleElements'
import { useIsMobile } from '../../hooks/useWindowWidth'

// function X12Badge() {
//   return (
//     // <div
//     //   style={{
//     //     display: 'inline-flex',
//     //     alignItems: 'center',
//     //     gap: 8,
//     //     padding: '8px 16px',
//     //     background: '#FFE66D',
//     //     border: '2px solid #1A1A2E',
//     //     borderRadius: 999,
//     //     boxShadow: '3px 3px 0px #1A1A2E',
//     //     fontFamily: 'Nunito, sans-serif',
//     //     fontWeight: 800,
//     //     fontSize: 14,
//     //     color: '#1A1A2E',
//     //     transform: 'rotate(-1deg)',
//     //     marginBottom: 19,
//     //     width: 'fit-content',
//     //   }}
//     // >
//     //   🏥&nbsp; X12 837 · 835 · 834
//     // </div>
//   )
// }

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const isMobile = useIsMobile()

  return (
    <section
      ref={ref}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        paddingTop: isMobile ? 90 : 80,
        paddingBottom: 40,
        paddingLeft: 'clamp(20px, 5vw, 80px)',
        paddingRight: 'clamp(20px, 4vw, 48px)',
        position: 'relative',
        overflowX: 'hidden',
        gap: isMobile ? 32 : 0,
      }}
    >
      {/* Background decorative doodles */}
      <StarDoodle
        size={36}
        color="#FFE66D"
        style={{ position: 'absolute', top: 120, right: '12%', opacity: 0.7, animation: 'arm-wave 3s ease-in-out infinite' }}
      />
      {/* SmallStar left-5% hidden on mobile — overlaps text column */}
      {!isMobile && (
        <SmallStar
          color="#FF6B6B"
          style={{ position: 'absolute', top: 200, left: '5%', opacity: 0.5, animation: 'arm-wave 4s ease-in-out infinite 1s' }}
        />
      )}
      {!isMobile && (
        <DotCluster
          color="#4ECDC4"
          style={{ position: 'absolute', bottom: 120, left: '8%', opacity: 0.6 }}
        />
      )}
      <SmallStar
        color="#4ECDC4"
        style={{ position: 'absolute', bottom: 200, right: '5%', opacity: 0.4 }}
      />
      {!isMobile && (
        <SparkleIcon
          size={28}
          color="#FF6B6B"
          style={{ position: 'absolute', top: 300, right: '48%', opacity: 0.4 }}
        />
      )}

      {/* Left / Top: Text + Upload */}
      <div
        style={{
          flex: isMobile ? 'none' : '0 0 52%',
          maxWidth: isMobile ? '100%' : '52%',
          width: isMobile ? '100%' : undefined,
          paddingRight: isMobile ? 0 : 'clamp(16px, 2vw, 32px)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* <X12Badge /> */}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, lineHeight: 1.05, marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 'clamp(36px, 5.5vw, 64px)', color: '#1A1A2E' }}>
              Parse. Validate.
            </span>
            <span style={{ display: 'block', fontSize: 'clamp(36px, 5.5vw, 64px)', color: '#FF6B6B', position: 'relative' }}>
              Fix.
              <span style={{ display: 'block', marginTop: 2 }}>
                <ScribbleUnderline width={90} color="#FF6B6B" animated />
              </span>
            </span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 18,
            color: 'rgba(26,26,46,0.7)',
            maxWidth: 480,
            lineHeight: 1.6,
            marginBottom: isMobile ? 52 : 36,
            marginTop: 16,
          }}
        >
          The open-source EDI validator that actually explains what went wrong — and tells you how to fix it.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <UploadZone />
        </motion.div>

        {/* Secondary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 1.1 }}
          style={{ marginTop: 45 }}
        >
          <a
            href="/auth"
            className="btn-sticker"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 24px',
              background: '#1A1A2E',
              color: '#FDFAF4',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 800,
              textDecoration: 'none',
              transform: 'rotate(-0.5deg)',
              boxShadow: '5px 5px 0px #1A1A2E',
              border: '2.5px solid #1A1A2E',
              minHeight: 44,
            }}
          >
            Create Free Workspace
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <path d="M1 7h16M10 1l6 6-6 6" stroke="#FDFAF4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Connecting arrow — desktop only */}
      {!isMobile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.2, ease: 'easeOut' }}
          style={{ position: 'absolute', left: '52%', top: '45%', transform: 'translate(-50%, -50%)', zIndex: 10, pointerEvents: 'none' }}
        >
          <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 70 C16 62, 28 34, 52 22 C72 12, 92 18, 108 14" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" fill="none" style={{ filter: 'url(#smudge2)' }} />
            <path d="M96 8 L109 14 L98 22" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <defs>
              <filter id="smudge2" x="-10%" y="-20%" width="120%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>
        </motion.div>
      )}

      {/* Right / Bottom: Hero Illustration */}
      <motion.div
        initial={{ opacity: 0, x: isMobile ? 0 : 40, y: isMobile ? 20 : 0 }}
        animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        className="flex items-center justify-center"
        style={{
          flex: isMobile ? 'none' : '0 0 48%',
          maxWidth: isMobile ? '100%' : '48%',
          width: isMobile ? '100%' : undefined,
          height: isMobile ? 'clamp(260px, 55vw, 340px)' : 'clamp(380px, 45vw, 540px)',
          position: 'relative',
        }}
      >
        <HeroIllustration />
      </motion.div>
    </section>
  )
}
