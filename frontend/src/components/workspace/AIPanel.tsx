import { useState, useRef, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

interface FixPatch {
  fieldId: string
  label: string
  loopKey: string
  segmentKey: string
  fieldKey: string
  oldValue: string
  newValue: string | null
  reason: string
  canAutoFix: boolean
}

function applyPatch(tree: any, fix: FixPatch): any {
  if (!fix.canAutoFix || !fix.newValue) return tree
  const cloned = structuredClone(tree) as any
  const loops = cloned.loops || {}
  const allKeys = Object.keys(loops)
  const bare = fix.loopKey.replace(/^loop_/i, '')

  const candidates = [
    fix.loopKey,
    `loop_${bare}`,
    bare,
    allKeys.find(k => k.replace(/^loop_/i, '').toUpperCase() === bare.toUpperCase()),
    allKeys.find(k => k.toUpperCase().includes(bare.toUpperCase())),
  ].filter(Boolean) as string[]

  let loopArr: any = null
  for (const c of candidates) {
    if (loops[c]) { 
      loopArr = loops[c]
      break 
    }
  }

  if (!loopArr) return cloned

  const instances = Array.isArray(loopArr) ? loopArr : [loopArr]
  for (const instance of instances) {
    if (!instance) continue
    const rawSeg = instance[fix.segmentKey]
    if (!rawSeg) continue
    
    const seg = Array.isArray(rawSeg) ? rawSeg[0] : rawSeg
    if (!seg || typeof seg !== 'object') continue

    let patched = false
    if (seg[fix.fieldKey] !== undefined) {
      seg[fix.fieldKey] = fix.newValue
      patched = true
    } else {
      const numSuffix = fix.fieldKey.match(/\d{2}$/)
      if (numSuffix) {
        const suffix = `_${numSuffix[0]}`
        for (const k of Object.keys(seg)) {
          if (k.endsWith(suffix)) { seg[k] = fix.newValue; patched = true; break }
        }
      }
      if (!patched && seg.raw_data && Array.isArray(seg.raw_data)) {
        const idxMatch = fix.fieldKey.match(/\d+$/)
        if (idxMatch) {
          const idx = parseInt(idxMatch[0], 10)
          if (seg.raw_data.length > idx) { seg.raw_data[idx] = fix.newValue; patched = true }
        }
      }
    }
    break
  }

  if (cloned.errors) {
    cloned.errors = cloned.errors.filter((e: any) => {
      const el = (e.element || e.field || '').toUpperCase()
      return !el.includes(fix.fieldKey.toUpperCase())
    })
  }
  return cloned
}

export default function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: "Hi! I'm your EDI assistant. Ask me anything about your file, or click **Fix All Errors** and I'll automatically correct every fixable issue." }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isFixing, setIsFixing] = useState(false)

  const setIsAIPanelOpen = useAppStore(s => s.setIsAIPanelOpen)
  const aiPromptContext = useAppStore(s => s.aiPromptContext)
  const setAiPromptContext = useAppStore(s => s.setAiPromptContext)
  const parseResult = useAppStore(s => s.parseResult)
  const setParseResult = useAppStore(s => s.setParseResult)
  const transactionType = useAppStore(s => s.transactionType)
  const pendingFix = useAppStore(s => s.pendingFix)
  const acceptFix = useAppStore(s => s.acceptFix)
  const rejectFix = useAppStore(s => s.rejectFix)

  const inputRef = useRef<HTMLInputElement>(null)
  const msgsEndRef = useRef<HTMLDivElement>(null)

  const errors: any[] = (parseResult as any)?.errors ?? (parseResult as any)?.data?.errors ?? []
  const errorCount = errors.length

  // Auto-add fix messages from Fix Assistant (ValidationDrawer)
  useEffect(() => {
    if (aiPromptContext) {
      setMessages(m => [...m, { id: Date.now().toString(), role: 'system', text: aiPromptContext }])
    }
  }, [aiPromptContext])

  const handleAcceptFix = () => {
    if (!pendingFix) return
    
    acceptFix()
    
    setMessages(m => [...m, {
      id: Date.now().toString(),
      role: 'system',
      text: `✅ **Fix Accepted**\n\nThe correction has been permanently saved to your document.`
    }])
  }

  const handleRejectFix = () => {
    if (!pendingFix) return
    
    rejectFix()
    
    setMessages(m => [...m, {
      id: Date.now().toString(),
      role: 'system',
      text: `❌ **Fix Rejected**\n\nReverted to original value. No changes were saved.`
    }])
  }

  const handleFixAllErrors = async () => {
    if (!errorCount) return
    setIsFixing(true)

    setMessages(s => [...s, {
      id: Date.now().toString(), role: 'user',
      text: `🔧 Fix ${errorCount} error${errorCount !== 1 ? 's' : ''}`
    }])
    setIsTyping(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

      const res = await fetch(`${apiUrl}/ai/fix-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors, parseResult, transactionType }),
      })
      if (!res.ok) throw new Error(`AI backend returned ${res.status}: ${res.statusText}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const fixes: FixPatch[] = (data.fixes || []).filter((f: any) => f.fieldId)
      const fixable = fixes.filter(f => f.canAutoFix && f.newValue)
      const manual = fixes.filter(f => !f.canAutoFix || !f.newValue)

      if (fixable.length > 0) {
        let current = useAppStore.getState().parseResult as any
        for (const fix of fixable) {
          current = applyPatch(current, fix)
        }
        setParseResult(current)
      }

      const fixedLines = fixable.map(f =>
        `✅ **${f.label}**: \`${f.oldValue || '—'}\` → \`${f.newValue}\`\n   _${f.reason}_`
      ).join('\n\n')

      const manualLines = manual.map(f =>
        `⚠️ **${f.label}**: ${f.reason}`
      ).join('\n')

      let summary = ''
      if (fixable.length > 0) {
        summary += `**${fixable.length} error${fixable.length !== 1 ? 's' : ''} fixed automatically:**\n\n${fixedLines}`
      }
      if (manual.length > 0) {
        summary += (summary ? '\n\n' : '') + `**${manual.length} error${manual.length !== 1 ? 's' : ''} need manual correction:**\n\n${manualLines}`
      }
      if (fixes.length === 0) {
        summary = `**No auto-fixable errors found.**\n\nThe errors require manual correction — values like NPIs must be verified through external registries (e.g. npiregistry.cms.hhs.gov).`
      }

      setMessages(s => [...s, { id: Date.now().toString(), role: 'assistant', text: summary }])

    } catch (err: any) {
      console.error('[AI Fix] Error:', err)
      setMessages(s => [...s, {
        id: Date.now().toString(), role: 'assistant',
        text: `⚠️ Error: ${err.message}`
      }])
    } finally {
      setIsTyping(false)
      setIsFixing(false)
    }
  }

  useEffect(() => {
    if (aiPromptContext) {
      setInput(aiPromptContext)
      setAiPromptContext(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aiPromptContext, setAiPromptContext])

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async (text: string) => {
    const msg = text.trim()
    if (!msg) return
    setInput('')
    setMessages(s => [...s, { id: Date.now().toString(), role: 'user', text: msg }])
    setIsTyping(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, parseResult, transactionType }),
      })
      if (!res.ok) throw new Error('Failed to connect to AI backend.')
      const data = await res.json()
      setMessages(s => [...s, { id: Date.now().toString(), role: 'assistant', text: data.reply }])
    } catch (err: any) {
      setMessages(s => [...s, { id: Date.now().toString(), role: 'assistant', text: `⚠️ Error: ${err.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FDFAF4', borderLeft: '2.5px solid #1A1A2E', overflow: 'hidden' }}>

      <div style={{ padding: '12px 16px', borderBottom: '2.5px solid #1A1A2E', display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', flexShrink: 0 }}>
        <div style={{ fontSize: 18 }}>✦</div>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: '#1A1A2E', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Ask Me Anything!
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setIsAIPanelOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Minimise AI Panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }} className="custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10, color: 'rgba(26,26,46,0.4)', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', marginLeft: 4, marginRight: 4 }}>
              {m.role === 'user' ? 'YOU' : m.role === 'system' ? 'FIX ASSISTANT' : 'EDI EXPERT'}
            </span>
            <div style={{
              background: m.role === 'user' ? '#1A1A2E' : m.role === 'system' ? 'rgba(255,230,109,0.2)' : '#FFFFFF',
              color: m.role === 'user' ? '#FDFAF4' : '#1A1A2E',
              border: m.role === 'user' ? '2px solid #1A1A2E' : m.role === 'system' ? '2px solid #FFE66D' : '2px solid rgba(26,26,46,0.15)',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '10px 14px', fontFamily: 'Nunito, sans-serif', fontSize: 13, lineHeight: 1.5,
              boxShadow: m.role === 'user' ? 'none' : '2px 2px 0px rgba(26,26,46,0.08)', overflowX: 'auto',
            }}>
              {m.role === 'user' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              ) : (
                <ReactMarkdown components={{
                  p: ({ node, ref, ...props }: any) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
                  ul: ({ node, ref, ...props }: any) => <ul style={{ margin: '0 0 8px 0', paddingLeft: 20 }} {...props} />,
                  ol: ({ node, ref, ...props }: any) => <ol style={{ margin: '0 0 8px 0', paddingLeft: 20 }} {...props} />,
                  code: ({ node, inline, className, children, ref, ...props }: any) => (
                    <code style={{ background: 'rgba(26,26,46,0.06)', padding: inline ? '2px 4px' : '8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, display: inline ? 'inline' : 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} {...props}>{children}</code>
                  ),
                }}>{m.text}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 10, color: 'rgba(26,26,46,0.4)', marginLeft: 4 }}>EDI EXPERT</span>
            <div style={{ background: '#FFFFFF', border: '2px solid rgba(26,26,46,0.15)', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', boxShadow: '2px 2px 0px rgba(26,26,46,0.08)' }}>
              <span className="typing-dots"><span>•</span><span style={{ margin: '0 2px' }}>•</span><span>•</span></span>
            </div>
          </div>
        )}

        {/* Accept/Reject Buttons */}
        {pendingFix && (
          <div style={{
            alignSelf: 'center',
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(78,205,196,0.1), rgba(255,230,109,0.1))',
            border: '2px solid #4ECDC4',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '3px 3px 0 rgba(78,205,196,0.2)',
          }}>
            <p style={{
              fontFamily: 'Nunito, sans-serif',
              fontSize: 11,
              fontWeight: 800,
              color: '#1A1A2E',
              margin: 0,
              textAlign: 'center',
            }}>
              🤔 Do you want to keep this fix?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAcceptFix}
                style={{
                  flex: 1,
                  background: '#27AE60',
                  color: '#FFFFFF',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 800,
                  fontSize: 11,
                  border: '2px solid #1A1A2E',
                  borderRadius: 6,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 #1A1A2E',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #1A1A2E' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #1A1A2E' }}
              >
                ✓ Accept Fix
              </button>
              <button
                onClick={handleRejectFix}
                style={{
                  flex: 1,
                  background: '#FF6B6B',
                  color: '#FFFFFF',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 800,
                  fontSize: 11,
                  border: '2px solid #1A1A2E',
                  borderRadius: 6,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 #1A1A2E',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #1A1A2E' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #1A1A2E' }}
              >
                ✗ Reject Fix
              </button>
            </div>
          </div>
        )}

        <div ref={msgsEndRef} />
      </div>

      {errorCount > 0 && (
        <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
          <button
            id="ai-fix-all-errors-btn"
            onClick={handleFixAllErrors}
            disabled={isTyping || isFixing}
            style={{
              width: '100%', padding: '9px 14px',
              background: isFixing ? 'rgba(255,107,107,0.12)' : '#FF6B6B',
              color: isFixing ? '#FF6B6B' : '#FFFFFF',
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, letterSpacing: '0.3px',
              border: '2px solid #FF6B6B', borderRadius: 10,
              boxShadow: isFixing ? 'none' : '3px 3px 0px #1A1A2E',
              cursor: isFixing || isTyping ? 'not-allowed' : 'pointer',
              transform: isFixing ? 'none' : 'rotate(-0.3deg)',
              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: isTyping ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!isFixing && !isTyping) { e.currentTarget.style.boxShadow = '5px 5px 0px #1A1A2E'; e.currentTarget.style.transform = 'rotate(0.3deg) translateY(-2px)' } }}
            onMouseLeave={e => { if (!isFixing && !isTyping) { e.currentTarget.style.boxShadow = '3px 3px 0px #1A1A2E'; e.currentTarget.style.transform = 'rotate(-0.3deg)' } }}
          >
            {isFixing ? (
              <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 13 }}>⟳</span> Fixing errors…</>
            ) : (
              <>🔧 Fix {errorCount} Error{errorCount !== 1 ? 's' : ''}</>
            )}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ padding: '12px', borderTop: '2.5px solid #1A1A2E', background: '#FFFFFF', flexShrink: 0 }}>
        <form
          onSubmit={e => { e.preventDefault(); handleSend(input) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px solid #1A1A2E', borderRadius: 16, padding: '4px 6px', background: '#FDFAF4', boxShadow: 'inset 2px 2px 0px rgba(26,26,46,0.05)', transition: 'border-color 0.2s' }}
        >
          <input
            ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? 'AI is thinking...' : 'Ask about a segment...'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '8px 10px', fontFamily: 'Nunito, sans-serif', fontSize: 13, color: '#1A1A2E', opacity: isTyping ? 0.6 : 1 }}
          />
          <button
            type="submit" disabled={!input.trim() || isTyping}
            style={{ width: 32, height: 32, borderRadius: 10, background: input.trim() && !isTyping ? '#4ECDC4' : 'rgba(26,26,46,0.05)', border: '1.5px solid', borderColor: input.trim() && !isTyping ? '#1A1A2E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isTyping ? 'pointer' : 'default', transition: 'all 0.15s ease', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" opacity={input.trim() && !isTyping ? 1 : 0.4}>
              <path d="M1 8L15 2L8 15L7 10L1 8Z" fill={input.trim() && !isTyping ? '#1A1A2E' : 'rgba(26,26,46,0.5)'} stroke={input.trim() && !isTyping ? '#1A1A2E' : 'rgba(26,26,46,0.5)'} strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}