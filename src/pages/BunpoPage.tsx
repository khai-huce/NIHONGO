import { ReviewStar } from '../components/ReviewStar';
import React, { useState } from 'react';
import { 
  Search, 
  Wand2, 
  Volume2, 
  ChevronRight, 
  Crown, 
  X,
  ArrowRight
} from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';

interface WordToken {
  text: string;
  reading?: string;
  romaji?: string;
  type: 'noun' | 'verb' | 'adj' | 'adv' | 'particle' | 'aux' | 'punct';
  typeLabel: string;
  hanVietList?: { kanji: string; hanViet: string; meaning: string }[];
  explanation: string;
  grammaticalTerms: string;
}

interface SentenceAnalysisData {
  sentence: string;
  translation: string;
  tokens: WordToken[];
  chunks: {
    role: string;
    text: string;
    meaning: string;
  }[];
  steps: string[];
  structure: {
    mainClause: string;
    subject: string;
    predicate: string;
    adverbial: string;
    explanation: string;
  };
  patterns: {
    pattern: string;
    level: string;
    meaning: string;
  }[];
}

export const BunpoPage: React.FC = () => {
  // Sentence input and analysis state
  const [inputText, setInputText] = useState('');
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number>(0);
  const [showAiStructure, setShowAiStructure] = useState(false);
  const [isConjugationModalOpen, setIsConjugationModalOpen] = useState(false);
  const [selectedCourseLesson, setSelectedCourseLesson] = useState<string | null>(null);

  // Pre-configured sentence database for interactive testing
  const sampleSentences: Record<string, SentenceAnalysisData> = {
    '今夜たくさんの宿題がある。': {
      sentence: '今夜たくさんの宿題がある。',
      translation: 'Tối nay có nhiều bài tập về nhà.',
      tokens: [
        {
          text: '今夜',
          reading: 'こんや',
          romaji: 'konya',
          type: 'noun',
          typeLabel: 'Danh từ · 名詞',
          hanVietList: [
            { kanji: '今', hanViet: 'KIM', meaning: 'hiện tại, bây giờ' },
            { kanji: '夜', hanViet: 'DẠ', meaning: 'đêm' }
          ],
          explanation: 'Danh từ chỉ thời gian/số lượng — dùng được như trạng từ, không cần trợ từ.',
          grammaticalTerms: 'Thuật ngữ: 名詞 · 副詞可能'
        },
        {
          text: 'たくさん',
          reading: '',
          romaji: 'takusan',
          type: 'adv',
          typeLabel: 'Phó từ · 副詞 / Danh từ',
          hanVietList: [],
          explanation: 'Phó từ chỉ số lượng nhiều, có thể đi kèm trợ từ 「の」 để bổ nghĩa cho danh từ phía sau.',
          grammaticalTerms: 'Thuật ngữ: 副詞 · 名詞'
        },
        {
          text: 'の',
          reading: '',
          romaji: 'no',
          type: 'particle',
          typeLabel: 'Trợ từ · 助詞',
          hanVietList: [],
          explanation: '"Của" — nối 2 danh từ: A の B = B của/thuộc A hoặc số lượng của danh từ.',
          grammaticalTerms: 'Thuật ngữ: 助詞 · 連体化'
        },
        {
          text: '宿題',
          reading: 'しゅくだい',
          romaji: 'shukudai',
          type: 'noun',
          typeLabel: 'Danh từ · 名詞',
          hanVietList: [
            { kanji: '宿', hanViet: 'TÚC', meaning: 'ở lại, trọ' },
            { kanji: '題', hanViet: 'ĐỀ', meaning: 'chủ đề, đề mục' }
          ],
          explanation: 'Bài tập về nhà (Danh từ làm chủ ngữ trong câu tồn tại).',
          grammaticalTerms: 'Thuật ngữ: 名詞 · 普通名詞'
        },
        {
          text: 'が',
          reading: '',
          romaji: 'ga',
          type: 'particle',
          typeLabel: 'Trợ từ · 助詞',
          hanVietList: [],
          explanation: 'Trợ từ chỉ chủ ngữ ngữ pháp của câu tồn tại 「〜がある」.',
          grammaticalTerms: 'Thuật ngữ: 助詞 · 格助詞'
        },
        {
          text: 'ある',
          reading: '',
          romaji: 'aru',
          type: 'verb',
          typeLabel: 'Động từ · 動詞',
          hanVietList: [],
          explanation: 'Nghĩa: có, tồn tại (vật vô tri). Động từ chính của cụm.',
          grammaticalTerms: 'Thuật ngữ: 動詞 · 自立'
        },
        {
          text: '。',
          reading: '',
          romaji: '',
          type: 'punct',
          typeLabel: 'Dấu câu',
          explanation: 'Dấu chấm câu trong tiếng Nhật.',
          grammaticalTerms: 'Thuật ngữ: 句点'
        }
      ],
      chunks: [
        { role: 'trạng ngữ thời gian', text: '今夜', meaning: 'tối nay' },
        { role: 'chủ ngữ', text: 'たくさんの宿題が', meaning: 'nhiều bài tập' },
        { role: 'vị ngữ chính', text: 'ある', meaning: 'có' }
      ],
      steps: [
        '1. Tìm vị ngữ ở cuối câu: ある = có, tồn tại.',
        '2. Xác định cái gì tồn tại: 宿題が = bài tập; たくさんの cho biết số lượng nhiều.',
        '3. 今夜 ở đầu câu là trạng ngữ thời gian: tối nay.',
        '4. Ghép theo thứ tự tiếng Việt: Tối nay + có + nhiều bài tập.'
      ],
      structure: {
        mainClause: '今夜たくさんの宿題がある',
        subject: 'たくさんの宿題が',
        predicate: 'ある',
        adverbial: '今夜',
        explanation: 'Câu tồn tại 「〜がある」: 宿題 là chủ ngữ của ある (có). Cụm たくさんの đứng trước bổ nghĩa số lượng cho 宿題; 今夜 là trạng ngữ thời gian.'
      },
      patterns: [
        { pattern: '〜がある', level: 'N5', meaning: 'Diễn tả sự tồn tại của vật/sự việc (vô tri): 宿題がある = có bài tập.' },
        { pattern: 'たくさんの + N', level: 'N5', meaning: 'たくさん + の đứng trước danh từ để nói số lượng nhiều: たくさんの宿題 = nhiều bài tập.' }
      ]
    },
    '雨が降りそうだったので、傘を持って行きました。': {
      sentence: '雨が降りそうだったので、傘を持って行きました。',
      translation: 'Vì trời trông có vẻ sắp mưa nên tôi đã mang theo ô đi.',
      tokens: [
        { text: '雨', reading: 'あめ', romaji: 'ame', type: 'noun', typeLabel: 'Danh từ · 名詞', hanVietList: [{ kanji: '雨', hanViet: 'VŨ', meaning: 'mưa' }], explanation: 'Mưa (chủ ngữ mệnh đề phụ).', grammaticalTerms: 'Thuật ngữ: 名詞' },
        { text: 'が', reading: '', romaji: 'ga', type: 'particle', typeLabel: 'Trợ từ · 助詞', explanation: 'Chỉ chủ ngữ tự nhiên của hiện tượng thời tiết.', grammaticalTerms: 'Thuật ngữ: 格助詞' },
        { text: '降りそう', reading: 'ふりそう', romaji: 'furisou', type: 'aux', typeLabel: 'Trợ động từ · 助動詞', explanation: 'Trông có vẻ sắp rơi/đổ mưa (V bỏ masu + そうだ).', grammaticalTerms: 'Thuật ngữ: 様態の助動詞' },
        { text: 'だったので', reading: '', romaji: 'dattanode', type: 'particle', typeLabel: 'Trợ từ liên kết · 接続助詞', explanation: 'Bởi vì... (nguyên nhân, lý do khách quan).', grammaticalTerms: 'Thuật ngữ: 接続助詞' },
        { text: '、', reading: '', romaji: '', type: 'punct', typeLabel: 'Dấu phẩy', explanation: 'Dấu ngắt câu.', grammaticalTerms: 'Thuật ngữ: 読点' },
        { text: '傘', reading: 'かさ', romaji: 'kasa', type: 'noun', typeLabel: 'Danh từ · 名詞', hanVietList: [{ kanji: '傘', hanViet: 'TẢN', meaning: 'cái ô, dù' }], explanation: 'Cái ô, dù (tân ngữ của hành động).', grammaticalTerms: 'Thuật ngữ: 名詞' },
        { text: 'を', reading: '', romaji: 'o', type: 'particle', typeLabel: 'Trợ từ · 助詞', explanation: 'Chỉ đối tượng trực tiếp tác động (tân ngữ).', grammaticalTerms: 'Thuật ngữ: 格助詞' },
        { text: '持って行きました', reading: 'もっていきました', romaji: 'motteikimashita', type: 'verb', typeLabel: 'Động từ ghép · 複合動詞', explanation: 'Mang theo đi (thể lịch sự quá khứ).', grammaticalTerms: 'Thuật ngữ: 動詞' },
        { text: '。', reading: '', romaji: '', type: 'punct', typeLabel: 'Dấu chấm', explanation: 'Dấu kết thúc câu.', grammaticalTerms: 'Thuật ngữ: 句点' }
      ],
      chunks: [
        { role: 'vế nguyên nhân', text: '雨が降りそうだったので', meaning: 'vì trời có vẻ sắp mưa' },
        { role: 'tân ngữ', text: '傘を', meaning: 'cái ô' },
        { role: 'vị ngữ chính', text: '持って行きました', meaning: 'đã mang theo đi' }
      ],
      steps: [
        '1. Xác định vế nối nguyên nhân: 〜ので = vì, do...',
        '2. Vế trước: 雨が降りそう = có vẻ sắp mưa (V-bỏ-masu + そう).',
        '3. Vế sau: 傘を持って行きました = đã mang ô theo.',
        '4. Ghép hoàn chỉnh: Vì trời có vẻ sắp mưa nên tôi đã mang theo ô.'
      ],
      structure: {
        mainClause: '傘を持って行きました',
        subject: 'わたし (ẩn)',
        predicate: '持って行きました',
        adverbial: '雨が降りそうだったので',
        explanation: 'Câu ghép chỉ quan hệ nhân quả: vế trước dùng 「〜そうだったので」 giải thích lý do cho hành động ở vế chính 「傘を持って行きました」.'
      },
      patterns: [
        { pattern: 'V(bỏ ます) + そうだ', level: 'N4', meaning: 'Có vẻ, sắp sửa xảy ra một hiện tượng.' },
        { pattern: '〜ので', level: 'N4', meaning: 'Bởi vì... (nêu nguyên nhân khách quan, lịch sự).' }
      ]
    },
    '先生に日本語を教えていただきました。': {
      sentence: '先生に日本語を教えていただきました。',
      translation: 'Tôi đã được thầy giáo dạy tiếng Nhật cho.',
      tokens: [
        { text: '先生', reading: 'せんせい', romaji: 'sensei', type: 'noun', typeLabel: 'Danh từ · 名詞', hanVietList: [{ kanji: '先', hanViet: 'TIÊN', meaning: 'trước' }, { kanji: '生', hanViet: 'SINH', meaning: 'sinh ra' }], explanation: 'Thầy cô giáo (đối tượng thực hiện hành động cho người nói).', grammaticalTerms: 'Thuật ngữ: 名詞' },
        { text: 'に', reading: '', romaji: 'ni', type: 'particle', typeLabel: 'Trợ từ · 助詞', explanation: 'Chỉ người trao/thực hiện hành động trong câu nhận 「〜ていただく」.', grammaticalTerms: 'Thuật ngữ: 格助詞' },
        { text: '日本語', reading: 'にほんご', romaji: 'nihongo', type: 'noun', typeLabel: 'Danh từ · 名詞', hanVietList: [{ kanji: '日', hanViet: 'NHẬT', meaning: 'mặt trời' }, { kanji: '本', hanViet: 'BẢN', meaning: 'gốc' }, { kanji: '語', hanViet: 'NGỮ', meaning: 'ngôn ngữ' }], explanation: 'Tiếng Nhật (tân ngữ).', grammaticalTerms: 'Thuật ngữ: 名詞' },
        { text: 'を', reading: '', romaji: 'o', type: 'particle', typeLabel: 'Trợ từ · 助詞', explanation: 'Trợ từ tân ngữ.', grammaticalTerms: 'Thuật ngữ: 格助詞' },
        { text: '教えていただきました', reading: 'おしえていただきました', romaji: 'oshieteitadakimashita', type: 'verb', typeLabel: 'Động từ khiêm nhường · 謙譲語', explanation: 'Được ai đó (bề trên) làm cho điều gì (Khiêm nhường ngữ của 〜てもらう).', grammaticalTerms: 'Thuật ngữ: 授受表現' },
        { text: '。', reading: '', romaji: '', type: 'punct', typeLabel: 'Dấu câu', explanation: 'Dấu chấm câu.', grammaticalTerms: 'Thuật ngữ: 句点' }
      ],
      chunks: [
        { role: 'đối tượng cho', text: '先生に', meaning: 'từ thầy giáo' },
        { role: 'tân ngữ', text: '日本語を', meaning: 'tiếng Nhật' },
        { role: 'vị ngữ khiêm nhường', text: '教えていただきました', meaning: 'đã được dạy cho' }
      ],
      steps: [
        '1. Nhận diện cấu trúc cho nhận: Vていただく = được bề trên làm gì cho.',
        '2. Xác định người thực hiện hành động: 先生に = từ thầy giáo.',
        '3. Tân ngữ được dạy: 日本語を = tiếng Nhật.',
        '4. Ghép nghĩa tiếng Việt: Tôi đã được thầy giáo dạy tiếng Nhật cho.'
      ],
      structure: {
        mainClause: '先生に日本語を教えていただきました',
        subject: 'わたし (chủ ngữ người nhận - ẩn)',
        predicate: '教えていただきました',
        adverbial: '先生に',
        explanation: 'Mẫu câu thể hiện lòng biết ơn khi nhận được sự giúp đỡ từ người có địa vị cao hơn hoặc người ngoài.'
      },
      patterns: [
        { pattern: 'Vていただく', level: 'N4', meaning: 'Được ai đó (bề trên, người ngoài) làm gì cho một cách khiêm nhường.' }
      ]
    }
  };

  const currentData: SentenceAnalysisData = sampleSentences[inputText] || sampleSentences['今夜たくさんの宿題がある。'];
  const selectedToken: WordToken = currentData.tokens[selectedTokenIdx] || currentData.tokens[0];

  const handleAnalyze = () => {
    if (!inputText.trim()) {
      setInputText('今夜たくさんの宿題がある。');
    }
    setIsAnalyzed(true);
    setSelectedTokenIdx(0);
  };

  const handleSampleClick = (sampleStr: string) => {
    setInputText(sampleStr);
    setIsAnalyzed(true);
    setSelectedTokenIdx(0);
    setShowAiStructure(false);
  };

  const getTokenUnderlineColor = (type: string) => {
    switch (type) {
      case 'noun': return 'border-b-2 border-blue-500';
      case 'verb': return 'border-b-2 border-emerald-500';
      case 'adj': return 'border-b-2 border-amber-500';
      case 'adv': return 'border-b-2 border-purple-500';
      case 'particle': return 'border-b-2 border-rose-500';
      case 'aux': return 'border-b-2 border-cyan-500';
      default: return '';
    }
  };

  const getTokenBadgeColor = (type: string) => {
    switch (type) {
      case 'noun': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'verb': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'adj': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'adv': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'particle': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'aux': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-7 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Header Banner */}
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch flex flex-wrap items-center gap-2">
          <span className="bg-[#0094ff] text-white px-2.5 py-0.5 rounded-lg border border-[#292524] shadow-xs">
            JLPT Mindmap
          </span>
          <span>–</span>
          <span>Càng học càng cuốn</span>
        </h1>

        <div className="text-xs md:text-sm font-bold text-[#57534e] space-y-0.5">
          <p>Không chỉ để thi mà còn để dùng thực tế, hiểu bản chất trong từng ngữ cảnh.</p>
          <p className="text-[#78716c]">
            Vẫn là các giáo trình quen thuộc nhưng được mở rộng theo mindmap trong từng mẫu ngữ pháp.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SENTENCE ANALYZER CARD (Phân tích câu 「文の分析」) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4 shadow-sketch">
        
        {/* Title & Badges */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-[#292524] font-sketch">
              Phân tích câu 「文の分析」
            </h2>
            <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-300">
              🚀 Beta
            </span>
            <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border-sketch-orange flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500 fill-amber-400" />
              Trọn đời
            </span>
          </div>

          <p className="text-[11px] font-bold text-[#78716c]">
            Nhập một câu tiếng Nhật — hệ thống tách từ, nhận diện trợ từ và từ loại. Bấm vào từng từ để xem chi tiết.
          </p>
        </div>

        {/* Input Bar with Search Button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="例: 今夜たくさんの宿題がある。"
            className="flex-1 bg-[#fdfbf7] border-sketch-subtle rounded-xl px-4 py-2 text-sm font-kanji font-bold text-[#292524] focus:outline-none"
          />
          <RoughButton
            onClick={handleAnalyze}
            fill="#0094ff"
            stroke="#0369a1"
            borderRadius={8}
            roughness={0.7}
            className="text-white px-5 py-2 text-xs font-black shrink-0 cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-1.5">
              <Search className="w-4 h-4" />
              <span>Phân tích</span>
            </div>
          </RoughButton>
        </div>

        {/* Sample Sentences Row */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-[#78716c]">
          <span>Câu mẫu (bấm thử miễn phí):</span>
          {Object.keys(sampleSentences).map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSampleClick(s)}
              className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] hover:bg-blue-50 hover:text-[#0094ff] hover:border-blue-400 transition-colors truncate max-w-[240px] cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* PARSED WORDS DISPLAY (Interactive Token Bar) */}
        {/* ============================================================ */}
        {isAnalyzed && (
          <div className="space-y-4 pt-2">
            
            {/* Horizontal Parsed Sentence Box */}
            <RoughCard fill="#fdfbf7" stroke="#292524" borderRadius={10} roughness={0.7} className="p-4 md:p-5">
              <div className="flex items-end flex-wrap gap-2 md:gap-3 text-2xl md:text-3xl font-kanji font-black leading-normal">
                {currentData.tokens.map((tok, idx) => {
                  const isSelected = selectedTokenIdx === idx;
                  const isPunct = tok.type === 'punct';

                  if (isPunct) {
                    return <span key={idx} className="text-[#292524]">{tok.text}</span>;
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedTokenIdx(idx)}
                      className="cursor-pointer group flex flex-col items-center"
                    >
                      {/* Furigana reading */}
                      <span className="text-[10px] font-bold text-[#78716c] leading-none mb-0.5">
                        {tok.reading || ' '}
                      </span>

                      {/* Word Tile with Underline Part of Speech */}
                      <div className={`px-1.5 py-0.5 rounded transition-all ${
                        isSelected 
                          ? 'border-2 border-[#292524] bg-white shadow-xs' 
                          : 'hover:bg-white/80'
                      } ${getTokenUnderlineColor(tok.type)}`}>
                        <span className="text-[#292524]">{tok.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RoughCard>

            {/* Selected Word Breakdown Box */}
            {selectedToken && selectedToken.type !== 'punct' && (
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-3">
                
                {/* Word Title & Part of Speech Badge */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-2xl font-kanji font-black text-[#292524]">
                    {selectedToken.text}
                  </div>
                  
                  {selectedToken.reading && (
                    <div className="text-sm font-bold text-[#78716c] font-kanji">
                      「{selectedToken.reading}」
                    </div>
                  )}

                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md border ${getTokenBadgeColor(selectedToken.type)}`}>
                    {selectedToken.typeLabel}
                  </span>

                  <button 
                    onClick={() => speakJapanese(selectedToken.text)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-[#0094ff] cursor-pointer"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Kanji Breakdown Badges */}
                {selectedToken.hanVietList && selectedToken.hanVietList.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                    <span className="text-[#78716c]">Hán Việt:</span>
                    {selectedToken.hanVietList.map((kv, kIdx) => (
                      <span 
                        key={kIdx} 
                        className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold"
                      >
                        <span className="font-kanji font-black">{kv.kanji}</span>
                        <span>{kv.hanViet}</span>
                        <span className="text-[10px] text-purple-500">({kv.meaning})</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Meaning & Explanation */}
                <div className="space-y-1 text-xs md:text-sm font-bold text-[#57534e]">
                  <p>{selectedToken.explanation}</p>
                  <p className="text-[11px] text-[#78716c]">
                    Bấm "Phân tích cấu trúc câu (AI)" để xem nghĩa từng từ, hoặc bấm nút ✨ để AI giải thích riêng từ này.
                  </p>
                  <div className="text-[10px] text-[#a8a29e] font-mono pt-0.5">
                    {selectedToken.grammaticalTerms}
                  </div>
                </div>

              </RoughCard>
            )}

            {/* Part of Speech Legend Color Strip */}
            <div className="flex items-center gap-3 md:gap-5 flex-wrap text-[11px] font-bold text-[#78716c]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-blue-500" />
                <span>Danh từ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-emerald-500" />
                <span>Động từ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-amber-500" />
                <span>Tính từ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-purple-500" />
                <span>Trạng từ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-rose-500" />
                <span>Trợ từ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-cyan-500" />
                <span>Trợ động từ</span>
              </div>
            </div>

            {/* AI Structure Analysis Button */}
            <div>
              <RoughButton
                onClick={() => setShowAiStructure(!showAiStructure)}
                fill="#ffffff"
                stroke="#7e22ce"
                borderRadius={10}
                roughness={0.7}
                className="text-purple-700 px-5 py-2.5 text-xs font-black shadow-xs hover:bg-purple-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-600" />
                  <span>{showAiStructure ? 'Ẩn phân tích cấu trúc câu' : '🪄 Phân tích cấu trúc câu · miễn phí với câu mẫu'}</span>
                </div>
              </RoughButton>
            </div>

            {/* ============================================================ */}
            {/* FULL AI SENTENCE STRUCTURE ANALYSIS BLOCK (Screen 5) */}
            {/* ============================================================ */}
            {showAiStructure && (
              <div className="space-y-4 pt-2 border-t border-[#78716c]/20 animate-in fade-in duration-200">
                
                {/* Sentence Full Translation */}
                <div className="text-sm font-black text-[#292524] bg-amber-50 border-sketch-subtle px-4 py-2 rounded-xl">
                  Dịch: {currentData.translation}
                </div>

                {/* 1. Chunk Reading Block (Ngắt câu để dịch - đọc theo từng khối) */}
                <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-4">
                  <h3 className="text-xs font-black text-rose-600 uppercase tracking-wider">
                    Ngắt câu để dịch — đọc theo từng khối
                  </h3>

                  {/* Flow Nodes of Chunks */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {currentData.chunks.map((ch, idx) => (
                      <RoughCard 
                        key={idx} 
                        fill="#fdfbf7" 
                        stroke="#292524" 
                        borderRadius={10} 
                        roughness={0.7} 
                        className="p-3 text-center space-y-1"
                      >
                        <div className="text-[10px] font-bold text-[#78716c] uppercase">
                          {ch.role}
                        </div>
                        <div className="text-lg font-kanji font-black text-[#292524]">
                          {ch.text}
                        </div>
                        <div className="text-xs font-bold text-[#0094ff]">
                          {ch.meaning}
                        </div>
                      </RoughCard>
                    ))}
                  </div>

                  {/* 4 Translation Steps */}
                  <div className="space-y-1 text-xs font-bold text-[#57534e] pt-2 border-t border-rose-100">
                    {currentData.steps.map((st, sIdx) => (
                      <p key={sIdx}>{st}</p>
                    ))}
                    <p className="text-[11px] text-[#0094ff] hover:underline cursor-pointer pt-1 flex items-center gap-1">
                      <span>▶ Mẹo chung khi dịch câu dài</span>
                    </p>
                  </div>
                </RoughCard>

                {/* 2. Grammar Structure Breakdown */}
                <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 md:p-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#78716c]">Câu chính:</span>
                    <span className="text-sm font-kanji font-black bg-[#fdfbf7] px-2.5 py-0.5 rounded border-sketch-subtle">
                      {currentData.structure.mainClause}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs font-bold">
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border-sketch-blue">
                      <span className="text-[10px] font-black">Chủ ngữ:</span>
                      <span className="font-kanji">{currentData.structure.subject}</span>
                    </span>

                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border-sketch-green">
                      <span className="text-[10px] font-black">Vị ngữ:</span>
                      <span className="font-kanji">{currentData.structure.predicate}</span>
                    </span>

                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border-sketch-subtle">
                      <span className="text-[10px] font-black">Trạng ngữ:</span>
                      <span className="font-kanji">{currentData.structure.adverbial}</span>
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#57534e] leading-relaxed">
                    {currentData.structure.explanation}
                  </p>
                </RoughCard>

                {/* 3. Relevant Grammar Patterns */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-[#292524] uppercase tracking-wider">
                    Mẫu ngữ pháp trong câu
                  </h4>
                  <div className="space-y-2">
                    {currentData.patterns.map((p, pIdx) => (
                      <div key={pIdx} className="p-3 rounded-xl bg-white border-sketch-subtle flex items-center justify-between gap-4 text-xs font-bold shadow-sketch">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ReviewStar source={{category:'grammar',sourceId:p.pattern,front:p.pattern,back:p.meaning}} />
                          <span className="font-kanji font-black text-sm text-[#292524]">{p.pattern}</span>
                          <span className="bg-[#0094ff] text-white text-[9px] font-black px-1.5 py-0.2 rounded">
                            {p.level}
                          </span>
                          <span className="text-[#57534e]">{p.meaning}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#78716c] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-[#a8a29e] italic">
                  * Tách từ & từ loại chạy tại chỗ (không cần mạng sau lần tải đầu). Phân tích cấu trúc (chủ ngữ · vị ngữ · mệnh đề bổ nghĩa) dùng AI.
                </p>

              </div>
            )}

          </div>
        )}

      </RoughCard>

      {/* ============================================================ */}
      {/* 3. GRAMMAR SYMBOLS & CONJUGATION BANNER */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-5 space-y-3 shadow-sketch">
        <h3 className="text-xs font-black text-[#292524] uppercase tracking-wider">
          Ký hiệu viết tắt trong cấu trúc ngữ pháp
        </h3>

        {/* Legend Symbols */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs font-bold">
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-[#0094ff] font-black mr-1">[ N ]</span>
            <span>Danh từ (名詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-emerald-600 font-black mr-1">[ V ]</span>
            <span>Động từ (動詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ A ]</span>
            <span>Tính từ (形容詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ Aい ]</span>
            <span>Tính từ đuôi い</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ Aな ]</span>
            <span>Tính từ đuôi な</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-purple-600 font-black mr-1">[ S ]</span>
            <span>Câu (文)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-cyan-600 font-black mr-1">[ TTT ]</span>
            <span>Thể thông thường</span>
          </div>
        </div>

        {/* Conjugation modal trigger banner */}
        <div 
          onClick={() => setIsConjugationModalOpen(true)}
          className="p-3 rounded-xl bg-amber-50 border-sketch-orange flex items-center justify-between text-xs font-bold text-amber-900 cursor-pointer hover:bg-amber-100 transition-colors shadow-sketch"
        >
          <div>
            <div className="font-black">Bảng chia thể động từ · tính từ</div>
            <div className="text-[11px] text-amber-700">Thể thông thường, thể て, thể ない, khả năng, bị động, sai khiến...</div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600" />
        </div>
      </RoughCard>

      {/* Progress Bar */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 shadow-sketch">
        <div className="flex items-center justify-between text-xs font-bold text-[#78716c] mb-1.5">
          <span>Tiến độ tổng</span>
          <span>0/548 mẫu · 0%</span>
        </div>
        <div className="w-full bg-[#eae3d5] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0094ff] h-full w-[2%]" />
        </div>
      </RoughCard>

      {/* ============================================================ */}
      {/* 4. COURSE SECTIONS (Giáo trình quốc dân & Ngữ pháp chuyên sâu) */}
      {/* ============================================================ */}
      <div className="space-y-6">
        
        {/* Section 1: Giáo trình quốc dân Sơ cấp I - II */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#0094ff] rounded-full" />
            <div>
              <h3 className="text-base font-black text-[#292524] font-sketch">
                Giáo trình quốc dân
              </h3>
              <p className="text-[11px] font-bold text-[#78716c]">Sơ cấp I · II</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* N5 */}
            <div onClick={() => setSelectedCourseLesson('N5 - Sơ cấp 1')} className="cursor-pointer group">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch hover:scale-[1.01] transition-transform">
                <div>
                  <div className="text-xs font-bold text-[#78716c]">Giáo trình quốc dân Sơ cấp I</div>
                  <div className="text-3xl font-black font-kanji text-[#292524]">N5</div>
                </div>
                <div className="mt-3 py-1.5 px-3 rounded-lg bg-[#2a9d8f] text-white flex items-center justify-between text-xs font-bold">
                  <span>25 bài học</span>
                  <span className="text-[11px] opacity-90">120 mẫu ngữ pháp · Sơ cấp 1</span>
                </div>
              </RoughCard>
            </div>

            {/* N4 */}
            <div onClick={() => setSelectedCourseLesson('N4 - Sơ cấp 2')} className="cursor-pointer group">
              <RoughCard fill="#7ba899" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch hover:scale-[1.01] transition-transform">
                <div>
                  <div className="text-xs font-bold text-[#292524]/80">Giáo trình quốc dân Sơ cấp II</div>
                  <div className="text-3xl font-black font-kanji text-[#292524]">N4</div>
                </div>
                <div className="mt-3 py-1.5 px-3 rounded-lg bg-[#2a9d8f] text-white flex items-center justify-between text-xs font-bold">
                  <span>25 bài học</span>
                  <span className="text-[11px] opacity-90">90 mẫu ngữ pháp · Sơ cấp 2</span>
                </div>
              </RoughCard>
            </div>
          </div>
        </div>

        {/* Section 2: Ngữ pháp chuyên sâu N3 - N2 - N1 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-amber-600 rounded-full" />
            <div>
              <h3 className="text-base font-black text-[#292524] font-sketch">
                Ngữ pháp chuyên sâu
              </h3>
              <p className="text-[11px] font-bold text-[#78716c]">N3 · N2 · N1</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* N3 */}
            <div onClick={() => setSelectedCourseLesson('N3 - Chuyên sâu')} className="cursor-pointer group">
              <RoughCard fill="#588157" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch hover:scale-[1.01] transition-transform text-white">
                <div>
                  <div className="text-xs font-bold text-white/90">Ngữ pháp chuyên sâu N3</div>
                  <div className="text-3xl font-black font-kanji">N3</div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-xs font-bold">
                  <span>19 bài học</span>
                  <span className="text-white/80 text-[11px]">Luyện ngữ pháp N3 chuyên sâu</span>
                </div>
              </RoughCard>
            </div>

            {/* N2 */}
            <div onClick={() => setSelectedCourseLesson('N2 - Chuyên sâu')} className="cursor-pointer group">
              <RoughCard fill="#2d6a4f" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch hover:scale-[1.01] transition-transform text-white">
                <div>
                  <div className="text-xs font-bold text-white/90">Ngữ pháp chuyên sâu N2</div>
                  <div className="text-3xl font-black font-kanji">N2</div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-xs font-bold">
                  <span>26 bài học</span>
                  <span className="text-white/80 text-[11px]">Luyện ngữ pháp N2 chuyên sâu</span>
                </div>
              </RoughCard>
            </div>

            {/* N1 */}
            <div onClick={() => setSelectedCourseLesson('N1 - Chuyên sâu')} className="cursor-pointer group sm:col-span-2">
              <RoughCard fill="#606c38" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch hover:scale-[1.01] transition-transform text-white">
                <div>
                  <div className="text-xs font-bold text-white/90">Ngữ pháp chuyên sâu N1</div>
                  <div className="text-3xl font-black font-kanji">N1</div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-xs font-bold">
                  <span>20 bài học</span>
                  <span className="text-white/80 text-[11px]">Luyện ngữ pháp N1 chuyên sâu</span>
                </div>
              </RoughCard>
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* MODAL: BẢNG CHIA THỂ ĐỘNG TỪ & TÍNH TỪ */}
      {/* ============================================================ */}
      {isConjugationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsConjugationModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={16} roughness={0.7} className="p-6 space-y-4 shadow-2xl bg-white">
              <div className="flex items-center justify-between border-b border-[#78716c]/20 pb-3">
                <h3 className="text-base font-black text-[#292524] font-sketch">
                  📚 Bảng chia thể Động từ & Tính từ tiếng Nhật
                </h3>
                <button onClick={() => setIsConjugationModalOpen(false)} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold text-[#57534e]">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <div className="text-blue-800 font-black">1. Thể て (Te-form)</div>
                  <p>Nhóm 1: い・ち・り → って | み・び・に → んで | き → いて | ぎ → いで | し → して</p>
                  <p>Nhóm 2: Bỏ ます + て (食べる → 食べて)</p>
                  <p>Nhóm 3: します → して | きます → きて</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="text-emerald-800 font-black">2. Thể ない (Nai-form)</div>
                  <p>Nhóm 1: Chuyển âm [i] sang cột [a] + ない (書く → 書かない, 行く → 行かない)</p>
                  <p>Nhóm 2: Bỏ ます + ない (見る → 見ない)</p>
                  <p>Nhóm 3: します → しない | きます → こない</p>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                  <div className="text-purple-800 font-black">3. Thể Khả năng (Potential)</div>
                  <p>Nhóm 1: Chuyển âm [u] sang cột [e] + る (話す → 話せる, 読む → 読める)</p>
                  <p>Nhóm 2: Bỏ る + られる (食べる → 食べられる)</p>
                  <p>Nhóm 3: する → できる | くる → こられる</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <RoughButton
                  onClick={() => setIsConjugationModalOpen(false)}
                  fill="#0094ff"
                  stroke="#0369a1"
                  borderRadius={8}
                  roughness={0.7}
                  className="text-white px-5 py-2 text-xs font-bold"
                >
                  Đã hiểu
                </RoughButton>
              </div>
            </RoughCard>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: LESSON EXPLORER MODAL */}
      {/* ============================================================ */}
      {selectedCourseLesson && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedCourseLesson(null)}>
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={16} roughness={0.7} className="p-6 space-y-4 shadow-2xl bg-white">
              <div className="flex items-center justify-between border-b border-[#78716c]/20 pb-3">
                <h3 className="text-base font-black text-[#292524] font-sketch">
                  📖 Danh sách bài học: {selectedCourseLesson}
                </h3>
                <button onClick={() => setSelectedCourseLesson(null)} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 text-xs font-bold">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#fdfbf7] border border-[#78716c]/30 flex items-center justify-between hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <div>
                      <div className="font-black text-[#292524]">Bài {idx + 1}: Ngữ pháp trọng tâm phần {idx + 1}</div>
                      <div className="text-[11px] text-[#78716c]">Bao gồm 4-6 mẫu ngữ pháp có bài tập ứng dụng</div>
                    </div>
                    <span className="text-[#0094ff] flex items-center gap-1 font-bold">
                      Học ngay <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2">
                <RoughButton
                  onClick={() => setSelectedCourseLesson(null)}
                  fill="#0094ff"
                  stroke="#0369a1"
                  borderRadius={8}
                  roughness={0.7}
                  className="text-white px-5 py-2 text-xs font-bold"
                >
                  Đóng
                </RoughButton>
              </div>
            </RoughCard>
          </div>
        </div>
      )}

    </div>
  );
};
