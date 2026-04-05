import { useEffect, useState, useCallback } from 'react'
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
      return { targets: ['welcome-heading'], tooltip: "Let's give you a tour of our site.", blur: false, beacon: true, showNext: true, placement: 'bottom' }
    case 'upload-file':
      return { targets: ['upload-dropzone'], tooltip: 'Upload your files here.', blur: true, beacon: true, showNext: false, placement: 'top' }
    case 'overview-proceed':
      return { targets: ['proceed-workspace-btn'], tooltip: 'Click here to proceed to your workspace.', blur: false, beacon: true, showNext: false, placement: 'top' }
    case 'workspace-explorer':
      return { targets: ['left-sidebar'], tooltip: 'This is your loop explorer. Here you will see each loop and corresponding segment of your EDI file. Try clicking on one loop.', blur: true, beacon: false, showNext: true, placement: 'right' }
    case 'workspace-validation':
      return { targets: ['validation-drawer'], tooltip: 'Here are the errors from your EDI file.', blur: true, beacon: false, showNext: true, placement: 'top' }
    case 'workspace-form':
      return { targets: ['form-editor-view'], tooltip: 'This is the BEST part. You can view your EDI files in a simplified form view.', blur: true, beacon: false, showNext: true, placement: 'left' }
    case 'workspace-form-val':
      return { targets: ['form-editor-view', 'validation-drawer'], tooltip: 'Try clicking on an error. It will guide you to the exact part of the form where the error occurs.', blur: true, beacon: true, showNext: true, placement: 'top' }
    case 'workspace-ai':
      return { targets: ['ai-panel'], tooltip: 'This is your AI buddy. It will explain anything about your EDI file you ask.', blur: true, beacon: false, showNext: true, placement: 'left' }
    case 'workspace-summary': {
      const typeNum = txnType?.includes('834') ? '834' : '835'
      return { targets: ['tab-summary'], tooltip: `Click here to view the summary of your ${typeNum} file.`, blur: true, beacon: true, showNext: true, placement: 'bottom' }
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

// ── Overlay SVG mask — cuts holes for target elements ─────────────────────────

function OverlayMask({ rects, blur }: { rects: Rect[]; blur: boolean }) {
  if (!blur) return null
  const PAD = 8
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998, pointerEvents: 'none',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.left - PAD}
                y={r.top - PAD}
                width={r.width + PAD * 2}
                height={r.height + PAD * 2}
                rx={12}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(253,250,244,0.75)"
          mask="url(#tour-mask)"
          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        />
      </svg>
      {/* Backdrop-blur fallback — SVG mask + filter doesn't propagate well in all browsers */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(253,250,244,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        mask: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'><defs><mask id='m'><rect width='100%' height='100%' fill='white'/>${rects.map(r => `<rect x='${r.left - PAD}' y='${r.top - PAD}' width='${r.width + PAD * 2}' height='${r.height + PAD * 2}' rx='12' fill='black'/>`).join('')}</mask></defs><rect width='100%' height='100%' mask='url(%23m)' fill='white'/></svg>`
        )}")`,
        WebkitMask: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'><defs><mask id='m'><rect width='100%' height='100%' fill='white'/>${rects.map(r => `<rect x='${r.left - PAD}' y='${r.top - PAD}' width='${r.width + PAD * 2}' height='${r.height + PAD * 2}' rx='12' fill='black'/>`).join('')}</mask></defs><rect width='100%' height='100%' mask='url(%23m)' fill='white'/></svg>`
        )}")`,
      }} />
    </div>
  )
}

// ── Click-through zone — allows interacting with highlighted targets ───────────

function ClickThroughZones({ rects }: { rects: Rect[] }) {
  const PAD = 8
  return (
    <>
      {/* Block clicks on masked areas */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        pointerEvents: 'auto', background: 'transparent',
      }} />
      {/* Cut out click-through holes */}
      {rects.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: r.top - PAD,
            left: r.left - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
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
        background: '#FF6B6B', border: '2.5px solid #1A1A2E',
        boxShadow: '0 0 0 0 rgba(255,107,107,0.7)',
        animation: 'tour-beacon-pulse 1.5s ease-in-out infinite',
      }} />
    </div>
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

  useEffect(() => {
    if (!anchorRect) {
      // Center of screen
      setPos({ top: window.innerHeight / 2 - 60, left: window.innerWidth / 2 - 160 })
      return
    }
    const TIP_W = 320
    const GAP = 16
    let top = 0
    let left = 0

    switch (placement) {
      case 'bottom':
        top = anchorRect.top + anchorRect.height + GAP
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'top':
        top = anchorRect.top - GAP - 140
        left = anchorRect.left + anchorRect.width / 2 - TIP_W / 2
        break
      case 'right':
        top = anchorRect.top + anchorRect.height / 2 - 60
        left = anchorRect.left + anchorRect.width + GAP
        break
      case 'left':
        top = anchorRect.top + anchorRect.height / 2 - 60
        left = anchorRect.left - TIP_W - GAP
        break
      default:
        top = window.innerHeight / 2 - 60
        left = window.innerWidth / 2 - TIP_W / 2
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(window.innerWidth - TIP_W - 12, left))
    top = Math.max(12, Math.min(window.innerHeight - 180, top))
    setPos({ top, left })
  }, [anchorRect, placement])

  return (
    <div style={{
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      zIndex: 100003,
      width: 320,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <span style={{
            fontWeight: 900, fontSize: 12, color: '#4ECDC4',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            EdiFix Tour
          </span>
        </div>
        <p style={{
          fontSize: 14, fontWeight: 600, color: '#1A1A2E',
          lineHeight: 1.6, margin: '0 0 16px',
        }}>
          {text}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showNext && (
            <button
              onClick={onNext}
              style={{
                background: '#4ECDC4', color: '#1A1A2E',
                fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12,
                border: '2px solid #1A1A2E', borderRadius: 8,
                padding: '8px 20px', cursor: 'pointer',
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
              border: 'none', cursor: 'pointer', padding: '8px 12px',
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

  const config = walkthroughStep ? getStepConfig(walkthroughStep, transactionType) : null

  // Recalculate positions on step change and on resize/scroll
  const recalc = useCallback(() => {
    if (!config) { setRects([]); return }
    setRects(getTargetRects(config.targets))
  }, [config])

  useEffect(() => {
    recalc()
    const timer = setTimeout(recalc, 300) // re-measure after layout settles
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [recalc, walkthroughStep])

  if (!walkthroughStep || !config) return null

  const boundingRect = getBoundingRect(rects)
  const isLastStep = walkthroughStep === 'workspace-ai' && !(transactionType?.includes('834') || transactionType?.includes('835'))
    || walkthroughStep === 'workspace-summary'

  const overlay = (
    <>
      <style>{`
        @keyframes tour-beacon-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,107,107,0.7); }
          70% { box-shadow: 0 0 0 14px rgba(255,107,107,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,107,107,0); }
        }
        @keyframes tour-tooltip-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <OverlayMask rects={rects} blur={config.blur} />

      {config.blur && <ClickThroughZones rects={rects} />}

      {config.beacon && rects.length > 0 && (
        <Beacon rect={rects[rects.length - 1]} />
      )}

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