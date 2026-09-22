import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { AdminRequest, ContentSource, KanjiData, KanjiRecord } from './types';
import { kanjiEditorData, kanjiEditorForm, type KanjiEditorForm } from './kanji-editor-data';
import { importErrorDetails, importFieldPath } from './import-json';

interface Props {
  record: KanjiRecord | null;
  sources: ContentSource[];
  request: AdminRequest;
  onSaved: (row: KanjiRecord) => void;
  onClose: () => void;
  onSourcesChanged: (source: ContentSource) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const control = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${button} !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700`;
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
const statusText = { draft: 'Bản nháp', published: 'Đã xuất bản', archived: 'Đã lưu trữ' };
const emptySource: ContentSource = { id: '', name: '', url: '', license: '', licenseUrl: '', version: '', checksum: '', attribution: '', notes: '' };
const fieldLabel: Record<keyof ContentSource, string> = { id: 'Mã nguồn (chữ thường, số, dấu gạch ngang)', name: 'Tên nguồn', url: 'URL nguồn', license: 'Giấy phép / quyền sử dụng', licenseUrl: 'URL giấy phép / điều khoản', version: 'Phiên bản / ngày xuất bản', checksum: 'Checksum (nếu có)', attribution: 'Ghi công', notes: 'Ghi chú' };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{children}{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>;
}

function Modal({ title, onClose, pending, children }: { title: string; onClose: () => void; pending: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const labelId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={labelId} aria-busy={pending} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} className="admin-dialog m-auto max-h-[90vh] w-[min(95vw,760px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><h2 id={labelId} className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} disabled={pending} className={button} aria-label="Đóng hộp thoại">Đóng</button></div>
    <div className="p-6">{children}</div>
  </dialog>;
}

function Preview({ data, source }: { data: KanjiData; source?: ContentSource }) {
  return <div className="space-y-5 text-sm text-slate-700">
    <div className="flex items-center gap-5 rounded-xl bg-slate-50 p-5"><span className="font-japanese text-6xl text-slate-900">{data.kanji}</span><div><div className="font-semibold text-slate-900">{data.hanViet}</div><div className="mt-1">{data.meaning}</div><div className="mt-2 text-xs text-slate-500">{data.level} · {data.strokeCount} nét · {data.id}</div></div></div>
    <dl className="grid grid-cols-2 gap-4"><div><dt className="font-medium">Âm On</dt><dd className="mt-1">{data.onyomi.join('、') || 'Chưa có'}</dd></div><div><dt className="font-medium">Âm Kun</dt><dd className="mt-1">{data.kunyomi.join('、') || 'Chưa có'}</dd></div><div><dt className="font-medium">Bộ thủ</dt><dd className="mt-1">{data.radicals.join(' · ') || 'Chưa có'}</dd></div><div><dt className="font-medium">Gợi nhớ</dt><dd className="mt-1 whitespace-pre-wrap">{data.mnemonic || 'Chưa có'}</dd></div></dl>
    {data.radicalParts.length > 0 && <div><h3 className="font-medium">Thành phần</h3><ul className="mt-2 space-y-1">{data.radicalParts.map((part, index) => <li key={index}>{part.radical} · {part.hanViet} · {part.meaning}</li>)}</ul></div>}
    <div><h3 className="font-medium">Ví dụ ({data.examples.length})</h3>{data.examples.length ? <ul className="mt-2 divide-y divide-slate-200">{data.examples.map((example, index) => <li key={index} className="py-2"><b className="font-japanese">{example.word}</b> · {example.reading} · {example.meaning}{example.level && <span className="ml-2 text-xs text-slate-500">{example.level}</span>}{example.furigana && <div className="mt-1 text-xs text-slate-500">Furigana: {example.furigana}</div>}</li>)}</ul> : <p className="mt-1 text-slate-500">Chưa có ví dụ.</p>}</div>
    <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">Nguồn: {source ? `${source.name} · ${source.version} · ${source.license}` : 'Chưa chọn nguồn'}</p>
  </div>;
}

export function KanjiEditor({ record, sources, request, onSaved, onClose, onSourcesChanged, onDirtyChange }: Props) {
  const [saved, setSaved] = useState(record);
  const [form, setForm] = useState(() => kanjiEditorForm(record?.draft));
  const [sourceId, setSourceId] = useState(record?.draftSourceId ?? '');
  const [extraSources, setExtraSources] = useState<ContentSource[]>([]);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ form: kanjiEditorForm(record?.draft), sourceId: record?.draftSourceId ?? '' }));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<'source' | 'preview' | 'archive' | 'reload' | 'close' | null>(null);
  const [preview, setPreview] = useState<KanjiData | null>(null);
  const [sourceDraft, setSourceDraft] = useState<ContentSource>({ ...emptySource });
  const [sourceError, setSourceError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const allSources = [...sources, ...extraSources.filter(item => !sources.some(source => source.id === item.id))];
  const selectedSource = allSources.find(source => source.id === sourceId);
  const dirty = JSON.stringify({ form, sourceId }) !== baseline;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const setData = <K extends keyof KanjiData>(key: K, value: KanjiData[K]) => setForm(previous => ({ ...previous, data: { ...previous.data, [key]: value } }));
  const setText = (key: keyof Omit<KanjiEditorForm, 'data'>, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const accept = (row: KanjiRecord) => {
    const nextForm = kanjiEditorForm(row.draft);
    setSaved(row); setForm(nextForm); setSourceId(row.draftSourceId);
    setBaseline(JSON.stringify({ form: nextForm, sourceId: row.draftSourceId }));
    setConflict(false); onSaved(row);
  };
  const fail = (caught: unknown) => {
    const details = importErrorDetails(caught);
    setError([details.message, ...details.issues.slice(0, 5).map(issue => `${importFieldPath(issue.path)}: ${issue.message}`)].join(' · '));
    if (saved && typeof caught === 'object' && caught !== null && 'status' in caught && caught.status === 409) setConflict(true);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try { await action(); } catch (caught) { if (mounted.current) fail(caught); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const save = () => run(async () => {
    if (!selectedSource) throw new Error('Vui lòng chọn nguồn nội dung.');
    const data = kanjiEditorData(form, saved?.id);
    const result = await request<{ item: KanjiRecord }>(`/admin/content/kanji/${data.id}`, { method: 'PUT', body: { sourceId, data, expectedVersion: saved?.version ?? null } });
    if (!mounted.current) return;
    accept(result.item); setNotice('Đã lưu bản nháp. Trang học chỉ thay đổi sau khi xuất bản.');
  });
  const openPreview = () => {
    try { setPreview(kanjiEditorData(form, saved?.id)); setDialog('preview'); setError(''); }
    catch (caught) { fail(caught); }
  };
  const publish = () => run(async () => {
    if (!saved || dirty || conflict) return;
    const result = await request<{ item: KanjiRecord }>(`/admin/content/kanji/${saved.id}/publish`, { method: 'POST', body: { expectedVersion: saved.version } });
    if (!mounted.current) return;
    accept(result.item); setDialog(null); setNotice('Đã xuất bản. Nội dung thẻ ôn được cập nhật, lịch ôn và lịch sử được giữ nguyên.');
  });
  const archive = () => run(async () => {
    if (!saved || dirty || conflict) return;
    const result = await request<{ item: KanjiRecord }>(`/admin/content/kanji/${saved.id}/archive`, { method: 'POST', body: { expectedVersion: saved.version } });
    if (!mounted.current) return;
    accept(result.item); setDialog(null); setNotice('Đã lưu trữ Kanji. Tiến độ và lịch sử học vẫn được giữ.');
  });
  const reload = () => run(async () => {
    if (!saved) return;
    const result = await request<{ item: KanjiRecord }>(`/admin/content/kanji/${saved.id}`);
    if (!mounted.current) return;
    accept(result.item); setDialog(null); setNotice('Đã tải bản mới nhất từ máy chủ.');
  });
  const addSource = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setSourceError('');
    try {
      const result = await request<{ source: ContentSource }>('/admin/content/sources', { method: 'POST', body: { source: sourceDraft } });
      if (!mounted.current) return;
      setExtraSources(previous => [...previous.filter(item => item.id !== result.source.id), result.source]);
      onSourcesChanged(result.source); setSourceId(result.source.id); setDialog(null); setSourceDraft({ ...emptySource });
    } catch (caught) { if (mounted.current) setSourceError(caught instanceof Error ? caught.message : 'Không tạo được nguồn.'); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const close = () => { if (!pending) { if (dirty) setDialog('close'); else onClose(); } };

  return <section className="admin-kanji-editor min-w-0 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm" aria-label={saved ? `Biên tập Kanji ${saved.character}` : 'Thêm Kanji'}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-xl font-semibold">{saved ? `Biên tập ${saved.character}` : 'Thêm Kanji'}</h2><p className="mt-1 text-xs text-slate-500">{saved ? `${saved.id} · ${statusText[saved.status]} · Phiên bản ${saved.version}` : 'Tạo bản nháp trước khi xuất bản lên trang học.'}{dirty && ' · Có thay đổi chưa lưu'}</p></div><button type="button" className={button} disabled={pending} onClick={close}>Đóng trình sửa</button></div>
    <div className="space-y-4 px-5 pt-5">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}{conflict && <p className="mt-2">Nội dung hoặc tài khoản đã thay đổi. Bản nhập của bạn vẫn còn; tải bản mới nhất trước khi tiếp tục.</p>}</div>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {conflict && saved && <button type="button" className={button} disabled={pending} onClick={() => setDialog('reload')}>Tải bản mới nhất</button>}
    </div>
    <form className="space-y-6 p-5" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Chữ Kanji *" hint={saved ? 'Chữ và ID được giữ cố định để bảo toàn tiến độ.' : 'ID được tạo tự động theo mã Unicode.'}><input required className={`${control} font-japanese text-xl`} value={form.data.kanji} readOnly={!!saved} maxLength={8} onChange={event => setData('kanji', event.target.value)} /></Field>
          <Field label="Hán Việt *"><input required className={control} value={form.data.hanViet} maxLength={500} onChange={event => setData('hanViet', event.target.value)} /></Field>
          <Field label="Cấp JLPT"><select className={control} value={form.data.level} onChange={event => setData('level', event.target.value as KanjiData['level'])}>{levels.map(level => <option key={level}>{level}</option>)}</select></Field>
        </div>
        <Field label="Nghĩa *"><textarea required className={control} rows={2} maxLength={2000} value={form.data.meaning} onChange={event => setData('meaning', event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Số nét *"><input required type="number" min="1" max="64" step="1" className={control} value={form.strokeCount} onChange={event => setText('strokeCount', event.target.value)} /></Field><Field label="Âm On" hint="Mỗi cách đọc một dòng."><textarea className={control} rows={3} value={form.onyomi} onChange={event => setText('onyomi', event.target.value)} /></Field><Field label="Âm Kun" hint="Mỗi cách đọc một dòng; giữ dấu phân tách nếu có."><textarea className={control} rows={3} value={form.kunyomi} onChange={event => setText('kunyomi', event.target.value)} /></Field></div>
        <Field label="Gợi nhớ"><textarea className={control} rows={3} maxLength={2000} value={form.data.mnemonic} onChange={event => setData('mnemonic', event.target.value)} /></Field>
        <Field label="Bộ thủ" hint="Mỗi bộ thủ một dòng. Chỉ nhập dữ liệu đã xác minh."><textarea className={control} rows={2} value={form.radicals} onChange={event => setText('radicals', event.target.value)} /></Field>
        <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Thành phần cấu tạo</h3><button type="button" className={button} disabled={form.data.radicalParts.length >= 20} onClick={() => setData('radicalParts', [...form.data.radicalParts, { radical: '', hanViet: '', meaning: '' }])}>Thêm thành phần</button></div>{form.data.radicalParts.length === 0 && <p className="text-sm text-slate-500">Chưa có thành phần được biên tập.</p>}{form.data.radicalParts.map((part, index) => <div key={index} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[80px_1fr_2fr_auto]">{(['radical', 'hanViet', 'meaning'] as const).map(key => <Field key={key} label={`${key === 'radical' ? 'Bộ' : key === 'hanViet' ? 'Hán Việt' : 'Nghĩa'} ${index + 1}`}><input className={control} value={part[key]} required={key === 'radical'} maxLength={key === 'radical' ? 8 : key === 'hanViet' ? 100 : 1000} onChange={event => setData('radicalParts', form.data.radicalParts.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: event.target.value } : row))} /></Field>)}<button type="button" className={button} aria-label={`Xóa thành phần ${index + 1}`} onClick={() => setData('radicalParts', form.data.radicalParts.filter((_, rowIndex) => rowIndex !== index))}>Xóa</button></div>)}</div>
        <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Ví dụ từ vựng ({form.data.examples.length})</h3><button type="button" className={button} disabled={form.data.examples.length >= 100} onClick={() => setData('examples', [...form.data.examples, { word: '', reading: '', meaning: '' }])}>Thêm ví dụ</button></div>{form.data.examples.length === 0 && <p className="text-sm text-slate-500">Chưa có ví dụ.</p>}{form.data.examples.map((example, index) => <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3"><div className="grid gap-3 sm:grid-cols-3">{(['word', 'reading', 'meaning'] as const).map(key => <Field key={key} label={`${key === 'word' ? 'Từ' : key === 'reading' ? 'Cách đọc' : 'Nghĩa'} ví dụ ${index + 1}`}><input className={control} value={example[key]} required={key === 'word'} maxLength={key === 'word' ? 200 : key === 'reading' ? 500 : 1000} onChange={event => setData('examples', form.data.examples.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: event.target.value } : row))} /></Field>)}</div><div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]"><Field label={`Furigana ví dụ ${index + 1}`}><input className={control} value={example.furigana ?? ''} maxLength={1000} onChange={event => setData('examples', form.data.examples.map((row, rowIndex) => rowIndex === index ? { ...row, furigana: event.target.value } : row))} /></Field><Field label={`JLPT ví dụ ${index + 1}`}><select className={control} value={example.level ?? ''} onChange={event => setData('examples', form.data.examples.map((row, rowIndex) => { if (rowIndex !== index) return row; const next = { ...row }; if (event.target.value) next.level = event.target.value as KanjiData['level']; else delete next.level; return next; }))}><option value="">Chưa phân loại</option>{levels.map(level => <option key={level}>{level}</option>)}</select></Field><button type="button" className={button} aria-label={`Xóa ví dụ ${index + 1}`} onClick={() => setData('examples', form.data.examples.filter((_, rowIndex) => rowIndex !== index))}>Xóa ví dụ</button></div></div>)}</div>
        <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Dữ liệu từ điển và nét viết</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Số bộ thủ từ điển (1–214)"><input type="number" min="1" max="214" step="1" className={control} value={form.dictionaryRadicalNumber} onChange={event => setText('dictionaryRadicalNumber', event.target.value)} /></Field><Field label="Thứ hạng tần suất"><input type="number" min="1" step="1" className={control} value={form.frequency} onChange={event => setText('frequency', event.target.value)} /></Field></div><div className="mt-4"><Field label="Đường nét SVG" hint="Mảng JSON các chuỗi path, ví dụ [&quot;M10 10 L20 20&quot;]. Để trống khi chưa có dữ liệu nét viết."><textarea className={`${control} font-mono text-xs`} rows={4} value={form.strokePaths} onChange={event => setText('strokePaths', event.target.value)} /></Field></div></details>
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-end gap-3"><div className="min-w-0 flex-1"><Field label="Nguồn nội dung *"><select required className={control} value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">Chọn nguồn</option>{allSources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.version}</option>)}</select></Field></div><button type="button" className={button} onClick={() => { setSourceError(''); setDialog('source'); }}>Thêm nguồn</button></div>{selectedSource && <div className="space-y-1 break-words text-xs text-slate-600"><p>{selectedSource.license} · {selectedSource.version}</p><p>{selectedSource.attribution}</p><p>Nguồn: {selectedSource.url}</p><p>Điều khoản: {selectedSource.licenseUrl}</p>{selectedSource.notes && <p>{selectedSource.notes}</p>}</div>}</div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4"><button type="submit" className={primary} disabled={pending || conflict || (!!saved && !dirty)}>{pending ? 'Đang xử lý…' : 'Lưu bản nháp'}</button><button type="button" className={button} disabled={pending} onClick={openPreview}>Xem trước</button><button type="button" className={button} disabled={pending || !saved || dirty || conflict} title={dirty ? 'Lưu bản nháp trước khi xuất bản' : undefined} onClick={openPreview}>Xuất bản…</button>{saved && saved.status !== 'archived' && <button type="button" className={`${button} text-red-700`} disabled={pending || dirty || conflict} onClick={() => setDialog('archive')}>Lưu trữ…</button>}<p className="basis-full pt-1 text-xs text-slate-500">Lưu nháp chưa đổi nội dung trang học. Xuất bản giữ nguyên lịch ôn, lịch sử và ID.</p></div>
    </form>
    {dialog === 'preview' && preview && <Modal title="Xem trước nội dung" pending={pending} onClose={() => setDialog(null)}><Preview data={preview} source={selectedSource} />{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 border-t border-slate-200 pt-4"><p className="mb-3 text-sm text-slate-600">{dirty || !saved ? 'Đây là nội dung chưa lưu. Đóng xem trước và lưu bản nháp trước khi xuất bản.' : 'Xuất bản bản nháp này lên trang học và cập nhật nội dung thẻ ôn hiện có. Lịch ôn và lịch sử được giữ nguyên.'}</p><div className="flex justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={() => setDialog(null)}>Quay lại sửa</button><button type="button" className={primary} disabled={pending || !saved || dirty || conflict} onClick={() => void publish()}>{pending ? 'Đang xuất bản…' : 'Xác nhận xuất bản'}</button></div></div></Modal>}
    {dialog === 'archive' && <Modal title="Lưu trữ Kanji" pending={pending} onClose={() => setDialog(null)}><p className="text-sm text-slate-700">Lưu trữ chữ <b>{saved?.character}</b> để ngừng hiển thị trong danh mục học mới. Thẻ đã lưu, tiến độ và lịch sử vẫn được giữ; bạn có thể xuất bản lại.</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={() => setDialog(null)}>Hủy</button><button type="button" className={`${button} !border-red-600 !bg-red-600 !text-white`} disabled={pending || conflict} onClick={() => void archive()}>Xác nhận lưu trữ</button></div></Modal>}
    {dialog === 'reload' && <Modal title="Tải bản mới nhất" pending={pending} onClose={() => setDialog(null)}><p className="text-sm text-slate-700">Các thay đổi chưa lưu trong trình sửa này sẽ được thay bằng bản nháp mới nhất từ máy chủ.</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={() => setDialog(null)}>Giữ bản đang nhập</button><button type="button" className={primary} disabled={pending} onClick={() => void reload()}>Tải lại và bỏ thay đổi</button></div></Modal>}
    {dialog === 'close' && <Modal title="Thay đổi chưa lưu" pending={false} onClose={() => setDialog(null)}><p className="text-sm text-slate-700">Bạn có thay đổi chưa lưu. Đóng trình sửa sẽ bỏ những thay đổi này.</p><div className="mt-6 flex justify-end gap-2"><button type="button" className={button} onClick={() => setDialog(null)}>Tiếp tục sửa</button><button type="button" className={button} onClick={onClose}>Bỏ thay đổi và đóng</button></div></Modal>}
    {dialog === 'source' && <Modal title="Thêm nguồn nội dung" pending={pending} onClose={() => setDialog(null)}><p className="mb-4 text-sm text-slate-600">Ghi nguồn và quyền sử dụng thực tế. Thông tin nguồn được giữ cố định sau khi tạo để truy xuất xuất xứ nội dung.</p><form className="space-y-4" onSubmit={event => { event.preventDefault(); void addSource(); }}><fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">{(Object.keys(emptySource) as (keyof ContentSource)[]).map(key => <Field key={key} label={fieldLabel[key]}>{key === 'notes' || key === 'attribution' ? <textarea className={control} rows={2} maxLength={key === 'notes' ? 2000 : 1000} required={key === 'attribution'} value={sourceDraft[key]} onChange={event => setSourceDraft(previous => ({ ...previous, [key]: event.target.value }))} /> : <input className={control} type={key === 'url' || key === 'licenseUrl' ? 'url' : 'text'} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} maxLength={key === 'id' || key === 'checksum' ? 64 : key === 'version' ? 100 : key === 'name' || key === 'license' ? 200 : undefined} required={key !== 'checksum'} value={sourceDraft[key]} onChange={event => setSourceDraft(previous => ({ ...previous, [key]: event.target.value }))} />}</Field>)}</fieldset>{sourceError && <p role="alert" className="text-sm text-red-700">{sourceError}</p>}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={() => setDialog(null)}>Hủy</button><button type="submit" className={primary} disabled={pending}>{pending ? 'Đang tạo…' : 'Tạo nguồn'}</button></div></form></Modal>}
  </section>;
}

export default KanjiEditor;
