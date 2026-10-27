import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Eye, EyeOff, RotateCcw, Undo2 } from 'lucide-react';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import { normalizeWritingPoint, writingCanvasSize, type WritingPoint } from '../lib/kana-writing';

export interface KanaDrawingCanvasProps {
  glyph: string;
  resetKey?: string | number;
}

export function KanaDrawingCanvas({ glyph, resetKey }: KanaDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<WritingPoint[][]>([]);
  const activePointer = useRef<number | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [displayWidth, setDisplayWidth] = useState(320);
  const descriptionId = useId();

  const repaint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const size = writingCanvasSize(bounds.width, bounds.height, window.devicePixelRatio);
    const context = canvas.getContext('2d');
    if (!size || !context) return;
    if (canvas.width !== size.pixelWidth) canvas.width = size.pixelWidth;
    if (canvas.height !== size.pixelHeight) canvas.height = size.pixelHeight;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(size.pixelWidth / size.width, 0, 0, size.pixelHeight / size.height, 0, 0);
    context.strokeStyle = '#0094ff';
    context.fillStyle = '#0094ff';
    context.lineWidth = Math.max(2, Math.min(size.width, size.height) * 0.014);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const points of strokes.current) {
      if (!points.length) continue;
      context.beginPath();
      const first = points[0];
      if (points.length === 1) {
        context.arc(first.x * size.width, first.y * size.height, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(first.x * size.width, first.y * size.height);
        for (const point of points.slice(1)) context.lineTo(point.x * size.width, point.y * size.height);
        context.stroke();
      }
    }
  };

  const finishStroke = () => {
    const pointerId = activePointer.current;
    activePointer.current = null;
    const canvas = canvasRef.current;
    if (pointerId !== null && canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    setDrawing(false);
  };

  useLayoutEffect(() => {
    finishStroke();
    strokes.current = [];
    setStrokeCount(0);
    repaint();
  }, [glyph, resetKey]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.getBoundingClientRect().width;
      if (width > 0) setDisplayWidth(width);
      repaint();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) finishStroke(); };
    window.addEventListener('blur', finishStroke);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', finishStroke);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const addPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = normalizeWritingPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const stroke = strokes.current[strokes.current.length - 1];
    if (!point || !stroke) return;
    const last = stroke[stroke.length - 1];
    if (!last || point.x !== last.x || point.y !== last.y) stroke.push(point);
    repaint();
  };

  const startStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || event.button !== 0 || activePointer.current !== null) return;
    const point = normalizeWritingPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    strokes.current.push([point]);
    setStrokeCount(strokes.current.length);
    setDrawing(true);
    repaint();
  };

  const buttonClass = 'px-3 py-2 text-xs font-bold text-[#57534e] disabled:cursor-default disabled:opacity-40';
  return <div className="space-y-3">
    <p id={descriptionId} className="text-xs text-[#78716c]">Dùng chuột, bút hoặc cảm ứng để luyện viết theo chữ mẫu.</p>
    <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7}
      className="mx-auto aspect-square w-full max-w-[400px] overflow-hidden">
      <div className="relative h-full w-full">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 h-full border-l border-dashed border-[#78643c]/30" />
          <div className="absolute top-1/2 w-full border-t border-dashed border-[#78643c]/30" />
          {showGuide && <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="font-kanji select-none leading-none text-[#78716c]/25"
              style={{ fontSize: displayWidth * (Array.from(glyph).length > 1 ? 0.4 : 0.65) }}>{glyph}</span>
          </div>}
        </div>
        <canvas ref={canvasRef} role="img" aria-label={`Vùng luyện viết ${glyph}`} aria-describedby={descriptionId}
          onPointerDown={startStroke}
          onPointerMove={event => { if (activePointer.current === event.pointerId) { event.preventDefault(); addPoint(event); } }}
          onPointerUp={event => { if (activePointer.current === event.pointerId) { addPoint(event); finishStroke(); } }}
          onPointerCancel={event => { if (activePointer.current === event.pointerId) finishStroke(); }}
          onLostPointerCapture={event => { if (activePointer.current === event.pointerId) finishStroke(); }}
          className="absolute inset-0 block h-full w-full touch-none cursor-crosshair">
          Vùng vẽ tự do cho chữ {glyph}.
        </canvas>
      </div>
    </RoughCard>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <RoughButton type="button" disabled={drawing || strokeCount === 0} className={buttonClass} borderRadius={8}
        onClick={() => { strokes.current.pop(); setStrokeCount(strokes.current.length); repaint(); }}>
        <Undo2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Hoàn tác
      </RoughButton>
      <RoughButton type="button" disabled={drawing || strokeCount === 0} className={buttonClass} borderRadius={8}
        onClick={() => { strokes.current = []; setStrokeCount(0); repaint(); }}>
        <RotateCcw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Xóa nét
      </RoughButton>
      <RoughButton type="button" aria-pressed={showGuide} aria-label="Hiện chữ mẫu" className={buttonClass} borderRadius={8}
        onClick={() => setShowGuide(value => !value)}>
        {showGuide ? <EyeOff aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
        {showGuide ? 'Ẩn chữ mẫu' : 'Hiện chữ mẫu'}
      </RoughButton>
    </div>
  </div>;
}
