import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { JumpingStickFigure } from './StickFigure'
import { WaveTop } from './DoodleElements'
import { useIsMobile } from '../../hooks/useWindowWidth'

export default function CTABand() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const isMobile = useIsMobile()

  const scrollToUpload = () => {
    document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section ref={ref} style={{ position: 'relative', background: '#FF6B6B' }}>
      <WaveTop fill="#FF6B6B" />

      <div
        style={{
          padding: 'clamp(48px, 6vw, 80px) clamp(24px, 6vw, 80px)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Jumping stick figure — hide on mobile to avoid overlapping button text */}
        {!isMobile && (
          <div
            style={{ position: 'absolute', top: 20, right: 'clamp(20px, 6%, 80px)', pointerEvents: 'none' }}
          >
            <JumpingStickFigure size={80} />
          </div>
        )}

        {/* Decorative stars */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 30, left: '10%', opacity: 0.5 }} aria-hidden="true">
          <path d="M12 2 L13.5 8.5 L20 9 L15 13.5 L16.5 20 L12 16.5 L7.5 20 L9 13.5 L4 9 L10.5 8.5 Z" fill="white" />
        </svg>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', bottom: 40, left: '15%', opacity: 0.4 }} aria-hidden="true">
          <path d="M8 1 L9.2 5.5 L14 6 L10.5 9.2 L11.5 14 L8 11.5 L4.5 14 L5.5 9.2 L2 6 L6.8 5.5 Z" fill="white" />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(32px, 5vw, 52px)',
              color: '#FFFFFF',
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            Ready to fix your EDI files?
          </h2>

          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 400,
              fontSize: 18,
              color: 'rgba(255,255,255,0.85)',
              marginBottom: 36,
            }}
          >
            No account. No limits. Just upload and go.
          </p>

          <button
            onClick={scrollToUpload}
            className="btn-sticker"
            style={{
              background: '#FFFFFF',
              color: '#FF6B6B',
              fontSize: 18,
              padding: '14px 36px',
              borderRadius: 10,
              border: '2.5px solid rgba(0,0,0,0.15)',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.2)',
              fontFamily: 'Nunito, sans-serif',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Start Parsing →
          </button>
        </motion.div>
      </div>
    </section>
  )
}
