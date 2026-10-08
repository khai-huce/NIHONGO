import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ShadowingDetailResponse, ShadowingListResponse, ShadowingVideo, ShadowingVideoSummary } from '@nihongo/shared/contracts/shadowing';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { ShadowingEditor } from './ShadowingEditor';
import { formatShadowingTime } from './shadowing-editor-data';

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const labels = { draft: 'Bản nháp', published: 'Đã xuất bản', archived: 'Đã lưu trữ' };
export function ShadowingWorkspace({ request, onDirtyChange }: { request: AdminRequest; onDirtyChange: (dirty: boolean) => void }) {
  const [items, setItems] = useState<ShadowingVideoSummary[]>([]), [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const mounted = useRef(false), generation = useRef(0), navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; onDirtyChange(false); }; }, [onDirtyChange]);
  const reload = useCallback(async () => {
    const run = ++generation.current; setLoading(true); setError('');
    try {
      const [list, metadata] = await Promise.all([request<ShadowingListResponse>('/admin/shadowing/videos'), request<{ sources: ContentSource[] }>('/admin/content/sources')]);
      if (mounted.current && run === generation.current) { setItems(list.items); setSources(metadata.sources); }
    } catch (caught) { if (mounted.current && run === generation.current) setError(caught instanceof Error ? caught.message : 'Chưa tải được kho video.'); }
    finally { if (mounted.current && run === generation.current) setLoading(false); }
  }, [request]);
  useEffect(() => { void reload(); }, [reload]);
  const props = { request, sources, onDirtyChange,
    onClose: () => { onDirtyChange(false); navigate('/admin/shadowing'); },
    onSaved: (video: ShadowingVideo) => { setItems(rows => rows.some(row => row.id === video.id) ? rows.map(row => row.id === video.id ? video : row) : [video, ...rows]); },
    onSourceAdded: (source: ContentSource) => setSources(rows => rows.some(row => row.id === source.id) ? rows : [...rows, source]),
  };
  return <>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} <button className="underline" onClick={() => void reload()}>Thử tải lại</button></p>}
    <Routes>
      <Route index element={<ShadowingList items={items} loading={loading} failed={!!error} reload={() => void reload()} />} />
      <Route path="new" element={<ShadowingEditor key="new-shadowing" {...props} video={null} onSaved={video => { props.onSaved(video); onDirtyChange(false); navigate(`/admin/shadowing/${video.id}`, { replace: true }); }} />} />
      <Route path=":id" element={<EditorRoute {...props} />} />
      <Route path="*" element={<p>Không tìm thấy trang. <Link to="/admin/shadowing">Về kho Shadowing</Link></p>} />
    </Routes>
  </>;
}

function EditorRoute(props: Omit<Parameters<typeof ShadowingEditor>[0], 'video'>) {
  const { id } = useParams();
  const [video, setVideo] = useState<ShadowingVideo | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let live = true; setVideo(null); setError('');
    props.request<ShadowingDetailResponse>(`/admin/shadowing/videos/${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then(result => { if (live) setVideo(result.video); }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : 'Chưa tải được video.'); });
    return () => { live = false; controller.abort(); props.onDirtyChange(false); };
  }, [id, props.request, props.onDirtyChange, retry]);
  if (error) return <div role="alert"><p className="mb-4 text-red-700">{error}</p><button className={button} onClick={() => setRetry(value => value + 1)}>Tải lại video</button></div>;
  if (!video) return <p role="status">Đang tải video…</p>;
  return <ShadowingEditor key={video.id} {...props} video={video} onSaved={next => { setVideo(next); props.onSaved(next); }} />;
}

function ShadowingList({ items, loading, failed, reload }: { items: ShadowingVideoSummary[]; loading: boolean; failed: boolean; reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '', status = params.get('status') ?? '';
  const rows = items.filter(row => (!status || row.status === status) && `${row.title} ${row.channel}`.toLocaleLowerCase('vi').includes(q.trim().toLocaleLowerCase('vi')));
  const pages = Math.max(1, Math.ceil(rows.length / 25)), page = Math.max(1, Math.min(pages, Math.floor(Number(params.get('page')) || 1)));
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); };
  return <>
    <div className="mb-6 flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-semibold">Kho Shadowing</h1><p className="mt-2 text-sm text-slate-500">Biên tập phụ đề, bản dịch và mốc thời gian cho video YouTube dưới 30 phút.</p></div><Link className={`${button} !border-blue-600 !bg-blue-600 !text-white`} to="/admin/shadowing/new">Thêm video</Link></div>
    <section aria-label="Danh sách video Shadowing" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4"><input className={`${input} min-w-48 flex-1`} aria-label="Tìm video" placeholder="Tìm tên video hoặc kênh…" value={q} onChange={event => change('q', event.target.value)} /><select aria-label="Trạng thái video" className={input} value={status} onChange={event => change('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className={button} disabled={loading} onClick={reload}>Tải lại</button></div>
      {loading ? <p role="status" className="p-8 text-center text-sm">Đang tải thư viện…</p> : !rows.length ? <p className="p-8 text-center text-sm text-slate-500">{failed ? 'Chưa tải được dữ liệu.' : items.length ? 'Không có video khớp bộ lọc.' : 'Chưa có video. Thêm video và rà soát phụ đề trước khi xuất bản.'}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Video', 'Cấp độ', 'Câu / thời lượng', 'Trạng thái', ''].map((label, i) => <th key={i} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.slice((page - 1) * 25, page * 25).map(video => <tr key={video.id}><td className="max-w-md px-4 py-4"><Link className="font-medium hover:text-blue-700" to={`/admin/shadowing/${video.id}`}>{video.title}</Link><p className="mt-1 text-xs text-slate-500">{video.channel}</p></td><td className="px-4 py-4">{video.level ?? 'Chưa phân loại'}</td><td className="px-4 py-4">{video.sentenceCount} câu · {formatShadowingTime(video.durationMs)}</td><td className="px-4 py-4">{labels[video.status]}<p className="mt-1 text-xs text-slate-500">Phiên bản {video.version}</p></td><td className="px-4 py-4"><Link className={button} to={`/admin/shadowing/${video.id}`}>Biên tập</Link></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between gap-3 border-t p-4 text-xs text-slate-500"><span>{rows.length} video · Trang {page}/{pages}</span><div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => change('page', String(page - 1))}>Trước</button><button className={button} disabled={page >= pages} onClick={() => change('page', String(page + 1))}>Sau</button></div></div>
    </section>
  </>;
}
