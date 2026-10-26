import { useEffect, useRef, useState } from 'react';
import type { JlptLevel, JlptResourceInput, JlptResourceKind, JlptResourceOption, JlptResourceSearch } from '@nihongo/shared/contracts/jlpt';
import type { AdminRequest } from '../../shared/types';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { jlptLevels, resourceKey, resourceLabels } from './jlpt-editor-data';
import { button, input } from './ui';

export function JlptResourcePicker({ request, level, selected, canAdd, onSelect, onClose }: {
  request: AdminRequest; level: JlptLevel; selected: JlptResourceInput[];
  canAdd: boolean; onSelect: (item: JlptResourceOption) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<JlptResourceKind>('kanji'), [q, setQ] = useState(''), [filterLevel, setFilterLevel] = useState<string>(level);
  const [page, setPage] = useState(1), [result, setResult] = useState<JlptResourceSearch | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current, controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ kind, q, page: String(page) });
      if (filterLevel && kind !== 'reading') query.set('level', filterLevel);
      request<JlptResourceSearch>(`/admin/jlpt/resources?${query}`, { signal: controller.signal })
        .then(value => { if (current === generation.current) setResult(value); })
        .catch(caught => { if (current === generation.current) setError(caught instanceof Error ? caught.message : 'Chưa tải được nội dung.'); })
        .finally(() => { if (current === generation.current) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); generation.current++; controller.abort(); };
  }, [request, kind, q, page, filterLevel, attempt]);
  const selectedKeys = new Set(selected.map(resourceKey));
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return <AdminDialog title="Chọn nội dung cho buổi học" onClose={onClose}>
    <p className="mb-4 text-sm leading-6 text-slate-600">Chọn nội dung đã xuất bản trong kho học. Lộ trình giữ liên kết đến nội dung gốc; sửa kiến thức tại kho tương ứng.</p>
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
      <label className="text-sm">Loại nội dung<select className={input} value={kind} onChange={event => { setKind(event.target.value as JlptResourceKind); setPage(1); }}>{Object.entries(resourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm">Cấp độ<select className={input} value={kind === 'reading' ? '' : filterLevel} disabled={kind === 'reading'} onChange={event => { setFilterLevel(event.target.value); setPage(1); }}><option value="">Tất cả cấp độ</option>{jlptLevels.map(value => <option key={value}>{value}</option>)}</select>{kind === 'reading' && <span className="mt-1 block text-xs text-slate-500">Kho bài đọc hiện chưa phân loại JLPT.</span>}</label>
      <label className="text-sm">Tìm trong kho<input className={input} placeholder="Tên, chữ hoặc nội dung…" value={q} maxLength={100} onChange={event => { setQ(event.target.value); setPage(1); }} /></label>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button className="underline" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></p>}
    {!canAdd && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Đã đạt giới hạn 200 liên kết mỗi buổi hoặc 2.000 liên kết mỗi lộ trình. Bỏ một liên kết trước khi thêm tiếp.</p>}
    <div className="min-h-40 divide-y divide-slate-200 rounded-lg border border-slate-200">
      {loading ? <p role="status" className="p-6 text-center text-sm text-slate-500">Đang tìm nội dung…</p> : result && !result.items.length ? <p className="p-6 text-center text-sm text-slate-500">Chưa có nội dung đã xuất bản khớp bộ lọc. Thử cấp độ khác hoặc xuất bản nội dung tại kho tương ứng.</p> : result?.items.map(item => <div key={resourceKey(item)} className="flex items-center justify-between gap-4 p-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 break-words text-xs leading-5 text-slate-500">{item.subtitle}{item.level ? ` · ${item.level}` : ''}</p></div>
        <button type="button" className={`${button} shrink-0`} disabled={!canAdd || !item.available || selectedKeys.has(resourceKey(item))} onClick={() => onSelect(item)}>{selectedKeys.has(resourceKey(item)) ? 'Đã chọn' : 'Thêm'}</button>
      </div>)}
    </div>
    {result && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{result.total} mục · Trang {result.page}/{pages}</span><div className="flex gap-2"><button className={button} disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><button className={button} disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Sau</button></div></div>}
    <div className="mt-5 flex justify-end"><button className={button} onClick={onClose}>Xong</button></div>
  </AdminDialog>;
}
