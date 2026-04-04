import React from 'react'
import { motion, useAnimation } from 'framer-motion'

interface StickFigureProps {
  size?: number
  color?: string
  waving?: boolean
  jumping?: boolean
  walking?: boolean
  style?: React.CSSProperties
}

// Reusable inline SVG stick figure
// All animations via CSS keyframes defined in doodle.css
export default function StickFigure({ size = 80, color = '#1A1A2E', waving = false, jumping = false, walking = false, style }: StickFigureProps) {

  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 80 110"
      fill="none"
      style={{
        display: 'block',
        ...(jumping ? { animation: 'stick-jump 0.6s ease-in-out infinite alternate' } : {}),
        ...style,
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes stick-jump {
          from { transform: translateY(0px); }
          to { transform: translateY(-12px); }
        }
        @keyframes leg-walk-left {
          0%, 100% { transform: rotate(-20deg); transform-origin: 40px 75px; }
          50% { transform: rotate(20deg); transform-origin: 40px 75px; }
        }
        @keyframes leg-walk-right {
          0%, 100% { transform: rotate(20deg); transform-origin: 40px 75px; }
          50% { transform: rotate(-20deg); transform-origin: 40px 75px; }
        }
        @keyframes wave-arm {
          0%, 100% { transform: rotate(-20deg); transform-origin: 40px 45px; }
          50% { transform: rotate(25deg); transform-origin: 40px 45px; }
        }
        @keyframes arm-rest {
          0%, 100% { transform: rotate(0deg); transform-origin: 40px 45px; }
        }
      `}</style>

      {/* Head */}
      <circle cx="40" cy="18" r="12" stroke={color} strokeWidth="2.5" fill="none" />

      {/* Eyes */}
      <circle cx="36" cy="16" r="1.5" fill={color} />
      <circle cx="44" cy="16" r="1.5" fill={color} />

      {/* Smile */}
      <path d="M36 22 Q40 26 44 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Body */}
      <line x1="40" y1="30" x2="40" y2="72" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Left arm */}
      <line
        x1="40" y1="45" x2="18" y2="62"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={walking ? { animation: 'arm-rest 0.5s infinite' } : {}}
      />

      {/* Right arm — waves if waving=true */}
      <line
        x1="40" y1="45" x2="62" y2="56"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={waving ? {
          transformOrigin: '40px 45px',
          animation: 'wave-arm 0.5s ease-in-out infinite',
        } : {}}
      />

      {/* Left leg */}
      <line
        x1="40" y1="72" x2="22" y2="98"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={walking ? {
          transformOrigin: '40px 72px',
          animation: 'leg-walk-left 0.5s ease-in-out infinite',
        } : {}}
      />

      {/* Right leg */}
      <line
        x1="40" y1="72" x2="58" y2="98"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={walking ? {
          transformOrigin: '40px 72px',
          animation: 'leg-walk-right 0.5s ease-in-out infinite',
        } : {}}
      />
    </svg>
  )
}

// Stick figure sitting on edge with dangling legs
export function SittingStickFigure({ color = '#1A1A2E', size = 70 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 70 64" fill="none" aria-hidden="true">
      <style>{`
        @keyframes dangle-legs {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes wave-sitting {
          0%, 100% { transform: rotate(-25deg); transform-origin: 38px 28px; }
          50% { transform: rotate(15deg); transform-origin: 38px 28px; }
        }
      `}</style>

      {/* Head */}
      <circle cx="38" cy="10" r="9" stroke={color} strokeWidth="2" fill="none" />

      {/* Eyes */}
      <circle cx="35" cy="9" r="1.2" fill={color} />
      <circle cx="41" cy="9" r="1.2" fill={color} />

      {/* Smile */}
      <path d="M34 13 Q38 16 42 13" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Body */}
      <line x1="38" y1="19" x2="38" y2="44" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Left arm out */}
      <line x1="38" y1="28" x2="18" y2="36" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Right arm waving */}
      <line
        x1="38" y1="28" x2="56" y2="18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transformOrigin: '38px 28px', animation: 'wave-sitting 0.6s ease-in-out infinite' }}
      />

      {/* Torso / sitting */}
      <line x1="20" y1="44" x2="56" y2="44" stroke={color} strokeWidth="2" strokeLinecap="round" />

      {/* Left leg dangling */}
      <line
        x1="28" y1="44" x2="20" y2="64"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transformOrigin: '28px 44px', animation: 'dangle-legs 1s ease-in-out infinite' }}
      />

      {/* Right leg dangling (offset) */}
      <line
        x1="40" y1="44" x2="34" y2="64"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transformOrigin: '40px 44px', animation: 'dangle-legs 1s ease-in-out infinite 0.3s' }}
      />

    </svg>
  )
}

// White jumping stick figure for CTA band
export function JumpingStickFigure({ size = 90 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 80 104"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'stick-jump-cta 0.7s ease-in-out infinite alternate' }}
    >
      <style>{`
        @keyframes stick-jump-cta {
          from { transform: translateY(0px) rotate(-3deg); }
          to { transform: translateY(-16px) rotate(3deg); }
        }
      `}</style>

      {/* Head */}
      <circle cx="40" cy="14" r="12" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="36" cy="12" r="1.5" fill="white" />
      <circle cx="44" cy="12" r="1.5" fill="white" />
      <path d="M35 18 Q40 23 45 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Body */}
      <line x1="40" y1="26" x2="40" y2="66" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

      {/* Arms up (celebrating) */}
      <line x1="40" y1="40" x2="16" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="40" x2="64" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

      {/* Legs splayed */}
      <line x1="40" y1="66" x2="18" y2="92" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="66" x2="62" y2="92" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * WaitingFigure — a standing stick figure (eyes only, no mouth) with:
 *  • Idle: gentle body sway loop (framer-motion animate repeat)
 *  • Click: spring scale-bounce layered on a wrapper element, non-destructive
 * Color matches the doodle theme palette. Used on the ProcessingPage.
 */
export function WaitingFigure({
  size = 90,
  color = '#4ECDC4',
}: {
  size?: number
  color?: string
}) {
  const clickCtrl = useAnimation()

  const handleClick = async () => {
    // Quick reactive spring-pop — composed on the outer wrapper, doesn't touch idle sway
    await clickCtrl.start({
      scale: [1, 1.18, 0.93, 1.06, 1],
      rotate: [0, -6, 5, -3, 0],
      transition: { duration: 0.45, ease: 'easeInOut' },
    })
  }

  return (
    // Outer wrapper: absorbs the click bounce
    <motion.div
      animate={clickCtrl}
      onClick={handleClick}
      style={{ display: 'inline-block', cursor: 'pointer', transformOrigin: 'bottom center' }}
    >
      {/* Inner wrapper: idle sway — completely independent */}
      <motion.div
        animate={{
          rotate: [0, 3, 0, -3, 0],
          y: [0, -3, 0, -2, 0],
        }}
        transition={{
          duration: 3.2,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'loop',
        }}
        style={{ transformOrigin: 'bottom center', display: 'block' }}
      >
        <svg
          width={size}
          height={size * 1.35}
          viewBox="0 0 80 108"
          fill="none"
          aria-hidden="true"
        >
          {/* Head — slightly tilted, waiting feel */}
          <circle cx="40" cy="16" r="12" stroke={color} strokeWidth="2.5" fill="none" />

          {/* Eyes only — no mouth */}
          <circle cx="36" cy="14" r="2" fill={color} />
          <circle cx="44" cy="14" r="2" fill={color} />

          {/* Eyelid lines for "bored waiting" expression */}
          <line x1="34" y1="12.5" x2="38" y2="12.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="42" y1="12.5" x2="46" y2="12.5" stroke={color} strokeWidth="1" strokeLinecap="round" />

          {/* Body */}
          <line x1="40" y1="28" x2="40" y2="68" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

          {/* Left arm — hanging relaxed */}
          <line x1="40" y1="42" x2="20" y2="58" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

          {/* Right arm — bent at elbow, hand near chin (leaning/bored wait) */}
          <line x1="40" y1="42" x2="58" y2="38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="58" y1="38" x2="56" y2="25" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Small circle "chin rest" hand dot */}
          <circle cx="56" cy="24" r="2.5" fill={color} />

          {/* Left leg */}
          <line x1="40" y1="68" x2="24" y2="96" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

          {/* Right leg */}
          <line x1="40" y1="68" x2="56" y2="96" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

          {/* Feet */}
          <line x1="24" y1="96" x2="16" y2="98" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="56" y1="96" x2="64" y2="98" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.div>
    </motion.div>
  )
}
