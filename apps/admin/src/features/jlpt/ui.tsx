import { ArrowDown, ArrowUp } from 'lucide-react';

export const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
export const primary = `${button} !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700`;
export const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100';
export const panel = 'rounded-xl border border-slate-200 bg-white p-5';

export function OrderButtons({ index, length, label, onMove }: { index: number; length: number; label: string; onMove: (offset: -1 | 1) => void }) {
  return <div className="flex gap-1">
    <button type="button" className={button} disabled={index === 0} aria-label={`Đưa ${label} lên`} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
    <button type="button" className={button} disabled={index === length - 1} aria-label={`Đưa ${label} xuống`} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
  </div>;
}
