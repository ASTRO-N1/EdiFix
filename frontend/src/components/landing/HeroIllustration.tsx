import { motion } from 'framer-motion'

// ─── A fully animated SVG illustration for the Hero right column ───
// Tells the story: EDI file → scanner → errors detected → fixed ✓
// Pure SVG + Framer Motion, no image files, no Three.js

// Slightly wobbly rect path (hand-drawn feel — corners overshoot)
function SketchyRect({
  x, y, w, h, fill = 'white', stroke = '#1A1A2E', strokeWidth = 2.5,
}: {
  x: number; y: number; w: number; h: number
  fill?: string; stroke?: string; strokeWidth?: number
}) {
  // Each corner slightly overshoots to look hand-drawn
  const x2 = x + w
  const y2 = y + h
  const o = 3 // overshoot amount
  const d = [
    `M${x - o} ${y + o}`,
    `L${x + o} ${y - o}`,
    `L${x2 - o} ${y - o}`,
    `L${x2 + o} ${y + o}`,
    `L${x2 + o} ${y2 - o}`,
    `L${x2 - o} ${y2 + o}`,
    `L${x + o} ${y2 + o}`,
    `L${x - o} ${y2 - o}`,
    'Z',
  ].join(' ')
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
}

// A single error/warning badge with connector line
function Badge({
  x, y, type, title, subtitle, delay,
}: {
  x: number; y: number
  type: 'error' | 'warning'
  title: string; subtitle: string; delay: number
}) {
  const accent = type === 'error' ? '#FF6B6B' : '#E6C619'
  const bh = 44
  const bw = 140
  const connectorY = y + bh / 2

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 15 }}
    >
      {/* Connector line from badge left → document right edge */}
      <path
        d={`M${x} ${connectorY} Q${x - 20} ${connectorY} ${260} ${connectorY}`}
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.6"
      />
      <circle cx={260} cy={connectorY} r="3" fill={accent} opacity="0.8" />

      {/* Badge background */}
      <rect x={x} y={y} width={bw} height={bh} rx={6} fill="white" stroke={accent} strokeWidth={1.8} />

      {/* Accent circle indicator */}
      <circle cx={x + 14} cy={y + 14} r={5} fill={accent} opacity={0.9} />

      {/* Idle sway animation wrapper (applied post-appearance via separate motion) */}
      <text
        x={x + 26}
        y={y + 18}
        style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, fill: '#1A1A2E' }}
      >
        {title}
      </text>
      <text
        x={x + 14}
        y={y + 34}
        style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: 9, fill: 'rgba(26,26,46,0.55)' }}
      >
        {subtitle}
      </text>
    </motion.g>
  )
}

// A checkmark circle that draws itself
function Checkmark({ cx, cy, delay }: { cx: number; cy: number; delay: number }) {
  const checkPath = `M${cx - 7} ${cy} L${cx - 2} ${cy + 5} L${cx + 7} ${cy - 5}`

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 350, damping: 18 }}
    >
      <circle cx={cx} cy={cy} r={12} fill="#95E1D3" stroke="#4ECDC4" strokeWidth={2} />
      <motion.path
        d={checkPath}
        stroke="#1A1A2E"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: delay + 0.05, duration: 0.4, ease: 'easeOut' }}
      />
    </motion.g>
  )
}

// The EDI document lines inside the rect
function DocumentLines({ docX, docY }: { docX: number; docY: number }) {
  const widths = [180, 115, 165, 130, 180, 98, 150, 118, 175, 105, 160, 125]
  return (
    <>
      {widths.map((w, i) => (
        <line
          key={i}
          x1={docX + 20}
          y1={docY + 20 + i * 20}
          x2={docX + 20 + w}
          y2={docY + 20 + i * 20}
          stroke="#1A1A2E"
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.13}
        />
      ))}
    </>
  )
}

// EDI segment labels
function SegmentLabels({ docX, docY }: { docX: number; docY: number }) {
  const segments = [
    { y: docY + 38, text: 'ISA*00*          *00*' },
    { y: docY + 74, text: 'NM1*85*2*ACME...' },
    { y: docY + 128, text: 'CLM*CLM001*1500...' },
    { y: docY + 182, text: 'SV1*HC:99213*150...' },
  ]
  return (
    <>
      {segments.map((s, i) => (
        <text
          key={i}
          x={docX + 18}
          y={s.y}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fill: '#1A1A2E',
            opacity: 0.6,
          }}
        >
          {s.text}
        </text>
      ))}
    </>
  )
}

export default function HeroIllustration() {
  const DOC_X = 40
  const DOC_Y = 60
  const DOC_W = 220
  const DOC_H = 280
  const BADGE_X = 290

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg
        viewBox="0 0 425 390"
        width="100%"
        style={{ maxHeight: 480, display: 'block' }}
        aria-label="EDI file parsing illustration"
      >
        {/* ── Drop shadow filter ── */}
        <defs>
          <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="3" dy="3" stdDeviation="3" floodColor="#1A1A2E" floodOpacity="0.12" />
          </filter>
          <linearGradient id="scanner-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0" />
            <stop offset="50%" stopColor="#4ECDC4" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── LAYER 1: EDI Document ── */}
        <motion.g
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          {/* Idle float animation wrapper */}
          <motion.g
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
          >
            {/* Document card */}
            <SketchyRect x={DOC_X} y={DOC_Y} w={DOC_W} h={DOC_H} />

            {/* File type tab */}
            <rect
              x={DOC_X + DOC_W - 56}
              y={DOC_Y - 18}
              width={56}
              height={22}
              rx={4}
              fill="#FFE66D"
              stroke="#1A1A2E"
              strokeWidth={1.5}
            />
            <text
              x={DOC_X + DOC_W - 28}
              y={DOC_Y - 3}
              textAnchor="middle"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, fill: '#1A1A2E' }}
            >
              837P
            </text>

            {/* Document lines */}
            <DocumentLines docX={DOC_X} docY={DOC_Y} />

            {/* EDI segment text labels */}
            <SegmentLabels docX={DOC_X} docY={DOC_Y} />
          </motion.g>
        </motion.g>

        {/* ── LAYER 2: Scanner beam ── */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <motion.rect
            x={DOC_X + 2}
            width={DOC_W - 4}
            height={14}
            fill="url(#scanner-grad)"
            rx={2}
            animate={{ y: [DOC_Y, DOC_Y + DOC_H - 14, DOC_Y] }}
            transition={{ duration: 2.5, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
          />
        </motion.g>

        {/* ── LAYER 3: Error badges ── */}
        <g filter="url(#badge-shadow)">
          <Badge
            x={BADGE_X}
            y={95}
            type="error"
            title="InvalidNPI"
            subtitle="Line 42 · NM109"
            delay={1.1}
          />
          <Badge
            x={BADGE_X}
            y={175}
            type="error"
            title="InvalidICD10"
            subtitle="Line 67 · HI01"
            delay={1.6}
          />
          <Badge
            x={BADGE_X}
            y={255}
            type="warning"
            title="AmountMismatch"
            subtitle="CLM02 vs SV1"
            delay={2.0}
          />
        </g>

        {/* ── LAYER 4: Fix checkmarks ── */}
        <Checkmark cx={454} cy={117} delay={2.8} />
        <Checkmark cx={454} cy={197} delay={3.1} />
        <Checkmark cx={454} cy={277} delay={3.4} />

        {/* ── Label: "837 Claims" bottom-left decoration ── */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <rect x={DOC_X} y={DOC_Y + DOC_H + 16} width={100} height={22} rx={4}
            fill="#4ECDC4" opacity={0.15} stroke="#4ECDC4" strokeWidth={1.5} />
          <text x={DOC_X + 50} y={DOC_Y + DOC_H + 31} textAnchor="middle"
            style={{ fontFamily: 'Nunito, sans-serif', fontSize: 10, fontWeight: 700, fill: '#1A1A2E', opacity: 0.7 }}>
            X12 · 5010A1
          </text>

          {/* Small decorative stars — repositioned to stay in visible viewBox */}
          <text x={320} y={370} style={{ fontSize: 18, opacity: 0.4 }}>✦</text>
          <text x={460} y={350} style={{ fontSize: 12, opacity: 0.3 }}>✦</text>
          <text x={100} y={380} style={{ fontSize: 10, opacity: 0.25 }}>✦</text>
        </motion.g>
      </svg>

      {/* Caption below illustration */}
      <p
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 12,
          color: 'rgba(26,26,46,0.45)',
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        Watch your EDI file get parsed in real time →
      </p>
    </div>
  )
}
