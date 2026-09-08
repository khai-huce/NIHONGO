import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, Keyboard, Pause, Play, RotateCw, Settings, Shuffle, Star, Volume2, X, ArrowLeftRight } from 'lucide-react';
import { KanjiItem } from '../types';
import { speakJapanese } from '../utils/speech';
import { useKanjiProgress } from '../hooks/useKanjiProgress';
import './FlashcardView.css';

interface FlashcardViewProps {
  items: KanjiItem[];
  onClose: () => void;
  userId: string | null;
  authBusy: boolean;
  onLogin: () => void;
  onDetail: (item: KanjiItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ items, onClose, userId, authBusy, onLogin, onDetail, favorites, onToggleFavorite }) => {
  const [deck, setDeck] = useState(items);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<'help' | 'settings' | null>(null);
  const [seconds, setSeconds] = useState(3);
  const root = useRef<HTMLDivElement>(null);
  const progress = useKanjiProgress(userId);
  const busy = authBusy || progress.loading || progress.saving || !progress.loaded;
  const current = deck[index];
  const known = deck.filter(item => progress.memorizedIds.includes(item.id)).length;
  const showJapanese = reverse ? flipped : !flipped;
  const move = (offset: number) => {
    if (busy || !deck.length) return;
    setFlipped(false);
    setIndex(value => (value + offset + deck.length) % deck.length);
  };
  const rate = async (memorized: boolean) => {
    setPlaying(false);
    if (busy || !current || !await progress.save(current.id, memorized)) return;
    setFlipped(false);
    setIndex(value => (value + 1) % deck.length);
  };
  const mix = () => {
    const next = [...deck];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setDeck(next); setIndex(0); setFlipped(false); setPlaying(false);
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    return () => { previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!playing || busy || panel || !deck.length) return;
    const timer = window.setTimeout(() => { if (!flipped) setFlipped(true); else move(1); }, seconds * 1000);
    return () => window.clearTimeout(timer);
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const scope = panel ? root.current?.querySelector('.kf-panel') : root.current;
        const buttons = [...(scope?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); if (panel) setPanel(null); else if (!progress.saving) onClose(); return; }
      if (panel || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)) return;
      if (busy || !current) return;
      const key = event.key.toLowerCase();
      if (![' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'z', 'x', 'c', 'p'].includes(key)) return;
      event.preventDefault();
      if (key === ' ') { setPlaying(false); setFlipped(value => !value); }
      else if (key === 'a' || key === 'arrowleft') move(-1);
      else if (key === 'd' || key === 'arrowright') move(1);
      else if (key === 'z' || key === 'arrowup') void rate(true);
      else if (key === 'x' || key === 'arrowdown') void rate(false);
      else if (key === 'c') onToggleFavorite(current.id);
      else if (key === 'p') setPlaying(value => !value);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  if (!current) return <div className="kanji-flashcard" role="dialog" aria-label="Flashcard Kanji"><p>Không có Kanji trong danh sách này.</p><button onClick={onClose}>Đóng</button></div>;
  const japanese = <span className="kf-japanese"><span className="kf-glyph font-japanese">{current.kanji}</span><span className="kf-hanviet">{current.hanViet}</span><span className="kf-mnemonic">💡 {current.mnemonic}</span></span>;
  const meaning = <span className="kf-meaning">{current.meaning}</span>;
  return (
    <div ref={root} tabIndex={-1} className="kanji-flashcard" role="dialog" aria-label="Flashcard Kanji" aria-modal="true">
      <header className="kf-header">
        <button onClick={() => { setPlaying(false); onDetail(current); }} disabled={progress.saving}><ExternalLink size={15} /> Xem chi tiết</button>
        <div className="kf-header-actions">
          <button title="Nghe phát âm" aria-label="Nghe phát âm" onClick={() => speakJapanese(current.kanji)}><Volume2 size={17} /></button>
          <button title="Yêu thích trên thiết bị này (C)" aria-label="Yêu thích" aria-pressed={favorites.includes(current.id)} onClick={() => onToggleFavorite(current.id)} className={favorites.includes(current.id) ? 'kf-starred' : ''}><Star size={18} fill={favorites.includes(current.id) ? 'currentColor' : 'none'} /></button>
          <button title="Đóng (Esc)" aria-label="Đóng flashcard" disabled={progress.saving} onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      <div className="kf-stage">
        <button className="kf-arrow kf-prev" title="Thẻ trước (← / A)" aria-label="Thẻ trước" disabled={busy} onClick={() => { setPlaying(false); move(-1); }}><ChevronLeft /></button>
        <button className="kf-flip" aria-label={showJapanese ? 'Lật xem nghĩa' : 'Lật xem Kanji'} aria-pressed={flipped} onClick={() => { setPlaying(false); setFlipped(value => !value); }}>
          <span key={`${current.id}-${reverse}`} className={`kf-rotor ${flipped ? 'is-flipped' : ''}`}>
            <span className="kf-face kf-front" aria-hidden={flipped}>{reverse ? meaning : japanese}</span>
            <span className="kf-face kf-back" aria-hidden={!flipped}>{reverse ? japanese : meaning}</span>
          </span>
        </button>
        <button className="kf-arrow kf-next" title="Thẻ sau (→ / D)" aria-label="Thẻ sau" disabled={busy} onClick={() => { setPlaying(false); move(1); }}><ChevronRight /></button>
      </div>
      <div className={`kf-status ${progress.error ? 'has-error' : ''}`} aria-live="polite">
        {progress.error ? <><span role="alert">{progress.error}</span>{!progress.loaded && <button onClick={() => void progress.reload()} disabled={progress.loading}>Tải lại</button>}</> : progress.loading ? 'Đang tải tiến độ…' : progress.saving ? 'Đang lưu…' : userId ? `Đã thuộc ${known}/${deck.length} · Tiến độ lưu vào tài khoản` : <><span>Học thử · Tiến độ chỉ giữ trong lần học này.</span><button onClick={() => { setPlaying(false); onClose(); onLogin(); }}>Đăng nhập để lưu</button></>}
      </div>
      <button className="kf-shortcuts" onClick={() => { setPanel('help'); setPlaying(false); }}><Keyboard size={15} /><span>Phím tắt:</span><kbd>Space</kbd><span>lật</span><kbd>Z</kbd><span>biết</span><kbd>X</kbd><span>chưa biết</span><kbd>C</kbd><span>yêu thích</span></button>
      <footer className="kf-toolbar">
        <div className="kf-ratings">
          <button className="kf-rating kf-unknown" title="Chưa thuộc (X / ↓)" aria-label="Chưa thuộc" disabled={busy} onClick={() => void rate(false)}><X size={25} /></button>
          <span className="kf-counter">{index + 1} / {deck.length}</span>
          <button className="kf-rating kf-known" title="Đã thuộc (Z / ↑)" aria-label="Đã thuộc" disabled={busy} onClick={() => void rate(true)}><Check size={25} /></button>
        </div>
        <div className="kf-tools">
          <button className="kf-direction" title="Đổi chiều học" onClick={() => { setReverse(value => !value); setFlipped(false); }}><ArrowLeftRight size={14} />{reverse ? 'VI→JP' : 'JP→VI'}</button>
          <button title="Học lại từ thẻ đầu (giữ tiến độ)" aria-label="Học lại từ đầu" disabled={busy} onClick={() => { setIndex(0); setFlipped(false); setPlaying(false); }}><RotateCw size={19} /></button>
          <button title="Tự động lật và chuyển thẻ (P)" aria-label={playing ? 'Dừng tự động phát' : 'Tự động phát'} aria-pressed={playing} disabled={busy} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
          <button title="Trộn thẻ" aria-label="Trộn thẻ" disabled={busy} onClick={mix}><Shuffle size={19} /></button>
          <button title="Cài đặt flashcard" aria-label="Cài đặt flashcard" onClick={() => { setPlaying(false); setPanel('settings'); }}><Settings size={19} /></button>
        </div>
      </footer>
      <div className="kf-progress" role="progressbar" aria-label="Kanji đã thuộc" aria-valuemin={0} aria-valuemax={deck.length} aria-valuenow={known}><span style={{ width: `${known / deck.length * 100}%` }} /></div>
      {panel && <div className="kf-panel-overlay" onClick={() => setPanel(null)}><section className="kf-panel" role="dialog" aria-modal="true" aria-label={panel === 'help' ? 'Phím tắt bàn phím' : 'Cài đặt flashcard'} onClick={event => event.stopPropagation()}>
        <header><h2>{panel === 'help' ? 'Phím tắt bàn phím' : 'Cài đặt flashcard'}</h2><button autoFocus aria-label="Đóng bảng hướng dẫn" onClick={() => setPanel(null)}><X size={18} /></button></header>
        {panel === 'help' ? <div className="kf-key-grid">{[['Thẻ trước', '← / A'], ['Thẻ tiếp theo', '→ / D'], ['Lật thẻ', 'Space'], ['Đã thuộc', '↑ / Z'], ['Chưa thuộc', '↓ / X'], ['Yêu thích', 'C'], ['Tự động phát', 'P'], ['Đóng', 'Esc']].map(([label, key]) => <div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div> : <label className="kf-setting">Thời gian hiển thị mỗi mặt<select value={seconds} onChange={event => setSeconds(Number(event.target.value))}><option value={3}>3 giây</option><option value={5}>5 giây</option><option value={8}>8 giây</option></select><small>Tự động phát chỉ lật và chuyển thẻ, không đánh dấu đã thuộc.</small></label>}
      </section></div>}
    </div>
  );
};
