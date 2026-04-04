import { useState, useRef, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export default function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: 'Hi! I’m your virtual EDI assistant. Click on any error or segment in your file and I can explain it, or use “Ask AI to Fix” on any field.' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Store connections
  const setIsAIPanelOpen = useAppStore(s => s.setIsAIPanelOpen)
  const aiPromptContext = useAppStore(s => s.aiPromptContext)
  const setAiPromptContext = useAppStore(s => s.setAiPromptContext)
  const parseResult = useAppStore(s => s.parseResult)
  const transactionType = useAppStore(s => s.transactionType)

  const inputRef = useRef<HTMLInputElement>(null)
  const msgsEndRef = useRef<HTMLDivElement>(null)

  // When a form field's "Ask AI to Fix" triggers a context, pre-fill the input
  useEffect(() => {
    if (aiPromptContext) {
      setInput(aiPromptContext)
      setAiPromptContext(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aiPromptContext, setAiPromptContext])

  // Auto-scroll to bottom on new messages
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
      const apiUrl = 'https://edi-parser-production.up.railway.app'
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          parseResult: parseResult,
          transactionType: transactionType
        })
      })

      if (!res.ok) {
        throw new Error('Failed to connect to AI backend.')
      }

      const data = await res.json()
      setMessages(s => [...s, { id: Date.now().toString(), role: 'assistant', text: data.reply }])
    } catch (err: any) {
      setMessages(s => [...s, { id: Date.now().toString(), role: 'assistant', text: `⚠️ Error: ${err.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#FDFAF4',
      borderLeft: '2.5px solid #1A1A2E',
      overflow: 'hidden',
    }}>
      {/* AI Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '2.5px solid #1A1A2E',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#FFFFFF',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 18 }}>✦</div>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: '#1A1A2E', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Ask Me Anything!
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setIsAIPanelOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Minimize AI Panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }} className="custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <span style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 10,
              color: 'rgba(26,26,46,0.4)',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginLeft: 4, marginRight: 4
            }}>{m.role === 'user' ? 'YOU' : 'EDI EXPERT'}</span>
            
            <div style={{
              background: m.role === 'user' ? '#1A1A2E' : '#FFFFFF',
              color: m.role === 'user' ? '#FDFAF4' : '#1A1A2E',
              border: m.role === 'user' ? '2px solid #1A1A2E' : '2px solid rgba(26,26,46,0.15)',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '10px 14px',
              fontFamily: 'Nunito, sans-serif',
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: m.role === 'user' ? 'none' : '2px 2px 0px rgba(26,26,46,0.08)',
              overflowX: 'auto'
            }}>
              {m.role === 'user' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              ) : (
                <ReactMarkdown
                components={{
                  // 🚨 THE FIX: Destructure 'ref' out and add ': any' to the parameters
                  p: ({node, ref, ...props}: any) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
                  ul: ({node, ref, ...props}: any) => <ul style={{ margin: '0 0 8px 0', paddingLeft: 20 }} {...props} />,
                  ol: ({node, ref, ...props}: any) => <ol style={{ margin: '0 0 8px 0', paddingLeft: 20 }} {...props} />,
                  code: ({node, inline, className, children, ref, ...props}: any) => (
                    <code style={{
                      background: 'rgba(26,26,46,0.06)',
                      padding: inline ? '2px 4px' : '8px',
                      borderRadius: 4,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      display: inline ? 'inline' : 'block',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }} {...props}>
                      {children}
                    </code>
                  )
                }}
              >
                {m.text}
              </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <span style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 10,
              color: 'rgba(26,26,46,0.4)',
              marginLeft: 4, marginRight: 4
            }}>EDI EXPERT</span>
            <div style={{
              background: '#FFFFFF',
              color: '#1A1A2E',
              border: '2px solid rgba(26,26,46,0.15)',
              borderRadius: '12px 12px 12px 2px',
              padding: '10px 14px',
              boxShadow: '2px 2px 0px rgba(26,26,46,0.08)',
            }}>
              <span className="typing-dots">
                <span>•</span><span style={{ margin: '0 2px' }}>•</span><span>•</span>
              </span>
            </div>
          </div>
        )}
        <div ref={msgsEndRef} />
      </div>

      {/* Input Box */}
      <div style={{
        padding: '12px',
        borderTop: '2.5px solid #1A1A2E',
        background: '#FFFFFF',
        flexShrink: 0,
      }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '2px solid #1A1A2E',
            borderRadius: 16,
            padding: '4px 6px',
            background: '#FDFAF4',
            boxShadow: 'inset 2px 2px 0px rgba(26,26,46,0.05)',
            transition: 'border-color 0.2s',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? "AI is thinking..." : "Ask about a segment..."}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '8px 10px',
              fontFamily: 'Nunito, sans-serif',
              fontSize: 13,
              color: '#1A1A2E',
              opacity: isTyping ? 0.6 : 1
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: input.trim() && !isTyping ? '#4ECDC4' : 'rgba(26,26,46,0.05)',
              border: '1.5px solid',
              borderColor: input.trim() && !isTyping ? '#1A1A2E' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isTyping ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
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