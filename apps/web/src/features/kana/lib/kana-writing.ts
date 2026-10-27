export interface WritingPoint { x: number; y: number; }

export interface WritingBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Keep strokes independent of the canvas's CSS size and backing resolution. */
export function normalizeWritingPoint(clientX: number, clientY: number, bounds: WritingBounds): WritingPoint | null {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
  };
}

export function writingCanvasSize(width: number, height: number, devicePixelRatio: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    width,
    height,
    pixelWidth: Math.max(1, Math.round(width * ratio)),
    pixelHeight: Math.max(1, Math.round(height * ratio)),
  };
}
