import { shadowingTokenAtTime } from '../player/shadowing-token-time';
import { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, Eye, EyeOff, Keyboard, Maximize2, Pause, Pencil, Play, RotateCcw, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import type { ShadowingDetailResponse, ShadowingMode } from '@nihongo/shared/contracts/shadowing';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { useLearningSettings } from '../../settings/hooks/useLearningSettings';
import { useShadowingStudy } from '../hooks/useShadowingStudy';
import { cueAtTime, crossedCueEnd, YouTubePlayer, type YouTubePlayerState } from '../player/youtube-player';
import { shadowingApi } from '../lib/shadowing-api';
import { createShadowingCheckpoint, matchingGrade } from '../lib/shadowing-study';
import { ShadowingTokens } from './ShadowingTokens';
import { ShadowingDictation } from './ShadowingDictation';
import { ShadowingDialog } from './ShadowingDialog';
import { ShadowingImportDialog } from './ShadowingImportDialog';

export function ShadowingWorkspace({ detail, userId, onBack, onReload }: { detail: ShadowingDetailResponse; userId: string | null; onBack: () => void; onReload: () => void }) {
  const { video } = detail, sentences = video.content.sentences, settings = useLearningSettings();
  const savedIndex = Math.max(0, sentences.findIndex(cue => cue.id === detail.study?.currentSentenceId));
  const { study, error, update, check } = useShadowingStudy(video, userId, detail.study);
  const [index, setIndex] = useState(savedIndex), [mode, setMode] = useState<'shadowing' | 'dictation'>('shadowing'), [dictationMode, setDictationMode] = useState<ShadowingMode>('typing');
  const [media, setMedia] = useState<YouTubePlayerState | null>(null), [playerRevision, setPlayerRevision] = useState(0);
  const [visible, setVisible] = useState(true), [autoPause, setAutoPause] = useState(true), [translation, setTranslation] = useState(true);
  const [furigana, setFurigana] = useState<'always' | 'never' | 'hover' | null>(null), [shortcuts, setShortcuts] = useState(false);
  const [editing, setEditing] = useState(false), [archiving, setArchiving] = useState(false), [archiveBusy, setArchiveBusy] = useState(false), [actionError, setActionError] = useState('');
  const [completed, setCompleted] = useState(false), [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const live = useRef(0), leaveBusy = useRef(false), rateOverride = useRef(false);
  useEffect(() => { live.current++; return () => { live.current++; }; }, []);
  const host = useRef<HTMLDivElement>(null), transcript = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const seekUntil = useRef(0);
  const runtime = useRef({ autoPause, index, visible, positionMs: detail.study?.positionMs ?? sentences[savedIndex]?.startMs ?? 0 });
  runtime.current.autoPause = autoPause; runtime.current.index = index; runtime.current.visible = visible;
  const save = useRef(update); save.current = update;
  const writeCheckpoint = useRef(createShadowingCheckpoint<{ currentSentenceId: string; positionMs: number }>(value => save.current(value)));
  const furiganaMode = furigana ?? settings.showFurigana, sentence = sentences[index];
  const activeToken = sentence && visible && media?.status === 'playing'
    ? shadowingTokenAtTime(sentence, media.currentTimeMs) : -1;
  const checkpoint = () => {
    const cue = sentences[runtime.current.index]; if (!cue) return Promise.resolve();
    return writeCheckpoint.current({ currentSentenceId: cue.id, positionMs: Math.max(0, Math.min(video.durationMs, Math.round(runtime.current.positionMs))) });
  };
  const leave = async () => {
    if (leaveBusy.current) return;
    const generation = live.current; leaveBusy.current = true; setLeaving(true);
    player.current?.pause();
    try { await checkpoint(); if (live.current === generation) onBack(); }
    catch { /* The study hook shows the error and keeps the screen available for retry. */ }
    finally { leaveBusy.current = false; if (live.current === generation) setLeaving(false); }
  };
  useEffect(() => {
    if (!host.current) return;
    let restored = false, rateApplied = false, previous: YouTubePlayerState | null = null, pendingSeek = false;
    const instance = new YouTubePlayer(host.current, video.youtubeId, state => {
      setMedia(state);
      if (!state.ready) return;
      if (!restored) {
        restored = true;
        const resumeAt = runtime.current.positionMs;
        queueMicrotask(() => {
          if (player.current !== instance) return;
          pendingSeek = true;
          instance.seek(Math.min(resumeAt, video.durationMs), { play: false });
          instance.setVisible(runtime.current.visible);
        });
      }
      runtime.current.positionMs = state.currentTimeMs;
      if (!rateApplied && !rateOverride.current && state.availablePlaybackRates.includes(settings.audioSpeed)) {
        rateApplied = true;
        queueMicrotask(() => { if (player.current === instance && !rateOverride.current) instance.setRate(settings.audioSpeed); });
      }
      const continuous = Date.now() > seekUntil.current && previous?.status === 'playing' && state.status === 'playing' && state.currentTimeMs >= previous.currentTimeMs && state.currentTimeMs - previous.currentTimeMs < Math.max(1200, state.playbackRate * 600);
      const endedCue = !pendingSeek && continuous && runtime.current.autoPause ? crossedCueEnd(sentences, previous!.currentTimeMs, state.currentTimeMs) : -1;
      if (endedCue >= 0) { runtime.current.index = endedCue; setIndex(endedCue); queueMicrotask(() => { if (player.current === instance) instance.pause(); }); }
      else if (state.status === 'playing' && !pendingSeek && Date.now() > seekUntil.current) { const next = cueAtTime(sentences, state.currentTimeMs); if (next >= 0) { runtime.current.index = next; setIndex(next); } }
      if (previous?.status === 'playing' && state.status !== 'playing' && state.status !== 'buffering') void checkpoint().catch(() => {});
      pendingSeek = false; previous = state;
    });
    player.current = instance;
    const timer = window.setInterval(() => { if (instance.state.status === 'playing') void checkpoint().catch(() => {}); }, 5000);
    return () => { window.clearInterval(timer); player.current = null; instance.dispose(); };
  }, [video.id, video.version, playerRevision]);
  const select = (next: number, play?: boolean) => {
    if (!sentences[next]) return;
    setIndex(next); runtime.current.index = next; runtime.current.positionMs = sentences[next].startMs;
    seekUntil.current = Date.now() + 400;
    player.current?.seek(sentences[next].startMs, { play });
    void update({ currentSentenceId: sentences[next].id, positionMs: sentences[next].startMs }).catch(() => {});
  };
  const replay = () => {
    if (!sentence || !visible) return;
    seekUntil.current = Date.now() + 400;
    if (player.current?.seek(sentence.startMs, { play: true })) void update({ replay: { sentenceId: sentence.id, requestId: crypto.randomUUID() }, currentSentenceId: sentence.id, positionMs: sentence.startMs }).catch(() => {});
  };
  const playPause = () => {
    if (!player.current || !visible) return;
    if (player.current.state.status === 'playing') player.current.pause();
    else if (sentence && player.current.state.currentTimeMs >= sentence.endMs && autoPause) select(Math.min(index + 1, sentences.length - 1), true);
    else player.current.play();
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
      if (event.code === 'Space') { event.preventDefault(); playPause(); }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); replay(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); select(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); select(index + 1); }
      if (event.key === '?') setShortcuts(true);
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  useEffect(() => { const active = transcript.current?.querySelector<HTMLElement>(`[data-cue-index="${index}"]`); if (active && transcript.current) transcript.current.scrollTo({ top: Math.max(0, active.offsetTop - transcript.current.offsetTop - 8), behavior: 'smooth' }); }, [index]);
  const toggleBookmark = async (id: string) => { if (bookmarkBusy) return; setBookmarkBusy(true); try { await update({ bookmark: { sentenceId: id, active: !study.bookmarks.includes(id) } }); } catch {} finally { setBookmarkBusy(false); } };
  return <div className="max-w-[1500px] mx-auto px-4 md:px-7 py-7 space-y-5">
    <div className="flex justify-between gap-3 flex-wrap"><div className="border-2 border-stone-700 rounded-2xl shadow-sketch bg-white p-1 flex text-sm font-bold">{([['shadowing', 'Bắt chước phát âm'], ['dictation', 'Nghe - Viết chính tả']] as const).map(([value, label]) => <button key={value} onClick={() => { player.current?.pause(); setMode(value); }} className={`rounded-xl px-4 py-2 ${mode === value ? 'bg-blue-600 text-white' : ''}`}>{label}</button>)}</div><div className="flex gap-3"><button onClick={() => setShortcuts(true)} className="rounded-full border border-stone-700 bg-white px-4 py-2 flex items-center gap-2 text-xs font-bold"><Keyboard size={16} />Phím tắt</button><button onClick={() => { player.current?.setVisible(!visible); setVisible(!visible); }} className="rounded-full border border-stone-700 bg-white px-4 py-2 flex items-center gap-2 text-xs font-bold">{visible ? <EyeOff size={16} /> : <Eye size={16} />}{visible ? 'Ẩn video' : 'Hiện video'}</button></div></div>
    <header><button disabled={leaving} onClick={() => void leave()} className="text-sm text-stone-500 inline-flex gap-1 items-center"><ChevronLeft size={14} />Quay lại</button>{video.level && <span className="ml-3 border rounded-full bg-blue-100 border-stone-700 px-2 text-xs font-bold">{video.level}</span>}<div className="flex gap-3 items-center flex-wrap"><h1 className="font-black text-xl mt-2">{video.title}</h1><span className="text-xs text-stone-500">· {video.channel}</span>{userId && video.scope === 'personal' && <div className="ml-auto flex gap-3"><button aria-label="Sửa video của tôi" onClick={() => { player.current?.pause(); setEditing(true); }}><Pencil size={17} /></button><button aria-label="Lưu trữ video của tôi" onClick={() => { player.current?.pause(); setArchiving(true); }}><Trash2 size={17} /></button></div>}</div></header>
    {!userId && <p className="text-xs text-stone-500">Bạn đang học với tư cách khách. Tiến độ chỉ giữ trong lượt đang mở.</p>}
    {(error || actionError) && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error || actionError} <button onClick={onReload} className="underline">Tải lại tiến độ</button></p>}
    <div className="grid lg:grid-cols-12 gap-6 items-start"><section className="lg:col-span-7 space-y-4">
      <div style={{ display: visible ? undefined : 'none' }} className="rounded-2xl border-2 border-stone-700 overflow-hidden bg-black shadow-sketch"><div ref={host} className="aspect-video min-h-[200px] w-full" /></div>
      {!visible && <RoughCard fill="#ffffff" className="p-6 text-center"><p>Video đã tạm dừng. Hiện video để tiếp tục nghe.</p><button className="text-blue-600 underline mt-2" onClick={() => { player.current?.setVisible(true); setVisible(true); }}>Hiện video</button></RoughCard>}
      {media?.error && <p role="alert" className="text-red-700 text-sm">{media.error} <button onClick={() => setPlayerRevision(value => value + 1)} className="underline">Thử lại</button> · <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer" className="underline">Mở YouTube</a></p>}
      {media?.autoplayBlocked && <p className="text-sm text-amber-700">Trình duyệt chặn tự phát. Bấm nút phát trong video để nghe.</p>}
      <div className="flex justify-between gap-3 flex-wrap"><div className="flex items-center gap-2">{([{ label: 'Câu trước', Icon: SkipBack, action: () => select(index - 1), disabled: index === 0 }, { label: 'Phát lại câu', Icon: RotateCcw, action: replay, disabled: !visible }, { label: media?.status === 'playing' ? 'Tạm dừng' : 'Phát video', Icon: media?.status === 'playing' ? Pause : Play, action: playPause, disabled: !visible }, { label: 'Câu tiếp theo', Icon: SkipForward, action: () => select(index + 1), disabled: index >= sentences.length - 1 }]).map(({ label, Icon, action, disabled }, i) => <button key={i} aria-label={label} disabled={disabled || !media?.ready} onClick={action} className={`rounded-full border border-stone-700 p-2 disabled:opacity-40 ${i === 2 ? 'bg-blue-600 text-white' : 'bg-white'}`}><Icon size={18} /></button>)}</div><div className="flex gap-2 items-center flex-wrap text-xs font-bold"><button onClick={() => setAutoPause(!autoPause)} className={`rounded-lg border border-stone-600 px-3 py-2 ${autoPause ? 'bg-stone-800 text-white' : 'bg-white'}`}>Tự ngắt câu</button><button onClick={() => setTranslation(!translation)} className={`rounded-lg border px-3 py-2 ${translation ? 'border-blue-600 text-blue-600' : 'border-stone-400'}`}>Bản dịch</button><button onClick={() => setFurigana(furiganaMode === 'never' ? 'always' : 'never')} className={`rounded-lg border px-3 py-2 ${furiganaMode !== 'never' ? 'border-blue-600 text-blue-600' : 'border-stone-400'}`}>Furigana</button><select aria-label="Tốc độ video" disabled={!media?.ready} value={media?.playbackRate ?? 1} onChange={event => { rateOverride.current = true; player.current?.setRate(Number(event.target.value)); }} className="border border-stone-700 bg-white rounded-lg p-2">{(media?.availablePlaybackRates ?? [1]).map(rate => <option value={rate} key={rate}>{rate}x</option>)}</select></div></div>
      {mode === 'shadowing' && sentence && <RoughCard fill="#ffffff" borderRadius={12} className="p-7 text-center"><div className="text-2xl md:text-3xl font-black leading-loose"><ShadowingTokens tokens={sentence.tokens} activeIndex={activeToken} furigana={furiganaMode} /></div>{translation && <p className="text-stone-500 mt-5 border-t pt-4">{sentence.translationVi || 'Chưa có bản dịch cho câu này.'}</p>}<p className="text-xs text-stone-400 mt-4">Câu {index + 1} / {sentences.length}</p></RoughCard>}
      {mode === 'dictation' && <p className="text-sm text-stone-500">Nghe video rồi trả lời ở bên cạnh. Phát lại hoặc chuyển câu bằng các nút phía trên.</p>}
    </section><aside className="lg:col-span-5 min-w-0">
      {mode === 'shadowing' ? <><div className="flex justify-between items-center mb-3"><h2 className="font-black">BẢN CHÉP</h2><button aria-label="Phóng to bản chép" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void transcript.current?.requestFullscreen().catch(() => setActionError('Trình duyệt không hỗ trợ phóng to bản chép.')); }}><Maximize2 size={17} /></button></div><div ref={transcript} className="relative max-h-[75vh] overflow-y-auto space-y-3 pr-2 fullscreen:bg-sketch-paper">{sentences.map((cue, i) => <RoughCard key={cue.id} fill="#ffffff" borderRadius={12} className={`p-3 ${index === i ? 'ring-2 ring-blue-500' : ''}`}><div data-cue-index={i}><div className="flex justify-between mb-2"><button aria-label={`Chọn câu ${i + 1}`} onClick={() => select(i)} className={`px-2 rounded text-xs font-bold ${index === i ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-500'}`}>#{i + 1}</button><button aria-label={`${study.bookmarks.includes(cue.id) ? 'Bỏ đánh dấu' : 'Đánh dấu'} câu ${i + 1}`} disabled={bookmarkBusy} onClick={() => void toggleBookmark(cue.id)}><Bookmark size={17} className={study.bookmarks.includes(cue.id) ? 'text-amber-500 fill-amber-500' : 'text-stone-400'} /></button></div><button onClick={() => select(i)} className="text-left w-full font-bold leading-relaxed"><ShadowingTokens tokens={cue.tokens} activeIndex={i === index ? activeToken : -1} furigana={furiganaMode} chips /></button>{translation && <p className="border-t mt-3 pt-2 italic text-xs text-stone-500">{cue.translationVi || 'Chưa có bản dịch.'}</p>}</div></RoughCard>)}</div></> : sentence && <ShadowingDictation key={`${sentence.id}-${dictationMode}`} sentence={sentence} mode={dictationMode} onMode={setDictationMode} grades={study.grades} replays={study.replayCounts[sentence.id] ?? 0} check={(mode, answer, hints, requestId) => check(sentence.id, mode, answer, hints, requestId)} isLast={index === sentences.length - 1} onNext={() => { if (index === sentences.length - 1) { player.current?.pause(); setCompleted(true); } else select(index + 1, true); }} />}
    </aside></div>
    {shortcuts && <ShadowingDialog title="Phím tắt Shadowing & Chép chính tả" onClose={() => setShortcuts(false)}><ul className="space-y-3"><li>Phím cách — Phát / tạm dừng</li><li>← / → — Câu trước / câu tiếp theo</li><li>R — Phát lại câu hiện tại</li><li>? — Mở bảng phím tắt</li></ul><p className="text-sm text-stone-500 mt-4">Phím tắt không áp dụng khi đang nhập câu trả lời hoặc thao tác trong trình phát YouTube.</p></ShadowingDialog>}
    {completed && <ShadowingDialog title="Đã đến câu cuối" onClose={() => setCompleted(false)}><p>Đã kiểm tra {sentences.filter(cue => matchingGrade(study.grades, cue, dictationMode)).length}/{sentences.length} câu ở chế độ này.</p><div className="flex gap-3 mt-5"><button onClick={() => { setCompleted(false); select(0, false); }} className="border rounded-lg p-3 bg-white">Luyện lại</button><button disabled={leaving} onClick={() => void leave()} className="rounded-lg p-3 bg-blue-600 text-white">Về danh sách</button></div></ShadowingDialog>}
    {editing && userId && <ShadowingImportDialog userId={userId} url={`https://www.youtube.com/watch?v=${video.youtubeId}`} video={video} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onReload(); }} />}
    {archiving && userId && <ShadowingDialog title="Lưu trữ video của tôi?" onClose={() => setArchiving(false)} busy={archiveBusy}><p>Video sẽ rời danh sách học. Kết quả và bookmark vẫn được giữ.</p><div className="flex gap-3 mt-4"><button disabled={archiveBusy} onClick={() => setArchiving(false)} className="border rounded-lg p-2">Hủy</button><button disabled={archiveBusy} onClick={() => { setArchiveBusy(true); void shadowingApi<{ userId: string }>(`/videos/${video.id}/archive`, { expectedUserId: userId, version: video.version }).then(result => { if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi.'); onBack(); }).catch(cause => { setActionError(cause.message); setArchiving(false); }).finally(() => setArchiveBusy(false)); }} className="bg-red-600 text-white rounded-lg p-2">Lưu trữ video</button></div></ShadowingDialog>}
  </div>;
}
