import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileUp, LogOut, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { AdminLogin } from '../features/auth/AdminLogin';
import type { useAuth } from '@nihongo/client/auth/useAuth';
import { createAdminRequest } from '../shared/api';
import { filterKanji, hasUnpublishedDraft } from '../features/kanji/catalog';
import { KanjiEditor } from '../features/kanji/KanjiEditor';
import { KanjiImportPanel } from '../features/kanji/KanjiImportPanel';
import { ReadingWorkspace } from '../features/reading/ReadingWorkspace';
import { CurriculumWorkspace } from '../features/curriculum/CurriculumWorkspace';
import { GrammarWorkspace } from '../features/grammar/GrammarWorkspace';
import { ShadowingWorkspace } from '../features/shadowing/ShadowingWorkspace';
import type { AdminRequest, ContentSource, KanjiRecord } from '../shared/types';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
const primary = `${button} !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700`;
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
const statusLabel = { draft: 'Chưa xuất bản', published: 'Đã xuất bản', archived: 'Đã lưu trữ' };
type Auth = ReturnType<typeof useAuth>;

export default function AdminApp({ auth }: { auth: Auth }) {
  const [showLogin, setShowLogin] = useState(false);
  const user = auth.currentUser;
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(({ historyAction }) => dirty && historyAction === 'POP');
  const [leaveAction, setLeaveAction] = useState<null | (() => void)>(null);
  const leave = useCallback((action: () => void) => {
    if (dirty) setLeaveAction(() => action); else action();
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => { setDirty(false); setLeaveAction(null); }, [user?.id, user?.role]);

  return <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: '"Be Vietnam Pro", system-ui, sans-serif', colorScheme: 'light' }}>
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-xl text-white">漢</span><div><p className="text-sm font-bold tracking-wide">NIHONGO</p><p className="text-xs text-slate-500">Quản trị nội dung</p></div></div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={button} onClick={() => leave(() => { window.location.assign(`${import.meta.env.VITE_APP_ORIGIN || 'http://localhost:3000'}/kanji`); })}><ArrowLeft size={15} />Trang học</button>
        {user && <><span className="hidden max-w-64 truncate text-xs text-slate-500 sm:block">{user.email}</span><button className={button} disabled={auth.checking || auth.loggingOut} onClick={() => leave(() => { void auth.logout(); })}><LogOut size={15} />Đăng xuất</button></>}
      </div>
    </header>
    {auth.error && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">{auth.error} <button className="font-semibold underline" onClick={() => void auth.refresh()}>Tải lại tài khoản</button></div>}
    {!user ? <section className="mx-auto max-w-lg px-5 py-20 text-center">
      <ShieldCheck className="mx-auto mb-5 text-blue-600" size={40} />
      <h1 className="mb-3 text-2xl font-semibold">Đăng nhập quản trị</h1>
      <p className="mb-6 text-sm leading-6 text-slate-600">Dùng tài khoản NIHONGO đã được cấp quyền admin để quản lý kho nội dung.</p>
      {auth.checking ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : <button className={primary} disabled={!!auth.error} onClick={() => setShowLogin(true)}>Đăng nhập</button>}
    </section> : user.role !== 'admin' ? <section className="mx-auto max-w-xl px-5 py-20 text-center"><ShieldCheck className="mx-auto mb-5 text-slate-400" size={40} /><h1 className="mb-3 text-2xl font-semibold">Tài khoản chưa có quyền quản trị</h1><p className="mb-6 text-sm leading-6 text-slate-600">Quyền quản trị được cấp riêng cho tài khoản. Gói Premium không bao gồm quyền này.</p><button className={button} onClick={() => void auth.refresh()} disabled={auth.checking}>Kiểm tra lại quyền</button></section> :
      <Workspace key={user.id} auth={auth} leave={leave} onDirtyChange={setDirty} />}
    {showLogin && !user && <AdminLogin onClose={() => setShowLogin(false)} onSuccess={auth.acceptUser} />}
    {leaveAction && <LeaveDialog onCancel={() => setLeaveAction(null)} onConfirm={() => { const action = leaveAction; setLeaveAction(null); setDirty(false); action(); }} />}
    {blocker.state === 'blocked' && <LeaveDialog onCancel={() => blocker.reset()} onConfirm={() => { setDirty(false); blocker.proceed(); }} />}
  </div>;
}

function LeaveDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; cancel.current?.focus(); return () => previous?.focus(); }, []);
  return <div className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/40 p-4" onKeyDown={event => {
    if (event.key === 'Escape') onCancel();
    if (event.key === 'Tab') {
      const buttons = box.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    }
  }}><div ref={box} role="dialog" aria-modal="true" aria-labelledby="admin-leave-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="admin-leave-title" className="text-lg font-semibold">Rời nội dung đang nhập?</h2><p className="my-4 text-sm leading-6 text-slate-600">Thay đổi chưa lưu sẽ bị bỏ. Bản nháp đã lưu trên máy chủ vẫn được giữ.</p><div className="flex justify-end gap-3"><button ref={cancel} className={button} onClick={onCancel}>Tiếp tục chỉnh sửa</button><button className={primary} onClick={onConfirm}>Rời trang</button></div></div></div>;
}

function Workspace({ auth, leave, onDirtyChange }: { auth: Auth; leave: (action: () => void) => void; onDirtyChange: (dirty: boolean) => void }) {
  const navigate = useNavigate(), location = useLocation();
  const userId = auth.currentUser!.id;
  const identity = useRef(auth.currentUser);
  identity.current = auth.currentUser;
  const scope = useMemo(() => createAdminRequest(userId, {
    isCurrent: () => identity.current?.id === userId && identity.current?.role === 'admin',
    onAccessDenied: () => { void auth.refresh(); },
  }), [userId, auth.refresh]);
  useLayoutEffect(() => { scope.activate(); return () => scope.dispose(); }, [scope]);
  const [items, setItems] = useState<KanjiRecord[]>([]), [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const revision = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; }; }, []);
  const reload = useCallback(async () => {
    const id = ++revision.current;
    setLoading(true); setError('');
    try {
      const [data, metadata] = await Promise.all([scope.request<{ items: KanjiRecord[] }>('/admin/content/kanji'), scope.request<{ sources: ContentSource[] }>('/admin/content/sources')]);
      if (!mounted.current || id !== revision.current) return;
      setItems(data.items); setSources(metadata.sources); setLoaded(true);
    } catch (err) { if (mounted.current && id === revision.current) setError(err instanceof Error ? err.message : 'Chưa tải được kho nội dung.'); }
    finally { if (mounted.current && id === revision.current) setLoading(false); }
  }, [scope]);
  const inKanji = location.pathname.startsWith('/admin/kanji');
  useEffect(() => { if (inKanji) void reload(); }, [reload, inKanji]);
  const listSearch = useRef('');
  if (location.pathname.replace(/\/$/, '') === '/admin/kanji') listSearch.current = location.search;
  const back = () => leave(() => navigate(`/admin/kanji${listSearch.current}`));
  const editorClose = () => { onDirtyChange(false); navigate(`/admin/kanji${listSearch.current}`); };
  const saved = (item: KanjiRecord) => {
    setItems(previous => previous.some(row => row.id === item.id) ? previous.map(row => row.id === item.id ? item : row) : [...previous, item]);
    if (location.pathname === '/admin/kanji/new') { onDirtyChange(false); navigate(`/admin/kanji/${encodeURIComponent(item.id)}`, { replace: true }); }
  };
  const sourceAdded = (source: ContentSource) => setSources(previous => previous.some(item => item.id === source.id) ? previous : [...previous, source]);

  return <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row">
    <aside className="shrink-0 border-b border-slate-200 bg-white p-4 md:min-h-[calc(100vh-65px)] md:w-52 md:border-b-0 md:border-r"><p className="mb-3 hidden px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 md:block">Nội dung học</p>{[{path:'/admin/kanji',label:'Kanji'}, {path:'/admin/reading',label:'Đọc hiểu'}, {path:'/admin/curriculum',label:'Giáo trình'}, {path:'/admin/grammar',label:'Ngữ pháp'}, {path:'/admin/shadowing',label:'Shadowing'}].map(item => <button key={item.path} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${location.pathname.startsWith(item.path) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => leave(() => navigate(item.path))}><BookOpen size={18} />{item.label}</button>)}<p className="mt-6 hidden px-3 text-xs leading-5 text-slate-500 md:block">Chỉ nội dung đã xuất bản mới xuất hiện trong kho học.</p></aside>
    <main className="min-w-0 flex-1 px-4 py-6 sm:px-7">
      <fieldset disabled={auth.checking || auth.loggingOut || !!auth.error} className="min-w-0">
        {auth.checking && <p role="status" className="mb-3 text-xs text-slate-500">Đang kiểm tra phiên quản trị…</p>}
        {inKanji && error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button className="font-semibold underline" onClick={() => void reload()}>Thử tải lại</button></div>}
        <Routes>
          <Route path="/" element={<Navigate to="/admin/kanji" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/kanji" replace />} />
          <Route path="/admin/reading/*" element={<ReadingWorkspace request={scope.request} onDirtyChange={onDirtyChange} />} />
          <Route path="/admin/curriculum/*" element={<CurriculumWorkspace request={scope.request} onDirtyChange={onDirtyChange} />} />
          <Route path="/admin/grammar/*" element={<GrammarWorkspace request={scope.request} onDirtyChange={onDirtyChange} />} />
          <Route path="/admin/shadowing/*" element={<ShadowingWorkspace request={scope.request} onDirtyChange={onDirtyChange} />} />
          <Route path="/admin/kanji" element={<KanjiList items={items} loading={loading} error={error} onReload={() => void reload()} onOpen={id => leave(() => navigate(`/admin/kanji/${encodeURIComponent(id)}`))} />} />
          <Route path="/admin/kanji/new" element={loaded ? <KanjiEditor key="new" record={null} sources={sources} request={scope.request} onSaved={saved} onClose={editorClose} onSourcesChanged={sourceAdded} onDirtyChange={onDirtyChange} /> : <p role="status">Đang chuẩn bị dữ liệu…</p>} />
          <Route path="/admin/kanji/import" element={loaded ? <KanjiImportPanel request={scope.request} sources={sources} onImported={() => { void reload(); }} onClose={back} onDirtyChange={onDirtyChange} /> : <p role="status">Đang chuẩn bị dữ liệu…</p>} />
          <Route path="/admin/kanji/:id" element={<EditorRoute request={scope.request} sources={sources} onSaved={saved} onClose={editorClose} onSourcesChanged={sourceAdded} onDirtyChange={onDirtyChange} />} />
          <Route path="*" element={<div><h1 className="mb-4 text-2xl font-semibold">Không tìm thấy trang quản trị</h1><button className={button} onClick={back}>Về danh sách Kanji</button></div>} />
        </Routes>
      </fieldset>
    </main>
  </div>;
}

function EditorRoute(props: { request: AdminRequest; sources: ContentSource[]; onSaved: (row: KanjiRecord) => void; onClose: () => void; onSourcesChanged: (source: ContentSource) => void; onDirtyChange: (dirty: boolean) => void }) {
  const { id } = useParams();
  const [record, setRecord] = useState<KanjiRecord | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let live = true;
    setRecord(null); setError('');
    props.request<{ item: KanjiRecord }>(`/admin/content/kanji/${encodeURIComponent(id ?? '')}`, { signal: controller.signal })
      .then(result => { if (live) setRecord(result.item); }).catch(err => { if (live) setError(err instanceof Error ? err.message : 'Chưa tải được Kanji.'); });
    return () => { live = false; controller.abort(); props.onDirtyChange(false); };
  }, [id, props.request, attempt, props.onDirtyChange]);
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-white p-5"><p className="mb-4 text-sm text-red-700">{error}</p><div className="flex gap-3"><button className={button} onClick={() => setAttempt(value => value + 1)}>Tải lại Kanji</button><button className={button} onClick={props.onClose}>Về danh sách</button></div></div>;
  if (!record) return <p role="status">Đang tải Kanji…</p>;
  return <KanjiEditor key={record.id} {...props} record={record} onSaved={row => { setRecord(row); props.onSaved(row); }} />;
}

function KanjiList({ items, loading, error, onReload, onOpen }: { items: KanjiRecord[]; loading: boolean; error: string; onReload: () => void; onOpen: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '', level = params.get('level') ?? '', status = params.get('status') ?? '';
  const filtered = useMemo(() => filterKanji(items, q, level, status), [items, q, level, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const page = Math.max(1, Math.min(pages, Number(params.get('page')) || 1));
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); };
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Kho Kanji</h1><p className="mt-2 text-sm text-slate-500">Biên tập, kiểm tra và xuất bản nội dung học.</p></div><div className="flex flex-wrap gap-2"><Link className={button} to="/admin/kanji/import"><FileUp size={16} />Nhập JSON</Link><Link className={primary} to="/admin/kanji/new"><Plus size={16} />Thêm Kanji</Link></div></div>
    <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"><span><strong className="text-slate-900">{items.length}</strong> Kanji</span><span><strong className="text-emerald-700">{items.filter(item => item.status === 'published').length}</strong> đã xuất bản</span><span><strong className="text-amber-700">{items.filter(item => item.status !== 'archived' && hasUnpublishedDraft(item)).length}</strong> cần xuất bản</span></div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Danh sách Kanji">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4"><label className="min-w-48 flex-1 text-xs font-medium text-slate-600">Tìm kiếm<div className="relative mt-1.5"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input className={`${input} w-full pl-9`} value={q} placeholder="Chữ, âm Hán Việt, nghĩa hoặc ID" onChange={event => update('q', event.target.value)} /></div></label><label className="text-xs font-medium text-slate-600">Cấp độ<select className={`${input} mt-1.5 block`} value={level} onChange={event => update('level', event.target.value)}><option value="">Tất cả cấp độ</option>{['N5', 'N4', 'N3', 'N2', 'N1'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Trạng thái<select className={`${input} mt-1.5 block`} value={status} onChange={event => update('status', event.target.value)}><option value="">Tất cả trạng thái</option><option value="published">Đã xuất bản</option><option value="draft">Chưa xuất bản</option><option value="changed">Có bản nháp chưa xuất bản</option><option value="archived">Đã lưu trữ</option></select></label><button className={button} disabled={loading} onClick={onReload} aria-label="Tải lại danh sách"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button></div>
      {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Đang tải danh sách…</p> : !filtered.length ? <p className="p-10 text-center text-sm text-slate-500">{error ? 'Chưa lấy được dữ liệu.' : items.length ? 'Không có Kanji khớp bộ lọc.' : 'Kho Kanji chưa có nội dung.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Kanji', 'Hán Việt / Nghĩa', 'Cấp độ', 'Trạng thái', 'Thao tác'].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.slice((page - 1) * 25, page * 25).map(item => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><span className="font-japanese text-3xl">{item.draft.kanji}</span><span className="mt-1 block font-mono text-[11px] text-slate-400">{item.id}</span></td><td className="max-w-sm px-5 py-4"><p className="font-semibold">{item.draft.hanViet}</p><p className="mt-1 line-clamp-2 leading-5 text-slate-500">{item.draft.meaning}</p></td><td className="px-5 py-4 text-slate-600">{item.draft.level}</td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs ${item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : item.status === 'archived' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>{statusLabel[item.status]}</span>{item.status === 'published' && hasUnpublishedDraft(item) && <span className="mt-2 block text-xs text-amber-700">Có thay đổi nháp</span>}</td><td className="px-5 py-4"><button className="rounded px-2 py-1 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => onOpen(item.id)} aria-label={`Biên tập ${item.draft.kanji}`}>Biên tập</button></td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-slate-500"><span>{filtered.length} kết quả · Nội dung trong bảng là bản nháp mới nhất</span><div className="flex items-center gap-2"><button className={button} disabled={page <= 1} aria-label="Trang trước" onClick={() => update('page', String(page - 1))}><ChevronLeft size={15} /></button><span>Trang {page} / {pages}</span><button className={button} disabled={page >= pages} aria-label="Trang sau" onClick={() => update('page', String(page + 1))}><ChevronRight size={15} /></button></div></div>
    </section>
  </>;
}
