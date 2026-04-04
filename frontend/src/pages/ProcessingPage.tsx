import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { RobotScene } from '../components/processing/RobotScene';
import { FileInfoCard } from '../components/processing/FileInfoCard';
import { ParseLog } from '../components/processing/ParseLog';
import { RoughBorder } from '../components/processing/RoughBorder';
//import { WaitingFigure } from '../components/landing/StickFigure';
import { useIsMobile } from '../hooks/useWindowWidth';

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { file, setParseResult, setTransactionType, transactionType } = useAppStore();
  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const parseFile = async () => {
    if (!file) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app';
      const res = await fetch(`${apiUrl}/api/v1/parse`, {
        method: 'POST',
        headers: { 'X-Internal-Bypass': 'frontend-ui-secret' },
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to parse file. Backend might be down.');
      const result = await res.json();
      setParseResult(result);
      const type = result.transaction_type ||
                   result.metadata?.transaction_type ||
                   result.file_info?.transaction_type ||
                   "EDI File";
      setTransactionType(type);
      setIsLoading(false);
    } catch (err: any) {
      setHasError(true);
      console.error(err.message || String(err));
      setIsLoading(false);
    }
  };

  const hasParseStarted = useRef(false);

  useEffect(() => {
    if (!file) { navigate('/'); return; }
    if (!hasParseStarted.current) { hasParseStarted.current = true; parseFile(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px',
      background: '#F5EFE0',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        minHeight: isMobile ? 'unset' : '580px',
        padding: isMobile ? '20px 16px' : '40px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'center' : 'center',
        gap: isMobile ? '24px' : '48px',
        background: '#F5EFE0',
        position: 'relative',
      }}>
        {/* Rough border — desktop only (hard to render correctly on narrow screens) */}
        {!isMobile && <RoughBorder roughness={1.0} strokeWidth={2.0} stroke="#4A4A6A" borderRadius={12} />}

        {/* Decorative doodles */}
        <svg style={{ position: 'absolute', top: 20, right: 20, width: 20, height: 20, transform: 'rotate(15deg)', pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#FFE66D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="pulse-star" />
        </svg>
        {!isMobile && (
          <svg style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, pointerEvents: 'none', opacity: 0.4, zIndex: 0 }} viewBox="0 0 40 40" fill="none">
            <circle cx="8" cy="32" r="4" fill="#4ECDC4" />
            <circle cx="20" cy="20" r="4" fill="#4ECDC4" />
            <circle cx="32" cy="8" r="4" fill="#4ECDC4" />
          </svg>
        )}

        <style>{`
          @keyframes pulseStar {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          .pulse-star { animation: pulseStar 2s infinite ease-in-out; }
        `}</style>

        {/* LEFT / TOP — Robot scene + WaitingFigure */}
        <div style={{
          flex: isMobile ? 'none' : '0 0 50%',
          width: isMobile ? '100%' : undefined,
          height: isMobile ? '280px' : '500px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          position: 'relative',
          zIndex: 1,
        }}>
          <RobotScene />
          {/* WaitingFigure doodle beside robot — visible on all screen sizes */}
          
        </div>

        {/* RIGHT / BOTTOM — File info + parse log */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          width: isMobile ? '100%' : undefined,
        }}>
          <FileInfoCard
            fileName={file?.name || 'Unknown File'}
            fileSize={file?.size || 0}
            transactionType={transactionType}
            hasError={hasError}
          />
          <ParseLog
            isLoading={isLoading}
            hasError={hasError}
            onRetry={parseFile}
            onComplete={() => navigate('/workspace')}
            transactionType={transactionType}
          />
        </div>
      </div>
    </div>
  );
}
