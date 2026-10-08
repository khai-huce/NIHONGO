import { useRef, useState } from 'react';
import type { ShadowingDraftInput } from '@nihongo/shared/contracts/shadowing';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { formatShadowingTime, parseTranscriptImport } from './shadowing-editor-data';

const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50';
export function ShadowingImport({ onClose, onApply }: { onClose: () => void; onApply: (rows: ShadowingDraftInput['sentences']) => void }) {
  const [format, setFormat] = useState<'json' | 'srt' | 'vtt'>('json'), [text, setText] = useState(''), [error, setError] = useState('');
  const [rows, setRows] = useState<ShadowingDraftInput['sentences'] | null>(null), [checked, setChecked] = useState(false), [reading, setReading] = useState(false);
  const fileRun = useRef(0);
  const clearPreview = () => { setRows(null); setChecked(false); setError(''); };
  const close = () => { fileRun.current++; onClose(); };
  return <AdminDialog title="Nhập phụ đề JSON / SRT / VTT" onClose={close} busy={reading}>
    <p className="mb-4 text-sm text-slate-600">Xem trước rồi xác nhận thay toàn bộ phụ đề trong bản đang nhập. Chưa lưu lên máy chủ; bản công khai giữ nguyên.</p>
    <div className="mb-4 flex flex-wrap gap-3"><select aria-label="Định dạng phụ đề" className={button} disabled={reading} value={format} onChange={event => { setFormat(event.target.value as typeof format); clearPreview(); }}><option value="json">JSON</option><option value="srt">SRT</option><option value="vtt">WebVTT</option></select><label className={`${button} cursor-pointer`}>Chọn tệp<input type="file" accept=".json,.srt,.vtt,text/plain,application/json,text/vtt" className="sr-only" disabled={reading} onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return; const run = ++fileRun.current; clearPreview(); setReading(true);
      try { if (file.size > 1024 * 1024) throw new Error('Tệp quá lớn (tối đa 1 MiB).'); const data = await file.text(); if (run !== fileRun.current) return; const extension = file.name.split('.').at(-1)?.toLowerCase(); if (extension === 'json' || extension === 'srt' || extension === 'vtt') setFormat(extension); setText(data); }
      catch (caught) { if (run === fileRun.current) setError(caught instanceof Error ? caught.message : 'Không đọc được tệp.'); }
      finally { if (run === fileRun.current) setReading(false); }
    }} /></label></div>
    <p className="mb-2 text-xs text-slate-500">JSON: danh sách câu hoặc {`{ "sentences": [...] }`}; mỗi câu gồm startMs, endMs, text và translationVi (tùy chọn). Mốc thời gian tính bằng mili giây. ID câu mới được tạo khi nhập.</p>
    <textarea aria-label="Nội dung phụ đề nhập" className="h-56 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs" disabled={reading} value={text} onChange={event => { setText(event.target.value); clearPreview(); }} />
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    <button className={`${button} mt-3`} disabled={reading || !text.trim()} onClick={() => { try { setRows(parseTranscriptImport(text, format)); setError(''); setChecked(false); } catch (caught) { setRows(null); setError(caught instanceof Error ? caught.message : 'Phụ đề không hợp lệ.'); } }}>Xem trước phụ đề</button>
    {rows && <div className="mt-5 border-t pt-4"><p className="mb-3 text-sm font-semibold">{rows.length} câu hợp lệ · Kết thúc phụ đề: {formatShadowingTime(rows.at(-1)!.endMs)}</p><div className="max-h-72 space-y-3 overflow-y-auto">{rows.map((row, index) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="text-xs text-slate-500">#{index + 1} · {formatShadowingTime(row.startMs)} → {formatShadowingTime(row.endMs)}</p><p className="mt-1 whitespace-pre-wrap">{row.text}</p><p className="mt-1 whitespace-pre-wrap text-slate-500">{row.translationVi || 'Chưa có bản dịch.'}</p></div>)}</div><label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Tôi đã kiểm tra và muốn thay phụ đề đang nhập bằng {rows.length} câu này.</label><button className={`${button} bg-blue-600 text-white`} disabled={!checked} onClick={() => onApply(rows)}>Dùng phụ đề này</button></div>}
  </AdminDialog>;
}
