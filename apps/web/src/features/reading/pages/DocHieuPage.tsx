import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Folder, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  PenTool, 
  CheckSquare, 
  CheckCircle2, 
  XCircle, 
  AudioLines, 
  Pencil, 
  Trash2, 
  ExternalLink,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import { useLearningSettings } from '../../settings/hooks/useLearningSettings';
import { useNavigate, useParams } from 'react-router-dom';
import { pagePaths } from '../../../app/routes';
import { useReadings } from '../hooks/useReadings';
import { useReadingAudio } from '../hooks/useReadingAudio';
import { useReadingAnalysis } from '../hooks/useReadingAnalysis';
import { ReadingAnalysisDialog } from '../components/ReadingAnalysisDialog';
import { formatReadingTime as formatTime, readingLength, READING_LIMIT } from '@nihongo/client/reading';

// ---------------------------------------------------------------------------
// 6-STEP EFFECTIVE READING COMPREHENSION METHOD
// ---------------------------------------------------------------------------
const READING_STEPS = [
  {
    step: 1,
    title: 'Đọc lướt bắt ý chính (Skimming)',
    desc: 'Đọc lướt toàn bài trong 2-3 phút, tập trung vào câu đầu/cuối mỗi đoạn để nắm nội dung tổng quan mà không tra từ điển.'
  },
  {
    step: 2,
    title: 'Nghe audio chuẩn giọng bản xứ',
    desc: 'Bấm nghe audio toàn bài 1-2 lần để cảm nhận ngữ điệu, nhịp ngắt câu và cách phát âm tự nhiên của người Nhật.'
  },
  {
    step: 3,
    title: 'Luyện đọc đuổi (Shadowing)',
    desc: 'Bật chế độ lặp câu hoặc bấm từng câu, vừa nghe audio vừa đọc theo thật to và đúng ngữ điệu của người đọc.'
  },
  {
    step: 4,
    title: 'Tra cứu Từ vựng & Ngữ pháp trọng điểm',
    desc: 'Quan sát cột bên phải: ghi nhớ các từ vựng cốt lõi kèm âm Hán-Việt và cấu trúc ngữ pháp JLPT xuất hiện trong bài.'
  },
  {
    step: 5,
    title: 'Làm bài kiểm tra đọc hiểu',
    desc: 'Trả lời các câu hỏi trắc nghiệm chuẩn đề thi JLPT ở cuối bài để kiểm tra khả năng suy luận và mức độ hiểu sâu nội dung.'
  },
  {
    step: 6,
    title: 'Tắt hỗ trợ và đọc lại trôi chảy',
    desc: 'Tắt Furigana và Bản dịch, tự đọc lại trôi chảy toàn văn bản từ đầu đến cuối một cách tự tin.'
  }
];

export const DocHieuPage: React.FC<{ userId: string | null; authBusy: boolean }> = ({ userId, authBusy }) => {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const readings = useReadings(userId, authBusy, articleId);
  const currentArticle = readings.article;
  const analysis = useReadingAnalysis(userId, currentArticle, authBusy || readings.loading, readings.refresh);
  const userArticles = readings.articles.filter(article => article.visibility === 'private');
  const publicArticles = readings.articles.filter(article => article.visibility === 'public');
  const [inputText, setInputText] = useState('');
  const [isMethodAccordionOpen, setIsMethodAccordionOpen] = useState(false);
  const [isLoopSentence, setIsLoopSentence] = useState(false);
  const settings = useLearningSettings();
  const [speedOverride, setPlaybackSpeed] = useState<number | null>(null);
  const [furiganaOverride, setShowFurigana] = useState<boolean | null>(null);
  const playbackSpeed = speedOverride ?? settings.audioSpeed;
  const furiganaMode = furiganaOverride === null ? settings.showFurigana : furiganaOverride ? 'always' : 'never';
  const showFurigana = furiganaMode !== 'never';
  const player = useReadingAudio(currentArticle, userId, authBusy, playbackSpeed, isLoopSentence);
  const isPlaying = player.playing;
  const activeSentenceId = player.sentenceId;
  const currentTimeSec = player.currentTime;
  const readingAreaRef = useRef<HTMLDivElement>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});
  useEffect(() => { setQuizAnswers({}); setShowExplanations({}); }, [articleId, currentArticle?.version, userId]);
  const openArticle = (id: string) => navigate(`${pagePaths['lifetime-doc-hieu']}/${encodeURIComponent(id)}`);
  const cyclePlaybackSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5];
    setPlaybackSpeed(speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length]);
  };
  const handleUseSampleText = () => {
    const first = publicArticles[0];
    if (first) setInputText(first.text);
  };
  const handleCreateArticle = async () => {
    const id = await readings.create(inputText);
    if (id) { setInputText(''); openArticle(id); }
  };
  const handleDeleteUserArticle = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const article = userArticles.find(item => item.id === id);
    if (article && window.confirm('Bạn có chắc muốn xóa bài đọc này?')) await readings.remove(article);
  };
  const status = <>
    {readings.loading && <p role="status" className="text-xs font-bold text-[#78716c]">Đang tải bài đọc…</p>}
    {readings.saving && <p role="status" className="text-xs font-bold text-[#78716c]">Đang lưu…</p>}
    {readings.error && <p role="alert" className="text-xs font-bold text-red-700">{readings.error} <button onClick={readings.refresh} className="underline" disabled={readings.saving}>Tải lại</button></p>}
    {!userId && !authBusy && <p className="text-xs font-bold text-[#78716c]">Bạn đang dùng chế độ khách. Bài trên thiết bị được giữ riêng, không tự nhập vào tài khoản.</p>}
  </>;

  // =========================================================================
  // VIEW 1: CREATION & ARTICLE LIST OVERVIEW (media_1788792133093.png)
  // =========================================================================
  if (!currentArticle) {
    return (
      <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto select-none space-y-6">
        
        {/* Header with Circular Icon */}
        <div className="flex flex-col items-center text-center space-y-2 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#0094ff]/15 border-2 border-[#0094ff]/30 flex items-center justify-center text-[#0094ff] shadow-sm">
            <BookOpen className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">
            Đọc hiểu
          </h1>
          <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">
            Lưu bài đọc tiếng Nhật để học và mở lại theo tài khoản. Audio, bản dịch và nội dung bổ trợ hiển thị khi đã sẵn sàng.
          </p>
        </div>

        {status}
        {/* 2-Column Grid: Left (Articles list) + Right (Creation Box) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
          
          {/* LEFT COLUMN: Demo & User Articles (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Section 1: Bài demo */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-black text-[#292524] font-sketch">
                <BookOpen className="w-4 h-4 text-stone-700" />
                <span>Bài demo</span>
              </div>
              <p className="text-xs font-bold text-[#78716c]">
                Xem bài đọc và nội dung bổ trợ đã được biên tập. Audio hiển thị khi đã sẵn sàng.
              </p>

              {publicArticles.length === 0 && !readings.loading && <p className="text-xs font-bold text-[#78716c]">Chưa có bài đọc được xuất bản.</p>}
              {publicArticles.map(article => (
              <RoughCard
                key={article.id}
                fill="#ffffff"
                stroke="#292524"
                borderRadius={12}
                roughness={0.7}
                className="p-4 space-y-1.5 shadow-sketch cursor-pointer hover:bg-stone-50/70 transition-colors"
                onClick={() => openArticle(article.id)}
              >
                <h3 className="text-sm md:text-base font-black text-[#292524] font-sketch">
                  {article.title}
                </h3>
                <p className="text-xs font-bold text-[#57534e]">
                  {article.subtitle}
                </p>
                <div className="text-[11px] font-bold text-[#78716c] pt-1">
                  {article.audio ? formatTime(article.audio.totalSeconds) : '--:--'} · {readingLength(article.text)} ký tự
                </div>
              </RoughCard>
              ))}
            </div>

            {/* Section 2: Bài của bạn */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-black text-[#292524] font-sketch">
                <Folder className="w-4 h-4 text-stone-700" />
                <span>Bài của bạn</span>
              </div>
              <p className="text-xs font-bold text-[#78716c]">
                Bài đã tạo được lưu vào tài khoản — mở lại trên mọi thiết bị, không tốn lượt.
              </p>

              {userArticles.length === 0 ? (
                /* Empty state card */
                <RoughCard
                  fill="#f5f5f4"
                  stroke="#a8a29e"
                  borderRadius={12}
                  roughness={0.7}
                  className="p-4 text-xs font-bold text-[#78716c] leading-relaxed shadow-sketch"
                >
                  Chưa có bài nào — dán văn bản bên phải để tạo bài đầu tiên.
                </RoughCard>
              ) : (
                <div className="space-y-3">
                  {userArticles.map(art => (
                    <RoughCard
                      key={art.id}
                      fill="#ffffff"
                      stroke="#292524"
                      borderRadius={12}
                      roughness={0.7}
                      className="p-4 space-y-1.5 shadow-sketch cursor-pointer hover:bg-stone-50/70 transition-colors group relative"
                      onClick={() => openArticle(art.id)}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-black text-[#292524] font-sketch line-clamp-1">
                          {art.title}
                        </h3>
                        <button
                          onClick={(e) => { void handleDeleteUserArticle(art.id, e); }}
                          disabled={readings.saving || readings.loading}
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition-opacity p-1"
                          title="Xóa bài đọc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-[#57534e]">
                        {art.subtitle}
                      </p>
                      <div className="text-[11px] font-bold text-[#78716c] pt-1">
                        {art.audio ? formatTime(art.audio.totalSeconds) : '--:--'} · {readingLength(art.text)} ký tự · {Number.isFinite(Date.parse(art.createdAt)) ? new Date(art.createdAt).toLocaleDateString('vi-VN') : art.createdAt}
                      </div>
                    </RoughCard>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Accordion + Textarea Box (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Accordion: Phương pháp đọc hiểu hiệu quả nhất */}
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={12}
              roughness={0.7}
              className="p-4 shadow-sketch cursor-pointer select-none transition-colors hover:bg-stone-50/50"
              onClick={() => setIsMethodAccordionOpen(!isMethodAccordionOpen)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs md:text-sm font-black text-[#292524] font-sketch">
                  <BookOpen className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>Phương pháp đọc hiểu hiệu quả nhất (6 bước với 1 bài)</span>
                </div>
                {isMethodAccordionOpen ? (
                  <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                )}
              </div>

              {/* Accordion expanded content */}
              {isMethodAccordionOpen && (
                <div className="mt-4 pt-3 border-t border-stone-200 space-y-3 text-xs text-[#57534e] font-sans">
                  {READING_STEPS.map(item => (
                    <div key={item.step} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#0094ff] text-white flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                        {item.step}
                      </span>
                      <div>
                        <strong className="text-[#292524] font-bold block">{item.title}</strong>
                        <span className="text-slate-600 leading-relaxed">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </RoughCard>

            {/* Main Text Input Box */}
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={14}
              roughness={0.7}
              className="p-4 md:p-5 shadow-sketch space-y-3"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(Array.from(e.target.value).slice(0, READING_LIMIT).join(''))}
                disabled={readings.saving || authBusy}
                placeholder="Dán một đoạn đọc ngắn, đoạn văn hoặc bài báo tiếng Nhật (tối đa 3000 ký tự) vào đây..."
                rows={12}
                className="w-full bg-transparent border-0 outline-none resize-y text-sm md:text-base text-[#292524] font-kanji placeholder:text-stone-400 focus:ring-0 leading-relaxed"
              />

              <div className="flex items-center justify-end text-xs font-bold text-stone-400 pt-2 border-t border-stone-200/60">
                <span>{readingLength(inputText)}/3000</span>
              </div>
            </RoughCard>

            {/* Bottom Actions: "Dùng văn bản mẫu" + "Tạo bài đọc" Button */}
            <div className="space-y-3 pt-1">
              <div>
                <button
                  onClick={handleUseSampleText}
                  disabled={!publicArticles.length || readings.saving}
                  className="text-xs font-bold text-[#78716c] hover:text-[#0094ff] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Dùng văn bản mẫu
                </button>
              </div>

              <RoughButton
                onClick={() => { void handleCreateArticle(); }}
                disabled={readings.saving || readings.loading || !inputText.trim()}
                fill="#70c4ff"
                stroke="#0284c7"
                borderRadius={10}
                roughness={0.7}
                className="w-auto px-6 py-2.5 text-white font-black text-sm shadow-md hover:brightness-105 transition-all flex items-center gap-2 cursor-pointer"
              >
                <AudioLines className="w-4 h-4 stroke-[2.5]" />
                <span>Tạo bài đọc</span>
              </RoughButton>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: DETAILED ARTICLE STUDY VIEW (media_1788792150983.png & media_1788792243457.png)
  // =========================================================================
  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto select-none space-y-6">
      
      {/* 1. Header with Circular Icon */}
      <div className="flex flex-col items-center text-center space-y-2 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-[#0094ff]/15 border-2 border-[#0094ff]/30 flex items-center justify-center text-[#0094ff] shadow-sm">
          <BookOpen className="w-6 h-6 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">
          Đọc hiểu
        </h1>
        <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">
          Lưu bài đọc tiếng Nhật để học và mở lại theo tài khoản. Audio, bản dịch và nội dung bổ trợ hiển thị khi đã sẵn sàng.
        </p>
      </div>

      {/* 2. Sub-action bar: "Tạo bài đọc khác" + Demo badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(pagePaths['lifetime-doc-hieu'])}
          className="px-3 py-1 rounded-lg border border-[#292524] bg-white hover:bg-stone-100 text-xs font-bold text-[#292524] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Tạo bài đọc khác</span>
        </button>

        {currentArticle.visibility === 'private' && <button
          type="button" onClick={() => { void analysis.start(); }}
          disabled={!userId || authBusy || readings.loading || readings.saving || analysis.busy || analysis.saving || !!analysis.eligibility}
          title={analysis.eligibility || 'Tạo furigana và bản dịch cho phần còn thiếu; xem trước rồi mới lưu.'}
          className="px-3 py-1 rounded-lg border border-[#292524] bg-white hover:bg-stone-100 text-xs font-bold text-[#292524] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        ><Sparkles className="w-3.5 h-3.5" /><span>{analysis.busy ? 'Đang phân tích…' : 'Phân tích bài đọc'}</span></button>}

        {currentArticle.visibility === 'public' && (
          <span className="px-3 py-1 rounded-full border border-[#0094ff] bg-blue-50/70 text-xs font-black text-[#0094ff] flex items-center gap-1.5 shadow-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bài đọc mẫu (demo) · miễn phí</span>
          </span>
        )}
      </div>

      {status}
      {analysis.busy && <p role="status" className="text-xs font-bold text-[#78716c]">Gemini đang tạo furigana và bản dịch. Bài đã lưu vẫn giữ nguyên đến khi bạn xác nhận.</p>}
      {analysis.error && !analysis.draft && <p role="alert" className="text-xs font-bold text-red-700">{analysis.error}</p>}
      {currentArticle.visibility === 'private' && analysis.eligibility && <p className="text-xs font-bold text-[#78716c]">{analysis.eligibility}</p>}
      {analysis.draft && <ReadingAnalysisDialog title={analysis.draft.title} article={analysis.draft.article}
        rows={analysis.draft.rows} warnings={analysis.draft.warnings} saving={analysis.saving} uncertain={analysis.uncertain}
        stale={analysis.stale} error={analysis.error} onEdit={analysis.edit} onClose={analysis.close}
        onApply={() => { void analysis.apply(); }} onReload={analysis.reload} />}
      {/* 3. Audio Player Bar (Full width RoughCard) */}
      <RoughCard
        fill="#ffffff"
        stroke="#292524"
        borderRadius={14}
        roughness={0.7}
        className="p-4 md:p-5 shadow-sketch space-y-3"
      >
        {player.generating && <p role="status" className="text-xs font-bold text-[#78716c]">Đang tạo audio bằng Microsoft Edge TTS…</p>}
        {player.error && <p role="alert" className="text-xs font-bold text-red-700">{player.error}</p>}
        {!player.audio && !player.generating && !player.error && <p className="text-xs font-bold text-[#78716c]">Chưa có audio. Bấm phát để tạo audio cho bài đọc.</p>}
        {/* Timeline Slider */}
        <div className="flex items-center gap-3 text-xs font-black text-slate-600 font-mono">
          <span className="w-10 text-right">{formatTime(currentTimeSec)}</span>
          
          <div 
            role="slider"
            tabIndex={player.audio ? 0 : -1}
            aria-label="Vị trí phát audio"
            aria-valuemin={0}
            aria-valuemax={player.audio?.totalSeconds ?? 0}
            aria-valuenow={Math.round(currentTimeSec)}
            aria-disabled={!player.audio}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); player.seek(currentTimeSec + (event.key === 'ArrowLeft' ? -5 : 5)); }
              if (event.key === 'Home') { event.preventDefault(); player.seek(0); }
              if (event.key === 'End') { event.preventDefault(); player.seek(player.audio?.totalSeconds ?? 0); }
            }}
            onClick={(e) => {
              if (!player.audio) return;
              const rect = e.currentTarget.getBoundingClientRect();
              player.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * player.audio.totalSeconds);
            }}
            className="relative flex-1 h-2.5 border border-[#292524] rounded-full bg-stone-100 cursor-pointer overflow-hidden p-0.5"
          >
            <div 
              className="h-full bg-[#0094ff] rounded-full transition-all duration-200"
              style={{ width: `${(currentTimeSec / (player.audio?.totalSeconds || 1)) * 100}%` }}
            />
          </div>

          <span className="w-10">{player.audio ? formatTime(player.audio.totalSeconds) : '--:--'}</span>
        </div>

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          
          {/* Left Player Controls: Prev, Play/Pause, Next, Loop, Speed */}
          <div className="flex items-center gap-2">
            {/* Prev Sentence */}
            <button
              onClick={player.previous}
              disabled={!player.audio || player.generating || authBusy}
              className="w-8 h-8 border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524] flex items-center justify-center transition-colors cursor-pointer"
              title="Câu trước"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <RoughButton
              onClick={() => { void player.toggle(); }}
              disabled={player.generating || authBusy}
              fill="#0094ff"
              stroke="#0284c7"
              className="w-10 h-10 text-white flex items-center justify-center cursor-pointer"
              title={isPlaying ? 'Tạm dừng' : 'Bắt đầu phát'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </RoughButton>

            {/* Next Sentence */}
            <button
              onClick={player.next}
              disabled={!player.audio || player.generating || authBusy}
              className="w-8 h-8 border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524] flex items-center justify-center transition-colors cursor-pointer"
              title="Câu kế tiếp"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Loop Sentence Toggle */}
            <button
              onClick={() => setIsLoopSentence(!isLoopSentence)}
              className={`px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLoopSentence 
                  ? 'border-sketch-blue bg-blue-50 text-[#0094ff]' 
                  : 'border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524]'
              }`}
              title="Lặp lại câu đang chọn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Lặp câu</span>
            </button>

            {/* Speed Button */}
            <button
              onClick={cyclePlaybackSpeed}
              className="px-2.5 py-1.5 border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524] text-xs font-black transition-colors cursor-pointer font-mono"
              title="Tốc độ phát audio"
            >
              {playbackSpeed}x
            </button>
          </div>

          {/* Right Toggles: Furigana & Translation */}
          <div className="flex items-center gap-2">
            {/* Furigana toggle */}
            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className={`px-3 py-1.5 text-xs font-black transition-colors cursor-pointer ${
                showFurigana 
                  ? 'border-sketch-blue bg-blue-50 text-[#0094ff]' 
                  : 'border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524]'
              }`}
              title="Bật/tắt chữ Furigana trên Kanji"
            >
              <span>ふ Furigana</span>
            </button>

            {/* Translation toggle */}
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-3 py-1.5 text-xs font-black transition-colors cursor-pointer ${
                showTranslation 
                  ? 'border-sketch-blue bg-blue-50 text-[#0094ff]' 
                  : 'border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524]'
              }`}
              title="Bật/tắt bản dịch tiếng Việt"
            >
              <span>文A Bản dịch</span>
            </button>
          </div>

        </div>
      </RoughCard>

      {/* 4. Main 2-Column Content Grid */}
      <div ref={readingAreaRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Japanese Text + Reading Comprehension Quiz (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Japanese Text Article Box */}
          <RoughCard
            fill="#ffffff"
            stroke="#292524"
            borderRadius={14}
            roughness={0.7}
            className="p-5 md:p-7 shadow-sketch space-y-6"
          >
            {showFurigana && !currentArticle.paragraphs.some(p => p.sentences.some(s => s.ruby?.some(token => token.reading))) && <p className="text-xs font-bold text-[#78716c]">Chưa có Furigana được biên tập cho bài này.</p>}
            {currentArticle.paragraphs.map(p => (
              <div key={p.id} className="space-y-3 leading-relaxed text-[#292524] font-sans">
                {p.sentences.map(s => {
                  const isActive = s.id === activeSentenceId;

                  return (
                    <div
                      key={s.id}
                      onClick={() => { void player.sentence(s.id); }}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-amber-100/70 border-l-4 border-[#0094ff] pl-3.5 shadow-xs ring-1 ring-amber-200'
                          : 'hover:bg-stone-100/70'
                      }`}
                    >
                      {/* Japanese Text (with or without ruby Furigana) */}
                      <div
                        className="text-base md:text-lg leading-loose font-kanji"
                        data-furigana={furiganaMode}
                        onPointerDown={event => {
                          if (furiganaMode === 'hover') (event.target as HTMLElement).closest<HTMLElement>('ruby')?.focus();
                        }}
                      >
                        <span className="ruby-container font-medium">
                          {s.ruby?.length ? s.ruby.map((token, index) => token.reading
                            ? <ruby key={index} tabIndex={furiganaMode === 'hover' ? 0 : -1}>{token.text}<rt>{token.reading}</rt></ruby>
                            : <React.Fragment key={index}>{token.text}</React.Fragment>) : s.japanese}
                        </span>
                      </div>

                      {/* Vietnamese Translation (Visible if toggle ON or on hover of active) */}
                      {(showTranslation || isActive) && (
                        <div className="text-xs md:text-sm font-bold text-slate-500 pt-1.5 animate-in fade-in duration-200">
                          {s.translation || 'Chưa có bản dịch cho câu này.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </RoughCard>

          {/* Reading Comprehension Quiz (media_1788792243457.png) */}
          <RoughCard
            fill="#ffffff"
            stroke="#292524"
            borderRadius={14}
            roughness={0.7}
            className="p-5 md:p-6 shadow-sketch space-y-5"
          >
            <div className="flex items-center gap-2 text-base md:text-lg font-black text-[#292524] font-sketch border-b border-stone-200/80 pb-3">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <span>Kiểm tra đọc hiểu</span>
            </div>

            <div className="space-y-6">
              {!currentArticle.quizList.length && <p className="text-xs font-bold text-[#78716c]">Chưa có câu hỏi đọc hiểu cho bài này.</p>}
              {currentArticle.quizList.map((quiz, qIdx) => {
                const selected = quizAnswers[quiz.id];
                const isAnswered = selected !== undefined;
                const isCorrect = isAnswered && selected === quiz.correctIndex;
                const showExpl = showExplanations[quiz.id];

                return (
                  <div key={quiz.id} className="space-y-3">
                    {/* Question Header */}
                    <div className="space-y-1">
                      <span className="text-xs font-black text-[#78716c] uppercase">
                        Câu {qIdx + 1}/{currentArticle.quizList.length}
                      </span>
                      <h4 className="text-sm md:text-base font-black text-[#292524] leading-relaxed font-kanji">
                        {quiz.question}
                      </h4>
                    </div>

                    {/* Options List */}
                    <div className="space-y-2">
                      {quiz.options.map((opt, optIdx) => {
                        let optStyle = 'border-sketch-subtle bg-white hover:bg-stone-50 text-[#292524]';
                        if (isAnswered) {
                          if (optIdx === quiz.correctIndex) {
                            optStyle = 'border-sketch-green bg-emerald-50 text-emerald-900 font-bold';
                          } else if (optIdx === selected) {
                            optStyle = 'border-sketch bg-rose-50 text-rose-900 line-through';
                          } else {
                            optStyle = 'border-sketch-subtle opacity-60 bg-stone-50';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => {
                              if (!isAnswered) {
                                setQuizAnswers(prev => ({ ...prev, [quiz.id]: optIdx }));
                                setShowExplanations(prev => ({ ...prev, [quiz.id]: true }));
                              }
                            }}
                            disabled={isAnswered}
                            className={`w-full text-left p-3.5 rounded-xl text-xs md:text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${optStyle}`}
                          >
                            <span className="font-kanji">{optIdx + 1}. {opt}</span>
                            {isAnswered && optIdx === quiz.correctIndex && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                            )}
                            {isAnswered && optIdx === selected && optIdx !== quiz.correctIndex && (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation Box */}
                    {showExpl && (
                      <div className={`p-3.5 rounded-xl border-sketch text-xs font-bold leading-relaxed animate-in fade-in duration-200 ${
                        isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                      }`}>
                        <div className="flex items-center gap-1.5 pb-1">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{isCorrect ? 'Chính xác! Giải thích:' : 'Chưa đúng. Giải thích:'}</span>
                        </div>
                        <p>{quiz.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </RoughCard>

        </div>

        {/* RIGHT COLUMN: Vocabulary + Grammar Points (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Từ vựng trọng điểm (media_1788792150983.png) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm md:text-base font-black text-[#292524] font-sketch">
              <FileText className="w-4 h-4 text-stone-700" />
              <span>Từ vựng trọng điểm</span>
            </div>

            {/* Scrollable list of vocabulary cards */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {!currentArticle.vocabList.length && <p className="text-xs font-bold text-[#78716c]">Chưa có từ vựng được biên tập cho bài này.</p>}
              {currentArticle.vocabList.map((v, idx) => (
                <RoughCard
                  key={idx}
                  fill="#ffffff"
                  stroke="#78716c"
                  borderRadius={10}
                  roughness={0.7}
                  className="p-3 space-y-1 shadow-sketch"
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm md:text-base font-black text-[#292524] font-kanji">
                      {v.word}
                    </span>
                    <span className="text-xs font-bold text-slate-500 font-kanji">
                      {v.reading}
                    </span>
                    <span className="text-[11px] font-black text-[#0094ff] uppercase">
                      {v.hanViet}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {v.meaning}
                  </p>
                </RoughCard>
              ))}
            </div>
          </div>

          {/* Section 2: Mẫu ngữ pháp trong bài (media_1788792243457.png) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm md:text-base font-black text-[#292524] font-sketch">
              <PenTool className="w-4 h-4 text-stone-700" />
              <span>Mẫu ngữ pháp trong bài</span>
            </div>

            <div className="space-y-3">
              {!currentArticle.grammarList.length && <p className="text-xs font-bold text-[#78716c]">Chưa có ngữ pháp được biên tập cho bài này.</p>}
              {currentArticle.grammarList.map((g, idx) => (
                <RoughCard
                  key={idx}
                  fill="#ffffff"
                  stroke="#78716c"
                  borderRadius={10}
                  roughness={0.7}
                  className="p-3.5 space-y-2 shadow-sketch"
                >
                  {/* Grammar Header: Pattern + External link + JLPT Level badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-[#0094ff] font-kanji">
                        {g.pattern}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                    </div>

                    <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-black">
                      {g.jlptLevel}
                    </span>
                  </div>

                  {/* Meaning */}
                  <div className="text-xs font-bold text-slate-600">
                    {g.meaning}
                  </div>

                  {/* Example sentences */}
                  <div className="p-2.5 rounded-lg bg-stone-50 border-sketch-subtle space-y-1 text-xs">
                    <p className="font-bold text-[#292524] leading-relaxed font-kanji">
                      {g.exampleJp}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                      {g.exampleVi}
                    </p>
                  </div>
                </RoughCard>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
