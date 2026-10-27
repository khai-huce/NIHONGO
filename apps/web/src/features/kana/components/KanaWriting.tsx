import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { KANA_LIST, type KanaScript } from '@nihongo/shared/study/kana-quiz';
import { speakJapanese } from '../../../shared/audio/speech';
import { RoughButton } from '../../../shared/ui/RoughCard';
import { KanaDrawingCanvas } from './KanaDrawingCanvas';

export function KanaWriting({ script, initialKanaId }: { script: KanaScript; initialKanaId?: string }) {
  const [index, setIndex] = useState(() => Math.max(0, KANA_LIST.findIndex(kana => kana.id === initialKanaId)));
  const [speechError, setSpeechError] = useState('');
  const stopSpeech = useRef<() => void>(() => {});
  const kana = KANA_LIST[index];
  const glyph = script === 'hiragana' ? kana.hira : kana.kata;
  useEffect(() => {
    setSpeechError('');
    const stopWhenHidden = () => { if (document.hidden) stopSpeech.current(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      stopSpeech.current();
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [glyph]);
  const move = (offset: number) => {
    stopSpeech.current();
    setIndex(value => (value + offset + KANA_LIST.length) % KANA_LIST.length);
  };
  const play = () => {
    setSpeechError('');
    stopSpeech.current = speakJapanese(glyph, undefined, { onError: setSpeechError });
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-2">
      <RoughButton onClick={() => move(-1)} aria-label="Chữ trước" className="p-2"><ChevronLeft size={20} /></RoughButton>
      <div className="text-center" aria-live="polite">
        <p><span lang="ja" className="font-kanji text-3xl">{glyph}</span><span className="ml-2 text-blue-600">{kana.romaji}</span></p>
        <p className="mt-1 text-xs text-stone-500">{index + 1}/{KANA_LIST.length}</p>
      </div>
      <RoughButton onClick={() => move(1)} aria-label="Chữ tiếp" className="p-2"><ChevronRight size={20} /></RoughButton>
    </div>
    <div className="flex justify-center"><button type="button" onClick={play} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"><Volume2 size={18} />Nghe phát âm</button></div>
    {speechError && <p role="alert" className="text-sm text-orange-700">{speechError}</p>}
    <KanaDrawingCanvas glyph={glyph} />
    <p className="text-xs leading-relaxed text-stone-600">Viết tự do theo chữ mẫu, chưa hướng dẫn thứ tự hoặc chấm nét. Nét vẽ chỉ giữ ở chữ đang mở; chuyển chữ hoặc đóng khung sẽ xóa nét vẽ.</p>
  </div>;
}
