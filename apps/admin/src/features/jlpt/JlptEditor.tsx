import { useEffect, useRef, useState } from 'react';
import type { AdminJlptRoadmap, JlptDraft, JlptLevel, JlptPreview, JlptResourceOption, JlptSessionInput } from '@nihongo/shared/contracts/jlpt';
import { AdminApiError } from '../../shared/api';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { appendJlptResource, copyJlptDraft, jlptDraftCounts, jlptStatus, moveJlptItem, resourceKey, resourceLabels } from './jlpt-editor-data';
import { JlptResourcePicker } from './JlptResourcePicker';
import { JlptSourceDialog } from './JlptSourceDialog';
import { JlptPreviewContent } from './JlptPreviewContent';
import { JlptTestEditor } from './JlptTestEditor';
import { button, input, OrderButtons, panel, primary } from './ui';

type Props = {
  roadmap: AdminJlptRoadmap | null; availableLevels: JlptLevel[]; sources: ContentSource[]; request: AdminRequest;
  onSaved: (roadmap: AdminJlptRoadmap) => void; onClose: () => void; onSourceAdded: (source: ContentSource) => void; onDirtyChange: (dirty: boolean) => void;
};
type Dialog = 'preview' | 'publish' | 'archive' | 'restore' | 'reload' | 'close' | 'source' | null;
const errorMessage = (caught: unknown) => caught instanceof AdminApiError && caught.issues.length ? caught.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n') : caught instanceof Error ? caught.message : 'Chưa thực hiện được yêu cầu.';

export function JlptEditor({ roadmap, availableLevels, sources, request, onSaved, onClose, onSourceAdded, onDirtyChange }: Props) {
  const [saved, setSaved] = useState(roadmap), [draft, setDraft] = useState(() => copyJlptDraft(roadmap));
  const [level, setLevel] = useState<JlptLevel>(roadmap?.level ?? availableLevels[0] ?? 'N5');
  const [baseline, setBaseline] = useState(() => JSON.stringify({ draft: copyJlptDraft(roadmap), level: roadmap?.level ?? availableLevels[0] ?? 'N5' }));
  const [pending, setPending] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null), [preview, setPreview] = useState<JlptPreview | null>(null), [pickerSession, setPickerSession] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, JlptResourceOption>>({}), [labelsError, setLabelsError] = useState(''), [labelsRetry, setLabelsRetry] = useState(0);
  const [removeSession, setRemoveSession] = useState<JlptSessionInput | null>(null);
  const id = useRef(roadmap?.id ?? crypto.randomUUID()), mounted = useRef(false), locked = useRef(false);
  const dirty = JSON.stringify({ draft, level }) !== baseline, archived = !!saved?.archivedAt, counts = jlptDraftCounts(draft);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty || !!pending || dialog === 'source'); return () => onDirtyChange(false); }, [dirty, pending, dialog, onDirtyChange]);
  const remember = (value: JlptPreview) => setLabels(old => {
    const next = { ...old }; for (const session of value.sessions) for (const resource of session.resources) next[resourceKey(resource)] = resource; return next;
  });
  useEffect(() => {
    if (!roadmap) return;
    const controller = new AbortController(); let live = true; setLabelsError('');
    request<JlptPreview>('/admin/jlpt/roadmaps/preview', { body: { draft: roadmap.draft }, signal: controller.signal })
      .then(value => { if (live) remember(value); })
      .catch(caught => { if (live) setLabelsError(errorMessage(caught)); });
    return () => { live = false; controller.abort(); };
  }, [roadmap?.id, roadmap?.version, request, labelsRetry]);
  const edit = (update: (previous: JlptDraft) => JlptDraft) => { setDraft(update); setPreview(null); setNotice(''); };
  const patchSession = (sessionId: string, update: (session: JlptSessionInput) => JlptSessionInput) => edit(old => ({ ...old, sessions: old.sessions.map(session => session.id === sessionId ? update(session) : session) }));
  const accept = (next: AdminJlptRoadmap) => {
    setSaved(next); setDraft(structuredClone(next.draft)); setLevel(next.level); setBaseline(JSON.stringify({ draft: next.draft, level: next.level })); setConflict(false); setPreview(null); onSaved(next);
  };
  const run = async (kind: string, action: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setPending(kind); setError(''); setNotice('');
    try { await action(); }
    catch (caught) { if (mounted.current) { setError(errorMessage(caught)); if (caught instanceof AdminApiError && ['JLPT_CHANGED', 'JLPT_ARCHIVED', 'VERSION_CONFLICT', 'ACCOUNT_CHANGED'].includes(caught.code)) setConflict(true); } }
    finally { locked.current = false; if (mounted.current) setPending(''); }
  };
  const save = () => run('save', async () => {
    const response = await request<{ roadmap: AdminJlptRoadmap }>(saved ? `/admin/jlpt/roadmaps/${saved.id}` : '/admin/jlpt/roadmaps', {
      method: saved ? 'PATCH' : 'POST', body: saved ? { version: saved.version, draft } : { id: id.current, level, draft },
    });
    if (mounted.current) { accept(response.roadmap); setNotice('Đã lưu bản nháp. Trang học chỉ thay đổi sau khi xuất bản.'); }
  });
  const prepare = (kind: 'preview' | 'publish') => run('preview', async () => {
    const result = await request<JlptPreview>('/admin/jlpt/roadmaps/preview', { body: { draft } });
    if (mounted.current) { setPreview(result); remember(result); setDialog(kind); }
  });
  const changeStatus = (kind: 'publish' | 'archive' | 'restore') => run(kind, async () => {
    if (!saved) return;
    const result = await request<{ roadmap: AdminJlptRoadmap }>(`/admin/jlpt/roadmaps/${saved.id}/${kind}`, { body: { version: saved.version } });
    if (mounted.current) { accept(result.roadmap); setDialog(null); setNotice(kind === 'publish' ? 'Đã xuất bản lộ trình vào trang học.' : kind === 'archive' ? 'Đã lưu trữ lộ trình. Nội dung gốc và lịch sử được giữ nguyên.' : 'Đã khôi phục lộ trình về bản nháp.'); }
  });
  const reload = () => run('reload', async () => {
    if (!saved) return;
    const result = await request<{ roadmap: AdminJlptRoadmap }>(`/admin/jlpt/roadmaps/${saved.id}`);
    if (mounted.current) { accept(result.roadmap); setDialog(null); setLabels({}); setLabelsRetry(value => value + 1); }
  });
  const source = sources.find(item => item.id === draft.sourceId), selected = draft.sessions.find(session => session.id === pickerSession);
  const blocked = !!pending || archived, canPublish = !!saved && !dirty && !pending && !archived && !conflict;
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{saved ? `Biên tập lộ trình ${level}` : 'Thêm lộ trình JLPT'}</h1><p className="mt-2 text-sm text-slate-500">{saved ? `Phiên bản ${saved.version} · ${jlptStatus(saved)}` : 'Mỗi cấp độ có một lộ trình.'}{dirty ? ' · Chưa lưu' : ''}</p></div><button className={button} disabled={!!pending} onClick={() => dirty ? setDialog('close') : onClose()}>Về danh sách</button></div>
    {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error && <div role="alert" className="mb-4 whitespace-pre-wrap rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}{conflict && saved && <p className="mt-2">Nội dung đang nhập được giữ. <button className="font-semibold underline" disabled={!!pending} onClick={() => setDialog('reload')}>Tải bản mới nhất</button></p>}</div>}
    {archived && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Lộ trình đã lưu trữ. Khôi phục về nháp để chỉnh sửa.</p>}
    <fieldset disabled={blocked} className="min-w-0 space-y-5">
      <section className={`${panel} grid gap-4 sm:grid-cols-2`}>
        <label className="text-sm font-medium">Tên lộ trình *<input className={input} value={draft.title} maxLength={150} onChange={event => edit(old => ({ ...old, title: event.target.value }))} /></label>
        <label className="text-sm font-medium">Cấp độ<select className={input} value={level} disabled={!!saved} onChange={event => { setLevel(event.target.value as JlptLevel); setNotice(''); }}>{(saved ? [saved.level] : availableLevels).map(value => <option key={value}>{value}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Cấp độ không đổi sau khi tạo.</span></label>
        <label className="text-sm font-medium sm:col-span-2">Giới thiệu<textarea className={input} rows={3} value={draft.description} maxLength={2000} onChange={event => edit(old => ({ ...old, description: event.target.value }))} /></label>
        <label className="text-sm font-medium sm:col-span-2">Điểm đạt bài kiểm tra (%)<input className={input} type="number" min={1} max={100} step={1} value={draft.passPercent ?? 80} onChange={event => edit(old => ({ ...old, passPercent: Number(event.target.value) }))} /><span className="mt-2 block text-xs font-normal text-slate-500">Đạt mức này hoàn thành buổi và mở buổi tiếp theo. Đổi mức cần xuất bản lại; giữ nguyên mốc đã đạt.</span></label>
        <label className="text-sm font-medium sm:col-span-2">Nguồn biên soạn lộ trình<select className={input} value={draft.sourceId ?? ''} onChange={event => edit(old => ({ ...old, sourceId: event.target.value || null }))}><option value="">Chưa chọn (chỉ lưu nháp)</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name} · {item.version}</option>)}</select></label>
        <div className="text-xs leading-6 text-slate-500 sm:col-span-2">{source && <><p>{source.license} · {source.attribution}</p><p className="break-all">{source.url}</p></>}<button className={`${button} mt-2`} onClick={() => setDialog('source')}>Thêm nguồn</button></div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Các buổi học</h2><p className="mt-1 text-xs text-slate-500">{counts.sessions} buổi · {counts.resources} liên kết · {counts.minutes} phút dự kiến. Thứ tự dưới đây là thứ tự trên trang học.</p></div><button className={button} disabled={draft.sessions.length >= 200} onClick={() => edit(old => ({ ...old, sessions: [...old.sessions, { id: crypto.randomUUID(), title: `Buổi ${old.sessions.length + 1}`, description: '', estimatedMinutes: 0, resources: [] }] }))}>Thêm buổi học</button></div>
      {labelsError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Chưa tải được tên nội dung liên kết: {labelsError} <button className="underline" onClick={() => setLabelsRetry(value => value + 1)}>Thử lại</button></p>}
      {!draft.sessions.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có buổi học. Thêm buổi rồi chọn nội dung đã xuất bản trong kho.</p>}
      {draft.sessions.map((session, index) => <section key={session.id} className={panel} aria-label={`Buổi học ${index + 1}`}>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm font-medium">Tên buổi {index + 1}<input className={input} maxLength={150} value={session.title} onChange={event => patchSession(session.id, old => ({ ...old, title: event.target.value }))} /></label><label className="w-40 text-sm font-medium">Thời lượng (phút)<input className={input} type="number" min={0} max={1440} step={1} value={session.estimatedMinutes} onChange={event => patchSession(session.id, old => ({ ...old, estimatedMinutes: Number(event.target.value) }))} /></label><OrderButtons index={index} length={draft.sessions.length} label={`buổi ${index + 1}`} onMove={offset => edit(old => ({ ...old, sessions: moveJlptItem(old.sessions, index, offset) }))} /><button className={`${button} !text-red-700`} onClick={() => setRemoveSession(session)}>Bỏ buổi</button></div>
        <label className="mt-3 block text-sm">Mô tả buổi học<textarea className={input} rows={2} maxLength={2000} value={session.description} onChange={event => patchSession(session.id, old => ({ ...old, description: event.target.value }))} /></label>
        <div className="mt-4 space-y-2">{session.resources.map((resource, resourceIndex) => {
          const detail = labels[resourceKey(resource)];
          return <div key={resource.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${detail?.available === false ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{detail?.title || `${resourceLabels[resource.kind]} · đang lấy tên…`}</p><p className="mt-1 break-words text-xs text-slate-500">{resourceLabels[resource.kind]}{detail?.subtitle ? ` · ${detail.subtitle}` : ''}{detail?.level ? ` · ${detail.level}` : ''}</p>{detail?.available === false && <p className="mt-1 text-xs text-amber-800">Nội dung không còn sẵn có trong kho công khai. Cần thay liên kết trước khi xuất bản.</p>}</div>
            <div className="flex gap-2"><OrderButtons index={resourceIndex} length={session.resources.length} label={`nội dung ${resourceIndex + 1} của buổi ${index + 1}`} onMove={offset => patchSession(session.id, old => ({ ...old, resources: moveJlptItem(old.resources, resourceIndex, offset) }))} /><button className={`${button} !text-red-700`} onClick={() => patchSession(session.id, old => ({ ...old, resources: old.resources.filter(item => item.id !== resource.id) }))}>Bỏ liên kết</button></div>
          </div>;
        })}</div>
        <button className={`${button} mt-3`} disabled={session.resources.length >= 200 || counts.resources >= 2000} onClick={() => setPickerSession(session.id)}>Chọn nội dung từ kho</button>
        {!session.resources.length && <p className="mt-2 text-xs text-slate-500">Buổi này cần ít nhất một nội dung để xuất bản.</p>}
        <JlptTestEditor questions={session.questions ?? []} onChange={questions => patchSession(session.id, old => ({ ...old, questions }))} />
      </section>)}
    </fieldset>
    <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 py-4">
      <button className={primary} disabled={blocked || conflict || (!dirty && !!saved) || (!saved && !availableLevels.length)} onClick={save}>{pending === 'save' ? 'Đang lưu…' : 'Lưu bản nháp'}</button>
      <button className={button} disabled={!!pending || !draft.title.trim()} onClick={() => void prepare('preview')}>Xem trước nội dung</button>
      {archived ? <button className={button} disabled={!!pending} onClick={() => setDialog('restore')}>Khôi phục về nháp…</button> : <><button className={primary} disabled={!canPublish} onClick={() => void prepare('publish')}>Xuất bản…</button><button className={button} disabled={!saved || !!pending || dirty || conflict} onClick={() => setDialog('archive')}>Lưu trữ…</button></>}
      <p className="text-xs text-slate-500">{dirty || !saved ? 'Lưu bản nháp trước khi xuất bản.' : 'Xem trước để kiểm tra nguồn và các liên kết hiện có.'}</p>
    </div>
    {selected && <JlptResourcePicker request={request} level={level} selected={selected.resources} canAdd={selected.resources.length < 200 && counts.resources < 2000} onClose={() => setPickerSession(null)} onSelect={option => {
      setLabels(old => ({ ...old, [resourceKey(option)]: option }));
      edit(old => jlptDraftCounts(old).resources >= 2000 ? old : ({ ...old, sessions: old.sessions.map(session => session.id !== selected.id || session.resources.length >= 200 ? session : appendJlptResource(session, option)) }));
    }} />}
    {dialog === 'source' && <JlptSourceDialog request={request} onClose={() => setDialog(null)} onAdded={value => { onSourceAdded(value); edit(old => ({ ...old, sourceId: value.id })); setDialog(null); }} />}
    {(dialog === 'preview' || dialog === 'publish') && preview && <AdminDialog title={dialog === 'publish' ? 'Xác nhận xuất bản lộ trình' : 'Xem trước lộ trình'} busy={!!pending} onClose={() => setDialog(null)}>
      <JlptPreviewContent preview={preview} level={level} savedVersion={saved?.version ?? null} dirty={dirty} />
      {dialog === 'publish' && <div className="mt-5"><p className="mb-4 text-sm text-slate-600">Xuất bản bản đã lưu hiện tại lên trang học. Hệ thống sẽ kiểm tra lại nguồn, phiên bản và từng liên kết.</p><button className={primary} disabled={!!pending || !preview.canPublish || !canPublish} onClick={() => void changeStatus('publish')}>Xác nhận xuất bản</button>{error && <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-red-700">{error}</p>}</div>}
    </AdminDialog>}
    {dialog && !['preview', 'publish', 'source'].includes(dialog) && <AdminDialog title={{ archive: 'Lưu trữ lộ trình?', restore: 'Khôi phục lộ trình?', reload: 'Tải bản mới nhất?', close: 'Rời nội dung đang nhập?' }[dialog as 'archive' | 'restore' | 'reload' | 'close']} busy={!!pending} onClose={() => setDialog(null)}>
      <p className="mb-5 text-sm leading-6 text-slate-600">{dialog === 'archive' ? 'Lộ trình sẽ ẩn khỏi kho học. Các buổi, liên kết và nội dung gốc được giữ nguyên.' : dialog === 'restore' ? 'Lộ trình được khôi phục về nháp. Rà soát các liên kết rồi xuất bản để hiển thị lại trên trang học.' : 'Thay đổi chưa lưu sẽ bị bỏ. Bản nháp đã lưu trên máy chủ vẫn được giữ.'}</p>
      <div className="flex justify-end gap-3"><button className={button} disabled={!!pending} onClick={() => setDialog(null)}>Hủy</button><button className={primary} disabled={!!pending} onClick={() => dialog === 'close' ? onClose() : dialog === 'reload' ? void reload() : void changeStatus(dialog as 'archive' | 'restore')}>{dialog === 'archive' ? 'Lưu trữ' : dialog === 'restore' ? 'Khôi phục về nháp' : dialog === 'reload' ? 'Tải bản mới nhất' : 'Rời trang'}</button></div>
      {error && <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-red-700">{error}</p>}
    </AdminDialog>}
    {removeSession && <AdminDialog title={`Bỏ “${removeSession.title}” khỏi lộ trình?`} onClose={() => setRemoveSession(null)}><p className="mb-5 text-sm text-slate-600">Bỏ buổi và {removeSession.resources.length} liên kết khỏi bản nháp. Nội dung gốc trong các kho vẫn được giữ.</p><div className="flex justify-end gap-3"><button className={button} onClick={() => setRemoveSession(null)}>Hủy</button><button className={primary} onClick={() => { edit(old => ({ ...old, sessions: old.sessions.filter(session => session.id !== removeSession.id) })); setRemoveSession(null); }}>Bỏ buổi</button></div></AdminDialog>}
  </>;
}

