import { useEffect, useRef, useState } from 'react';
import { SentenceRubyEditor, ReadingSupplementEditor } from './ReadingSupplementEditor';
import { ReadingSupplementPreview } from './ReadingSupplementPreview';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { readingEditorBody, readingEditorForm, reconcileReading, validAdminReadingAudio, type AdminReading, type ReadingContent } from './reading-editor-data';
import { formatReadingTime, type ReadingAudio } from '@nihongo/client/reading';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const primary = `${button} !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700`;
type Props = { article: AdminReading | null; sources: ContentSource[]; request: AdminRequest; onSaved: (article: AdminReading) => void;
  onClose: () => void; onSourceAdded: (source: ContentSource) => void; onDirtyChange: (dirty: boolean) => void };
const emptySource: ContentSource = { id: '', name: '', url: '', license: '', licenseUrl: '', version: '', checksum: '', attribution: '', notes: '' };
const sourceLabels: Record<keyof ContentSource, string> = { id: 'Mã nguồn', name: 'Tên nguồn', url: 'URL / URI nguồn', license: 'Quyền sử dụng', licenseUrl: 'URL / URI điều khoản', version: 'Phiên bản / ngày', checksum: 'Checksum (nếu có)', attribution: 'Ghi công', notes: 'Ghi chú' };

function PreviewAudio({ segment, players, onPlay, onError }: { segment: ReadingAudio['segments'][number]; players: Map<string, HTMLAudioElement>; onPlay: () => void; onError: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    player.src = segment.url;
    players.set(segment.sentenceId, player);
    return () => { player.pause(); player.removeAttribute('src'); player.load(); players.delete(segment.sentenceId); };
  }, [players, segment.sentenceId, segment.url]);
  return <audio ref={ref} controls preload="none" className="mt-3 h-9 w-full" aria-label={`Nghe câu ${segment.sentenceId}`} src={segment.url}
    onPlay={event => { players.forEach(player => { if (player !== event.currentTarget) player.pause(); }); onPlay(); }} onError={onError} />;
}

function ReadingPreview({ content, audio }: { content: ReadingContent; audio: ReadingAudio | null }) {
  const players = useRef(new Map<string, HTMLAudioElement>());
  const [error, setError] = useState('');
  return <div className="space-y-5"><div><h3 className="text-xl font-semibold">{content.title}</h3>{content.subtitle && <p className="mt-2 text-sm text-slate-600">{content.subtitle}</p>}</div>
    <p className="text-xs text-slate-500">{audio ? `Audio: ${formatReadingTime(audio.totalSeconds)} · ${audio.voice}` : 'Chưa có audio khớp bản này. Lưu bản nháp rồi tạo audio để nghe.'}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {content.paragraphs.map(paragraph => <div key={paragraph.id} className="space-y-3">{paragraph.sentences.map(sentence => {
      const segment = audio?.segments.find(item => item.sentenceId === sentence.id);
      return <div key={sentence.id} className="rounded-lg border border-slate-200 p-4"><p className="font-japanese text-lg leading-8">{sentence.ruby?.length ? sentence.ruby.map((part, index) => part.reading ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby> : <span key={index}>{part.text}</span>) : sentence.japanese}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{sentence.translation || 'Chưa có bản dịch.'}</p>{segment && <PreviewAudio segment={segment} players={players.current} onPlay={() => setError('')} onError={() => setError('Không tải được audio. Hãy đóng xem trước và tải lại bài để kiểm tra phiên bản hoặc quyền truy cập.')} />}</div>;
    })}</div>)}
    <ReadingSupplementPreview content={content} />
  </div>;
}

export function ReadingEditor({ article, sources, request, onSaved, onClose, onSourceAdded, onDirtyChange }: Props) {
  const [saved, setSaved] = useState(article), [form, setForm] = useState(() => readingEditorForm(article ?? undefined));
  const [baseline, setBaseline] = useState(() => JSON.stringify(readingEditorForm(article ?? undefined)));
  const [pending, setPending] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<'preview' | 'segment' | 'archive' | 'restore' | 'reload' | 'close' | 'source' | null>(null);
  const [candidate, setCandidate] = useState<ReturnType<typeof reconcileReading> | null>(null), [checked, setChecked] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<ContentSource>({ ...emptySource }), [sourceError, setSourceError] = useState('');
  const id = useRef(article?.id ?? crypto.randomUUID()), mounted = useRef(true), locked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dirty = JSON.stringify(form) !== baseline, needsSplit = form.text !== form.content.text || !form.content.paragraphs.length;
  const selectedSource = sources.find(source => source.id === form.sourceId);
  const usableAudio = saved && saved.text === form.text && validAdminReadingAudio(saved.audio, saved) ? saved.audio : null;
  useEffect(() => { onDirtyChange(dirty || !!pending); }, [dirty, pending, onDirtyChange]);
  const fail = (caught: unknown) => {
    setError(caught instanceof Error ? caught.message : 'Chưa thực hiện được. Nội dung đang nhập vẫn được giữ.');
    if (saved && typeof caught === 'object' && caught && 'code' in caught && ['ARTICLE_CHANGED', 'ACCOUNT_CHANGED'].includes(String(caught.code))) setConflict(true);
    if (saved && typeof caught === 'object' && caught && 'code' in caught && caught.code === 'AUDIO_REQUIRED') {
      const next = { ...saved, audio: null }; setSaved(next); onSaved(next);
    }
  };
  const run = async (kind: string, action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setPending(kind); setError(''); setNotice('');
    try { await action(); } catch (caught) { if (mounted.current) fail(caught); }
    finally { locked.current = false; if (mounted.current) setPending(''); }
  };
  const accept = (next: AdminReading) => {
    const nextForm = readingEditorForm(next); setSaved(next); setForm(nextForm); setBaseline(JSON.stringify(nextForm)); setConflict(false); onSaved(next);
  };
  const save = () => run('save', async () => {
    const body = readingEditorBody(form, saved);
    const result = await request<{ article: AdminReading }>(saved ? `/admin/reading/articles/${saved.id}` : '/admin/reading/articles', {
      method: saved ? 'PATCH' : 'POST', body: { ...body, ...(saved ? { version: saved.version } : { id: id.current }) },
    });
    if (!mounted.current) return; accept(result.article); setNotice('Đã lưu bản nháp. Trang học chỉ thay đổi khi xuất bản.');
  });
  const split = () => run('split', async () => {
    const result = await request<{ content: ReadingContent }>('/admin/reading/articles/preview', { method: 'POST', body: { title: form.title, subtitle: form.subtitle, text: form.text } });
    if (!mounted.current) return;
    const next = reconcileReading(form.content, result.content);
    if (!form.content.paragraphs.length) { setForm(previous => ({ ...previous, content: next.content, translationsReviewed: true })); setNotice('Đã tách câu. Bạn có thể nhập bản dịch bên dưới.'); }
    else { setCandidate(next); setChecked(false); setDialog('segment'); }
  });
  const generate = () => run('audio', async () => {
    if (!saved || dirty || saved.archived) return;
    const result = await request<{ audio: ReadingAudio }>(`/admin/reading/articles/${saved.id}/audio`, { method: 'POST', body: { version: saved.version }, timeoutMs: 210000 });
    if (!mounted.current) return;
    if (!validAdminReadingAudio(result.audio, saved)) throw new Error('Audio không khớp bản nháp hiện tại. Hãy tải lại bài.');
    const next = { ...saved, audio: result.audio }; setSaved(next); onSaved(next); setNotice('Audio đã sẵn sàng. Mở xem trước để nghe từng câu trước khi xuất bản.');
  });
  const changeStatus = (action: 'publish' | 'archive' | 'restore') => run(action, async () => {
    if (!saved || dirty || conflict) return;
    const result = await request<{ article: AdminReading }>(`/admin/reading/articles/${saved.id}/${action}`, { method: 'POST', body: { version: saved.version } });
    if (!mounted.current) return; accept(result.article); setDialog(null); setNotice(action === 'publish' ? 'Đã xuất bản bài đọc và audio.' : action === 'archive' ? 'Đã lưu trữ bài đọc; nội dung và audio được giữ.' : 'Đã khôi phục về bản nháp. Chưa hiển thị trên trang học.');
  });
  const reload = () => run('reload', async () => {
    if (!saved) return;
    const result = await request<{ article: AdminReading }>(`/admin/reading/articles/${saved.id}`);
    if (!mounted.current) return; accept(result.article); setDialog(null); setNotice('Đã tải bản mới nhất.');
  });
  const createSource = async () => {
    if (locked.current) return; locked.current = true; setPending('source'); setSourceError('');
    try {
      const result = await request<{ source: ContentSource }>('/admin/content/sources', { method: 'POST', body: { source: sourceDraft } });
      if (!mounted.current) return; onSourceAdded(result.source); setForm(previous => ({ ...previous, sourceId: result.source.id })); setDialog(null); setSourceDraft({ ...emptySource });
    } catch (caught) { if (mounted.current) setSourceError(caught instanceof Error ? caught.message : 'Chưa tạo được nguồn.'); }
    finally { locked.current = false; if (mounted.current) setPending(''); }
  };
  const showPreview = () => { try { readingEditorBody(form, saved); setError(''); setDialog('preview'); } catch (caught) { fail(caught); } };
  const close = () => { if (!pending) { if (dirty) setDialog('close'); else onClose(); } };
  const previewContent = { ...form.content, title: form.title, subtitle: form.subtitle };
  const publishable = !!saved && !saved.archived && !dirty && !pending && !conflict && !!selectedSource && !!usableAudio;

  return <section className="rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h1 className="text-xl font-semibold">{saved ? 'Biên tập bài đọc' : 'Thêm bài đọc'}</h1><p className="mt-1 text-xs text-slate-500">{saved ? `Phiên bản ${saved.version} · ${saved.archived ? 'Đã lưu trữ' : saved.publishedVersion === null ? 'Bản nháp' : saved.hasUnpublishedChanges ? 'Có thay đổi chưa xuất bản' : 'Đã xuất bản'}` : 'Bài thư viện do quản trị viên biên soạn.'}{dirty && ' · Chưa lưu'}</p></div><button className={button} type="button" disabled={!!pending} onClick={close}>Về danh sách</button></div>
    <div className="space-y-3 px-5 pt-5">{error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}{conflict && <p className="mt-2">Bản nhập vẫn được giữ. Tải phiên bản mới nhất trước khi tiếp tục.</p>}</div>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{conflict && saved && <button type="button" className={button} disabled={!!pending} onClick={() => setDialog('reload')}>Tải bản mới nhất</button>}{saved?.archived && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Bài đã lưu trữ. Khôi phục về nháp để tiếp tục chỉnh sửa.</p>}</div>
    <form className="space-y-5 p-5" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={!!pending || saved?.archived} className="space-y-5">
      <label className="block text-sm font-medium">Tiêu đề *<input className={input} required maxLength={200} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></label>
      <label className="block text-sm font-medium">Mô tả ngắn<textarea className={input} rows={2} maxLength={500} value={form.subtitle} onChange={event => setForm(previous => ({ ...previous, subtitle: event.target.value }))} /></label>
      <label className="block text-sm font-medium">Văn bản tiếng Nhật *<textarea className={`${input} font-japanese leading-7`} required rows={9} value={form.text} onChange={event => setForm(previous => ({ ...previous, text: event.target.value, translationsReviewed: false }))} /><span className="mt-1 block text-xs font-normal text-slate-500">{Array.from(form.text).length}/3000 ký tự · Mỗi đoạn cách nhau bằng xuống dòng.</span></label>
      <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} disabled={!form.title.trim() || !form.text.trim() || Array.from(form.text).length > 3000 || !needsSplit} onClick={() => void split()}>{pending === 'split' ? 'Đang tách câu…' : 'Tách câu và kiểm tra bản dịch'}</button>{needsSplit && form.text && <p className="text-xs text-amber-700">Cần tách lại câu trước khi lưu văn bản này.</p>}</div>
      {form.content.paragraphs.length > 0 && <div className="space-y-3"><h2 className="font-semibold">Bản dịch theo câu</h2>{needsSplit && <p className="text-sm text-slate-500">Các câu dưới đây thuộc bản trước. Tách lại câu để tiếp tục dịch.</p>}<fieldset disabled={needsSplit || !!pending} className="space-y-3">{form.content.paragraphs.map(paragraph => paragraph.sentences.map(sentence => <div key={sentence.id} className="rounded-lg border border-slate-200 p-4"><p className="font-japanese leading-7">{sentence.japanese}</p><label className="mt-2 block text-xs text-slate-600">Dịch câu {sentence.id}<textarea className={input} rows={2} maxLength={3000} value={sentence.translation ?? ''} onChange={event => setForm(previous => ({ ...previous, content: { ...previous.content, paragraphs: previous.content.paragraphs.map(p => ({ ...p, sentences: p.sentences.map(s => s.id === sentence.id ? { ...s, translation: event.target.value } : s) })) } }))} /></label><SentenceRubyEditor sentence={sentence} onChange={ruby => setForm(previous => ({ ...previous, content: { ...previous.content, paragraphs: previous.content.paragraphs.map(p => ({ ...p, sentences: p.sentences.map(s => s.id === sentence.id ? { ...s, ruby } : s) })) } }))} /></div>))}</fieldset></div>}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-end gap-3"><label className="block min-w-0 flex-1 text-sm font-medium">Nguồn nội dung<select className={input} value={form.sourceId} onChange={event => setForm(previous => ({ ...previous, sourceId: event.target.value }))}><option value="">Chưa chọn nguồn (chỉ lưu nháp)</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.version}</option>)}</select></label><button type="button" className={button} onClick={() => { setSourceError(''); setDialog('source'); }}>Thêm nguồn</button></div>{selectedSource && <div className="mt-3 space-y-1 break-words text-xs text-slate-600"><p>{selectedSource.license} · {selectedSource.attribution}</p><p>{selectedSource.url}</p><p>{selectedSource.licenseUrl}</p></div>}<p className="mt-3 text-xs text-slate-500">Cần nguồn và quyền sử dụng thực tế trước khi xuất bản.</p></div>
      {form.content.paragraphs.length > 0 && <fieldset disabled={needsSplit || !!pending} className="space-y-3"><h2 className="font-semibold">Nội dung bổ trợ và câu hỏi</h2>{needsSplit && <p className="text-sm text-amber-700">Tách và rà soát lại câu trước khi biên tập phần bổ trợ cho văn bản mới.</p>}<ReadingSupplementEditor content={form.content} onChange={content => setForm(previous => ({ ...previous, content }))} /></fieldset>}
    </fieldset>
    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4"><button type="submit" className={primary} disabled={!!pending || conflict || needsSplit || saved?.archived || (!!saved && !dirty)}>Lưu bản nháp</button><button type="button" className={button} disabled={!!pending || needsSplit} onClick={showPreview}>Xem trước</button><button type="button" className={button} disabled={!!pending || !saved || dirty || conflict || saved.archived || !!usableAudio} onClick={() => void generate()}>{pending === 'audio' ? 'Đang tạo audio…' : usableAudio ? 'Audio đã sẵn sàng' : 'Tạo audio Edge TTS'}</button><button type="button" className={button} disabled={!publishable} onClick={showPreview}>Xuất bản…</button>{saved && <button type="button" className={button} disabled={!!pending || dirty || conflict} onClick={() => setDialog(saved.archived ? 'restore' : 'archive')}>{saved.archived ? 'Khôi phục về nháp…' : 'Lưu trữ…'}</button>}</div>
    {pending === 'audio' && <p role="status" className="text-sm text-blue-700">Đang tạo MP3 cho từng câu. Quá trình có thể mất vài phút; bản nháp đã được lưu.</p>}<p className="text-xs text-slate-500">Lưu nháp → tạo audio → xem trước → xuất bản. Chỉ bản đã xuất bản mới xuất hiện ở trang học.</p>
    </form>
    {dialog === 'preview' && <AdminDialog title="Xem trước bài đọc" busy={!!pending} onClose={() => setDialog(null)}><ReadingPreview content={previewContent} audio={saved?.text === form.text ? usableAudio : null} />{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 border-t border-slate-200 pt-4"><p className="mb-3 text-sm text-slate-600">{dirty ? 'Nội dung đang xem chưa lưu. Lưu nháp và chuẩn bị audio trước khi xuất bản.' : !selectedSource ? 'Cần chọn nguồn nội dung trước khi xuất bản.' : !usableAudio ? 'Cần tạo audio của bản đã lưu trước khi xuất bản.' : 'Xác nhận đưa bài đọc và audio này lên thư viện học.'}</p><div className="flex justify-end gap-2"><button type="button" className={button} disabled={!!pending} onClick={() => setDialog(null)}>Quay lại sửa</button><button type="button" className={primary} disabled={!publishable} onClick={() => void changeStatus('publish')}>Xác nhận xuất bản</button></div></div></AdminDialog>}
    {dialog === 'segment' && candidate && <AdminDialog title="Kiểm tra sau khi đổi văn bản" busy={!!pending} onClose={() => setDialog(null)}><p className="text-sm leading-6 text-slate-700">Giữ {candidate.kept} bản dịch có câu Nhật khớp duy nhất. {candidate.removedTranslations} bản dịch, {candidate.removedRuby} chú thích furigana và {candidate.removedRich} mục từ vựng/ngữ pháp/câu hỏi không còn phù hợp sẽ được bỏ khỏi bản đang sửa. Dữ liệu trên máy chủ chỉ đổi khi bạn lưu.</p><div className="mt-4 max-h-64 space-y-3 overflow-auto rounded-lg border border-slate-200 p-3">{candidate.content.paragraphs.flatMap(p => p.sentences).map(sentence => <div key={sentence.id}><p className="text-sm">{sentence.japanese}</p><p className="mt-1 text-xs text-slate-500">{sentence.translation || 'Chưa có bản dịch — cần nhập lại.'}</p></div>)}</div><label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Tôi đã kiểm tra việc ghép câu/bản dịch và đồng ý thay phần đang sửa.</label><div className="mt-5 flex justify-end gap-2"><button type="button" className={button} onClick={() => setDialog(null)}>Hủy, giữ nội dung cũ</button><button type="button" className={primary} disabled={!checked} onClick={() => { setForm(previous => ({ ...previous, content: candidate.content, translationsReviewed: true })); setDialog(null); }}>Áp dụng câu đã kiểm tra</button></div></AdminDialog>}
    {(dialog === 'archive' || dialog === 'restore' || dialog === 'reload' || dialog === 'close') && <AdminDialog title={dialog === 'archive' ? 'Lưu trữ bài đọc' : dialog === 'restore' ? 'Khôi phục bài đọc' : dialog === 'reload' ? 'Tải bản mới nhất' : 'Thay đổi chưa lưu'} busy={!!pending} onClose={() => setDialog(null)}><p className="text-sm leading-6 text-slate-700">{dialog === 'archive' ? 'Bài sẽ ẩn khỏi thư viện và audio công khai ngừng truy cập. Nội dung và file được giữ để có thể khôi phục.' : dialog === 'restore' ? 'Khôi phục bài về trạng thái nháp. Bạn cần kiểm tra và xuất bản lại để hiện trong thư viện.' : dialog === 'reload' ? 'Bỏ các thay đổi chưa lưu trong trình sửa và tải bản nháp mới nhất từ máy chủ?' : 'Đóng trình sửa sẽ bỏ thay đổi chưa lưu. Bản đã lưu trên máy chủ vẫn được giữ.'}</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" className={button} disabled={!!pending} onClick={() => setDialog(null)}>Hủy</button><button type="button" className={primary} disabled={!!pending} onClick={() => { if (dialog === 'reload') void reload(); else if (dialog === 'close') onClose(); else void changeStatus(dialog); }}>{dialog === 'reload' ? 'Tải lại và bỏ thay đổi' : dialog === 'close' ? 'Bỏ thay đổi và đóng' : dialog === 'archive' ? 'Xác nhận lưu trữ' : 'Khôi phục về nháp'}</button></div></AdminDialog>}
    {dialog === 'source' && <AdminDialog title="Thêm nguồn nội dung" busy={!!pending} onClose={() => setDialog(null)}><p className="mb-4 text-sm text-slate-600">Khai báo nguồn và quyền sử dụng thực tế. Metadata nguồn không đổi sau khi tạo; nếu biên soạn nội bộ có thể dùng URI urn:nihongo:… phù hợp.</p><form className="space-y-4" onSubmit={event => { event.preventDefault(); void createSource(); }}><fieldset disabled={!!pending} className="grid gap-4 sm:grid-cols-2">{(Object.keys(emptySource) as (keyof ContentSource)[]).map(key => <label key={key} className="block text-sm font-medium">{sourceLabels[key]}{key === 'notes' || key === 'attribution' ? <textarea className={input} required={key === 'attribution'} rows={2} maxLength={key === 'notes' ? 2000 : 1000} value={sourceDraft[key]} onChange={event => setSourceDraft(previous => ({ ...previous, [key]: event.target.value }))} /> : <input className={input} required={key !== 'checksum'} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} maxLength={key === 'id' || key === 'checksum' ? 64 : key === 'version' ? 100 : key === 'name' || key === 'license' ? 200 : 2000} value={sourceDraft[key]} onChange={event => setSourceDraft(previous => ({ ...previous, [key]: event.target.value }))} />}</label>)}</fieldset>{sourceError && <p role="alert" className="text-sm text-red-700">{sourceError}</p>}<div className="flex justify-end gap-2"><button className={button} type="button" disabled={!!pending} onClick={() => setDialog(null)}>Hủy</button><button type="submit" className={primary} disabled={!!pending}>Tạo nguồn</button></div></form></AdminDialog>}
  </section>;
}
