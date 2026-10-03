import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AdminRequest, ContentSource } from './types';
import type { GrammarRecord, GrammarDraft } from '../utils/grammar';
import { grammarCounts, grammarStatus } from './grammar-editor-data';
import { GrammarEditor } from './GrammarEditor';

type ListItem = Omit<GrammarRecord, 'draft'> & {draft?: GrammarDraft; title?: string; level?: string; lessonCount?: number; patternCount?: number; exerciseCount?: number};
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

export function GrammarWorkspace({ request, onDirtyChange }: { request: AdminRequest; onDirtyChange: (dirty: boolean) => void }) {
  const [items, setItems] = useState<ListItem[]>([]), [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const mounted = useRef(true), revision = useRef(0), navigate = useNavigate(), location = useLocation(), listSearch = useRef('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; onDirtyChange(false); }; }, [onDirtyChange]);
  if (location.pathname.replace(/\/$/, '') === '/admin/grammar') listSearch.current = location.search;
  const reload = useCallback(async () => {
    const run = ++revision.current; setLoading(true); setError('');
    try {
      const [rows, metadata] = await Promise.all([request<{ items: ListItem[] }>('/admin/grammar/courses'), request<{ sources: ContentSource[] }>('/admin/content/sources')]);
      if (!mounted.current || revision.current !== run) return;
      setItems(rows.items); setSources(metadata.sources);
    } catch (caught) { if (mounted.current && revision.current === run) setError(caught instanceof Error ? caught.message : 'Chưa tải được giáo trình.'); }
    finally { if (mounted.current && revision.current === run) setLoading(false); }
  }, [request]);
  useEffect(() => { void reload(); }, [reload]);
  const back = () => { onDirtyChange(false); navigate(`/admin/grammar${listSearch.current}`); };
  const saved = (course: GrammarRecord) => {
    setItems(previous => previous.some(item => item.id === course.id) ? previous.map(item => item.id === course.id ? course : item) : [course, ...previous]);
    if (location.pathname === '/admin/grammar/new') { onDirtyChange(false); navigate(`/admin/grammar/${course.id}`, { replace: true }); }
  };
  const sourceAdded = (source: ContentSource) => setSources(previous => previous.some(item => item.id === source.id) ? previous : [...previous, source]);
  return <>
    {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button className="font-semibold underline" onClick={() => void reload()}>Thử tải lại</button></div>}
    <Routes>
      <Route index element={<GrammarList items={items} loading={loading} failed={!!error} reload={() => void reload()} />} />
      <Route path="new" element={<GrammarEditor key="new-course" course={null} sources={sources} request={request} onSaved={saved} onClose={back} onSourceAdded={sourceAdded} onDirtyChange={onDirtyChange} />} />
      <Route path=":id" element={<EditorRoute request={request} sources={sources} onSaved={saved} onClose={back} onSourceAdded={sourceAdded} onDirtyChange={onDirtyChange} />} />
      <Route path="*" element={<div><h1 className="mb-4 text-xl font-semibold">Không tìm thấy trang giáo trình</h1><button className={button} onClick={back}>Về danh sách</button></div>} />
    </Routes>
  </>;
}

function EditorRoute(props: Omit<Parameters<typeof GrammarEditor>[0], 'course'>) {
  const { id } = useParams();
  const [course, setCourse] = useState<GrammarRecord | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let live = true; setCourse(null); setError('');
    props.request<{ course: GrammarRecord }>(`/admin/grammar/courses/${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then(result => { if (live) setCourse(result.course); }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : 'Chưa tải được giáo trình.'); });
    return () => { live = false; controller.abort(); props.onDirtyChange(false); };
  }, [id, props.request, props.onDirtyChange, attempt]);
  if (error) return <section role="alert" className="rounded-xl border border-red-200 bg-white p-5"><p className="mb-4 text-sm text-red-800">{error}</p><div className="flex gap-3"><button className={button} onClick={() => setAttempt(value => value + 1)}>Tải lại giáo trình</button><button className={button} onClick={props.onClose}>Về danh sách</button></div></section>;
  if (!course) return <p role="status" className="text-sm text-slate-600">Đang tải giáo trình…</p>;
  return <GrammarEditor key={course.id} {...props} course={course} onSaved={next => { setCourse(next); props.onSaved(next); }} />;
}

function GrammarList({ items, loading, failed, reload }: { items: ListItem[]; loading: boolean; failed: boolean; reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '', status = params.get('status') ?? '';
  const filtered = useMemo(() => items.filter(item => `${item.draft?.title ?? item.title} ${item.slug}`.toLocaleLowerCase('vi').includes(q.trim().toLocaleLowerCase('vi')) && (!status || (status === 'archived' ? !!item.archivedAt : status === 'draft' ? !item.archivedAt && item.publishedVersion === null : status === 'modified' ? !item.archivedAt && item.publishedVersion !== null && item.version !== item.publishedVersion : !item.archivedAt && item.publishedVersion !== null))), [items, q, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25)), page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); };
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Giáo trình ngữ pháp</h1><p className="mt-2 text-sm text-slate-500">Biên tập giáo trình → bài → mẫu câu → bài tập. Chỉ xuất bản nội dung có nguồn được phép sử dụng.</p></div><Link to="/admin/grammar/new" className={`${button} !border-blue-600 !bg-blue-600 !text-white`}>Thêm giáo trình</Link></div>
    <section aria-label="Danh sách giáo trình" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b border-slate-200 p-4"><label className="min-w-48 flex-1"><span className="sr-only">Tìm giáo trình</span><input className={`${input} w-full`} placeholder="Tìm tiêu đề hoặc đường dẫn…" value={q} onChange={event => update('q', event.target.value)} /></label><label><span className="sr-only">Trạng thái giáo trình</span><select className={input} value={status} onChange={event => update('status', event.target.value)}><option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="modified">Có nháp mới</option><option value="archived">Đã lưu trữ</option></select></label><button className={button} disabled={loading} onClick={reload}>Tải lại</button></div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải giáo trình…</p> : !filtered.length ? <p className="p-8 text-center text-sm text-slate-500">{failed ? 'Chưa tải được dữ liệu.' : items.length ? 'Không có giáo trình khớp bộ lọc.' : 'Chưa có giáo trình. Thêm bản nháp và nhập nội dung của bạn để bắt đầu.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Giáo trình', 'Nội dung', 'Trạng thái', 'Phiên bản', 'Thao tác'].map(title => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.slice((page - 1) * 25, page * 25).map(item => { const counts = item.draft ? grammarCounts(item.draft) : {lessons:item.lessonCount??0,patterns:item.patternCount??0,exercises:item.exerciseCount??0}; return <tr key={item.id} className="hover:bg-slate-50"><td className="max-w-sm px-4 py-4"><Link to={`/admin/grammar/${item.id}`} className="font-medium hover:text-blue-700">{item.draft?.title ?? item.title}</Link><p className="mt-1 text-xs text-slate-500">{item.draft?.level ?? item.level} · {item.slug}</p></td><td className="px-4 py-4 text-xs leading-6 text-slate-600">{counts.lessons} bài · {counts.patterns} mẫu · {counts.exercises} câu hỏi</td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{grammarStatus(item)}</span></td><td className="px-4 py-4 text-slate-500">{item.version}</td><td className="px-4 py-4"><Link className={button} to={`/admin/grammar/${item.id}`} aria-label={`Biên tập ${item.draft?.title ?? item.title}`}>Biên tập</Link></td></tr>; })}</tbody></table></div>}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{filtered.length} giáo trình · Trang {page}/{pages}</span><div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => update('page', String(page - 1))}>Trước</button><button className={button} disabled={page >= pages} onClick={() => update('page', String(page + 1))}>Sau</button></div></div>
    </section>
  </>;
}

