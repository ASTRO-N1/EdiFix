import React, { useState } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import useAppStore from '../../store/useAppStore'

export default function AIChatPanel({ onMobileClose }: { onMobileClose?: () => void } = {}) {
  const [isOpen, setIsOpen] = useState(true)
  const [inputVal, setInputVal] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const { t, isDark } = useTheme()
  const { parseResult, transactionType } = useAppStore()

  const handleSend = async (text: string) => {
    if (!text.trim()) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setInputVal('')
    setIsTyping(true)

    try {
      const apiUrl = 'https://edi-parser-production.up.railway.app'
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          parseResult: parseResult,
          transactionType: transactionType
        })
      })

      if (!res.ok) {
        throw new Error('Failed to connect to AI backend.')
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ Error: ${err.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  if (!isOpen) {
    return (
      <div style={{
        width: 40,
        height: '100vh',
        background: t.bgSidebar,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        gap: 0,
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}>
        <button
          onClick={() => setIsOpen(true)}
          title="Open AI Chat"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'transparent',
            border: `1.5px solid ${t.border}`,
            color: t.teal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.teal
            e.currentTarget.style.color = t.ink
            e.currentTarget.style.borderColor = t.teal
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = t.teal
            e.currentTarget.style.borderColor = t.border
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </button>
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 600,
          fontSize: 10,
          color: t.inkFaint,
          letterSpacing: '0.12em',
          userSelect: 'none',
          marginTop: 16,
        }}>
          AI CHAT
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: 320,
      height: '100%',
      background: t.bgSidebar,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'background 0.2s',
    }}>
      <div style={{
        height: 64,
        minHeight: 64,
        maxHeight: 64,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 8,
        borderBottom: `1.5px solid ${isDark ? 'rgba(240,235,225,0.08)' : 'rgba(26,26,46,0.08)'}`,
      }}>
        <div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15, color: t.ink }}>
            🤖 AI Assistant
          </div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: 10, color: t.teal, marginTop: 1 }}>
            Powered by Gemini
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Mobile close button — only shown when in bottom-sheet mode */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              aria-label="Close AI panel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: t.inkMuted, display: 'flex', alignItems: 'center', minHeight: 44, minWidth: 44, justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {/* Desktop collapse button */}
          <button
            onClick={() => setIsOpen(false)}
            style={{
              width: 28, height: 28,
              background: 'transparent',
              border: `1.5px solid ${t.border}`,
              color: t.inkMuted,
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = t.ink;
              e.currentTarget.style.borderColor = t.ink;
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = t.inkMuted;
              e.currentTarget.style.borderColor = t.border;
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['💡 Explain this EDI file', '🔍 What do the segments mean?', '⚠️ Any issues with this file?'].map((chip, i) => (
              <div
                key={i}
                onClick={() => handleSend(chip)}
                className="chat-chip"
                style={{
                  background: t.bgChip,
                  border: `1.5px solid ${t.border}`,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 600,
                  fontSize: 13,
                  color: t.inkMuted,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: 12,
                fontFamily: 'Nunito, sans-serif',
                fontSize: 13,
                lineHeight: 1.5,
                background: m.role === 'user' ? t.ink : t.bgCard,
                color: m.role === 'user' ? t.bg : t.ink,
                border: m.role === 'ai' ? `1.5px solid ${t.border}` : 'none',
                borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: m.role === 'ai' ? 4 : 12,
              }}>
                {m.text}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: t.bgCard,
              border: `1.5px solid ${t.border}`,
              borderBottomLeftRadius: 4,
            }} className="typing-dots">
              <span style={{ color: t.teal }}>●</span>
              <span style={{ color: t.teal, margin: '0 2px' }}>●</span>
              <span style={{ color: t.teal }}>●</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 20, borderTop: `1px solid ${t.borderDash}` }}>
        <div style={{ position: 'relative' }}>
          <input
            className="chat-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend(inputVal)}
            placeholder="Ask AI anything..."
            style={{
              width: '100%',
              padding: '12px 48px 12px 16px',
              background: t.bgInput,
              border: `2px solid ${t.border}`,
              borderRadius: 10,
              fontFamily: 'Nunito, sans-serif',
              fontSize: 13,
              color: t.ink,
              outline: 'none',
              transition: 'all 0.2s',
            }}
          />
          <button
            onClick={() => handleSend(inputVal)}
            className="send-btn"
            style={{
              position: 'absolute',
              right: 6,
              top: 6,
              bottom: 6,
              width: 32,
              background: t.ink,
              color: t.bg,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ transform: 'rotate(-45deg)', fontSize: 14 }}>🚀</span>
          </button>
        </div>
      </div>
    </div>
  )
}
