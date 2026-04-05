import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import useAppStore, { type WalkthroughStep } from '../../store/useAppStore'

// ── Step configuration ────────────────────────────────────────────────────────

interface StepConfig {
  targets: string[]           // data-tour attribute values to highlight
  tooltip: string
  blur: boolean
  beacon: boolean             // when true → glowing red border on the target
  showNext: boolean
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** When set, render a special wide banner card instead of the standard tooltip */
  bannerMode?: boolean
}

function getStepConfig(step: WalkthroughStep, txnType: string | null): StepConfig | null {
  switch (step) {
    case 'welcome-greeting':
      return {
        targets: ['upload-dropzone'],   // anchor the banner below the dropzone
        tooltip: "Welcome to EdiFix! Let's give you a quick tour of everything you can do here.",
        blur: false, beacon: false, showNext: true, placement: 'bottom',
        bannerMode: true,               // wide intro card, not a small tooltip
      }
    case 'upload-file':
      return {
        targets: ['upload-dropzone'],
        tooltip: 'Upload your files here. Drop an EDI file or click to browse. Hit Next to skip ahead.',
        blur: true, beacon: true,
        showNext: true,
        placement: 'top',
      }
    case 'overview-proceed':
      return {
        targets: ['proceed-workspace-btn'],
        tooltip: 'Click here to proceed to your workspace.',
        blur: false, beacon: true, showNext: false, placement: 'top',
      }
    case 'workspace-explorer':
      return {
        targets: ['left-sidebar'],
        tooltip: 'This is your Loop Explorer. You can see every loop and segment of your EDI file here. Try clicking on a loop!',
        blur: true, beacon: false, showNext: true, placement: 'right',
      }
    case 'workspace-validation':
      return {
        targets: ['validation-drawer'],
        tooltip: 'Here are the errors from your EDI file.',
        blur: true, beacon: false, showNext: true, placement: 'top',
      }
    case 'workspace-form':
      return {
        targets: ['form-editor-view'],
        tooltip: 'This is the BEST part. You can view your EDI files in a clean, simplified form view.',
        blur: true, beacon: false, showNext: true, placement: 'left',
      }
    case 'workspace-form-val':
      return {
        targets: ['form-editor-view', 'validation-drawer'],
        tooltip: 'Try clicking on an error — it will jump you straight to the exact field in the form!',
        blur: true, beacon: true, showNext: true, placement: 'top',
      }
    case 'workspace-ai':
      return {
        targets: ['ai-panel'],
        tooltip: 'This is your AI buddy. Ask it anything about your EDI file.',
        blur: true, beacon: false, showNext: true, placement: 'left',
      }
    case 'workspace-summary': {
      const typeNum = txnType?.includes('834') ? '834' : '835'
      return {
        targets: ['tab-summary'],
        tooltip: `Click the Summary tab to view the full summary of your ${typeNum} file.`,
        blur: true, beacon: true, showNext: false, placement: 'bottom',
      }
    }
    case 'workspace-summary-view': {
      const typeNum = txnType?.includes('834') ? '834' : '835'
      return {
        targets: ['form-editor-view'],
        tooltip: `🎉 Here's your ${typeNum} Summary! You've completed the tour. Explore the full workspace anytime.`,
        blur: false, beacon: false, showNext: true, placement: 'center',
      }
    }
    default:
      return null
  }
}

// ── Rect helpers ──────────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRects(targets: string[]): Rect[] {
  return targets
    .map(t => document.querySelector(`[data-tour="${t}"]`))
    .filter((el): el is HTMLElement => el !== null)
    .map(el => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    })
}

function getBoundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const top = Math.min(...rects.map(r => r.top))
  const left = Math.min(...rects.map(r => r.left))
  const bottom = Math.max(...rects.map(r => r.top + r.height))
  const right = Math.max(...rects.map(r => r.left + r.width))
  return { top, left, width: right - left, height: bottom - top }
}

// ── Blur Overlay — four curtains around the highlighted rect(s) ───────────────
//
//  Four fixed <div>s cover everything OUTSIDE the target bounding rect.
//  Each curtain has backdropFilter: blur so non-targets appear frosted.
//  The clear gap in the middle lets the real DOM element shine through —
//  no filter is applied there, so it looks perfectly focused.
//
//  Curtains use pointerEvents:'none' so they don't swallow clicks.
//  This means ALL elements on the page remain clickable (the in-focus
//  ones AND the blurred ones). That's the correct behaviour for steps
//  where we tell the user to explore/click the highlighted section.
//
//  ┌──────────────────────────────────┐
//  │          TOP  curtain            │
//  ├──────────┬─────────┬─────────────┤
//  │  LEFT    │  CLEAR  │   RIGHT     │
//  ├──────────┴─────────┴─────────────┤
//  │         BOTTOM curtain           │
//  └──────────────────────────────────┘

const CURTAIN_BG = 'rgba(26, 26, 46, 0.52)'
const CURTAIN_BLUR = 'blur(5px)'
const PAD = 12  // padding around targets (px)

function BlurCurtains({ boundingRect }: { boundingRect: Rect | null }) {
  const W = window.innerWidth
  const H = window.innerHeight

  const cut = boundingRect
    ? {
        top:    Math.max(0, boundingRect.top - PAD),
        left:   Math.max(0, boundingRect.left - PAD),
        bottom: Math.min(H, boundingRect.top + boundingRect.height + PAD),
        right:  Math.min(W, boundingRect.left + boundingRect.width + PAD),
      }
    : { top: 0, left: 0, bottom: 0, right: 0 }

  const curtain = (style: CSSProperties) => (
    <div
      style={{
        position: 'fixed',
        background: CURTAIN_BG,
        backdropFilter: CURTAIN_BLUR,
        WebkitBackdropFilter: CURTAIN_BLUR,
        zIndex: 99998,
        pointerEvents: 'none',   // ← never swallow clicks; overlay is visual-only
        ...style,
      }}
    />
  )

  return (
    <>
      {/* Top */}
      {curtain({ top: 0, left: 0, width: W, height: cut.top })}
      {/* Bottom */}
      {curtain({ top: cut.bottom, left: 0, width: W, height: Math.max(0, H - cut.bottom) })}
      {/* Left */}
      {curtain({ top: cut.top, left: 0, width: cut.left, height: cut.bottom - cut.top })}
      {/* Right */}
      {curtain({ top: cut.top, left: cut.right, width: Math.max(0, W - cut.right), height: cut.bottom - cut.top })}
    </>
  )
}

// ── Glowing beacon border — replaces the old red dot ─────────────────────────
//
//  Instead of a dot sitting on top of the element, we draw an animated
//  border ring (position:fixed) exactly around it. The ring pulses via
//  box-shadow so it looks like a "select me" glow without covering any
//  content inside the target.

function BeaconBorder({ rect }: { rect: Rect }) {
  const BPAD = 6  // extra padding for the glow ring
  return (
    <div
      style={{
        position: 'fixed',
        top:    rect.top    - BPAD,
        left:   rect.left   - BPAD,
        width:  rect.width  + BPAD * 2,
        height: rect.height + BPAD * 2,
        borderRadius: 14,
        border: '2px solid rgba(255, 107, 107, 0.9)',
        boxShadow: '0 0 0 0 rgba(255, 107, 107, 0.6)',
        animation: 'tour-beacon-border 1.8s ease-in-out infinite',
        zIndex: 100001,
        pointerEvents: 'none',
      }}
    />
  )
}

// ── Highlight ring (teal) for blur steps ─────────────────────────────────────

function HighlightRing({ rect }: { rect: Rect }) {
  return (
    <div style={{
      position: 'fixed',
      top:    rect.top    - PAD - 2,
      left:   rect.left   - PAD - 2,
      width:  rect.width  + (PAD + 2) * 2,
      height: rect.height + (PAD + 2) * 2,
      border: '2.5px solid rgba(78, 205, 196, 0.85)',
      borderRadius: 14,
      boxShadow: '0 0 0 4px rgba(78, 205, 196, 0.2)',
      zIndex: 99999,
      pointerEvents: 'none',
      animation: 'tour-ring-appear 0.3s ease-out',
    }} />
  )
}

// ── Wide welcome banner (Phase 0 only) ───────────────────────────────────────
//
//  Renders a horizontally-wide card anchored just below the upload dropzone.
//  It's more of a greeting card than a standard tooltip.

function WelcomeBanner({
  anchorRect,
  onStart,
  onSkip,
}: {
  anchorRect: Rect | null
  onStart: () => void
  onSkip: () => void
}) {
  const BANNER_W = Math.min(600, window.innerWidth - 48)
  const GAP = 24

  let top = 0
  let left = 0

  if (anchorRect) {
    top  = anchorRect.top + anchorRect.height + GAP
    left = anchorRect.left + anchorRect.width / 2 - BANNER_W / 2
  } else {
    top  = window.innerHeight / 2 - 80
    left = window.innerWidth  / 2 - BANNER_W / 2
  }

  // Clamp to viewport
  left = Math.max(24, Math.min(window.innerWidth - BANNER_W - 24, left))
  top  = Math.max(24, Math.min(window.innerHeight - 200, top))

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: BANNER_W,
        zIndex: 100003,
        pointerEvents: 'auto',
        animation: 'tour-tooltip-enter 0.4s ease-out',
      }}
    >
      <div style={{
        background: '#FFFFFF',
        border: '2.5px solid #1A1A2E',
        borderRadius: 16,
        boxShadow: '6px 6px 0px rgba(26,26,46,0.18)',
        padding: '20px 28px',
        fontFamily: 'Nunito, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        {/* Left: icon + text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>✨</span>
            <span style={{
              fontWeight: 900, fontSize: 11, color: '#4ECDC4',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              EdiFix Tour
            </span>
          </div>
          <p style={{
            fontSize: 15, fontWeight: 700, color: '#1A1A2E',
            lineHeight: 1.55, margin: 0,
          }}>
            Welcome to EdiFix! 🎉 Let's give you a quick tour of everything you can do here.
          </p>
        </div>

        {/* Right: CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onStart}
            style={{
              background: '#4ECDC4', color: '#1A1A2E',
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14,
              border: '2px solid #1A1A2E', borderRadius: 10,
              padding: '10px 28px', cursor: 'pointer',
              boxShadow: '3px 3px 0px #1A1A2E',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0px #1A1A2E' }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' }}
          >
            Let's Go 🚀
          </button>
          <button
            onClick={onSkip}
            style={{
              background: 'transparent', color: 'rgba(26,26,46,0.4)',
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11,
              border: 'none', cursor: 'pointer', padding: '4px 0',
              textAlign: 'center',
            }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Standard Tooltip Card ─────────────────────────────────────────────────────

function Tooltip({
  text,
  placement,
  anchorRect,
  showNext,
  isLast,
  onNext,
  onSkip,
}: {
  text: string
  placement: string
  anchorRect: Rect | null
  showNext: boolean
  isLast: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const TIP_W = 340
  const TIP_H = 160

  useEffect(() => {
    if (!anchorRect) {
      setPos({ top: window.innerHeight / 2 - TIP_H / 2, left: window.innerWidth / 2 - TIP_W / 2 })
      return
    }
    const GAP = 20
    let top = 0
    let left = 0

    switch (placement) {
      case 'bottom':
        top  = anchorRect.top + anchorRect.height + GAP + PAD
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'top':
        top  = anchorRect.top - GAP - PAD - TIP_H
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'right':
        top  = anchorRect.top + anchorRect.height / 2 - TIP_H / 2
        left = anchorRect.left + anchorRect.width + GAP + PAD
        break
      case 'left':
        top  = anchorRect.top + anchorRect.height / 2 - TIP_H / 2
        left = anchorRect.left - TIP_W - GAP - PAD
        break
      default:
        top  = window.innerHeight / 2 - TIP_H / 2
        left = window.innerWidth  / 2 - TIP_W / 2
    }

    left = Math.max(16, Math.min(window.innerWidth  - TIP_W - 16, left))
    top  = Math.max(16, Math.min(window.innerHeight - TIP_H - 16, top))
    setPos({ top, left })
  }, [anchorRect, placement])

  return (
    <div style={{
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      zIndex: 100003,
      width: TIP_W,
      pointerEvents: 'auto',
      animation: 'tour-tooltip-enter 0.3s ease-out',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '2.5px solid #1A1A2E',
        borderRadius: 14,
        boxShadow: '5px 5px 0px rgba(26,26,46,0.18)',
        padding: '18px 20px',
        fontFamily: 'Nunito, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <span style={{
            fontWeight: 900, fontSize: 12, color: '#4ECDC4',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            EdiFix Tour
          </span>
        </div>

        {/* Body */}
        <p style={{
          fontSize: 14, fontWeight: 600, color: '#1A1A2E',
          lineHeight: 1.6, margin: '0 0 16px',
        }}>
          {text}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showNext && (
            <button
              onClick={onNext}
              style={{
                background: '#4ECDC4', color: '#1A1A2E',
                fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
                border: '2px solid #1A1A2E', borderRadius: 8,
                padding: '9px 22px', cursor: 'pointer',
                boxShadow: '3px 3px 0px #1A1A2E',
                transition: 'all 0.15s',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0px #1A1A2E' }}
              onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E' }}
            >
              {isLast ? '🎉 Finish' : 'Next →'}
            </button>
          )}
          <button
            onClick={onSkip}
            style={{
              background: 'transparent', color: 'rgba(26,26,46,0.45)',
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11,
              border: 'none', cursor: 'pointer', padding: '9px 12px',
            }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Walkthrough Overlay ──────────────────────────────────────────────────

export default function WalkthroughOverlay() {
  const walkthroughStep    = useAppStore(s => s.walkthroughStep)
  const advanceWalkthrough = useAppStore(s => s.advanceWalkthrough)
  const endWalkthrough     = useAppStore(s => s.endWalkthrough)
  const transactionType    = useAppStore(s => s.transactionType)

  const [rects, setRects] = useState<Rect[]>([])
  const rafRef = useRef<number | null>(null)

  const config = walkthroughStep ? getStepConfig(walkthroughStep, transactionType) : null

  const recalc = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!config) { setRects([]); return }
      setRects(getTargetRects(config.targets))
    })
  }, [config])

  useEffect(() => {
    recalc()
    const t1 = setTimeout(recalc, 150)
    const t2 = setTimeout(recalc, 500)
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [recalc, walkthroughStep])

  if (!walkthroughStep || !config) return null

  const boundingRect = getBoundingRect(rects)
  const isLastStep =
    (walkthroughStep === 'workspace-ai' && !(transactionType?.includes('834') || transactionType?.includes('835')))
    || walkthroughStep === 'workspace-summary-view'

  const overlay = (
    <>
      <style>{`
        @keyframes tour-beacon-border {
          0%   { box-shadow: 0 0 0 0   rgba(255,107,107,0.7),
                             0 0 12px  rgba(255,107,107,0.4); }
          60%  { box-shadow: 0 0 0 8px rgba(255,107,107,0),
                             0 0 24px  rgba(255,107,107,0.15); }
          100% { box-shadow: 0 0 0 0   rgba(255,107,107,0),
                             0 0 0     rgba(255,107,107,0); }
        }
        @keyframes tour-tooltip-enter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tour-ring-appear {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Blur curtains — visual only, pointerEvents:none so everything stays clickable */}
      {config.blur && <BlurCurtains boundingRect={boundingRect} />}

      {/* ── Teal highlight ring around each target (blur steps) */}
      {config.blur && rects.map((r, i) => <HighlightRing key={i} rect={r} />)}

      {/* ── Red glowing border beacon on each target that needs it */}
      {config.beacon && rects.map((r, i) => <BeaconBorder key={i} rect={r} />)}

      {/* ── Welcome banner (Phase 0) OR standard tooltip */}
      {config.bannerMode ? (
        <WelcomeBanner
          anchorRect={boundingRect}
          onStart={advanceWalkthrough}
          onSkip={endWalkthrough}
        />
      ) : (
        <Tooltip
          text={config.tooltip}
          placement={config.placement}
          anchorRect={boundingRect}
          showNext={config.showNext}
          isLast={isLastStep}
          onNext={isLastStep ? endWalkthrough : advanceWalkthrough}
          onSkip={endWalkthrough}
        />
      )}
    </>
  )

  return createPortal(overlay, document.body)
}