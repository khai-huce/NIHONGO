import React, { useLayoutEffect, useRef, useState, useMemo } from 'react';

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
// HELPER: Generate standard rounded rectangle SVG path (compatibility export)
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
// HELPER: Single continuous organic hand-drawn rounded path
// Guaranteed exactly 1 closed loop, smooth rounded corners, zero overlapping lines
// ---------------------------------------------------------------------------
export function createOrganicRoundedPath(
  w: number,
  h: number,
  r: number = 14,
  seed: number = 1
): string {
  if (w <= 4 || h <= 4) return '';

  const pad = 2.5;
  const pw = Math.max(1, w - pad * 2);
  const ph = Math.max(1, h - pad * 2);
  const maxR = Math.max(0, Math.min(r, (pw - 2) / 2, (ph - 2) / 2));

  let s = Math.abs(seed) || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return (s / 233280) * 2 - 1; // -1 to 1
  };

  // Subtle organic corner variations
  const rTL = Math.max(0, maxR + rnd() * 0.5);
  const rTR = Math.max(0, maxR + rnd() * 0.5);
  const rBR = Math.max(0, maxR + rnd() * 0.5);
  const rBL = Math.max(0, maxR + rnd() * 0.5);

  const topJitter = rnd() * 0.4;
  const rightJitter = rnd() * 0.4;
  const bottomJitter = rnd() * 0.4;
  const leftJitter = rnd() * 0.4;

  const x0 = pad;
  const y0 = pad;
  const x1 = pad + pw;
  const y1 = pad + ph;

  if (maxR <= 1) {
    return [
      'M', x0.toFixed(1), y0.toFixed(1),
      'Q', ((x0 + x1) / 2).toFixed(1), (y0 + topJitter).toFixed(1), x1.toFixed(1), y0.toFixed(1),
      'Q', (x1 + rightJitter).toFixed(1), ((y0 + y1) / 2).toFixed(1), x1.toFixed(1), y1.toFixed(1),
      'Q', ((x0 + x1) / 2).toFixed(1), (y1 + bottomJitter).toFixed(1), x0.toFixed(1), y1.toFixed(1),
      'Q', (x0 + leftJitter).toFixed(1), ((y0 + y1) / 2).toFixed(1), x0.toFixed(1), y0.toFixed(1),
      'Z'
    ].join(' ');
  }

  return [
    'M', (x0 + rTL).toFixed(1), y0.toFixed(1),
    'Q', ((x0 + x1) / 2).toFixed(1), (y0 + topJitter).toFixed(1), (x1 - rTR).toFixed(1), y0.toFixed(1),
    'A', rTR.toFixed(1), rTR.toFixed(1), '0 0 1', x1.toFixed(1), (y0 + rTR).toFixed(1),
    'Q', (x1 + rightJitter).toFixed(1), ((y0 + y1) / 2).toFixed(1), x1.toFixed(1), (y1 - rBR).toFixed(1),
    'A', rBR.toFixed(1), rBR.toFixed(1), '0 0 1', (x1 - rBR).toFixed(1), y1.toFixed(1),
    'Q', ((x0 + x1) / 2).toFixed(1), (y1 + bottomJitter).toFixed(1), (x0 + rBL).toFixed(1), y1.toFixed(1),
    'A', rBL.toFixed(1), rBL.toFixed(1), '0 0 1', x0.toFixed(1), (y1 - rBL).toFixed(1),
    'Q', (x0 + leftJitter).toFixed(1), ((y0 + y1) / 2).toFixed(1), x0.toFixed(1), (y0 + rTL).toFixed(1),
    'A', rTL.toFixed(1), rTL.toFixed(1), '0 0 1', (x0 + rTL).toFixed(1), y0.toFixed(1),
    'Z'
  ].join(' ');
}

// ---------------------------------------------------------------------------
// ROUGH CARD (Clean Organic Hand-Drawn Rounded Card - Single Stroke, No Overlap)
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

  const resolvedSeed = useMemo(() => {
    if (seed !== undefined) return seed;
    if (dims.width === 0) return 12345;
    return (Math.floor(dims.width * 17 + dims.height * 31) % 100000) + 1;
  }, [seed, dims.width, dims.height]);

  const pathD = useMemo(() => {
    if (dims.width <= 4 || dims.height <= 4) return '';
    return createOrganicRoundedPath(dims.width, dims.height, borderRadius, resolvedSeed);
  }, [dims.width, dims.height, borderRadius, resolvedSeed]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      {...props}
    >
      {/* Background Hand-drawn SVG Container */}
      {dims.width > 0 && dims.height > 0 && pathD && (
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-0 overflow-visible"
          style={shadow ? { filter: 'drop-shadow(2px 2.5px 0px rgba(41, 37, 36, 0.85))' } : undefined}
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          <path
            d={pathD}
            fill={fill !== 'transparent' ? fill : 'none'}
            stroke={stroke}
            strokeWidth={active ? strokeWidth * 1.5 : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
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
// ROUGH BUTTON (Clean Organic Hand-Drawn Rounded Button - Single Stroke)
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

  const pathD = useMemo(() => {
    if (dims.width <= 4 || dims.height <= 4) return '';
    return createOrganicRoundedPath(dims.width, dims.height, borderRadius, resolvedSeed);
  }, [dims.width, dims.height, borderRadius, resolvedSeed]);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`relative cursor-pointer select-none transition-all active:scale-95 active:translate-y-0.5 ${className}`}
      {...props}
    >
      {dims.width > 0 && dims.height > 0 && pathD && (
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-0 overflow-visible"
          style={{ filter: 'drop-shadow(1.5px 2px 0px rgba(41, 37, 36, 0.85))' }}
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          <path
            d={pathD}
            fill={fill}
            stroke={stroke}
            strokeWidth={active ? strokeWidth * 1.5 : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
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
      borderRadius={12}
      shadow={true}
      className={`p-2.5 md:p-3 text-xs md:text-sm font-bold text-amber-800 flex items-center gap-2 ${className}`}
      {...props}
    >
      {children}
    </RoughCard>
  );
};
