import { useState, useRef, useEffect } from 'react'
import rough from 'roughjs'
import useAppStore from '../../../store/useAppStore'

interface Message {
  role: 'user' | 'ai'
  content: string
  typing?: boolean
}

const SUGGESTIONS = [
  { icon: '💡', text: 'Explain this EDI file' },
  { icon: '🔍', text: 'What do the segments mean?' },
  { icon: '⚠️', text: 'Are there any issues?' },
]

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const roughRef = useRef<SVGSVGElement>(null)
  const underlineRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const { parseResult, transactionType } = useAppStore()

  useEffect(() => {
    if (!roughRef.current || !containerRef.current) return
    const svg = roughRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    const w = containerRef.current.offsetWidth
    const h = containerRef.current.offsetHeight
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    svg.appendChild(rc.rectangle(2, 2, w - 4, h - 4, {
      roughness: 1.5, strokeWidth: 2, stroke: '#1A1A2E', fill: 'none',
    }))
  })

  useEffect(() => {
    if (!underlineRef.current) return
    const svg = underlineRef.current
    svg.innerHTML = ''
    const rc = rough.svg(svg)
    svg.appendChild(rc.line(0, 3, 160, 3, { roughness: 2, strokeWidth: 2.5, stroke: '#4ECDC4' }))
  }, [])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'ai', content: '', typing: true }])

    try {
      const apiUrl = 'https://edi-parser-production.up.railway.app'
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: msg, 
          parseResult: parseResult, 
          transactionType: transactionType 
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to connect to AI backend.')
      }

      const data = await res.json()
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'ai', content: data.reply, typing: false } : m
      ))
    } catch (err: any) {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'ai', content: `⚠️ Error: ${err.message}`, typing: false } : m
      ))
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: 'white',
        borderRadius: 14,
        padding: '20px 24px',
        boxShadow: '4px 4px 0px #1A1A2E',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      <svg ref={roughRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: '#1A1A2E' }}>
          🤖 Ask About This File
        </div>
        <svg ref={underlineRef} width={170} height={8} style={{ display: 'block', marginTop: 2 }} />
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 260,
          background: '#FAFAF8',
          borderRadius: 10,
          margin: '12px 0',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: 12, color: 'rgba(26,26,46,0.45)', marginBottom: 4 }}>
              Try asking...
            </span>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s.icon + ' ' + s.text)}
                style={{
                  background: 'white',
                  border: '1.5px solid rgba(26,26,46,0.12)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'rgba(26,26,46,0.7)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
                className="chat-chip"
              >
                {s.icon} {s.text}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {m.role === 'ai' && (
                <span style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 700,
                  fontSize: 10,
                  color: '#4ECDC4',
                  marginBottom: 3,
                }}>
                  ✨ EDI Assistant
                </span>
              )}
              <div style={{
                background: m.role === 'user' ? '#1A1A2E' : 'white',
                color: m.role === 'user' ? 'white' : '#1A1A2E',
                border: m.role === 'ai' ? '1.5px solid rgba(26,26,46,0.1)' : 'none',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '8px 12px',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 400,
                fontSize: 13,
                maxWidth: m.role === 'user' ? '80%' : '85%',
              }}>
                {m.typing ? (
                  <span className="typing-dots">
                    <span>•</span><span>•</span><span>•</span>
                  </span>
                ) : m.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask anything about your EDI file..."
          style={{
            flex: 1,
            background: 'white',
            border: '2px solid rgba(26,26,46,0.15)',
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 13,
            color: '#1A1A2E',
            outline: 'none',
            transition: 'all 0.15s',
          }}
          className="chat-input"
        />
        <button
          onClick={() => send(input)}
          style={{
            width: 40,
            height: 40,
            background: '#1A1A2E',
            borderRadius: 10,
            border: '2px solid #1A1A2E',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            boxShadow: '3px 3px 0px rgba(0,0,0,0.2)',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          className="send-btn"
        >
          →
        </button>
      </div>
    </div>
  )
}
