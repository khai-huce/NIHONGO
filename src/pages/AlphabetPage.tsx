import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  RotateCcw, 
  Sparkles, 
  FileText, 
  Download,
  Headphones
} from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';

interface KanaTileData {
  hira: string;
  kata: string;
  romaji: string;
}

export const AlphabetPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hiragana' | 'katakana'>('hiragana');
  const [selectedKana, setSelectedKana] = useState<KanaTileData | null>(null);

  // 1. Âm trong (Seion) - 5 columns x 11 rows
  const seionRows: (KanaTileData | null)[][] = [
    [
      { hira: 'あ', kata: 'ア', romaji: 'a' },
      { hira: 'い', kata: 'イ', romaji: 'i' },
      { hira: 'う', kata: 'ウ', romaji: 'u' },
      { hira: 'え', kata: 'エ', romaji: 'e' },
      { hira: 'お', kata: 'オ', romaji: 'o' },
    ],
    [
      { hira: 'か', kata: 'カ', romaji: 'ka' },
      { hira: 'き', kata: 'キ', romaji: 'ki' },
      { hira: 'く', kata: 'ク', romaji: 'ku' },
      { hira: 'け', kata: 'ケ', romaji: 'ke' },
      { hira: 'こ', kata: 'コ', romaji: 'ko' },
    ],
    [
      { hira: 'さ', kata: 'サ', romaji: 'sa' },
      { hira: 'し', kata: 'シ', romaji: 'shi' },
      { hira: 'す', kata: 'ス', romaji: 'su' },
      { hira: 'せ', kata: 'セ', romaji: 'se' },
      { hira: 'そ', kata: 'ソ', romaji: 'so' },
    ],
    [
      { hira: 'た', kata: 'タ', romaji: 'ta' },
      { hira: 'ち', kata: 'チ', romaji: 'chi' },
      { hira: 'つ', kata: 'ツ', romaji: 'tsu' },
      { hira: 'て', kata: 'テ', romaji: 'te' },
      { hira: 'と', kata: 'ト', romaji: 'to' },
    ],
    [
      { hira: 'な', kata: 'ナ', romaji: 'na' },
      { hira: 'に', kata: 'ニ', romaji: 'ni' },
      { hira: 'ぬ', kata: 'ヌ', romaji: 'nu' },
      { hira: 'ね', kata: 'ネ', romaji: 'ne' },
      { hira: 'の', kata: 'ノ', romaji: 'no' },
    ],
    [
      { hira: 'は', kata: 'ハ', romaji: 'ha' },
      { hira: 'ひ', kata: 'ヒ', romaji: 'hi' },
      { hira: 'ふ', kata: 'フ', romaji: 'fu' },
      { hira: 'へ', kata: 'ヘ', romaji: 'he' },
      { hira: 'ほ', kata: 'ホ', romaji: 'ho' },
    ],
    [
      { hira: 'ま', kata: 'マ', romaji: 'ma' },
      { hira: 'み', kata: 'ミ', romaji: 'mi' },
      { hira: 'む', kata: 'ム', romaji: 'mu' },
      { hira: 'め', kata: 'メ', romaji: 'me' },
      { hira: 'も', kata: 'モ', romaji: 'mo' },
    ],
    [
      { hira: 'や', kata: 'ヤ', romaji: 'ya' },
      null,
      { hira: 'ゆ', kata: 'ユ', romaji: 'yu' },
      null,
      { hira: 'よ', kata: 'ヨ', romaji: 'yo' },
    ],
    [
      { hira: 'ら', kata: 'ラ', romaji: 'ra' },
      { hira: 'り', kata: 'リ', romaji: 'ri' },
      { hira: 'る', kata: 'ル', romaji: 'ru' },
      { hira: 'れ', kata: 'レ', romaji: 're' },
      { hira: 'ろ', kata: 'ロ', romaji: 'ro' },
    ],
    [
      { hira: 'わ', kata: 'ワ', romaji: 'wa' },
      null,
      null,
      null,
      { hira: 'を', kata: 'ヲ', romaji: 'wo' },
    ],
    [
      { hira: 'ん', kata: 'ン', romaji: 'n' },
      null,
      null,
      null,
      null
    ]
  ];

  // 2. Âm đục & Bán đục (Dakuon · Handakuon) - 5 columns x 5 rows
  const dakuonRows: (KanaTileData | null)[][] = [
    [
      { hira: 'が', kata: 'ガ', romaji: 'ga' },
      { hira: 'ぎ', kata: 'ギ', romaji: 'gi' },
      { hira: 'ぐ', kata: 'グ', romaji: 'gu' },
      { hira: 'げ', kata: 'ゲ', romaji: 'ge' },
      { hira: 'ご', kata: 'ゴ', romaji: 'go' },
    ],
    [
      { hira: 'ざ', kata: 'ザ', romaji: 'za' },
      { hira: 'じ', kata: 'ジ', romaji: 'ji' },
      { hira: 'ず', kata: 'ズ', romaji: 'zu' },
      { hira: 'ぜ', kata: 'ゼ', romaji: 'ze' },
      { hira: 'ぞ', kata: 'ゾ', romaji: 'zo' },
    ],
    [
      { hira: 'だ', kata: 'ダ', romaji: 'da' },
      { hira: 'ぢ', kata: 'ヂ', romaji: 'ji' },
      { hira: 'づ', kata: 'ヅ', romaji: 'zu' },
      { hira: 'で', kata: 'デ', romaji: 'de' },
      { hira: 'ど', kata: 'ド', romaji: 'do' },
    ],
    [
      { hira: 'ば', kata: 'バ', romaji: 'ba' },
      { hira: 'び', kata: 'ビ', romaji: 'bi' },
      { hira: 'ぶ', kata: 'ブ', romaji: 'bu' },
      { hira: 'べ', kata: 'ベ', romaji: 'be' },
      { hira: 'ぼ', kata: 'ボ', romaji: 'bo' },
    ],
    [
      { hira: 'ぱ', kata: 'パ', romaji: 'pa' },
      { hira: 'ぴ', kata: 'ピ', romaji: 'pi' },
      { hira: 'ぷ', kata: 'プ', romaji: 'pu' },
      { hira: 'ぺ', kata: 'ペ', romaji: 'pe' },
      { hira: 'ぽ', kata: 'ポ', romaji: 'po' },
    ]
  ];

  // 3. Âm ghép (Yoon) - 9 columns x 4 rows
  const yoonRows: (KanaTileData | null)[][] = [
    [
      { hira: 'きゃ', kata: 'キャ', romaji: 'kya' },
      { hira: 'きゅ', kata: 'キュ', romaji: 'kyu' },
      { hira: 'きょ', kata: 'キョ', romaji: 'kyo' },
      { hira: 'しゃ', kata: 'シャ', romaji: 'sha' },
      { hira: 'しゅ', kata: 'シュ', romaji: 'shu' },
      { hira: 'しょ', kata: 'ショ', romaji: 'sho' },
      { hira: 'ちゃ', kata: 'チャ', romaji: 'cha' },
      { hira: 'ちゅ', kata: 'チュ', romaji: 'chu' },
      { hira: 'ちょ', kata: 'チョ', romaji: 'cho' },
    ],
    [
      { hira: 'にゃ', kata: 'ニャ', romaji: 'nya' },
      { hira: 'にゅ', kata: 'ニュ', romaji: 'nyu' },
      { hira: 'にょ', kata: 'ニョ', romaji: 'nyo' },
      { hira: 'ひゃ', kata: 'ヒャ', romaji: 'hya' },
      { hira: 'ひゅ', kata: 'ヒュ', romaji: 'hyu' },
      { hira: 'ひょ', kata: 'ヒョ', romaji: 'hyo' },
      { hira: 'みゃ', kata: 'ミャ', romaji: 'mya' },
      { hira: 'みゅ', kata: 'ミュ', romaji: 'myu' },
      { hira: 'みょ', kata: 'ミョ', romaji: 'myo' },
    ],
    [
      { hira: 'りゃ', kata: 'リャ', romaji: 'rya' },
      { hira: 'りゅ', kata: 'リュ', romaji: 'ryu' },
      { hira: 'りょ', kata: 'リョ', romaji: 'ryo' },
      { hira: 'ぎゃ', kata: 'ギャ', romaji: 'gya' },
      { hira: 'ぎゅ', kata: 'ギュ', romaji: 'gyu' },
      { hira: 'ぎょ', kata: 'ギョ', romaji: 'gyo' },
      { hira: 'じゃ', kata: 'ジャ', romaji: 'ja' },
      { hira: 'じゅ', kata: 'ジュ', romaji: 'ju' },
      { hira: 'じょ', kata: 'ジョ', romaji: 'jo' },
    ],
    [
      { hira: 'びゃ', kata: 'ビャ', romaji: 'bya' },
      { hira: 'びゅ', kata: 'ビュ', romaji: 'byu' },
      { hira: 'びょ', kata: 'ビョ', romaji: 'byo' },
      { hira: 'ぴゃ', kata: 'ピャ', romaji: 'pya' },
      { hira: 'ぴゅ', kata: 'ピュ', romaji: 'pyu' },
      { hira: 'ぴょ', kata: 'ピョ', romaji: 'pyo' },
      null,
      null,
      null
    ]
  ];

  // All flat kana items for the quiz
  const allKanaList: KanaTileData[] = [
    ...seionRows.flat().filter((x): x is KanaTileData => x !== null),
    ...dakuonRows.flat().filter((x): x is KanaTileData => x !== null),
    ...yoonRows.flat().filter((x): x is KanaTileData => x !== null),
  ];

  // ============================================================
  // Audio Quiz Game State
  // ============================================================
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [selectedQuizMode, setSelectedQuizMode] = useState<'hiragana' | 'katakana' | 'both'>('hiragana');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [targetKana, setTargetKana] = useState<KanaTileData>(allKanaList[0]);
  const [quizOptions, setQuizOptions] = useState<KanaTileData[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<KanaTileData | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const generateQuestion = (idx: number, autoSpeak: boolean = false) => {
    const target = allKanaList[idx % allKanaList.length];
    setTargetKana(target);

    // Pick 3 random distractor items
    const distractors: KanaTileData[] = [];
    const pool = allKanaList.filter(item => item.romaji !== target.romaji);
    while (distractors.length < 3) {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      if (!distractors.some(d => d.romaji === rand.romaji)) {
        distractors.push(rand);
      }
    }

    const options = [target, ...distractors].sort(() => Math.random() - 0.5);
    setQuizOptions(options);
    setSelectedAnswer(null);
    setIsAnswered(false);

    // Only speak if explicitly requested (e.g. user clicked Start or Next question)
    if (autoSpeak) {
      const activeKanaType = selectedQuizMode === 'both' 
        ? (Math.random() > 0.5 ? 'hiragana' : 'katakana')
        : selectedQuizMode;
      const char = activeKanaType === 'hiragana' ? target.hira : target.kata;
      speakJapanese(char);
    }
  };

  const handleStartQuiz = () => {
    setIsQuizStarted(true);
    setCurrentQuestionIdx(0);
    setCorrectCount(0);
    setWrongCount(0);
    generateQuestion(0, true);
  };

  const handlePlayQuizAudio = () => {
    const activeKanaType = selectedQuizMode === 'both' ? activeTab : selectedQuizMode;
    const char = activeKanaType === 'hiragana' ? targetKana.hira : targetKana.kata;
    speakJapanese(char);
  };

  const handleAnswer = (option: KanaTileData) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
    setIsAnswered(true);

    if (option.romaji === targetKana.romaji) {
      setCorrectCount(c => c + 1);
    } else {
      setWrongCount(w => w + 1);
    }
  };

  const handleNextQuestion = () => {
    const nextIdx = currentQuestionIdx + 1;
    setCurrentQuestionIdx(nextIdx);
    generateQuestion(nextIdx, true);
  };

  // Keyboard shortcut support: 1-4 to answer, Enter for next question, R to replay sound
  useEffect(() => {
    if (!isQuizStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key, 10) - 1;
        if (quizOptions[idx] && !isAnswered) {
          handleAnswer(quizOptions[idx]);
        }
      } else if (e.key === 'Enter') {
        if (isAnswered) {
          handleNextQuestion();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handlePlayQuizAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuizStarted, isAnswered, quizOptions, targetKana, currentQuestionIdx]);

  const handleTileClick = (item: KanaTileData) => {
    setSelectedKana(item);
    const char = activeTab === 'hiragana' ? item.hira : item.kata;
    speakJapanese(char);
  };

  const renderTile = (item: KanaTileData | null, idx: number) => {
    if (!item) {
      return <div key={idx} className="aspect-square" />;
    }

    const char = activeTab === 'hiragana' ? item.hira : item.kata;
    const isSelected = selectedKana?.romaji === item.romaji;

    return (
      <div
        key={idx}
        onClick={() => handleTileClick(item)}
        className="cursor-pointer group"
      >
        <RoughCard
          fill={isSelected ? '#bae6fd' : '#ffffff'}
          stroke="#6b7280"
          strokeWidth={1.0}
          borderRadius={8}
          roughness={0.7}
          className="aspect-square flex flex-col items-center justify-center p-1 text-center transition-transform group-hover:scale-105"
        >
          <div className="text-xl md:text-2xl font-kanji font-bold text-[#292524] group-hover:text-[#0094ff] leading-none">
            {char}
          </div>
          <div className="text-[9px] md:text-[10px] font-bold text-[#0094ff] mt-1 leading-none">
            {item.romaji}
          </div>
        </RoughCard>
      </div>
    );
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch">
          Bảng chữ cái tiếng Nhật
        </h1>
      </div>

      {/* Top Toggle Buttons: [ あ Hiragana ] / [ ア Katakana ] */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-1 max-w-2xl mx-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('hiragana')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-xs md:text-sm rounded-lg transition-all ${
              activeTab === 'hiragana'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span className="font-kanji font-bold">あ</span>
            <span>Hiragana</span>
          </button>

          <button
            onClick={() => setActiveTab('katakana')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-xs md:text-sm rounded-lg transition-all ${
              activeTab === 'katakana'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span className="font-kanji font-bold">ア</span>
            <span>Katakana</span>
          </button>
        </div>
      </RoughCard>

      {/* ============================================================ */}
      {/* MAIN ALPHABET BOX (SEION + DAKUON + YOON) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={14} roughness={0.7} className="p-5 md:p-7 space-y-6">
        
        {/* Caption */}
        <p className="text-xs font-bold text-[#78716c] italic">
          Bấm để xem thứ tự nét viết và nghe âm đọc của mỗi chữ
        </p>

        {/* TOP ROW: ÂM TRONG (SEION) & ÂM ĐỤC - BÁN ĐỤC (DAKUON · HANDAKUON) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 items-start">
          
          {/* LEFT: ÂM TRONG (SEION) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
              ÂM TRONG (SEION)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {seionRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
            </div>
          </div>

          {/* RIGHT: ÂM ĐỤC · BÁN ĐỤC (DAKUON · HANDAKUON) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
              ÂM ĐỤC · BÁN ĐỤC (DAKUON · HANDAKUON)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {dakuonRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
            </div>
          </div>

        </div>

        {/* BOTTOM: ÂM GHÉP (YOON) */}
        <div className="space-y-2 pt-4 border-t border-[#78716c]/20">
          <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
            ÂM GHÉP (YOON)
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {yoonRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
          </div>
        </div>

      </RoughCard>

      {/* Action Pills below Alphabet Card */}
      <div className="flex items-center gap-2">
        <RoughButton
          onClick={() => {}}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Flashcard</span>
          </div>
        </RoughButton>

        <RoughButton
          onClick={() => {}}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Luyện viết</span>
          </div>
        </RoughButton>

        <RoughButton
          onClick={() => alert('Đang tải file PDF luyện viết bảng chữ cái')}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Tải file luyện viết</span>
          </div>
        </RoughButton>
      </div>

      {/* ============================================================ */}
      {/* BOTTOM SECTION: BÀI TẬP NGHE CHỌN CHỮ (Audio Quiz Game) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4">
        
        {!isQuizStarted ? (
          /* Initial State matching media_1788112666497.png */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#292524] font-sketch">
              <Headphones className="w-4 h-4 text-[#0094ff]" />
              <span>BÀI TẬP NGHE CHỌN CHỮ</span>
            </div>

            <p className="text-xs text-[#57534e] leading-relaxed">
              Mỗi vòng đi hết 104 âm (xáo thứ tự): nghe âm đọc rồi chọn chữ cái đúng. Bấm đáp án là chấm ngay, tiến độ tự lưu — thoát ra vào lại làm tiếp. Mỗi câu chỉ hỏi trong 1 bảng chữ (không trộn Hiragana với Katakana vì hai bảng cùng âm đọc).
            </p>

            <div className="space-y-2">
              <div className="text-xs font-black text-[#292524]">Bảng chữ</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedQuizMode('hiragana')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'hiragana'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Hiragana
                </button>

                <button
                  onClick={() => setSelectedQuizMode('katakana')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'katakana'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Katakana
                </button>

                <button
                  onClick={() => setSelectedQuizMode('both')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'both'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Cả hai
                </button>
              </div>
            </div>

            <div className="pt-1">
              <RoughButton
                onClick={handleStartQuiz}
                fill="#0094ff"
                stroke="#0369a1"
                borderRadius={8}
                roughness={0.7}
                className="text-white px-5 py-2 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Bắt đầu</span>
                </div>
              </RoughButton>
            </div>
          </div>
        ) : (
          /* Active Quiz Game */
          <>
            {/* Quiz Header */}
            <div className="space-y-2.5 border-b border-[#78716c]/20 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-[#292524] font-sketch">
                  <Headphones className="w-4 h-4 text-[#0094ff]" />
                  <span>BÀI TẬP NGHE CHỌN CHỮ</span>
                </div>
                <div className="text-xs font-bold text-[#78716c]">
                  Câu {currentQuestionIdx + 1}/104
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#57534e]">
                  <span>Bảng: {selectedQuizMode === 'hiragana' ? 'Hiragana' : selectedQuizMode === 'katakana' ? 'Katakana' : 'Cả hai'}</span>
                  <button
                    onClick={() => setIsQuizStarted(false)}
                    className="text-[#0094ff] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Đổi bảng
                  </button>
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full bg-[#eae3d5] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#0094ff] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(3, ((currentQuestionIdx + 1) / 104) * 100))}%` }}
                />
              </div>
            </div>

            {/* Quiz Main 2-Column Split */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-4 items-start pt-1">
              
              {/* Left Box: Big Blue Audio Player Card */}
              <RoughCard
                fill="#0094ff"
                stroke="#0369a1"
                borderRadius={12}
                roughness={0.7}
                className="p-5 text-white flex flex-col items-center justify-center text-center space-y-3 shadow-md h-full min-h-[220px]"
              >
                <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                  NGHE CHỌN CHỮ
                </span>

                <Headphones className="w-10 h-10 stroke-[2.2]" />

                <p className="text-xs leading-relaxed font-medium">
                  Nghe rồi chọn chữ cái đúng ({selectedQuizMode === 'hiragana' ? 'Hiragana' : selectedQuizMode === 'katakana' ? 'Katakana' : 'Hiragana/Katakana'}). Bấm loa để nghe lại.
                </p>

                <button
                  onClick={handlePlayQuizAudio}
                  className="p-3 bg-white text-[#0094ff] rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  title="Bấm để nghe lại (R)"
                >
                  <Volume2 className="w-5 h-5 fill-[#0094ff]" />
                </button>
              </RoughCard>

              {/* Right Box: 4 Multiple Choice Options */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-[#292524] uppercase tracking-wider">
                    CHỌN CHỮ CÁI VỪA NGHE
                  </h4>
                  <p className="text-[10px] text-[#78716c]">
                    Phím tắt: 1-4 trả lời · Enter sang câu · R nghe lại
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {quizOptions.map((opt, idx) => {
                    const activeType = selectedQuizMode === 'both' ? activeTab : selectedQuizMode;
                    const char = activeType === 'hiragana' ? opt.hira : opt.kata;
                    const isSelected = selectedAnswer?.romaji === opt.romaji;
                    const isCorrect = opt.romaji === targetKana.romaji;

                    let cardFill = '#ffffff';
                    let strokeColor = '#78716c';

                    if (isAnswered) {
                      if (isCorrect) {
                        cardFill = '#f0fdf4';
                        strokeColor = '#16a34a';
                      } else if (isSelected) {
                        cardFill = '#ffffff';
                        strokeColor = '#78716c';
                      }
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => handleAnswer(opt)}
                        className={`cursor-pointer ${isAnswered ? 'cursor-default' : ''}`}
                      >
                        <RoughCard
                          fill={cardFill}
                          stroke={strokeColor}
                          borderRadius={10}
                          roughness={0.7}
                          className="p-3.5 flex items-center gap-3 transition-all min-h-[56px]"
                        >
                          {/* Badge indicator */}
                          {isAnswered && isCorrect ? (
                            <span className="text-emerald-600 font-black text-lg leading-none w-5 text-center">
                              ✓
                            </span>
                          ) : isAnswered && isSelected && !isCorrect ? (
                            <span className="text-rose-600 font-black text-lg leading-none w-5 text-center">
                              ✕
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded border border-[#78716c]/60 bg-[#fdfbf7] text-[11px] font-bold text-[#78716c] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                          )}

                          <span className={`text-2xl font-kanji font-bold ${
                            isAnswered && isCorrect 
                              ? 'text-emerald-700' 
                              : isAnswered && isSelected && !isCorrect 
                              ? 'text-[#292524]' 
                              : 'text-[#292524]'
                          }`}>
                            {char}
                          </span>
                        </RoughCard>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Row when Answered: Answer feedback + Cau tiep button */}
                {isAnswered && (
                  <div className="flex items-center justify-between pt-1 animate-in fade-in duration-150">
                    <div className="flex items-baseline gap-2 font-sketch">
                      <span className="text-xs font-bold text-[#57534e]">Đáp án:</span>
                      <span className="text-2xl font-kanji font-black text-[#292524]">
                        {selectedQuizMode === 'katakana' ? targetKana.kata : targetKana.hira}
                      </span>
                      <span className="text-xs font-bold text-[#78716c]">({targetKana.romaji})</span>
                    </div>

                    <RoughButton
                      onClick={handleNextQuestion}
                      fill="#0094ff"
                      stroke="#0369a1"
                      borderRadius={8}
                      roughness={0.7}
                      className="text-white px-5 py-2 text-xs font-bold shadow-md cursor-pointer"
                    >
                      <span>Câu tiếp</span>
                    </RoughButton>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Score Footer */}
            <div className="flex items-center gap-4 text-xs font-bold pt-3 border-t border-[#78716c]/20">
              <span className="text-emerald-600 font-black">Đúng {correctCount}</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600 font-black">Sai {wrongCount}</span>
              <span className="text-slate-300">|</span>
              <span className="text-[#78716c]">Đã làm {correctCount + wrongCount}/104</span>
            </div>
          </>
        )}

      </RoughCard>

    </div>
  );
};
