import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AdminRequest, ContentSource } from '../../shared/types';
import type { AdminReading } from './reading-editor-data';
import { ReadingEditor } from './ReadingEditor';

const button = 'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
const status = (article: AdminReading) => article.archived ? 'Đã lưu trữ' : article.publishedVersion === null ? 'Bản nháp' : article.hasUnpublishedChanges ? 'Có nháp mới' : 'Đã xuất bản';

export function ReadingWorkspace({ request, onDirtyChange }: { request: AdminRequest; onDirtyChange: (dirty: boolean) => void }) {
  const [articles, setArticles] = useState<AdminReading[]>([]), [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const mounted = useRef(true), revision = useRef(0), navigate = useNavigate(), location = useLocation(), listSearch = useRef('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; onDirtyChange(false); }; }, [onDirtyChange]);
  if (location.pathname.replace(/\/$/, '') === '/admin/reading') listSearch.current = location.search;
  const reload = useCallback(async () => {
    const run = ++revision.current; setLoading(true); setError('');
    try {
      const [rows, metadata] = await Promise.all([request<{ articles: AdminReading[] }>('/admin/reading/articles'), request<{ sources: ContentSource[] }>('/admin/content/sources')]);
      if (!mounted.current || revision.current !== run) return;
      setArticles(rows.articles); setSources(metadata.sources);
    } catch (caught) { if (mounted.current && revision.current === run) setError(caught instanceof Error ? caught.message : 'Chưa tải được thư viện bài đọc.'); }
    finally { if (mounted.current && revision.current === run) setLoading(false); }
  }, [request]);
  useEffect(() => { void reload(); }, [reload]);
  const back = () => { onDirtyChange(false); navigate(`/admin/reading${listSearch.current}`); };
  const saved = (article: AdminReading) => {
    setArticles(previous => previous.some(item => item.id === article.id) ? previous.map(item => item.id === article.id ? article : item) : [article, ...previous]);
    if (location.pathname === '/admin/reading/new') { onDirtyChange(false); navigate(`/admin/reading/${article.id}`, { replace: true }); }
  };
  const sourceAdded = (source: ContentSource) => setSources(previous => previous.some(item => item.id === source.id) ? previous : [...previous, source]);
  return <>
    {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button className="font-semibold underline" onClick={() => void reload()}>Thử tải lại</button></div>}
    <Routes>
      <Route index element={<ReadingList articles={articles} loading={loading} failed={!!error} reload={() => void reload()} />} />
      <Route path="new" element={<ReadingEditor key="new-reading" article={null} sources={sources} request={request} onSaved={saved} onClose={back} onSourceAdded={sourceAdded} onDirtyChange={onDirtyChange} />} />
      <Route path=":id" element={<ReadingEditorRoute request={request} sources={sources} onSaved={saved} onClose={back} onSourceAdded={sourceAdded} onDirtyChange={onDirtyChange} />} />
      <Route path="*" element={<div><h1 className="mb-4 text-xl font-semibold">Không tìm thấy trang bài đọc</h1><button className={button} onClick={back}>Về danh sách</button></div>} />
    </Routes>
  </>;
}

function ReadingEditorRoute(props: Omit<Parameters<typeof ReadingEditor>[0], 'article'>) {
  const { id } = useParams();
  const [article, setArticle] = useState<AdminReading | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let live = true; setArticle(null); setError('');
    props.request<{ article: AdminReading }>(`/admin/reading/articles/${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then(result => { if (live) setArticle(result.article); }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : 'Chưa tải được bài đọc.'); });
    return () => { live = false; controller.abort(); props.onDirtyChange(false); };
  }, [id, props.request, props.onDirtyChange, attempt]);
  if (error) return <section role="alert" className="rounded-xl border border-red-200 bg-white p-5"><p className="mb-4 text-sm text-red-800">{error}</p><div className="flex gap-3"><button className={button} onClick={() => setAttempt(value => value + 1)}>Tải lại bài</button><button className={button} onClick={props.onClose}>Về danh sách</button></div></section>;
  if (!article) return <p role="status" className="text-sm text-slate-600">Đang tải bài đọc…</p>;
  return <ReadingEditor key={article.id} {...props} article={article} onSaved={next => { setArticle(next); props.onSaved(next); }} />;
}

function ReadingList({ articles, loading, failed, reload }: { articles: AdminReading[]; loading: boolean; failed: boolean; reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '', filter = params.get('status') ?? '';
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('vi');
    return articles.filter(article => (!needle || `${article.title}\n${article.subtitle}\n${article.id}`.toLocaleLowerCase('vi').includes(needle))
      && (!filter || (filter === 'archived' ? article.archived : filter === 'draft' ? !article.archived && article.publishedVersion === null
        : filter === 'modified' ? !article.archived && article.publishedVersion !== null && article.hasUnpublishedChanges : !article.archived && article.publishedVersion !== null)));
  }, [articles, q, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25)), page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); };
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Thư viện bài đọc</h1><p className="mt-2 text-sm text-slate-500">Biên soạn nội dung, bản dịch và audio trước khi xuất bản.</p></div><Link to="/admin/reading/new" className={`${button} !border-blue-600 !bg-blue-600 !text-white`}>Thêm bài đọc</Link></div>
    <div className="mb-5 flex flex-wrap gap-5 text-sm text-slate-600"><span><b>{articles.length}</b> bài đọc</span><span><b className="text-emerald-700">{articles.filter(article => !article.archived && article.publishedVersion !== null).length}</b> công khai</span><span><b className="text-amber-700">{articles.filter(article => !article.archived && article.hasUnpublishedChanges).length}</b> cần xuất bản</span></div>
    <section aria-label="Danh sách bài đọc" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b border-slate-200 p-4"><label className="min-w-48 flex-1"><span className="sr-only">Tìm bài đọc</span><input className={`${input} w-full`} placeholder="Tìm tiêu đề, mô tả hoặc ID…" value={q} onChange={event => update('q', event.target.value)} /></label><label><span className="sr-only">Trạng thái bài đọc</span><select className={input} value={filter} onChange={event => update('status', event.target.value)}><option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="modified">Có nháp mới</option><option value="archived">Đã lưu trữ</option></select></label><button className={button} disabled={loading} onClick={reload}>Tải lại</button></div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải thư viện…</p> : !filtered.length ? <p className="p-8 text-center text-sm text-slate-500">{failed ? 'Chưa tải được dữ liệu.' : articles.length ? 'Không có bài khớp bộ lọc.' : 'Chưa có bài đọc. Thêm bài đầu tiên để bắt đầu biên soạn.'}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Bài đọc</th><th className="px-4 py-3 font-medium">Trạng thái</th><th className="px-4 py-3 font-medium">Audio bản nháp</th><th className="px-4 py-3 font-medium">Phiên bản</th><th className="px-4 py-3 font-medium"><span className="sr-only">Thao tác</span></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.slice((page - 1) * 25, page * 25).map(article => <tr key={article.id} className="hover:bg-slate-50"><td className="max-w-md px-4 py-4"><Link to={`/admin/reading/${article.id}`} className="font-medium text-slate-900 hover:text-blue-700">{article.title}</Link>{article.subtitle && <p className="mt-1 truncate text-xs text-slate-500">{article.subtitle}</p>}</td><td className="whitespace-nowrap px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{status(article)}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">{article.audio ? 'Sẵn sàng' : 'Chưa tạo'}</td><td className="px-4 py-4 text-slate-500">{article.version}</td><td className="px-4 py-4"><Link className={button} to={`/admin/reading/${article.id}`} aria-label={`Biên tập ${article.title}`}>Biên tập</Link></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{filtered.length} bài · Trang {page}/{pages}</span><div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => update('page', String(page - 1))}>Trước</button><button className={button} disabled={page >= pages} onClick={() => update('page', String(page + 1))}>Sau</button></div></div>
    </section>
  </>;
}
