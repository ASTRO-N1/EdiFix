import { useEffect, useRef, useState } from 'react';
import { RoughBorder } from './RoughBorder';

interface ParseLogProps {
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onComplete: () => void;
  transactionType?: string | null;
}

export function ParseLog({
  isLoading,
  hasError,
  onRetry,
  onComplete,
  transactionType,
}: ParseLogProps) {
  const [logIndex, setLogIndex] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);

  const entries = [
    { text: "ISA envelope detected", icon: "✅", color: "#4ECDC4" },
    { text: "Interchange separators identified", icon: "✅", color: "#4ECDC4" },
    { text: `Transaction type: ${transactionType || 'detecting...'}`, icon: "✅", color: "#4ECDC4" },
    { text: "Schema loaded successfully", icon: "✅", color: "#4ECDC4" },
    { text: "Parsing segment hierarchy...", icon: "⚙️", color: "#FFE66D" },
    { text: "Validating NPI identifiers...", icon: "⚙️", color: "#FFE66D" },
    { text: "Cross-checking ICD-10 codes...", icon: "⚙️", color: "#FFE66D" },
    { text: "Validating CARC / RARC codes...", icon: "⚙️", color: "#FFE66D" },
    { text: "Reconciling claim amounts...", icon: "⚙️", color: "#FFE66D" },
    { text: "Loop hierarchy mapped", icon: "✅", color: "#4ECDC4" },
    { text: "Parse complete ✓", icon: "✅", color: "#4ECDC4" },
  ];

  useEffect(() => {
    if (isLoading && !hasError) {
      setLogIndex(-1);
    }
  }, [isLoading, hasError]);

  useEffect(() => {
    if (isLoading && !hasError && logIndex < entries.length - 1) {
      const ms = Math.random() * 100 + 180;
      const nextIndex = logIndex + 1;
      
      const timer = setTimeout(() => {
        setLogIndex(nextIndex);
      }, ms);
      return () => clearTimeout(timer);
    } else if (!isLoading && !hasError && logIndex < entries.length - 1) {
        setLogIndex(entries.length - 1);
    }
  }, [isLoading, hasError, logIndex, entries.length]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logIndex]);

  if (hasError) {
    return (
      <div
        style={{
          background: '#FFF5F5',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '4px 4px 0px #FF6B6B',
          position: 'relative',
        }}
      >
        <RoughBorder roughness={0.8} strokeWidth={1.5} stroke="#FF6B6B" borderRadius={12} />
        
        <div style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: '16px', color: '#FF6B6B' }}>
          😔  Couldn't connect to parser
        </div>
        
        <div style={{ fontFamily: 'Nunito', fontWeight: 400, fontSize: '13px', color: '#1A1A2E', opacity: 0.7, marginTop: '8px' }}>
          The parser service couldn't be reached. This may be a temporary issue — please try again in a moment.
        </div>
        
        <div style={{ 
          background: '#1A1A2E', 
          borderRadius: '8px', 
          padding: '10px 14px', 
          marginTop: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#FFE66D'
        }}>
          Error: Could not connect to the parse engine
        </div>
        
        <button
          className="error-retry-btn"
          onClick={onRetry}
          style={{
            marginTop: '16px',
            background: '#FF6B6B',
            color: 'white',
            fontFamily: 'Nunito',
            fontWeight: 700,
            fontSize: '14px',
            padding: '10px 28px',
            borderRadius: '8px',
            border: '2px solid #1A1A2E',
            boxShadow: '3px 3px 0px #1A1A2E',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Try Again
        </button>
        <style>{`
          .error-retry-btn:hover {
            transform: translateY(-2px);
            box-shadow: 5px 5px 0px #1A1A2E !important;
          }
        `}</style>
      </div>
    );
  }

  const percent = logIndex >= 0 ? Math.min(100, (logIndex + 1) * 9.1) : 0;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          borderRadius: '14px',
          boxShadow: '4px 4px 0px #1A1A2E',
          position: 'relative',
        }}
      >
        <RoughBorder roughness={0.8} strokeWidth={1.5} stroke="#4A4A6A" borderRadius={14} />
        
        <div style={{
          height: '36px',
          background: '#2A2A3E',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: '8px',
          position: 'relative',
          zIndex: 1,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
        }}>
          <div style={{ width: '12px', height: '12px', background: '#FF6B6B', borderRadius: '50%', marginRight: '8px' }} />
          <div style={{ width: '12px', height: '12px', background: '#FFE66D', borderRadius: '50%', margin: '-8px' }} />
          <div style={{ width: '12px', height: '12px', background: '#4ECDC4', borderRadius: '50%', marginLeft: '8px' }} />
          
          <span style={{ 
            fontFamily: 'Nunito', 
            fontWeight: 400, 
            fontSize: '12px', 
            color: 'white', 
            opacity: 0.4,
            marginLeft: '8px'
          }}>
            parser.log
          </span>
        </div>
        
        <div 
          ref={logRef}
          style={{
            background: '#1A1A2E',
            padding: '14px 16px',
            height: '220px',
            overflowY: 'auto',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {entries.map((entry, idx) => (
            idx <= logIndex && (
              <div 
                key={idx}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  lineHeight: 1.9,
                  color: entry.color,
                  animation: 'slideFadeIn 0.2s ease forwards',
                  opacity: 0,
                  transform: 'translateX(-8px)',
                }}
              >
                <span style={{ marginRight: '8px' }}>{entry.icon}</span>
                {entry.text}
              </div>
            )
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: '14px', color: '#1A1A2E', marginBottom: '8px' }}>
          Analysing your file...
        </div>
        <div style={{
          height: '22px',
          background: '#FFFFFF',
          borderRadius: '999px',
          border: '2px solid #1A1A2E',
          boxShadow: '3px 3px 0px #1A1A2E',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            background: 'linear-gradient(90deg, #4ECDC4, #95E1D3)',
            height: '100%',
            borderRadius: '999px',
            width: `${Math.round(percent)}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{
          fontFamily: 'Nunito',
          fontWeight: 700,
          fontSize: '13px',
          color: '#1A1A2E',
          textAlign: 'right',
          marginTop: '4px'
        }}>
          {Math.round(percent)}%
        </div>

        {percent >= 100 && (
          <button
            onClick={onComplete}
            style={{
              width: '100%',
              marginTop: '16px',
              background: '#FFE66D',
              color: '#1A1A2E',
              border: '2px solid #1A1A2E',
              borderRadius: '12px',
              padding: '16px',
              fontFamily: 'Nunito',
              fontWeight: 800,
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '4px 4px 0px #1A1A2E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              animation: 'slideUpBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '6px 6px 0px #1A1A2E'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '4px 4px 0px #1A1A2E'
            }}
          >
            Let's Go! 🚀
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideFadeIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideUpBounce {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
