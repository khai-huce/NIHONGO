import React, { useLayoutEffect, useRef, useState, useMemo } from 'react';
import rough from 'roughjs';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface RoughCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  borderRadius?: number;
  seed?: number;
  shadow?: boolean;
  active?: boolean;
}

export interface RoughButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  borderRadius?: number;
  seed?: number;
  active?: boolean;
}

export interface RoughNoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  fill?: string;
  stroke?: string;
}

// ---------------------------------------------------------------------------
// HELPER: Generate smooth rounded rectangle SVG path
// ---------------------------------------------------------------------------
export function createRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const radius = Math.max(0, Math.min(r, (w - 2) / 2, (h - 2) / 2));
  if (radius <= 0) {
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }
  return (
    `M ${x + radius} ${y} ` +
    `L ${x + w - radius} ${y} ` +
    `A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} ` +
    `L ${x + w} ${y + h - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h} ` +
    `L ${x + radius} ${y + h} ` +
    `A ${radius} ${radius} 0 0 1 ${x} ${y + h - radius} ` +
    `L ${x} ${y + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y} Z`
  );
}

// ---------------------------------------------------------------------------
// ROUGH CARD (Authentic SVG Hand-Drawn Sketch Box with Smooth Rounded Corners)
// ---------------------------------------------------------------------------
export const RoughCard: React.FC<RoughCardProps> = ({
  children,
  className = '',
  fill = '#ffffff',
  stroke = '#292524',
  strokeWidth = 1.3,
  roughness = 0.7,
  bowing = 0.6,
  borderRadius = 14,
  seed,
  shadow = true,
  active = false,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      if (!containerRef.current) return;
      const w = Math.round(containerRef.current.offsetWidth);
      const h = Math.round(containerRef.current.offsetHeight);
      if (w > 0 && h > 0) {
        setDims(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Compute deterministic seed so paths do not flicker or jump
  const resolvedSeed = useMemo(() => {
    if (seed !== undefined) return seed;
    if (dims.width === 0) return 12345;
    return (Math.floor(dims.width * 17 + dims.height * 31) % 100000) + 1;
  }, [seed, dims.width, dims.height]);

  // Generate SVG Paths using Rough.js generator with organic rounded path
  const svgPaths = useMemo(() => {
    if (dims.width <= 4 || dims.height <= 4) return [];
    try {
      const gen = rough.generator();
      const pad = 3;
      const pathStr = createRoundedRectPath(
        pad, 
        pad, 
        dims.width - pad * 2, 
        dims.height - pad * 2, 
        borderRadius
      );
      const shape = gen.path(pathStr, {
        seed: resolvedSeed,
        roughness: roughness,
        bowing: bowing,
        stroke: stroke,
        strokeWidth: strokeWidth,
        fill: fill !== 'transparent' ? fill : undefined,
        fillStyle: 'solid'
      });
      return gen.toPaths(shape);
    } catch {
      return [];
    }
  }, [dims.width, dims.height, resolvedSeed, roughness, bowing, stroke, strokeWidth, fill, borderRadius]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${shadow ? 'filter drop-shadow-[2px_2.5px_0px_rgba(41,37,36,0.8)]' : ''} ${className}`}
      {...props}
    >
      {/* Background Hand-drawn SVG Container */}
      {dims.width > 0 && dims.height > 0 && (
        <svg
          className="pointer-events-none absolute -inset-[3px] w-[calc(100%+6px)] h-[calc(100%+6px)] z-0 overflow-visible"
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          {svgPaths.map((p, idx) => (
            <path
              key={idx}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Active outline accent */}
          {active && (
            <rect
              x={3}
              y={3}
              width={dims.width - 6}
              height={dims.height - 6}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth * 1.3}
              className="opacity-40"
              rx={borderRadius}
            />
          )}
        </svg>
      )}

      {/* Card Content Foreground */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ROUGH BUTTON (Authentic Hand-Drawn Sketch Button with Color Fill)
// ---------------------------------------------------------------------------
export const RoughButton: React.FC<RoughButtonProps> = ({
  children,
  className = '',
  fill = '#ffffff',
  stroke = '#292524',
  strokeWidth = 1.3,
  roughness = 0.7,
  bowing = 0.6,
  borderRadius = 12,
  seed,
  active = false,
  onClick,
  ...props
}) => {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!btnRef.current) return;
    const measure = () => {
      if (!btnRef.current) return;
      const w = Math.round(btnRef.current.offsetWidth);
      const h = Math.round(btnRef.current.offsetHeight);
      if (w > 0 && h > 0) {
        setDims(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(btnRef.current);

    return () => ro.disconnect();
  }, []);

  const resolvedSeed = useMemo(() => {
    if (seed !== undefined) return seed;
    if (dims.width === 0) return 9999;
    return (Math.floor(dims.width * 23 + dims.height * 47) % 100000) + 1;
  }, [seed, dims.width, dims.height]);

  const svgPaths = useMemo(() => {
    if (dims.width <= 4 || dims.height <= 4) return [];
    try {
      const gen = rough.generator();
      const pad = 3;
      const pathStr = createRoundedRectPath(
        pad,
        pad,
        dims.width - pad * 2,
        dims.height - pad * 2,
        borderRadius
      );
      const shape = gen.path(pathStr, {
        seed: resolvedSeed,
        roughness: roughness,
        bowing: bowing,
        stroke: stroke,
        strokeWidth: strokeWidth,
        fill: fill,
        fillStyle: 'solid'
      });
      return gen.toPaths(shape);
    } catch {
      return [];
    }
  }, [dims.width, dims.height, resolvedSeed, roughness, bowing, stroke, strokeWidth, fill, borderRadius]);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`relative cursor-pointer select-none transition-all active:scale-95 active:translate-y-0.5 filter drop-shadow-[1.5px_2px_0px_rgba(41,37,36,0.85)] ${className}`}
      {...props}
    >
      {dims.width > 0 && dims.height > 0 && (
        <svg
          className="pointer-events-none absolute -inset-[3px] w-[calc(100%+6px)] h-[calc(100%+6px)] z-0 overflow-visible"
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          {svgPaths.map((p, idx) => (
            <path
              key={idx}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// ROUGH NOTICE (Notice Banner matching media_1788715771652.png)
// ---------------------------------------------------------------------------
export const RoughNotice: React.FC<RoughNoticeProps> = ({
  children,
  className = '',
  fill = '#ffffff',
  stroke = '#292524',
  ...props
}) => {
  return (
    <RoughCard
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2}
      roughness={0.8}
      shadow={true}
      className={`p-2.5 md:p-3 text-xs md:text-sm font-bold text-amber-800 flex items-center gap-2 ${className}`}
      {...props}
    >
      {children}
    </RoughCard>
  );
};
