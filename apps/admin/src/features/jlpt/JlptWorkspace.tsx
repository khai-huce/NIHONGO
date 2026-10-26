import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { AdminJlptRoadmap } from '@nihongo/shared/contracts/jlpt';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { JlptEditor } from './JlptEditor';
import { jlptDraftCounts, jlptLevels, jlptStatus } from './jlpt-editor-data';
import { button, panel, primary } from './ui';

export function JlptWorkspace({ request, onDirtyChange }: { request: AdminRequest; onDirtyChange: (dirty: boolean) => void }) {
  const [items, setItems] = useState<AdminJlptRoadmap[]>([]), [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), generation = useRef(0), navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; onDirtyChange(false); }; }, [onDirtyChange]);
  const reload = useCallback(async () => {
    const run = ++generation.current; setLoading(true); setError('');
    try {
      const [list, metadata] = await Promise.all([request<{ items: AdminJlptRoadmap[] }>('/admin/jlpt/roadmaps'), request<{ sources: ContentSource[] }>('/admin/content/sources')]);
      if (mounted.current && run === generation.current) { setItems(list.items); setSources(metadata.sources); setLoaded(true); }
    } catch (caught) { if (mounted.current && run === generation.current) setError(caught instanceof Error ? caught.message : 'Chưa tải được kho lộ trình.'); }
    finally { if (mounted.current && run === generation.current) setLoading(false); }
  }, [request]);
  useEffect(() => { void reload(); }, [reload]);
  const availableLevels = jlptLevels.filter(level => !items.some(item => item.level === level));
  const common = {
    request, sources, availableLevels, onDirtyChange,
    onClose: () => { onDirtyChange(false); navigate('/admin/jlpt'); },
    onSourceAdded: (source: ContentSource) => setSources(rows => rows.some(row => row.id === source.id) ? rows : [...rows, source]),
    onSaved: (roadmap: AdminJlptRoadmap) => setItems(rows => rows.some(row => row.id === roadmap.id) ? rows.map(row => row.id === roadmap.id ? roadmap : row) : [...rows, roadmap]),
  };
  return <>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} <button className="underline" onClick={() => void reload()}>Thử tải lại</button></p>}
    <Routes>
      <Route index element={<JlptList items={items} loading={loading} failed={!!error} reload={() => void reload()} />} />
      <Route path="new" element={!loaded ? <p role="status">Đang chuẩn bị kho lộ trình…</p> : !availableLevels.length ? <section className={panel}><p className="mb-4 text-sm">Cả năm cấp độ đã có lộ trình. Mở lộ trình hiện có để biên tập hoặc khôi phục bản lưu trữ.</p><Link className={button} to="/admin/jlpt">Về danh sách</Link></section> : <JlptEditor key="new-jlpt" {...common} roadmap={null} onSaved={roadmap => { common.onSaved(roadmap); onDirtyChange(false); navigate(`/admin/jlpt/${roadmap.id}`, { replace: true }); }} />} />
      <Route path=":id" element={<EditorRoute {...common} />} />
      <Route path="*" element={<p>Không tìm thấy trang. <Link className="text-blue-700 underline" to="/admin/jlpt">Về kho lộ trình JLPT</Link></p>} />
    </Routes>
  </>;
}

function EditorRoute(props: Omit<Parameters<typeof JlptEditor>[0], 'roadmap'>) {
  const { id } = useParams();
  const [roadmap, setRoadmap] = useState<AdminJlptRoadmap | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let live = true; setRoadmap(null); setError('');
    props.request<{ roadmap: AdminJlptRoadmap }>(`/admin/jlpt/roadmaps/${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then(result => { if (live) setRoadmap(result.roadmap); }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : 'Chưa tải được lộ trình.'); });
    return () => { live = false; controller.abort(); props.onDirtyChange(false); };
  }, [id, props.request, props.onDirtyChange, retry]);
  if (error) return <section role="alert" className={panel}><p className="mb-4 text-sm text-red-700">{error}</p><div className="flex gap-3"><button className={button} onClick={() => setRetry(value => value + 1)}>Tải lại lộ trình</button><button className={button} onClick={props.onClose}>Về danh sách</button></div></section>;
  if (!roadmap) return <p role="status">Đang tải lộ trình…</p>;
  return <JlptEditor key={roadmap.id} {...props} roadmap={roadmap} onSaved={next => { setRoadmap(next); props.onSaved(next); }} />;
}

function JlptList({ items, loading, failed, reload }: { items: AdminJlptRoadmap[]; loading: boolean; failed: boolean; reload: () => void }) {
  const sorted = [...items].sort((a, b) => jlptLevels.indexOf(a.level) - jlptLevels.indexOf(b.level));
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Kho lộ trình JLPT</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Sắp xếp buổi học và liên kết nội dung đã xuất bản từ các kho. Mỗi cấp độ N5–N1 có một lộ trình, lưu nháp trước khi xuất bản.</p></div>{items.length < 5 && !loading && !failed && <Link className={primary} to="/admin/jlpt/new">Thêm lộ trình</Link>}</div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Danh sách lộ trình JLPT">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><p className="text-sm text-slate-600">{items.length} / 5 cấp độ đã biên soạn</p><button className={button} disabled={loading} onClick={reload}>Tải lại</button></div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải kho lộ trình…</p> : !items.length ? <p className="p-8 text-center text-sm text-slate-500">{failed ? 'Chưa tải được dữ liệu.' : 'Chưa có lộ trình. Tạo bản nháp rồi chọn nội dung từ kho học để bắt đầu.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Lộ trình', 'Nội dung', 'Trạng thái', 'Phiên bản', ''].map((label, index) => <th key={index} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sorted.map(item => {
        const counts = jlptDraftCounts(item.draft);
        return <tr key={item.id}><td className="max-w-sm px-4 py-4"><Link className="font-medium hover:text-blue-700" to={`/admin/jlpt/${item.id}`}>{item.draft.title}</Link><p className="mt-1 text-xs text-slate-500">{item.level}</p></td><td className="px-4 py-4 text-xs leading-6 text-slate-600">{counts.sessions} buổi · {counts.resources} liên kết<br />{counts.minutes} phút dự kiến</td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{jlptStatus(item)}</span></td><td className="px-4 py-4 text-slate-500">{item.version}</td><td className="px-4 py-4"><Link className={button} to={`/admin/jlpt/${item.id}`} aria-label={`Biên tập lộ trình ${item.level}`}>Biên tập</Link></td></tr>;
      })}</tbody></table></div>}
      <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">Danh sách hiển thị bản nháp mới nhất. Thay đổi chỉ xuất hiện trên trang học sau khi xuất bản.</p>
    </section>
  </>;
}
