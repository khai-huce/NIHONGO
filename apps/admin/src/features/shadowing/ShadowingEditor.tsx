import { useToastFeedback } from '@nihongo/client/toast';
import { useEffect, useRef, useState } from 'react';
import type { ShadowingAiRequest, ShadowingContent, ShadowingDetailResponse, ShadowingDraftInput, ShadowingVideo } from '@nihongo/shared/contracts/shadowing';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { contentToShadowingForm, formatShadowingTime, shadowingBody, shadowingForm, type ShadowingForm } from './shadowing-editor-data';
import { ShadowingImport } from './ShadowingImport';
import { ShadowingSource } from './ShadowingSource';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const primary = `${button} !border-blue-600 !bg-blue-600 !text-white`;
const fingerprint = (form: ShadowingForm) => JSON.stringify({ ...form, transcriptReviewed: false });
type Props = { video: ShadowingVideo | null; sources: ContentSource[]; request: AdminRequest; onSaved: (video: ShadowingVideo) => void; onClose: () => void; onSourceAdded: (source: ContentSource) => void; onDirtyChange: (dirty: boolean) => void };
type Dialog = 'preview' | 'import' | 'source' | 'publish' | 'archive' | 'restore' | 'reload' | 'close' | 'ai' | null;

export function ShadowingEditor({ video, sources, request, onSaved, onClose, onSourceAdded, onDirtyChange }: Props) {
  const [saved, setSaved] = useState(video), [form, setForm] = useState(() => shadowingForm(video ?? undefined));
  const [baseline, setBaseline] = useState(() => fingerprint(shadowingForm(video ?? undefined)));
  const [pending, setPending] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false);
  useToastFeedback({ success: notice, error });
  const [dialog, setDialog] = useState<Dialog>(null), [preview, setPreview] = useState<ShadowingContent | null>(video?.content ?? null), [page, setPage] = useState(1);
  const [ai, setAi] = useState<ShadowingAiRequest | null>(null), [aiError, setAiError] = useState(''), [aiRetry, setAiRetry] = useState(0), [aiChecked, setAiChecked] = useState(false);
  const id = useRef(video?.id ?? crypto.randomUUID()), aiId = useRef<{ url: string; id: string } | null>(null), mounted = useRef(false), locked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onDirtyChange(false); }; }, [onDirtyChange]);
  const dirty = fingerprint(form) !== baseline, generating = ai?.status === 'pending', archived = saved?.status === 'archived';
  const blocked = !!pending || generating || conflict || archived;
  useEffect(() => { onDirtyChange(dirty || !!pending || generating); }, [dirty, pending, generating, onDirtyChange]);
  const edit = (patch: Partial<ShadowingForm>) => { setForm(previous => ({ ...previous, ...patch, transcriptReviewed: false })); setPreview(null); setNotice(''); };
  const accept = (next: ShadowingVideo) => { const value = shadowingForm(next); setSaved(next); setForm(value); setBaseline(fingerprint(value)); setPreview(next.content); setConflict(false); onSaved(next); };
  const run = async (kind: string, action: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setPending(kind); setError(''); setNotice('');
    try { await action(); }
    catch (caught) { if (mounted.current) { setError(caught instanceof Error ? caught.message : 'Chưa nhận được xác nhận từ máy chủ.'); if (caught && typeof caught === 'object' && 'code' in caught && ['SHADOWING_CHANGED', 'ACCOUNT_CHANGED'].includes(String(caught.code))) setConflict(true); } }
    finally { locked.current = false; if (mounted.current) setPending(''); }
  };
  const save = () => run('save', async () => {
    const body = shadowingBody(form);
    const result = await request<ShadowingDetailResponse>(saved ? `/admin/shadowing/videos/${saved.id}` : '/admin/shadowing/videos', { method: saved ? 'PATCH' : 'POST', body: { ...body, ...(saved ? { version: saved.version } : { id: id.current }) } });
    if (mounted.current) { accept(result.video); setNotice('Đã lưu bản nháp. Trang học chỉ thay đổi khi xuất bản.'); }
  });
  const prepare = () => run('preview', async () => {
    const { sourceId: _sourceId, transcriptReviewed: _reviewed, ...body } = shadowingBody(form);
    const result = await request<{ content: ShadowingContent }>('/admin/shadowing/videos/prepare', { method: 'POST', body });
    if (mounted.current) { setPreview(result.content); setDialog('preview'); }
  });
  const action = (kind: 'publish' | 'archive' | 'restore') => run(kind, async () => {
    if (!saved) return;
    const result = await request<ShadowingDetailResponse>(`/admin/shadowing/videos/${saved.id}/${kind}`, { method: 'POST', body: { version: saved.version, ...(kind === 'publish' ? { transcriptReviewed: form.transcriptReviewed } : {}) } });
    if (mounted.current) { accept(result.video); setDialog(null); setNotice(kind === 'publish' ? 'Đã xuất bản video vào thư viện học.' : kind === 'archive' ? 'Đã lưu trữ. Nội dung và tiến độ được giữ.' : 'Đã khôi phục về bản nháp.'); }
  });
  const reload = () => run('reload', async () => {
    if (!saved) return; const result = await request<ShadowingDetailResponse>(`/admin/shadowing/videos/${saved.id}`);
    if (mounted.current) { accept(result.video); setDialog(null); setNotice('Đã tải bản mới nhất.'); }
  });
  const startAi = () => run('ai', async () => {
    if (!aiId.current || aiId.current.url !== form.url || ai?.status === 'ready' || ai?.status === 'failed') aiId.current = { url: form.url, id: crypto.randomUUID() };
    const result = await request<{ request: ShadowingAiRequest }>('/shadowing/ai', { method: 'POST', body: { id: aiId.current.id, url: form.url } });
    if (mounted.current) { setAi(result.request); setAiError(''); setAiChecked(false); setDialog('ai'); }
  });
  useEffect(() => {
    if (!ai || ai.status !== 'pending') return;
    let live = true; const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const result = await request<{ request: ShadowingAiRequest }>(`/shadowing/ai/${ai.id}`, { signal: controller.signal }); if (!live) return; setAi(result.request); setAiError(''); if (result.request.status === 'pending') timer = setTimeout(poll, 1800); }
      catch (caught) { if (live) setAiError(caught instanceof Error ? caught.message : 'Chưa lấy được kết quả AI.'); }
    };
    timer = setTimeout(poll, 1000);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [ai?.id, ai?.status, aiRetry, request]);
  const updateSentence = (index: number, patch: Partial<ShadowingDraftInput['sentences'][number]>) => edit({ sentences: form.sentences.map((row, i) => i === index ? { ...row, ...patch } : row) });
  const pages = Math.max(1, Math.ceil(form.sentences.length / 25)), currentPage = Math.min(page, pages);
  const source = sources.find(row => row.id === form.sourceId);
  const close = () => dirty || generating ? setDialog('close') : onClose();
  return <>
    <div className="mb-6 flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">{saved ? 'Biên tập video Shadowing' : 'Thêm video Shadowing'}</h1><p className="mt-2 text-sm text-slate-500">{saved ? `Phiên bản ${saved.version} · ${archived ? 'Đã lưu trữ' : saved.publishedVersion === null ? 'Bản nháp' : saved.version > saved.publishedVersion ? 'Có bản nháp mới' : 'Đã xuất bản'}` : 'Lưu nháp, rà soát phụ đề rồi xuất bản.'}</p></div><button className={button} disabled={!!pending} onClick={close}>Về danh sách</button></div>
    {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {conflict && <p className="mb-4 text-sm">Bản trên máy chủ hoặc phiên quản trị đã thay đổi. Nội dung đang nhập vẫn được giữ. <button className="text-blue-700 underline" onClick={() => setDialog('reload')}>Tải bản mới nhất</button></p>}
    <fieldset disabled={blocked} className="min-w-0 space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Link YouTube *<input className={input} value={form.url} maxLength={2048} placeholder="https://www.youtube.com/watch?v=…" onChange={event => edit({ url: event.target.value })} /></label><label className="text-sm">Cấp độ<select className={input} value={form.level ?? ''} onChange={event => edit({ level: event.target.value ? event.target.value as ShadowingForm['level'] : null })}><option value="">Chưa phân loại</option>{['N5', 'N4', 'N3', 'N2', 'N1'].map(level => <option key={level}>{level}</option>)}</select></label><label className="text-sm">Nguồn nội dung<select className={input} value={form.sourceId ?? ''} onChange={event => edit({ sourceId: event.target.value || null })}><option value="">Chưa chọn (chỉ lưu nháp)</option>{sources.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-sm sm:col-span-2">Mô tả<textarea className={`${input} h-24`} value={form.description} maxLength={2000} onChange={event => edit({ description: event.target.value })} /></label></div>
        {source && <p className="mt-3 text-xs leading-5 text-slate-500">{source.name} · {source.license}<br />{source.attribution}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={() => setDialog('source')}>Thêm nguồn</button><button className={button} disabled={!form.url.trim()} onClick={prepare}>Kiểm tra video / Xem trước</button><button className={button} disabled={!form.url.trim()} onClick={startAi}>Gemini tạo phụ đề + dịch</button></div>
        <p className="mt-3 text-xs text-slate-500">Tên, kênh và thời lượng được lấy từ YouTube. Gemini dùng hạn mức miễn phí đã cấu hình; kết quả cần xem lại trước khi lưu.</p>
        {preview && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><p className="font-semibold">{preview.title}</p><p className="mt-1 text-slate-500">{preview.channel} · {formatShadowingTime(preview.durationMs)} · {preview.sentences.length} câu</p></div>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Phụ đề và bản dịch ({form.sentences.length} câu)</h2><div className="flex gap-2"><button className={button} onClick={() => setDialog('import')}>Nhập JSON / SRT / VTT</button><button className={button} disabled={form.sentences.length >= 500} onClick={() => { const startMs = form.sentences.at(-1)?.endMs ?? 0; edit({ sentences: [...form.sentences, { id: crypto.randomUUID(), startMs, endMs: startMs + 1000, text: '', translationVi: '' }] }); setPage(Math.ceil((form.sentences.length + 1) / 25)); }}>Thêm câu</button></div></div><p className="mb-4 text-xs text-slate-500">Mốc bắt đầu/kết thúc tính bằng giây, chính xác đến 0,001 giây. Các câu theo thứ tự, không chồng lấn. Furigana được tạo từ từ điển khi lưu.</p>
        {!form.sentences.length && <p className="py-5 text-sm text-slate-500">Chưa có phụ đề. Thêm câu, nhập tệp hoặc dùng Gemini để tạo bản cần rà soát.</p>}
        <div className="space-y-4">{form.sentences.slice((currentPage - 1) * 25, currentPage * 25).map((row, offset) => { const index = (currentPage - 1) * 25 + offset; return <div key={row.id ?? index} className="rounded-lg border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">Câu {index + 1}</b><button className={`${button} text-red-700`} onClick={() => edit({ sentences: form.sentences.filter((_, i) => i !== index) })}>Bỏ câu</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Bắt đầu (giây)<input className={input} type="number" min="0" max="1800" step="0.001" value={row.startMs / 1000} onChange={event => updateSentence(index, { startMs: Math.round(Number(event.target.value) * 1000) })} /></label><label className="text-xs">Kết thúc (giây)<input className={input} type="number" min="0" max="1800" step="0.001" value={row.endMs / 1000} onChange={event => updateSentence(index, { endMs: Math.round(Number(event.target.value) * 1000) })} /></label><label className="text-xs">Tiếng Nhật *<textarea className={`${input} h-24`} value={row.text} maxLength={600} onChange={event => updateSentence(index, { text: event.target.value })} /></label><label className="text-xs">Bản dịch tiếng Việt<textarea className={`${input} h-24`} value={row.translationVi ?? ''} maxLength={2000} onChange={event => updateSentence(index, { translationVi: event.target.value })} /></label></div></div>; })}</div>
        {pages > 1 && <div className="mt-4 flex items-center justify-end gap-3 text-sm"><button className={button} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</button>Trang {currentPage}/{pages}<button className={button} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sau</button></div>}
      </section>
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={form.transcriptReviewed} onChange={event => setForm(value => ({ ...value, transcriptReviewed: event.target.checked }))} />Tôi đã nghe, rà soát nội dung, bản dịch, mốc thời gian và quyền sử dụng của bản này.</label>
    </fieldset>
    {generating && <p role="status" className="my-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">Gemini đang tạo bản phụ đề cần rà soát. <button className="underline" onClick={() => setDialog('ai')}>Xem trạng thái</button></p>}
    <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-3 border-t bg-slate-50 py-4"><button className={primary} disabled={blocked || (!dirty && !!saved)} onClick={save}>{pending === 'save' ? 'Đang lưu…' : 'Lưu bản nháp'}</button><button className={button} disabled={blocked || !form.url.trim()} onClick={prepare}>Xem trước nội dung</button>{!archived ? <><button className={primary} disabled={blocked || !saved || dirty || !form.sourceId || !form.sentences.length || !form.transcriptReviewed} onClick={() => setDialog('publish')}>Xuất bản…</button><button className={button} disabled={!!pending || generating || !saved || conflict || dirty} onClick={() => setDialog('archive')}>Lưu trữ…</button></> : <button className={button} disabled={!!pending || conflict} onClick={() => setDialog('restore')}>Khôi phục về nháp…</button>}<span className="text-xs text-slate-500">Lưu nháp → rà soát → xuất bản.</span></div>
    {dialog === 'import' && <ShadowingImport onClose={() => setDialog(null)} onApply={rows => { edit({ sentences: rows }); setPage(1); setDialog(null); setNotice('Đã thay phụ đề trong bản đang nhập. Rà soát rồi lưu bản nháp.'); }} />}
    {dialog === 'source' && <ShadowingSource request={request} onClose={() => setDialog(null)} onAdded={source => { onSourceAdded(source); edit({ sourceId: source.id }); setDialog(null); }} />}
    {dialog === 'preview' && preview && <AdminDialog title="Xem trước bản nháp Shadowing" onClose={() => setDialog(null)}><ContentPreview content={preview} /></AdminDialog>}
    {dialog === 'ai' && <AdminDialog title="Phụ đề do Gemini tạo" busy={pending === 'ai'} onClose={() => setDialog(null)}>
      {ai?.status === 'pending' && <p role="status" className="text-sm">Đang xử lý video. Chưa lưu phụ đề vào thư viện.</p>}{aiError && <p role="alert" className="mt-3 text-sm text-red-700">{aiError} <button className="underline" onClick={() => { setAiError(''); setAiRetry(value => value + 1); }}>Lấy lại trạng thái</button></p>}{ai?.status === 'failed' && <p role="alert" className="text-sm text-red-700">{ai.error || 'Chưa tạo được phụ đề. Bạn có thể nhập phụ đề thủ công.'}</p>}
      {ai?.status === 'ready' && ai.content && <><p className="mb-4 text-sm text-amber-800">Đây là bản do AI tạo. Nghe và kiểm tra từng câu, bản dịch, mốc thời gian trước khi xuất bản. Dùng bản này sẽ thay phụ đề đang nhập.</p><ContentPreview content={ai.content} /><label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={aiChecked} onChange={event => setAiChecked(event.target.checked)} />Tôi muốn đưa bản này vào trình sửa để rà soát.</label><button className={primary} disabled={!aiChecked} onClick={() => { const content = ai.content!; const next = contentToShadowingForm(content, form.sourceId); edit({ ...next, level: form.level, description: form.description }); setPreview(content); setPage(1); setDialog(null); setNotice('Đã đưa kết quả AI vào bản đang nhập. Chưa lưu hoặc xuất bản.'); }}>Dùng bản này để chỉnh sửa</button></>}
    </AdminDialog>}
    {dialog && ['publish', 'archive', 'restore', 'reload', 'close'].includes(dialog) && <AdminDialog title={dialog === 'publish' ? 'Xuất bản video?' : dialog === 'archive' ? 'Lưu trữ video?' : dialog === 'restore' ? 'Khôi phục về nháp?' : dialog === 'reload' ? 'Tải bản mới nhất?' : 'Rời nội dung đang nhập?'} busy={!!pending} onClose={() => setDialog(null)}><p className="mb-5 text-sm leading-6 text-slate-600">{dialog === 'publish' ? `Đưa ${form.sentences.length} câu của bản đã lưu vào thư viện công khai. Nội dung và mốc thời gian đã được bạn rà soát.` : dialog === 'archive' ? 'Video sẽ bị ẩn khỏi thư viện. Bản nháp và tiến độ học vẫn được giữ.' : dialog === 'restore' ? 'Khôi phục bản nháp; video chỉ hiện lại sau khi xuất bản.' : 'Thay đổi chưa lưu sẽ bị bỏ. Bản nháp đã lưu vẫn được giữ.'}</p><div className="flex justify-end gap-3"><button className={button} disabled={!!pending} onClick={() => setDialog(null)}>Hủy</button><button className={primary} disabled={!!pending} onClick={() => { if (dialog === 'close') onClose(); else if (dialog === 'reload') void reload(); else if (dialog === 'publish' || dialog === 'archive' || dialog === 'restore') void action(dialog); }}>{dialog === 'publish' ? 'Xác nhận xuất bản' : dialog === 'archive' ? 'Lưu trữ' : dialog === 'restore' ? 'Khôi phục' : dialog === 'reload' ? 'Tải bản mới nhất' : 'Rời trang'}</button></div></AdminDialog>}
  </>;
}

function ContentPreview({ content }: { content: ShadowingContent }) {
  return <div className="space-y-4"><div><h3 className="text-lg font-semibold">{content.title}</h3><p className="mt-1 text-sm text-slate-500">{content.channel} · {formatShadowingTime(content.durationMs)} · {content.level ?? 'Chưa phân loại'}</p><a className="mt-2 inline-block text-sm text-blue-700 underline" href={`https://www.youtube.com/watch?v=${content.youtubeId}`} target="_blank" rel="noreferrer">Mở video để đối chiếu</a></div>{!content.sentences.length && <p className="text-sm text-slate-500">Chưa có phụ đề.</p>}{content.sentences.map((row, index) => <div key={row.id} className="rounded-lg border border-slate-200 p-4"><p className="mb-2 text-xs text-slate-500">#{index + 1} · {formatShadowingTime(row.startMs)} → {formatShadowingTime(row.endMs)}</p><p className="whitespace-pre-wrap text-lg leading-9">{row.tokens.map((token, i) => token.reading ? <ruby key={i}>{token.text}<rt className="text-[10px]">{token.reading}</rt></ruby> : <span key={i}>{token.text}</span>)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{row.translationVi || 'Chưa có bản dịch.'}</p></div>)}</div>;
}
