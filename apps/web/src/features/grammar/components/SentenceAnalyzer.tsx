import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Wand2, Volume2, ChevronRight, LoaderCircle } from 'lucide-react';
import { SENTENCE_MAX_LENGTH, SENTENCE_SAMPLES } from '@nihongo/shared/contracts/sentence-analysis';
import { grammarPatternPath, grammarSource } from '@nihongo/shared/contracts/grammar';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import { speakJapanese } from '../../../shared/audio/speech';
import { ReviewStar } from '../../review/components/ReviewStar';
import { useLearningSettings } from '../../settings/hooks/useLearningSettings';
import { useSentenceAnalysis } from '../hooks/useSentenceAnalysis';

const tokenUnderline: Record<string, string> = {
  noun: 'border-b-2 border-blue-500', verb: 'border-b-2 border-emerald-500',
  adj: 'border-b-2 border-amber-500', adv: 'border-b-2 border-purple-500',
  particle: 'border-b-2 border-rose-500', aux: 'border-b-2 border-cyan-500',
};
const tokenBadge: Record<string, string> = {
  noun: 'bg-blue-50 text-blue-700 border-blue-200', verb: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  adj: 'bg-amber-50 text-amber-700 border-amber-200', adv: 'bg-purple-50 text-purple-700 border-purple-200',
  particle: 'bg-rose-50 text-rose-700 border-rose-200', aux: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};
const legend = [['Danh từ', 'bg-blue-500'], ['Động từ', 'bg-emerald-500'], ['Tính từ', 'bg-amber-500'], ['Trạng từ', 'bg-purple-500'], ['Trợ từ', 'bg-rose-500'], ['Trợ động từ', 'bg-cyan-500']];

export function SentenceAnalyzer({ userId, authBusy }: { userId: string | null; authBusy: boolean }) {
  const state = useSentenceAnalysis(userId, authBusy);
  const settings = useLearningSettings();
  const [selection, setSelection] = useState({ sentence: '', index: 0 });
  const [showTips, setShowTips] = useState(false);
  const currentData = state.analysis, aiData = state.ai;
  const selectedIndex = selection.sentence === currentData?.sentence ? selection.index : currentData?.tokens.findIndex(token => token.type !== 'punct') ?? 0;
  const selectedToken = currentData?.tokens[selectedIndex];
  const missingHanViet = selectedToken ? [...new Set(Array.from(selectedToken.text))]
    .filter(character => /\p{Script=Han}/u.test(character) && !selectedToken.hanVietList.some(item => item.kanji === character)) : [];
  const selectedNote = state.showAi ? aiData?.tokenNotes.find(note => note.index === selectedToken?.index && note.text === selectedToken.text) : undefined;
  const busy = state.loading || state.aiLoading || authBusy;

  return <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="min-w-0 p-5 md:p-6 space-y-4 shadow-sketch [&>div]:space-y-4" data-furigana={settings.showFurigana}>
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-base font-black text-[#292524] font-sketch">Phân tích câu 「文の分析」</h2>
        <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-300">🚀 Beta</span>
        <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border-sketch-orange flex items-center gap-1">AI cho tài khoản</span>
      </div>
      <p className="text-[11px] font-bold text-[#78716c]">Nhập một câu tiếng Nhật — hệ thống tách từ, nhận diện trợ từ và từ loại. Bấm vào từng từ để xem chi tiết.</p>
    </div>

    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void state.analyze(); }}>
      <input type="text" value={state.inputText} onChange={event => state.setInputText(event.target.value)} aria-label="Câu tiếng Nhật cần phân tích" aria-describedby="sentence-input-help"
        placeholder="例: 今夜たくさんの宿題がある。" className="min-w-0 flex-1 bg-[#fdfbf7] border-sketch-subtle rounded-xl px-3 md:px-4 py-2 text-sm font-kanji font-bold text-[#292524] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
      <RoughButton type="submit" disabled={busy} fill="#0094ff" stroke="#0369a1" borderRadius={8} roughness={0.7} className="text-white px-3 md:px-5 py-2 text-xs font-black shrink-0 cursor-pointer shadow-xs disabled:opacity-60">
        <span className="flex items-center gap-1.5">{state.loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}<span>Phân tích</span></span>
      </RoughButton>
    </form>
    <p id="sentence-input-help" className="text-[10px] font-bold text-[#a8a29e]">Tối đa {SENTENCE_MAX_LENGTH} ký tự · Cần kết nối mạng.</p>

    <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-[#78716c]">
      <span>Câu mẫu (bấm thử miễn phí):</span>
      {SENTENCE_SAMPLES.map(sentence => <button key={sentence} type="button" disabled={authBusy} onClick={() => void state.analyze(sentence)} className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] hover:bg-blue-50 hover:text-[#0094ff] hover:border-blue-400 transition-colors truncate max-w-[min(240px,100%)] cursor-pointer disabled:opacity-60">{sentence}</button>)}
    </div>
    {state.loading && <p role="status" className="text-xs font-bold text-[#78716c]">Đang tách từ và tra cứu từ điển…</p>}
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{state.error} <button type="button" onClick={() => void state.analyze()} className="underline">Thử lại</button></p>}

    {currentData && <div className="space-y-4 pt-2">
      <RoughCard fill="#fdfbf7" stroke="#292524" borderRadius={10} roughness={0.7} className="p-4 md:p-5">
        <div className="flex items-end flex-wrap gap-2 md:gap-3 text-2xl md:text-3xl font-kanji font-black leading-normal">
          {currentData.tokens.map((token, index) => token.type === 'punct' ? <span key={token.index} className="text-[#292524] whitespace-pre-wrap break-all">{token.text}</span> :
            <button key={token.index} type="button" data-furigana-token aria-pressed={selectedIndex === index} aria-label={`Xem chi tiết ${token.text}`} onClick={() => setSelection({ sentence: currentData.sentence, index })} className="max-w-full cursor-pointer group flex flex-col items-center rounded focus-visible:outline-blue-500">
              <span data-furigana-reading className="max-w-full break-all text-[10px] font-bold text-[#78716c] leading-none mb-0.5">{token.reading || '\u00a0'}</span>
              <span className={`max-w-full break-all px-1.5 py-0.5 rounded transition-all ${selectedIndex === index ? 'border-2 border-[#292524] bg-white shadow-xs' : 'hover:bg-white/80'} ${tokenUnderline[token.type] ?? ''}`}><span className="text-[#292524]">{token.text}</span></span>
            </button>)}
        </div>
        {currentData.tokens.length === 0 && <p className="text-xs text-[#78716c]">Chưa tách được từ trong câu này.</p>}
      </RoughCard>

      {selectedToken && selectedToken.type !== 'punct' && <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-3 [&>div]:space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="max-w-full break-all text-2xl font-kanji font-black text-[#292524]">{selectedToken.text}</div>
          {selectedToken.reading && <div className="max-w-full break-all text-sm font-bold text-[#78716c] font-kanji">「{selectedToken.reading}」</div>}
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-md border ${tokenBadge[selectedToken.type] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>{selectedToken.typeLabel}</span>
          <button type="button" onClick={() => speakJapanese(selectedToken.text)} className="p-1.5 rounded-full hover:bg-slate-100 text-[#0094ff] cursor-pointer" title="Nghe phát âm" aria-label={`Nghe phát âm ${selectedToken.text}`}><Volume2 className="w-4 h-4" /></button>
        </div>
        {selectedToken.hanVietList.length > 0 && <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
          <span className="text-[#78716c]">Hán Việt:</span>
          {selectedToken.hanVietList.map((item, index) => <span key={index} className="max-w-full bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md flex flex-wrap items-center gap-1 font-bold"><span className="font-kanji font-black">{item.kanji}</span><span>{item.hanViet}</span><span className="text-[10px] text-purple-500">({item.meaning})</span></span>)}
        </div>}
        {missingHanViet.length > 0 && <p className="text-[11px] font-bold text-[#78716c]">Chưa có Hán Việt trong kho cho: <span className="font-kanji">{missingHanViet.join('、')}</span>.</p>}
        <div className="space-y-1 text-xs md:text-sm font-bold text-[#57534e] break-words">
          <p>{selectedToken.explanation}</p>
          {selectedToken.baseForm && selectedToken.baseForm !== selectedToken.text && <p>Dạng từ điển: <span className="font-kanji">{selectedToken.baseForm}</span></p>}
          {selectedToken.definitions.length ? <div className="space-y-1"><p className="text-[11px] text-[#78716c]">Nghĩa từ điển (chưa xét ngữ cảnh):</p>{selectedToken.definitions.map((item, index) => <p key={index}>{item.meaning}<span className="ml-1 text-[10px] font-normal text-[#a8a29e]">({item.source})</span></p>)}</div> : <p className="text-[11px] text-[#78716c]">Chưa có nghĩa tiếng Việt trong từ điển hiện có.</p>}
          {selectedNote ? <div className="mt-2 rounded-lg bg-purple-50 px-3 py-2 text-purple-800"><p className="text-[10px] font-black uppercase">Giải thích trong câu · AI</p><p>{selectedNote.meaning}</p><p>{selectedNote.explanation}</p></div> : <p className="text-[11px] text-[#78716c]">Bấm “Phân tích cấu trúc câu (AI)” để xem nghĩa và cách dùng trong câu.</p>}
          <div className="text-[10px] text-[#a8a29e] font-mono pt-0.5">{selectedToken.grammaticalTerms}</div>
        </div>
      </RoughCard>}

      <div className="flex items-center gap-3 md:gap-5 flex-wrap text-[11px] font-bold text-[#78716c]">{legend.map(([label, color]) => <div key={label} className="flex items-center gap-1.5"><div className={`w-3 h-0.5 ${color}`} /><span>{label}</span></div>)}</div>
      <div>
        <RoughButton type="button" onClick={() => void state.toggleAi()} disabled={busy} aria-expanded={state.showAi} fill="#ffffff" stroke="#7e22ce" borderRadius={10} roughness={0.7} className="max-w-full text-purple-700 px-5 py-2.5 text-xs font-black shadow-xs hover:bg-purple-50 cursor-pointer disabled:opacity-60">
          <span className="flex items-center gap-2">{state.aiLoading ? <LoaderCircle className="w-4 h-4 shrink-0 animate-spin" /> : <Wand2 className="w-4 h-4 shrink-0 text-purple-600" />}<span>{state.aiLoading ? 'Đang phân tích cấu trúc câu…' : state.showAi ? 'Ẩn phân tích cấu trúc câu' : userId ? 'Phân tích cấu trúc câu (AI)' : 'Phân tích cấu trúc câu (AI) · cần đăng nhập'}</span></span>
        </RoughButton>
        {state.aiLoading && <p role="status" className="mt-2 text-[11px] font-bold text-[#78716c]">AI đang xử lý, có thể mất khoảng một phút.</p>}
        {state.aiError && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{state.aiError}{userId && <> <button type="button" disabled={busy} onClick={() => void state.toggleAi()} className="underline disabled:opacity-60">Thử lại</button></>}</p>}
      </div>

      {state.showAi && aiData && <div className="space-y-4 pt-2 border-t border-[#78716c]/20 animate-in fade-in duration-200 break-words">
        <div className="text-sm font-black text-[#292524] bg-amber-50 border-sketch-subtle px-4 py-2 rounded-xl">Dịch: {aiData.translation}<p className="mt-1 text-[10px] font-bold text-[#78716c]">Bản dịch và phân tích do AI tạo, có thể có sai sót.</p></div>
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-4 [&>div]:space-y-4">
          <h3 className="text-xs font-black text-rose-600 uppercase tracking-wider">Ngắt câu để dịch — đọc theo từng khối</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{aiData.chunks.map((chunk, index) => <RoughCard key={index} fill="#fdfbf7" stroke="#292524" borderRadius={10} roughness={0.7} className="min-w-0 p-3 text-center space-y-1 [&>div]:space-y-1"><div className="text-[10px] font-bold text-[#78716c] uppercase">{chunk.role}</div><div className="text-lg font-kanji font-black text-[#292524]">{chunk.text}</div><div className="text-xs font-bold text-[#0094ff]">{chunk.meaning}</div></RoughCard>)}</div>
          <div className="space-y-1 text-xs font-bold text-[#57534e] pt-2 border-t border-rose-100">
            {aiData.steps.map((step, index) => <p key={index}>{step}</p>)}
            <button type="button" aria-expanded={showTips} onClick={() => setShowTips(!showTips)} className="text-[11px] text-[#0094ff] hover:underline cursor-pointer pt-1 flex items-center gap-1">{showTips ? '▼' : '▶'} Mẹo chung khi dịch câu dài</button>
            {showTips && <div className="mt-2 rounded-lg bg-blue-50 p-3 text-[#57534e]"><p>1. Tìm vị ngữ cuối câu và xác định thể, thời, phủ định.</p><p>2. Theo trợ từ để tìm chủ đề, chủ ngữ, tân ngữ và các cụm bổ nghĩa.</p><p>3. Tách các vế nối bằng ので, から, が… rồi đọc từng khối.</p><p>4. Ghép nghĩa tự nhiên bằng tiếng Việt; kiểm tra lại chủ ngữ ẩn và ngữ cảnh.</p></div>}
          </div>
        </RoughCard>
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-3 [&>div]:space-y-3">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold text-[#78716c]">Câu chính:</span><span className="max-w-full text-sm font-kanji font-black bg-[#fdfbf7] px-2.5 py-0.5 rounded border-sketch-subtle">{aiData.structure.mainClause || 'Không xác định'}</span></div>
          <div className="flex items-center gap-3 flex-wrap text-xs font-bold">
            <span className="max-w-full flex flex-wrap items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border-sketch-blue"><span className="text-[10px] font-black">Chủ ngữ:</span><span className="font-kanji">{aiData.structure.subject || 'Không nêu rõ'}</span></span>
            <span className="max-w-full flex flex-wrap items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border-sketch-green"><span className="text-[10px] font-black">Vị ngữ:</span><span className="font-kanji">{aiData.structure.predicate || 'Không xác định'}</span></span>
            <span className="max-w-full flex flex-wrap items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border-sketch-subtle"><span className="text-[10px] font-black">Trạng ngữ:</span><span className="font-kanji">{aiData.structure.adverbial || 'Không nêu rõ'}</span></span>
          </div>
          <p className="text-xs font-bold text-[#57534e] leading-relaxed">{aiData.structure.explanation}</p>
        </RoughCard>
        <div className="space-y-2">
          <h4 className="text-xs font-black text-[#292524] uppercase tracking-wider">Mẫu ngữ pháp trong câu</h4>
          <div className="space-y-2">{aiData.patterns.map((pattern, index) => <div key={index} className="p-3 rounded-xl bg-white border-sketch-subtle flex items-center justify-between gap-4 text-xs font-bold shadow-sketch">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {pattern.match && <ReviewStar source={grammarSource(pattern.match)} />}
              {pattern.match ? <Link to={grammarPatternPath(pattern.match.id)} className="font-kanji font-black text-sm text-[#292524] hover:text-[#0094ff] hover:underline">{pattern.match.pattern}</Link> : <span className="font-kanji font-black text-sm text-[#292524]">{pattern.pattern}</span>}
              {pattern.match ? <span className="bg-[#0094ff] text-white text-[9px] font-black px-1.5 py-0.5 rounded">{pattern.match.level}</span> : <span className="bg-purple-50 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded">AI · chưa có trong kho</span>}
              <span className="text-[#57534e]">{pattern.match?.meaning ?? pattern.meaning}</span>
              {pattern.evidence && <span className="w-full text-[10px] font-normal text-[#78716c]">Trong câu: <span className="font-kanji">{pattern.evidence}</span></span>}
            </div>
            {pattern.match && <Link to={grammarPatternPath(pattern.match.id)} aria-label={`Mở mẫu ${pattern.match.pattern}`}><ChevronRight className="w-4 h-4 text-[#78716c] shrink-0" /></Link>}
          </div>)}</div>
          {aiData.patterns.length === 0 && <p className="text-xs font-bold text-[#78716c]">AI chưa xác định mẫu ngữ pháp trong câu này.</p>}
        </div>
      </div>}
      <p className="text-[10px] text-[#a8a29e] italic">* Tách từ và tra cứu từ điển cần kết nối mạng. Phân tích cấu trúc dùng AI, cần đăng nhập và không yêu cầu Premium.</p>
    </div>}
  </RoughCard>;
}
