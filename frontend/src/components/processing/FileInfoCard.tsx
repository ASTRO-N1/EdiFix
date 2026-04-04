import { RoughBorder } from './RoughBorder';

interface FileInfoCardProps {
  fileName: string;
  fileSize: number;
  transactionType: string | null;
  hasError: boolean;
}

export function FileInfoCard({
  fileName,
  fileSize,
  transactionType,
  hasError,
}: FileInfoCardProps) {
  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Bytes`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '4px 4px 0px #1A1A2E',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <RoughBorder roughness={1.5} strokeWidth={2} stroke="#1A1A2E" borderRadius={12} />

      {/* ROW 1 — File name */}
      <div
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 700,
          fontSize: '15px',
          color: '#1A1A2E',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title={fileName}
      >
        📄 {fileName}
      </div>

      {/* ROW 2 — File size */}
      <div
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 400,
          fontSize: '13px',
          color: '#1A1A2E',
          opacity: 0.6,
        }}
      >
        {formatBytes(fileSize)}
      </div>

      {/* ROW 3 — Detection state */}
      <div style={{ marginTop: '4px' }}>
        {hasError ? (
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: '13px', color: '#FF6B6B' }}>
            ❌ Parse Failed
          </div>
        ) : transactionType ? (
          <div
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 600,
              fontSize: '13px',
              color: '#4ECDC4',
              animation: 'popIn 0.4s ease forwards',
            }}
          >
            ✅ {transactionType}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid #4ECDC4',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 400, fontSize: '13px', color: '#4ECDC4' }}>
              Detecting transaction type...
            </span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
