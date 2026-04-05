import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import useAppStore, { type WalkthroughStep } from '../../store/useAppStore'

// ── Step configuration ────────────────────────────────────────────────────────

interface StepConfig {
  targets: string[]           // data-tour attribute values to highlight
  tooltip: string
  blur: boolean
  beacon: boolean
  showNext: boolean
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

function getStepConfig(step: WalkthroughStep, txnType: string | null): StepConfig | null {
  switch (step) {
    case 'welcome-greeting':
      return {
        targets: ['welcome-heading'],
        tooltip: "Let's give you a tour of our site.",
        blur: false, beacon: true, showNext: true, placement: 'bottom',
      }
    case 'upload-file':
      return {
        targets: ['upload-dropzone'],
        tooltip: 'Upload your files here. You can drop an EDI file or click to browse. Click Next to skip.',
        blur: true, beacon: true,
        showNext: true,   // ← allow manual advance if user doesn't want to upload now
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
        tooltip: 'This is your loop explorer. Here you will see each loop and corresponding segment of your EDI file. Try clicking on one loop.',
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
        tooltip: 'This is the BEST part. You can view your EDI files in a simplified form view.',
        blur: true, beacon: false, showNext: true, placement: 'left',
      }
    case 'workspace-form-val':
      return {
        targets: ['form-editor-view', 'validation-drawer'],
        tooltip: 'Try clicking on an error. It will guide you to the exact part of the form where the error occurs.',
        blur: true, beacon: true, showNext: true, placement: 'top',
      }
    case 'workspace-ai':
      return {
        targets: ['ai-panel'],
        tooltip: 'This is your AI buddy. It will explain anything about your EDI file you ask.',
        blur: true, beacon: false, showNext: true, placement: 'left',
      }
    case 'workspace-summary': {
      const typeNum = txnType?.includes('834') ? '834' : '835'
      return {
        targets: ['tab-summary'],
        tooltip: `Click here to view the summary of your ${typeNum} file.`,
        blur: true, beacon: true, showNext: true, placement: 'bottom',
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
//  This approach avoids the SVG-mask + backdropFilter bug (Chrome ignores
//  `backdrop-filter` on elements inside an SVG, so the target element was
//  inadvertently blurred along with the rest of the page).
//
//  Instead we render four solid/blur rectangles that precisely fill the
//  screen area OUTSIDE the bounding highlight rect.  The gap in the middle
//  exposes the real DOM elements without any filter applied.
//
//  ┌──────────────────────────────────┐
//  │          TOP  curtain            │
//  ├──────────┬─────────┬─────────────┤
//  │  LEFT    │  CLEAR  │   RIGHT     │
//  ├──────────┴─────────┴─────────────┤
//  │         BOTTOM curtain           │
//  └──────────────────────────────────┘

const CURTAIN_BG = 'rgba(26, 26, 46, 0.55)'
const CURTAIN_BLUR = 'blur(4px)'
const PAD = 10  // padding around targets (px)

function BlurCurtains({ boundingRect }: { boundingRect: Rect | null }) {
  const W = window.innerWidth
  const H = window.innerHeight

  // If we have no rect yet, black-out everything
  const cut = boundingRect
    ? {
        top: Math.max(0, boundingRect.top - PAD),
        left: Math.max(0, boundingRect.left - PAD),
        bottom: Math.min(H, boundingRect.top + boundingRect.height + PAD),
        right: Math.min(W, boundingRect.left + boundingRect.width + PAD),
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
        pointerEvents: 'none',
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

// ── Backdrop blocker for non-blur steps (blocks clicks outside callout) ───────

function FullscreenBlocker({ rects }: { rects: Rect[] }) {
  return (
    <>
      {/* Transparent full-screen catch that blocks accidental clicks */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        pointerEvents: 'auto', background: 'transparent',
      }} />
      {/* Punch-through zones for each highlighted element */}
      {rects.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: r.top - PAD, left: r.left - PAD,
            width: r.width + PAD * 2, height: r.height + PAD * 2,
            zIndex: 100000,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
        />
      ))}
    </>
  )
}

// ── Pulsing Beacon ────────────────────────────────────────────────────────────

function Beacon({ rect }: { rect: Rect }) {
  return (
    <div style={{
      position: 'fixed',
      top: rect.top + rect.height / 2 - 10,
      left: rect.left + rect.width / 2 - 10,
      width: 20, height: 20,
      zIndex: 100002,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#FF6B6B', border: '2.5px solid #FDFAF4',
        boxShadow: '0 0 0 0 rgba(255,107,107,0.7)',
        animation: 'tour-beacon-pulse 1.5s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Highlight ring drawn directly around each target ─────────────────────────

function HighlightRing({ rect }: { rect: Rect }) {
  return (
    <div style={{
      position: 'fixed',
      top: rect.top - PAD - 2,
      left: rect.left - PAD - 2,
      width: rect.width + (PAD + 2) * 2,
      height: rect.height + (PAD + 2) * 2,
      border: '2.5px solid rgba(78, 205, 196, 0.9)',
      borderRadius: 14,
      boxShadow: '0 0 0 4px rgba(78, 205, 196, 0.25)',
      zIndex: 99999,
      pointerEvents: 'none',
      animation: 'tour-ring-appear 0.3s ease-out',
    }} />
  )
}

// ── Tooltip Card ──────────────────────────────────────────────────────────────

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
  const TIP_H = 160 // estimated height for clamping

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
        top = anchorRect.top + anchorRect.height + GAP + PAD
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'top':
        top = anchorRect.top - GAP - PAD - TIP_H
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'right':
        top = anchorRect.top + anchorRect.height / 2 - TIP_H / 2
        left = anchorRect.left + anchorRect.width + GAP + PAD
        break
      case 'left':
        top = anchorRect.top + anchorRect.height / 2 - TIP_H / 2
        left = anchorRect.left - TIP_W - GAP - PAD
        break
      default:
        top = window.innerHeight / 2 - TIP_H / 2
        left = window.innerWidth / 2 - TIP_W / 2
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(window.innerWidth - TIP_W - 16, left))
    top = Math.max(16, Math.min(window.innerHeight - TIP_H - 16, top))
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
        boxShadow: '5px 5px 0px rgba(26,26,46,0.2)',
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
  const walkthroughStep = useAppStore(s => s.walkthroughStep)
  const advanceWalkthrough = useAppStore(s => s.advanceWalkthrough)
  const endWalkthrough = useAppStore(s => s.endWalkthrough)
  const transactionType = useAppStore(s => s.transactionType)

  const [rects, setRects] = useState<Rect[]>([])
  const rafRef = useRef<number | null>(null)

  const config = walkthroughStep ? getStepConfig(walkthroughStep, transactionType) : null

  // Recalculate positions via rAF to stay in sync with layout
  const recalc = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!config) { setRects([]); return }
      const newRects = getTargetRects(config.targets)
      setRects(newRects)
    })
  }, [config])

  useEffect(() => {
    recalc()
    // Re-measure after a short delay (allows element to animate into view)
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
    || walkthroughStep === 'workspace-summary'

  const overlay = (
    <>
      <style>{`
        @keyframes tour-beacon-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(255,107,107,0.7); }
          70%  { box-shadow: 0 0 0 14px rgba(255,107,107,0); }
          100% { box-shadow: 0 0 0 0   rgba(255,107,107,0); }
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

      {/* ── Blur curtains (only for blur steps) */}
      {config.blur && <BlurCurtains boundingRect={boundingRect} />}

      {/* ── Highlight rings around each target */}
      {config.blur && rects.map((r, i) => <HighlightRing key={i} rect={r} />)}

      {/* ── Click-through blocker (only for blur steps so user can interact with targets) */}
      {config.blur && <FullscreenBlocker rects={rects} />}

      {/* ── Pulsing beacon on the last target */}
      {config.beacon && rects.length > 0 && (
        <Beacon rect={rects[rects.length - 1]} />
      )}

      {/* ── Tooltip card */}
      <Tooltip
        text={config.tooltip}
        placement={config.placement}
        anchorRect={boundingRect}
        showNext={config.showNext}
        isLast={isLastStep}
        onNext={isLastStep ? endWalkthrough : advanceWalkthrough}
        onSkip={endWalkthrough}
      />
    </>
  )

  return createPortal(overlay, document.body)
}