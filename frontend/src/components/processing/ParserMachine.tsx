import { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface ParserMachineProps {
  isError?: boolean;
}

export default function ParserMachine({ isError = false }: ParserMachineProps) {
  const [stars, setStars] = useState<{ id: number; x: number; y: number }[]>([]);
  const machineControls = useAnimation();
  const [isHovered, setIsHovered] = useState(false);

  // Auto clean up stars
  useEffect(() => {
    if (stars.length > 0) {
      const timer = setTimeout(() => {
        setStars((prev) => prev.slice(1));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [stars]);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Prevent standard machine click if clicking the background
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 480;
    const y = ((e.clientY - rect.top) / rect.height) * 420;
    
    // Only spawn star if not clicking roughly on the machine bounds
    if (x < 120 || x > 360 || y < 80 || y > 300) {
      setStars((prev) => [...prev, { id: Date.now(), x, y }]);
    }
  };

  const handleMachineClick = (e: React.MouseEvent<SVGRectElement | SVGPathElement>) => {
    e.stopPropagation(); // Don't trigger canvas click
    machineControls.start({
      scale: [1, 1.08, 0.96, 1.02, 1],
      transition: { duration: 0.5, type: 'spring' }
    });
    
    // Add burst from center of machine
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
             setStars((prev) => [...prev, { 
                id: Date.now() + i, 
                x: 240 + (Math.random() - 0.5) * 100, 
                y: 190 + (Math.random() - 0.5) * 100 
             }]);
        }, i * 50);
    }
  };

  const segments = [
    "ISA*00*          *00*...",
    "GS*HC*SENDER*REC...",  
    "ST*837*0001*005...",
    "BHT*0019*00*CLM...",
    "NM1*85*2*ACME...",
    "CLM*CLM001*1500...",
    "SV1*HC:99213*150...",
    "HI*ABK:Z0000...",
    "NM1*IL*1*DOE*J...",
    "DTP*472*D8*2026..."
  ];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="relative w-full max-w-lg aspect-square">
        <svg 
            viewBox="0 0 480 420" 
            className="w-full h-full"
            onClick={handleCanvasClick}
            style={{ cursor: 'crosshair' }}
        >
          <defs>
            <clipPath id="screen-clip">
              <rect x="160" y="120" width="160" height="100" rx="8" />
            </clipPath>
            {/* Soft glow filter on hover */}
            <filter id="glow">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#4ECDC4" floodOpacity={isHovered ? 0.5 : 0} />
            </filter>
          </defs>

          {/* BACKGROUND ANIMATED STARS */}
          <motion.path d="M110,54 L112,58 L116,58 L113,61 L114,65 L110,63 L106,65 L107,61 L104,58 L108,58 Z" fill="none" stroke="#FFE66D" strokeWidth="1.5"
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 2, repeat: Infinity, delay: 0 }} />
          <motion.path d="M370,292 L373,298 L379,298 L374,302 L376,308 L370,305 L364,308 L366,302 L361,298 L367,298 Z" fill="none" stroke="#FFE66D" strokeWidth="1.5"
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 2.8, repeat: Infinity, delay: 0.5 }} />
          <motion.path d="M420,125 L422,128 L425,128 L423,130 L424,133 L420,132 L416,133 L417,130 L415,128 L418,128 Z" fill="none" stroke="#FFE66D" strokeWidth="1.5"
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.8, repeat: Infinity, delay: 1 }} />

          {/* FLOATING ELEMENTS */}
          <motion.g animate={{ y: [0, -8, 0], rotate: [-8, -4, -8] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
            <rect x="60" y="68" width="60" height="24" rx="8" fill="#FF6B6B" transform="rotate(-8 90 80)" />
            <text x="90" y="84" fill="#FFFFFF" fontSize="10" fontFamily="Nunito" fontWeight="700" textAnchor="middle" transform="rotate(-8 90 80)">NM1</text>
          </motion.g>

          <motion.g animate={{ y: [0, -6, 0], rotate: [4, 8, 4] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
            <rect x="330" y="58" width="60" height="24" rx="8" fill="#4ECDC4" transform="rotate(6 360 70)" />
            <text x="360" y="74" fill="#FFFFFF" fontSize="10" fontFamily="Nunito" fontWeight="700" textAnchor="middle" transform="rotate(6 360 70)">CLM</text>
          </motion.g>

          <motion.g transform="translate(70 330)">
            <motion.g animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
              <circle cx="0" cy="0" r="18" fill="#95E1D3" stroke="#1A1A2E" strokeWidth="2" />
              <path d="M-6 0 L-2 4 L6 -4" fill="none" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
          </motion.g>

          {/* CENTRAL MACHINE GROUP */}
          <motion.g animate={machineControls} style={{ transformOrigin: '240px 190px' }}>
            {/* Machine excited bounce */}
            <motion.g animate={!isError ? { y: [0, -6, 0] } : {}} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}>
              
              {/* Legs */}
              <path d="M185 280 L175 320 L160 320" fill="none" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M215 280 L225 320 L240 320" fill="none" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

              {/* Body */}
              <path 
                d="M156 100 L324 100 C332.8 100 340 107.2 340 116 L340 264 C340 272.8 332.8 280 324 280 L156 280 C147.2 280 140 272.8 140 264 L140 116 C140 107.2 147.2 100 156 100 Z M137 110 L143 110 M337 270 L343 270" 
                fill="#FFFFFF" 
                stroke="#1A1A2E" 
                strokeWidth="3"
                filter="url(#glow)"
                onClick={handleMachineClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{ cursor: 'pointer' }}
              />

              {/* Arms */}
              {/* Left Arm with feeding document */}
              <motion.g animate={!isError ? { rotate: [-5, 5, -5] } : {}} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: '140px 160px' }}>
                <path d="M140 160 L100 180 L75 210" fill="none" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="55" y="200" width="30" height="38" fill="#FFE66D" stroke="#1A1A2E" strokeWidth="2" rx="2" transform="rotate(-15 70 219)" />
                <line x1="60" y1="210" x2="80" y2="210" stroke="#1A1A2E" strokeWidth="1" transform="rotate(-15 70 219)" />
                <line x1="60" y1="215" x2="75" y2="215" stroke="#1A1A2E" strokeWidth="1" transform="rotate(-15 70 219)" />
                <line x1="60" y1="220" x2="80" y2="220" stroke="#1A1A2E" strokeWidth="1" transform="rotate(-15 70 219)" />
              </motion.g>

              {/* Right Arm with stamp checkmark */}
              <motion.g style={{ transformOrigin: '340px 160px' }}>
                <path d="M340 160 L380 180" fill="none" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <motion.g animate={!isError ? { y: [0, -10, 0] } : {}} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}>
                    <path d="M380 180 L405 210" fill="none" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M398 208 L406 216 L422 200" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </motion.g>
              </motion.g>

              {/* Screen Area */}
              <rect x="160" y="120" width="160" height="100" rx="8" fill="#1A1A2E" />
              
              {/* Scrolling Text Group inside ClipPath */}
              <g clipPath="url(#screen-clip)">
                <motion.g animate={!isError ? { y: [0, -100] } : {}} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  {/* Render list twice for infinite loop effect */}
                  {[...segments, ...segments].map((text, i) => (
                    <text 
                      key={i} 
                      x="165" 
                      y={130 + (i * 10)} 
                      fill="#FFFFFF" 
                      fontSize="8" 
                      fontFamily="JetBrains Mono"
                      opacity={0.8}
                    >
                      {text}
                    </text>
                  ))}
                </motion.g>
              </g>

              {/* Face Details */}
              <motion.circle cx="185" cy="115" r="6" fill={isError ? "#FF6B6B" : "#FFE66D"} animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }} />
              <motion.circle cx="215" cy="115" r="6" fill={isError ? "#FF6B6B" : "#FFE66D"} animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }} />
              
              {isError ? (
                <path d="M170 245 Q 200 230 230 245" fill="none" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path 
                  d={isHovered ? "M170 235 Q 200 254 230 235" : "M170 235 Q 200 250 230 235"} 
                  fill="none" 
                  stroke="#1A1A2E" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  style={{ transition: 'all 0.3s ease' }}
                />
              )}
            </motion.g>
          </motion.g>

          {/* DYNAMIC CLICK SPARKLES */}
          {stars.map((star) => (
            <motion.path 
              key={star.id}
              d={`M${star.x-4},${star.y-10} L${star.x-1},${star.y-3} L${star.x+6},${star.y-3} L${star.x+1},${star.y+2} L${star.x+3},${star.y+9} L${star.x-4},${star.y+5} L${star.x-11},${star.y+9} L${star.x-9},${star.y+2} L${star.x-14},${star.y-3} L${star.x-7},${star.y-3} Z`}
              fill="none" 
              stroke="#FF6B6B"
              strokeWidth="2"
              initial={{ scale: 0, opacity: 1, rotate: Math.random() * 90 }}
              animate={{ scale: 1.5, opacity: 0, rotate: Math.random() * 180 }}
              transition={{ duration: 0.6 }}
            />
          ))}

        </svg>
      </div>

      <div className="flex flex-col items-center mt-2 pointer-events-none">
        <p className="text-[13px] font-nunito font-normal text-[#1A1A2E] opacity-50">
          Click me while you wait! 👆
        </p>
        <svg width="60" height="8" viewBox="0 0 60 8" className="mt-1">
          <path d="M2,4 Q15,-2 30,5 T58,4" fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
