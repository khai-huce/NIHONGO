import { useEffect, useRef, useState } from 'react';
import type { ShadowingAiRequest, ShadowingContent, ShadowingDetailResponse, ShadowingDraftInput, ShadowingVideo } from '@nihongo/shared/contracts/shadowing';
import { parseShadowingSubtitles, validateShadowingCues } from '@nihongo/shared/study/shadowing-media';
import { ApiError } from '@nihongo/client/api';
import { shadowingApi } from '../lib/shadowing-api';
import { ShadowingDialog } from './ShadowingDialog';

type Cues = ShadowingDraftInput['sentences'];
const fromContent = (content: ShadowingContent): ShadowingDraftInput => ({ url: `https://www.youtube.com/watch?v=${content.youtubeId}`, level: content.level, description: content.description,
  sentences: content.sentences.map(({ id, startMs, endMs, text, translationVi }) => ({ id, startMs, endMs, text, translationVi })) });
export function ShadowingImportDialog({ userId, url, video, onClose, onSaved }: {
  userId: string; url: string; video?: ShadowingVideo; onClose: () => void; onSaved: (detail: ShadowingDetailResponse) => void;
}) {
  const [draft, setDraft] = useState<ShadowingDraftInput>(() => video ? fromContent(video.content) : { url, level: null, description: '', sentences: [] });
  const [metadata, setMetadata] = useState<ShadowingContent | null>(video?.content ?? null);
  const [text, setText] = useState(''), [preview, setPreview] = useState<Cues | null>(null), [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ai, setAi] = useState<ShadowingAiRequest | null>(null);
  const [pollPaused, setPollPaused] = useState(false), [accountError, setAccountError] = useState(false), [fileBusy, setFileBusy] = useState(false);
  const live = useRef(0), locked = useRef(false), fileRevision = useRef(0), owner = useRef(userId), currentOwner = useRef(userId);
  const controllers = useRef(new Set<AbortController>()), createId = useRef(crypto.randomUUID()), aiAttempt = useRef<{ hash: string; id: string } | null>(null);
  currentOwner.current = userId;
  useEffect(() => { live.current++; return () => { live.current++; fileRevision.current++; controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); }; }, []);
  const change = (value: Partial<ShadowingDraftInput>) => { setDraft(old => ({ ...old, ...value })); setReviewed(false); };
  const run = async (action: () => Promise<void>) => {
    if (locked.current || owner.current !== userId || accountError) return; const generation = live.current; locked.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { if (live.current === generation) { setError(cause instanceof Error ? cause.message : 'Chưa thực hiện được.'); if (cause instanceof ApiError && [401, 403].includes(cause.status) || cause instanceof ApiError && cause.code === 'ACCOUNT_CHANGED') setAccountError(true); } }
    finally { locked.current = false; if (live.current === generation) setBusy(false); }
  };
  const verified = async <T extends { userId: string | null },>(path: string, body?: unknown, method?: string) => {
    const generation = live.current;
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const result = await shadowingApi<T>(path, body, method, AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]));
      if (generation !== live.current) throw new Error('Màn nhập đã đóng.');
      if (result.userId !== userId || currentOwner.current !== userId || owner.current !== userId) throw new ApiError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng đóng và mở lại màn nhập.');
      return result;
    } finally { controllers.current.delete(controller); }
  };
  useEffect(() => {
    if (ai?.status !== 'pending' || pollPaused || accountError) return;
    const generation = live.current; let cancelled = false;
    const timer = window.setTimeout(() => {
      void verified<{ userId: string; request: ShadowingAiRequest }>(`/ai/${ai.id}`).then(result => {
        if (!cancelled && generation === live.current) { setAi(result.request); if (result.request.status === 'failed') setError(result.request.error || 'Gemini chưa tạo được phụ đề.'); }
      }).catch(cause => { if (!cancelled && generation === live.current) { setError(cause instanceof Error ? cause.message : 'Chưa lấy được trạng thái AI.'); setPollPaused(true); if (cause instanceof ApiError && ([401, 403].includes(cause.status) || cause.code === 'ACCOUNT_CHANGED')) setAccountError(true); } });
    }, 2500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [ai, pollPaused, accountError]);
  const parse = () => {
    setError(''); setPreview(null);
    try {
      if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error('Phụ đề tối đa 1 MiB.');
      let rows: Cues;
      if (/^[\s\uFEFF]*[\[{]/.test(text)) {
        const json = JSON.parse(text.replace(/^\uFEFF/, '')); const values = Array.isArray(json) ? json : json.sentences;
        if (!Array.isArray(values)) throw new Error('JSON cần danh sách câu hoặc trường sentences.');
        rows = values.map((item: Record<string, unknown>) => {
          if (!item || typeof item !== 'object' || Array.isArray(item) || (item.translationVi !== undefined && (typeof item.translationVi !== 'string' || Array.from(item.translationVi).length > 2000))) throw new Error('Dữ liệu câu hoặc bản dịch không hợp lệ; bản dịch tối đa 2.000 ký tự.');
          return { id: crypto.randomUUID(), startMs: item.startMs as number, endMs: item.endMs as number, text: item.text as string, translationVi: (item.translationVi as string | undefined) ?? '' };
        });
        validateShadowingCues(rows.map((cue, index) => ({ ...cue, id: cue.id ?? String(index) })));
      } else rows = parseShadowingSubtitles(text).cues.map(cue => ({ ...cue, id: crypto.randomUUID(), translationVi: '' }));
      setPreview(rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Phụ đề chưa hợp lệ.'); }
  };
  const generate = () => run(async () => {
    const body = { url: draft.url, level: draft.level, description: draft.description }, hash = JSON.stringify(body);
    if (!aiAttempt.current || aiAttempt.current.hash !== hash || ai?.status === 'failed') aiAttempt.current = { hash, id: crypto.randomUUID() };
    const result = await verified<{ userId: string; request: ShadowingAiRequest }>('/ai', { ...body, id: aiAttempt.current.id, expectedUserId: userId });
    setAi(result.request); setPollPaused(false);
  });
  const blocked = busy || fileBusy || ai?.status === 'pending' || accountError || owner.current !== userId;
  if (owner.current !== userId) return <ShadowingDialog title="Tài khoản đã thay đổi" onClose={onClose}><p>Vui lòng đóng và mở lại màn nhập cho tài khoản hiện tại.</p></ShadowingDialog>;
  return <ShadowingDialog title={video ? 'Chỉnh sửa video của tôi' : 'Thêm video của tôi'} onClose={onClose} busy={busy || fileBusy}>
    <div className="space-y-4 text-sm">
      <label className="block">Liên kết YouTube<input value={draft.url} disabled={blocked} onChange={event => { change({ url: event.target.value }); setMetadata(null); setAi(null); setPreview(null); aiAttempt.current = null; }} className="w-full border rounded-lg bg-white p-2 mt-1" /></label>
      <div className="flex gap-3 items-center flex-wrap"><label>Cấp độ <select value={draft.level ?? ''} disabled={blocked} onChange={event => change({ level: (event.target.value || null) as ShadowingDraftInput['level'] })} className="p-2 border rounded bg-white"><option value="">Chưa phân loại</option>{['N5', 'N4', 'N3', 'N2', 'N1'].map(level => <option key={level}>{level}</option>)}</select></label><button disabled={blocked} onClick={() => void run(async () => { const result = await verified<{ userId: string; content: ShadowingContent }>('/videos/prepare', { ...draft, expectedUserId: userId }); setMetadata(result.content); })} className="border border-stone-500 rounded-lg px-3 py-2 bg-white disabled:opacity-50">Kiểm tra video</button></div>
      {metadata && <p className="rounded border p-3 bg-white"><strong>{metadata.title}</strong><br />{metadata.channel} · {Math.floor(metadata.durationMs / 60000)} phút {Math.floor(metadata.durationMs / 1000) % 60} giây</p>}
      <label className="block">Mô tả<textarea value={draft.description} disabled={blocked} onChange={event => change({ description: event.target.value })} rows={2} className="w-full border rounded-lg p-2 bg-white" /></label>
      <div className="rounded-xl border border-stone-400 p-3 space-y-2"><p className="font-bold">Phụ đề và bản dịch</p><p className="text-xs text-stone-500">Gemini nhận đường dẫn video công khai, tạo bản nháp để bạn rà soát. Tối đa 3 video/tài khoản và 10 video/toàn hệ thống trong 24 giờ, trong hạn mức Gemini miễn phí.</p><button disabled={blocked} onClick={() => void generate()} className="px-3 py-2 border border-violet-500 text-violet-700 bg-white rounded-lg disabled:opacity-50">{ai?.status === 'pending' ? 'Gemini đang tạo phụ đề…' : 'AI tạo phụ đề + dịch'}</button>
        {ai?.status === 'ready' && ai.content && <div className="bg-violet-50 p-3 rounded"><p>Đã tạo {ai.content.sentences.length} câu. Chưa lưu video.</p><button onClick={() => { setPreview(fromContent(ai.content!).sentences); setMetadata(ai.content); }} className="underline font-bold">Xem trước kết quả AI</button></div>}
        {pollPaused && !accountError && <button className="underline text-blue-700" onClick={() => { setError(''); setPollPaused(false); }}>Thử lấy lại trạng thái AI</button>}
        <p className="text-xs">Hoặc dán/chọn tệp JSON, SRT hoặc VTT. SRT/VTT chưa có bản dịch sẽ để trống.</p><input type="file" accept=".json,.srt,.vtt" disabled={blocked} onChange={event => {
          const file = event.target.files?.[0]; if (!file) return; const revision = ++fileRevision.current; setPreview(null); setError('');
          if (file.size > 1024 * 1024) { setError('Tệp tối đa 1 MiB.'); return; }
          const generation = live.current; setFileBusy(true);
          void file.text().then(value => { if (generation === live.current && revision === fileRevision.current) setText(value); })
            .catch(cause => { if (generation === live.current && revision === fileRevision.current) setError(cause instanceof Error ? cause.message : 'Chưa đọc được tệp phụ đề.'); })
            .finally(() => { if (generation === live.current && revision === fileRevision.current) setFileBusy(false); });
        }} />
        <textarea aria-label="Nội dung phụ đề nhập" value={text} disabled={blocked} onChange={event => { setText(event.target.value); setPreview(null); }} rows={4} className="w-full bg-white border rounded-lg p-2 font-mono" /><button disabled={blocked || !text.trim()} onClick={parse} className="border rounded px-3 py-2 bg-white disabled:opacity-50">Xem trước phụ đề nhập</button>
      </div>
      {preview && <section className="border border-blue-400 p-3 rounded-xl bg-blue-50"><h3 className="font-bold">Xem trước {preview.length} câu</h3><div className="max-h-48 overflow-y-auto my-2">{preview.map((cue, index) => <p key={index} className="py-1 border-b"><span className="text-xs">{index + 1}. {cue.startMs / 1000}–{cue.endMs / 1000}s</span> <span className="font-kanji">{cue.text}</span>{cue.translationVi && <span className="block text-xs">{cue.translationVi}</span>}</p>)}</div><button disabled={blocked} onClick={() => { change({ sentences: preview }); setPreview(null); }} className="bg-blue-600 text-white rounded-lg px-3 py-2">Dùng {preview.length} câu này (thay phụ đề đang sửa)</button><button onClick={() => setPreview(null)} className="ml-3 underline">Hủy</button></section>}
      <section><h3 className="font-bold mb-2">Rà soát phụ đề ({draft.sentences.length} câu)</h3><div className="max-h-80 overflow-y-auto space-y-3">{draft.sentences.map((cue, index) => <div key={cue.id ?? index} className="p-3 bg-white border rounded-lg"><div className="flex gap-2 items-center"><strong>#{index + 1}</strong>{(['startMs', 'endMs'] as const).map(field => <label key={field} className="text-xs">{field === 'startMs' ? 'Bắt đầu (giây)' : 'Kết thúc (giây)'}<input aria-label={`${field === 'startMs' ? 'Bắt đầu' : 'Kết thúc'} câu ${index + 1}`} type="number" min="0" step="0.001" disabled={blocked} value={cue[field] / 1000} onChange={event => change({ sentences: draft.sentences.map((row, i) => i === index ? { ...row, [field]: Math.round(Number(event.target.value) * 1000) } : row) })} className="block w-28 border rounded p-1" /></label>)}<button disabled={blocked} onClick={() => change({ sentences: draft.sentences.filter((_, i) => i !== index) })} className="ml-auto text-red-700">Xóa câu</button></div>{(['text', 'translationVi'] as const).map(field => <label key={field} className="block text-xs mt-2">{field === 'text' ? 'Tiếng Nhật' : 'Dịch tiếng Việt (có thể để trống)'}<textarea disabled={blocked} value={cue[field] ?? ''} rows={2} onChange={event => change({ sentences: draft.sentences.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row) })} className="w-full border rounded p-2 text-sm" /></label>)}</div>)}</div><button disabled={blocked || draft.sentences.length >= 500} onClick={() => { const startMs = draft.sentences.at(-1)?.endMs ?? 0; change({ sentences: [...draft.sentences, { id: crypto.randomUUID(), startMs, endMs: startMs + 3000, text: '', translationVi: '' }] }); }} className="underline mt-2">+ Thêm câu</button></section>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={reviewed} disabled={blocked} onChange={event => setReviewed(event.target.checked)} /><span>Tôi đã rà soát nội dung, bản dịch và mốc thời gian theo video; đồng ý lưu bản này.</span></label>
      {error && <p role="alert" className="text-red-700 whitespace-pre-wrap">{error}</p>}
      <button disabled={blocked || !reviewed || !draft.sentences.length} onClick={() => void run(async () => {
        validateShadowingCues(draft.sentences.map((cue, index) => ({ ...cue, id: cue.id ?? String(index) })));
        const result = await verified<ShadowingDetailResponse>(video ? `/videos/${video.id}` : '/videos', { ...draft, expectedUserId: userId, transcriptReviewed: true, ...(video ? { version: video.version } : { id: createId.current }) }, video ? 'PATCH' : 'POST'); onSaved(result);
      })} className="w-full bg-blue-600 text-white font-bold rounded-xl py-3 disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Lưu video và bắt đầu học'}</button>
    </div>
  </ShadowingDialog>;
}
