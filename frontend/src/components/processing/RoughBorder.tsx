import { useEffect, useRef } from 'react';
import rough from 'roughjs/bin/rough'; // Or just 'roughjs' depending on your vite setup. If roughjs fails, import rough from 'roughjs';

export function RoughBorder({
  roughness = 1.5,
  strokeWidth = 2,
  stroke = '#1A1A2E',
  borderRadius = 12,
}: {
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  borderRadius?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    let animationFrameId: number;
    let resizeObserver: ResizeObserver;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const width = parent.offsetWidth;
      const height = parent.offsetHeight;
      
      // Need to account for retina displays
      const dpr = window.devicePixelRatio || 1;
      
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // rough might not be exported as default correctly depending on module. 
        // @ts-ignore
        const rgh = rough.default || rough;
        const rc = rgh.canvas(canvas);
        const r = borderRadius;

        if (r > 0) {
          rc.path(
            `M ${r} 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width} ${r} L ${width} ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 0 ${height - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
            {
              roughness,
              strokeWidth,
              stroke,
              fill: 'transparent',
              bowing: 1,
              seed: 42,
            }
          );
        } else {
          rc.rectangle(0, 0, width, height, {
            roughness,
            strokeWidth,
            stroke,
            fill: 'transparent',
            bowing: 1,
            seed: 42,
          });
        }
      }
    };

    resizeObserver = new ResizeObserver(() => {
      animationFrameId = requestAnimationFrame(draw);
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    draw();

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [roughness, strokeWidth, stroke, borderRadius]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        borderRadius: `${borderRadius}px`
      }}
    />
  );
}
