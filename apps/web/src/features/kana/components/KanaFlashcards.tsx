import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Keyboard, Pause, Play, RotateCw, Settings, Shuffle, Volume2, X } from 'lucide-react';
import { KANA_LIST, type KanaScript } from '@nihongo/shared/study/kana-quiz';
import { speakJapanese } from '../../../shared/audio/speech';
import { RoughButton } from '../../../shared/ui/RoughCard';
import { KanaStudyDialog } from './KanaStudyDialog';
import './KanaFlashcards.css';

type Props = { script: KanaScript; initialKanaId?: string };
function Deck({ script, initialKanaId }: Props) {
  const [deck, setDeck] = useState(() => [...KANA_LIST]);
  const [index, setIndex] = useState(() => Math.max(0, KANA_LIST.findIndex(k => k.id === initialKanaId)));
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(3);
  const [settings, setSettings] = useState(false);
  const [ratings, setRatings] = useState<Record<string, boolean>>({});
  const [speechError, setSpeechError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const stopSpeech = useRef<() => void>(() => {});
  const kana = deck[index];
  const glyph = script === 'hiragana' ? kana.hira : kana.kata;
  const japanese = reverse ? flipped : !flipped;
  const speak = useCallback(() => {
    if (document.hidden) return;
    stopSpeech.current(); setSpeechError('');
    stopSpeech.current = speakJapanese(glyph, undefined, { onError: setSpeechError });
  }, [glyph]);
  const move = useCallback((delta: number) => {
    stopSpeech.current(); setSpeechError(''); setFlipped(false);
    setIndex(i => Math.max(0, Math.min(deck.length - 1, i + delta)));
  }, [deck.length]);
  const navigate = useCallback((delta: number) => { setPlaying(false); move(delta); }, [move]);
  const flip = useCallback(() => { setPlaying(false); setFlipped(v => !v); }, []);
  const rate = useCallback((known: boolean) => {
    setRatings(r => ({ ...r, [kana.id]: known })); navigate(1);
  }, [kana.id, navigate]);
  const restart = () => { setPlaying(false); stopSpeech.current(); setSpeechError(''); setIndex(0); setFlipped(false); setRatings({}); };
  const mix = () => {
    const next = [...deck];
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    restart(); setDeck(next);
  };
  useEffect(() => {
    const hide = () => { if (document.hidden) { stopSpeech.current(); setPlaying(false); } };
    document.addEventListener('visibilitychange', hide);
    return () => { stopSpeech.current(); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => {
    if (!playing || settings) return;
    const timer = window.setTimeout(() => {
      if (!flipped) setFlipped(true);
      else if (index < deck.length - 1) move(1);
      else setPlaying(false);
    }, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, settings, flipped, index, deck.length, move, seconds]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || document.hidden || settings) return;
      const target = e.target;
      if (!(target instanceof HTMLElement) || target.isContentEditable || target.closest('input,textarea,select')) return;
      const dialog = container.current?.closest('dialog');
      if (!dialog?.open || target.closest('dialog') !== dialog) return;
      if (e.key === ' ' && !target.closest('button,a,[role="button"]')) { e.preventDefault(); flip(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); navigate(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); speak(); }
      else if (['z', 'x'].includes(e.key.toLowerCase())) { e.preventDefault(); rate(e.key.toLowerCase() === 'z'); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [settings, flip, navigate, speak, rate]);
  return <div ref={container} className="kana-flashcards">
    <div className="kana-flashcard-stage">
      <button className="kana-flashcard-flip" onClick={flip} aria-label={japanese ? 'Lật xem romaji' : 'Lật xem chữ cái'} aria-pressed={flipped}>
        <span lang={japanese ? 'ja' : undefined} className={japanese ? 'font-kanji kana-glyph' : 'kana-romaji'}>{japanese ? glyph : kana.romaji}</span>
      </button>
      <RoughButton aria-label="Thẻ trước" disabled={index === 0} onClick={() => navigate(-1)} fill="#4b556d" stroke="#c5c9d4" borderRadius={30} className="kana-arrow kana-prev"><ChevronLeft size={30} /></RoughButton>
      <RoughButton aria-label="Thẻ tiếp" disabled={index === deck.length - 1} onClick={() => navigate(1)} fill="#4b556d" stroke="#c5c9d4" borderRadius={30} className="kana-arrow kana-next"><ChevronRight size={30} /></RoughButton>
      <button aria-label="Phát âm" title="Phát âm (R)" className="kana-speaker" onClick={speak}><Volume2 size={22} /></button>
      {speechError && <p role="alert" className="kana-speech-error">{speechError}</p>}
    </div>
    <div className="kana-shortcuts"><Keyboard size={19} /><span>Phím tắt:</span> <kbd>Space</kbd> lật <kbd>Z</kbd> biết <kbd>X</kbd> chưa biết</div>
    <div className="kana-toolbar">
      <div className="kana-ratings">
        <RoughButton aria-label="Chưa biết" title="Chưa biết (chỉ trong lượt này)" aria-pressed={ratings[kana.id] === false} onClick={() => rate(false)} fill="#543c4d" stroke="#d3c5cc" borderRadius={34} className="kana-rating text-rose-500"><X size={30} /></RoughButton>
        <span aria-live="polite" className="kana-counter">{index + 1} / {deck.length}</span>
        <RoughButton aria-label="Đã biết" title="Đã biết (chỉ trong lượt này)" aria-pressed={ratings[kana.id] === true} onClick={() => rate(true)} fill="#18453e" stroke="#bfd4cc" borderRadius={34} className="kana-rating text-emerald-400"><Check size={30} /></RoughButton>
      </div>
      <div className="kana-tools">
        <RoughButton aria-label="Đổi chiều chữ và romaji" onClick={() => { setPlaying(false); setReverse(v => !v); setFlipped(false); }} fill="#514537" stroke="#d3c5ab" borderRadius={24} className="kana-direction"><ArrowLeftRight size={17} />{reverse ? 'Romaji→Chữ' : 'Chữ→Romaji'}</RoughButton>
        <button aria-label="Học lại từ đầu" title="Học lại từ đầu" onClick={restart}><RotateCw /></button>
        <button aria-label={playing ? 'Tạm dừng' : 'Tự động lật thẻ'} title={playing ? 'Tạm dừng' : 'Tự động lật thẻ'} onClick={() => setPlaying(v => !v)}>{playing ? <Pause /> : <Play />}</button>
        <button aria-label="Trộn thẻ và học lại" title="Trộn thẻ và học lại" onClick={mix}><Shuffle /></button>
        <button aria-label="Cài đặt flashcard" title="Cài đặt flashcard" onClick={() => { setPlaying(false); setSettings(true); }}><Settings /></button>
      </div>
    </div>
    {settings && <KanaStudyDialog title="Cài đặt flashcard" onClose={() => setSettings(false)}>
      <label className="flex items-center justify-between gap-4">Thời gian mỗi mặt thẻ<select className="rounded border p-2" value={seconds} onChange={e => setSeconds(Number(e.target.value))}>{[2,3,5,8].map(n => <option key={n} value={n}>{n} giây</option>)}</select></label>
      <p className="mt-4">Đã biết: {Object.values(ratings).filter(Boolean).length} · Chưa biết: {Object.values(ratings).filter(v => !v).length}</p>
      <p className="mt-3 text-sm">Đánh giá chỉ giữ trong lượt đang mở; đóng khung hoặc tải lại trang sẽ xóa. Không lưu tiến độ vào tài khoản.</p>
      <p className="mt-3 text-sm">← / → chuyển thẻ · Space lật · Z biết · X chưa biết · R nghe</p>
    </KanaStudyDialog>}
  </div>;
}
export function KanaFlashcards(props: Props) { return <Deck key={`${props.script}:${props.initialKanaId ?? ''}`} {...props} />; }
