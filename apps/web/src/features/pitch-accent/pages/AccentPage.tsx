import { useEffect, useRef, useState } from 'react';
import { Search, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { speakJapanese } from '../../../shared/audio/speech';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import { PitchVariants } from '../components/PitchVariants';
import { createPitchSearch, emptyPitchSearch, fetchPitchSearch } from '../utils/pitchSearch';

export function AccentPage() {
  const [state, setState] = useState(emptyPitchSearch);
  const controllerRef = useRef<ReturnType<typeof createPitchSearch> | null>(null);
  if (!controllerRef.current) controllerRef.current = createPitchSearch(fetchPitchSearch, setState);
  const controller = controllerRef.current;
  const composing = useRef(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState('');
  const stopSpeech = useRef<(() => void) | null>(null);
  useEffect(() => {
    controller.mount();
    return () => { controller.dispose(); stopSpeech.current?.(); };
  }, [controller]);

  const changeSearch = (query: string) => {
    stopSpeech.current?.(); setSpeechError(''); setExpandedId(null);
    controller.search(query, composing.current);
  };
  const pronounce = (reading: string) => {
    stopSpeech.current?.(); setSpeechError('');
    stopSpeech.current = speakJapanese(reading, undefined, { onError: setSpeechError });
  };
  const changePage = (offset: number) => {
    stopSpeech.current?.(); setSpeechError(''); setExpandedId(null); controller.page(offset);
  };
  const response = state.response;
  const sources = response ? [...new Map(response.items.map(item => [item.source.id, item.source])).values()] : [];

  return <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
    <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
      <div className="w-14 h-14 rounded-full bg-[#38bdf8] border border-[#0284c7] flex items-center justify-center shadow-sketch">
        <div className="flex items-center gap-1">
          <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
          <span className="w-1 h-6 bg-white rounded-full" />
          <span className="w-1 h-8 bg-white rounded-full" />
          <span className="w-1 h-6 bg-white rounded-full" />
          <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
        </div>
      </div>
      <h1 className="text-3xl md:text-4xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">アクセント辞典</h1>
      <p className="text-xs md:text-sm font-bold text-[#57534e] dark:text-[#a8a29e]">Tra cứu pitch accent tiếng Nhật</p>
    </div>

    <div className="space-y-2">
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <Search className="w-4 h-4 text-[#78716c] shrink-0" />
          <input type="text" value={state.query} maxLength={100} aria-label="Tìm từ để tra cứu pitch accent"
            onChange={event => changeSearch(event.target.value)}
            onCompositionStart={() => { composing.current = true; controller.search(state.query, true); }}
            onCompositionEnd={event => { composing.current = false; changeSearch(event.currentTarget.value); }}
            placeholder="単語を検索 - Tìm kiếm từ..."
            className="w-full min-w-0 bg-transparent text-sm font-bold text-[#292524] focus:outline-none placeholder:text-[#a8a29e]" />
        </div>
      </RoughCard>
      <div aria-live="polite" className="text-xs font-bold text-[#78716c] px-1">
        {state.loading && <p role="status">Đang tra cứu trọng âm…</p>}
        {response?.catalogReady && response.total > 0 && <p>{response.total.toLocaleString('vi-VN')} kết quả cho “<b className="text-[#292524]">{state.query.trim()}</b>” · Hiển thị {response.offset + 1}–{response.offset + response.items.length}</p>}
      </div>
      {state.error && <p role="alert" className="text-xs text-red-700 font-bold px-1">{state.error} <button type="button" onClick={controller.retry} className="underline cursor-pointer">Thử lại</button></p>}
    </div>

    {response && <div className="space-y-3" aria-label="Kết quả tra cứu pitch accent">
      {!response.catalogReady ? <p className="py-12 text-center text-sm font-bold text-[#78716c]">Kho trọng âm chưa có dữ liệu. Vui lòng thử lại sau khi nội dung được nhập.</p>
        : response.total === 0 ? <p className="py-12 text-center text-sm font-bold text-[#78716c]">何も見つかりませんでした - Không tìm thấy “{state.query.trim()}” trong kho trọng âm.</p>
          : <>
            <p className="text-[11px] text-[#78716c] px-1">Phát âm tham khảo, không đảm bảo đúng biến thể trọng âm.</p>
            {speechError && <p role="alert" className="text-xs text-red-700 font-bold px-1">{speechError}</p>}
            {response.items.map(item => {
              const isExpanded = expandedId === item.id;
              return <RoughCard key={item.id} fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-4 md:p-5 shadow-sketch transition-shadow hover:shadow-md [&>div]:space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3 min-w-0">
                  <div className="flex items-center gap-4 md:gap-6 flex-wrap min-w-0 max-w-full flex-1">
                    <div className="text-2xl md:text-3xl font-black font-kanji text-[#292524] max-w-full break-all">{item.word}</div>
                    <PitchVariants reading={item.reading} variants={item.variants} />
                    <div className="flex items-center gap-2 text-xs font-bold text-[#78716c] flex-wrap">
                      <span className="px-1.5 rounded border border-[#78716c]/50 text-[10px] font-mono text-[#57534e]" aria-label="1 nguồn dữ liệu">x1</span>
                      <a href={item.source.id.startsWith('kanjium-pitch') ? `https://github.com/mifunetoshiro/kanjium/blob/${encodeURIComponent(item.source.version)}/data/source_files/raw/accents.txt#L${item.sourceLine}` : item.source.url} title={`Nguồn dữ liệu · dòng ${item.sourceLine}`} target="_blank" rel="noreferrer" className="text-[11px] underline hover:text-[#0094ff]">{item.source.name}</a>
                    </div>
                  </div>
                  <button type="button" onClick={() => pronounce(item.reading)} className="p-2 rounded-full hover:bg-blue-50 text-[#0094ff] cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0"
                    aria-label={`Nghe phát âm tham khảo ${item.reading}`} title="Phát âm tham khảo, không đảm bảo đúng biến thể trọng âm"><Volume2 className="w-5 h-5" /></button>
                </div>
                {item.conjugations.length > 0 ? <div>
                  <button type="button" onClick={() => setExpandedId(previous => previous === item.id ? null : item.id)} aria-expanded={isExpanded}
                    className="text-xs font-bold text-[#78716c] hover:text-[#0094ff] flex items-center gap-1 cursor-pointer transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? '活用形を非表示 - Ẩn dạng chia' : '活用形を表示 - Hiện dạng chia'}</span>
                  </button>
                  {isExpanded && <div className="mt-3 pt-3 border-t border-[#78716c]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                    {item.conjugations.map((form, index) => <div key={`${form.sourceLine}-${index}`} className="p-2.5 rounded-lg bg-[#fdfbf7] border border-[#78716c]/30 flex items-start justify-between gap-2 min-w-0">
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] font-bold text-[#78716c] break-words">{form.formName}</div>
                        <div className="font-kanji font-black text-sm text-[#292524] break-all">{form.word}</div>
                        <PitchVariants reading={form.reading} variants={form.variants} />
                        <a href={item.source.id.startsWith('kanjium-pitch') ? `${form.sourceUrl.split('#')[0]}#L${form.sourceLine}` : form.sourceUrl} title={`Nguồn dạng chia · dòng ${form.sourceLine}`} target="_blank" rel="noreferrer" className="text-[10px] underline text-[#78716c]">Nguồn dạng chia</a>
                      </div>
                      <button type="button" onClick={() => pronounce(form.reading)} className="p-1.5 rounded-full hover:bg-blue-50 text-[#0094ff] shrink-0 cursor-pointer"
                        aria-label={`Nghe phát âm tham khảo ${form.reading}`} title="Phát âm tham khảo, không đảm bảo đúng biến thể trọng âm"><Volume2 className="w-3.5 h-3.5" /></button>
                    </div>)}
                  </div>}
                </div> : <p className="text-[11px] text-[#78716c]">Chưa có dữ liệu trọng âm dạng chia.</p>}
              </RoughCard>;
            })}
            {(response.offset > 0 || response.hasMore) && <nav aria-label="Trang kết quả trọng âm" className="flex items-center justify-center gap-3 py-2 text-xs font-bold text-[#57534e]">
              <RoughButton type="button" disabled={response.offset === 0} onClick={() => changePage(Math.max(0, response.offset - response.limit))} fill="#ffffff" stroke="#78716c" className="px-3 py-1.5 disabled:opacity-40">Trước</RoughButton>
              <span>Trang {Math.floor(response.offset / response.limit) + 1} / {Math.ceil(response.total / response.limit)}</span>
              <RoughButton type="button" disabled={!response.hasMore} onClick={() => changePage(response.offset + response.limit)} fill="#ffffff" stroke="#78716c" className="px-3 py-1.5 disabled:opacity-40">Tiếp</RoughButton>
            </nav>}
            <div className="pt-3 space-y-2 text-[10px] text-[#78716c] break-words select-text">
              {sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer" className="underline">{source.name}</a> · <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="underline">{source.license}</a> · Phiên bản {source.version}<br />{source.attribution}</p>)}
            </div>
          </>}
    </div>}
  </div>;
}
