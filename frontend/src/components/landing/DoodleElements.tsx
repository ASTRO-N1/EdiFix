import React from 'react'

// Decorative doodle elements: stars, squiggles, arrows, dots
// All drawn with inline SVG — no image files or icon libraries

export function StarDoodle({ size = 24, color = '#FFE66D', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path
        d="M12 2 L13.5 8.5 L20 9 L15 13.5 L16.5 20 L12 16.5 L7.5 20 L9 13.5 L4 9 L10.5 8.5 Z"
        fill={color}
        stroke="#1A1A2E"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SmallStar({ color = '#FFE66D', style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={style} aria-hidden="true">
      <path
        d="M8 1 L9.2 5.5 L14 6 L10.5 9.2 L11.5 14 L8 11.5 L4.5 14 L5.5 9.2 L2 6 L6.8 5.5 Z"
        fill={color}
        stroke="#1A1A2E"
        strokeWidth="1"
      />
    </svg>
  )
}

export function CrossDoodle({ size = 20, color = '#FF6B6B', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style} aria-hidden="true">
      <path d="M4 4 L16 16 M16 4 L4 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function SquiggleLine({ width = 80, color = '#4ECDC4', style }: { width?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="16" viewBox={`0 0 ${width} 16`} fill="none" style={style} aria-hidden="true">
      <path
        d={`M0 8 C${width * 0.1} 2, ${width * 0.2} 14, ${width * 0.3} 8 C${width * 0.4} 2, ${width * 0.5} 14, ${width * 0.6} 8 C${width * 0.7} 2, ${width * 0.8} 14, ${width * 0.9} 8 C${width * 0.95} 5, ${width} 6, ${width} 8`}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function CurvedArrow({ color = '#1A1A2E', direction = 'right', style }: { color?: string; direction?: 'right' | 'left'; style?: React.CSSProperties }) {
  const flipped = direction === 'left' ? { transform: 'scaleX(-1)' } : {}
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" fill="none" style={{ ...flipped, ...style }} aria-hidden="true">
      <path
        d="M5 25 C15 10, 50 10, 65 25"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 3"
        fill="none"
      />
      <path d="M60 18 L65 25 L58 28" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function DotCluster({ color = '#4ECDC4', style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={style} aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill={color} opacity="0.7" />
      <circle cx="20" cy="5" r="2" fill={color} opacity="0.5" />
      <circle cx="32" cy="10" r="3.5" fill={color} opacity="0.8" />
      <circle cx="5" cy="22" r="2.5" fill={color} opacity="0.6" />
      <circle cx="35" cy="28" r="2" fill={color} opacity="0.5" />
      <circle cx="18" cy="34" r="3" fill={color} opacity="0.7" />
    </svg>
  )
}

export function SparkleIcon({ size = 20, color = '#FF6B6B', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style} aria-hidden="true">
      <path d="M10 2 L11 8 L17 9 L11 10 L10 16 L9 10 L3 9 L9 8 Z" fill={color} />
      <path d="M16 2 L16.5 4.5 L19 5 L16.5 5.5 L16 8 L15.5 5.5 L13 5 L15.5 4.5 Z" fill={color} opacity="0.6" />
    </svg>
  )
}

export function ScribbleUnderline({ width = 120, color = '#FF6B6B', animated = false, style }: { width?: number; color?: string; animated?: boolean; style?: React.CSSProperties }) {
  const pathLength = width * 1.2
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} fill="none" style={style}>
      <path
        d={`M2 8 C${width * 0.15} 3, ${width * 0.3} 12, ${width * 0.5} 7 C${width * 0.65} 3, ${width * 0.8} 11, ${width - 2} 7`}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        style={animated ? {
          strokeDasharray: pathLength,
          strokeDashoffset: 0,
          animation: 'draw-underline 0.8s ease forwards',
        } : {}}
      />
    </svg>
  )
}

export function WaveTop({ fill = '#1A1A2E' }: { fill?: string }) {
  return (
    <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      <path
        d="M0 0 C120 30, 240 0, 360 20 C480 40, 600 5, 720 25 C840 45, 960 10, 1080 28 C1200 46, 1320 8, 1440 20 L1440 48 L0 48 Z"
        fill={fill}
      />
    </svg>
  )
}

export function WaveBottom({ fill = '#1A1A2E' }: { fill?: string }) {
  return (
    <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
      <path
        d="M0 48 C120 20, 240 45, 360 28 C480 10, 600 40, 720 18 C840 2, 960 38, 1080 15 C1200 2, 1320 36, 1440 22 L1440 0 L0 0 Z"
        fill={fill}
      />
    </svg>
  )
}
