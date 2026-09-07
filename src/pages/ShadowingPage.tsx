import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Keyboard, 
  Eye, 
  EyeOff, 
  Bookmark, 
  Sparkles, 
  Crown, 
  Plus, 
  Maximize2, 
  Volume2, 
  X, 
  AlertTriangle, 
  Puzzle, 
  Type, 
  ChevronLeft,
  ChevronRight,
  XCircle,
  Layers,
  Zap
} from 'lucide-react';
import { RoughCard } from '../components/RoughCard';

// ---------------------------------------------------------------------------
// DATA INTERFACES
// ---------------------------------------------------------------------------
export interface ShadowingToken {
  text: string;
  reading?: string; // furigana reading
  romaji?: string;
  isMain?: boolean;
}

export interface ShadowingSentence {
  id: number;
  timeStart: string;
  timeEnd: string;
  tokens: ShadowingToken[];
  line1Tokens: string[];
  line2Tokens?: string[];
  fullJapanese: string;
  furiganaHtml: string;
  translationVi: string;
  puzzleTokens: string[]; // correct sequence of puzzle pieces
  initialScrambledTokens: string[]; // scrambled for puzzle
}

export interface ShadowingVideo {
  id: string;
  title: string;
  channel: string;
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  duration: string;
  sentenceCount: number;
  thumbnailUrl: string;
  youtubeId?: string;
  description: string;
  sentences: ShadowingSentence[];
}

// ---------------------------------------------------------------------------
// SAMPLE DATABASE (Authentic Japanese Fairy Tale matching screenshots)
// ---------------------------------------------------------------------------
export const SAMPLE_VIDEOS: ShadowingVideo[] = [
  {
    id: 'vid-34-1',
    title: '#34-1 びんぼう神と福の神 【むかしばなしのおへや〜伝えたい日本昔話〜】',
    channel: 'BS-TBS公式チャンネル',
    level: 'N5',
    duration: '6:06',
    sentenceCount: 8,
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    description: 'Truyện cổ tích Nhật Bản: Thần Nghèo và Thần Tài. Ngôn từ đơn giản, phát âm chuẩn mực, cực kỳ phù hợp luyện Shadowing N5.',
    sentences: [
      {
        id: 1,
        timeStart: '0:00',
        timeEnd: '0:05',
        tokens: [
          { text: '貧乏神と', reading: 'びんぼうがみと' },
          { text: '福の神', reading: 'ふくのかみ' }
        ],
        line1Tokens: ['貧乏神と', '福の神'],
        fullJapanese: '貧乏神と福の神',
        furiganaHtml: '<ruby>貧乏神<rt>びんぼうがみ</rt></ruby>と <ruby>福<rt>ふく</rt></ruby>の<ruby>神<rt>かみ</rt></ruby>',
        translationVi: 'Thần Nghèo Khổ và Thần Tài',
        puzzleTokens: ['貧乏神と', '福の神'],
        initialScrambledTokens: ['福の神', '貧乏神と']
      },
      {
        id: 2,
        timeStart: '0:05',
        timeEnd: '0:14',
        tokens: [
          { text: '昔々、', reading: 'むかしむかし' },
          { text: 'ある村に', reading: 'あるむら' },
          { text: '貧しい若者が', reading: 'まずしいわかもの' },
          { text: '一人で', reading: 'ひとり' },
          { text: '暮らしていました。', reading: 'く' }
        ],
        line1Tokens: ['昔々、', 'ある村に', '貧しい若者が', '一人で'],
        line2Tokens: ['暮らしていました。'],
        fullJapanese: '昔々、ある村に貧しい若者が一人で暮らしていました。',
        furiganaHtml: '<ruby>昔々<rt>むかしむかし</rt></ruby>、ある<ruby>村<rt>むら</rt></ruby>に<ruby>貧<rt>まず</rt></ruby>しい<ruby>若者<rt>わかもの</rt></ruby>が<ruby>一人<rt>ひとり</rt></ruby>で<ruby>暮<rt>く</rt></ruby>らしていました。',
        translationVi: 'Ngày xửa ngày xưa, ở một ngôi làng nọ có một chàng trai nghèo sống một mình.',
        puzzleTokens: ['昔々、', 'ある村に', '貧しい若者が', '一人で', '暮らしていました。'],
        initialScrambledTokens: ['一人で', 'ある村に', '暮らしていました。', '昔々、', '貧しい若者が']
      },
      {
        id: 3,
        timeStart: '0:14',
        timeEnd: '0:24',
        tokens: [
          { text: 'そこに、', reading: 'そこに' },
          { text: 'かわいいお嫁さんが', reading: 'およめ' },
          { text: '来て、', reading: 'き' },
          { text: '村の', reading: 'むら' },
          { text: '人たちも', reading: 'ひと' },
          { text: 'みんな', reading: 'みんな' },
          { text: '喜びましたが、', reading: 'よろこ' }
        ],
        line1Tokens: ['そこに、', 'かわいいお嫁さんが', '来て、', '村の'],
        line2Tokens: ['人たちも', 'みんな', '喜びましたが、'],
        fullJapanese: 'そこに、かわいいお嫁さんが来て、村の人たちもみんな喜びましたが、',
        furiganaHtml: 'そこに、かわいいお<ruby>嫁<rt>よめ</rt></ruby>さんが<ruby>来<rt>き</rt></ruby>て、<ruby>村<rt>むら</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>たちもみんな<ruby>喜<rt>よろこ</rt></ruby>びましたが、',
        translationVi: 'Rồi một cô vợ dễ thương về nhà anh, ai trong làng cũng mừng cho anh, nhưng',
        puzzleTokens: ['そこに、', 'かわいいお嫁さんが', '来て、', '村の人たちも', 'みんな', '喜びましたが、'],
        initialScrambledTokens: ['村の人たちも', '来て、', 'そこに、', '喜びましたが、', 'かわいいお嫁さんが', 'みんな']
      },
      {
        id: 4,
        timeStart: '0:24',
        timeEnd: '0:32',
        tokens: [
          { text: 'この家には', reading: 'いえ' },
          { text: '貧乏神が', reading: 'びんぼうがみ' },
          { text: 'いました。', reading: 'いました' }
        ],
        line1Tokens: ['この家には', '貧乏神が', 'いました。'],
        fullJapanese: 'この家には貧乏神がいました。',
        furiganaHtml: 'この<ruby>家<rt>いえ</rt></ruby>には<ruby>貧乏神<rt>びんぼうがみ</rt></ruby>がいました。',
        translationVi: 'nhà này lại có Thần Nghèo ở đó.',
        puzzleTokens: ['この家には', '貧乏神が', 'いました。'],
        initialScrambledTokens: ['いました。', 'この家には', '貧乏神が']
      },
      {
        id: 5,
        timeStart: '0:32',
        timeEnd: '0:45',
        tokens: [
          { text: 'そんなこととは', reading: 'そんなこととは' },
          { text: '知らない若夫婦は、', reading: 'し/わかふうふ' },
          { text: '仲良く', reading: 'なかよ' },
          { text: '一生懸命', reading: 'いっしょうけんめい' },
          { text: '働きました。', reading: 'はたら' }
        ],
        line1Tokens: ['そんなこととは', '知らない若夫婦は、'],
        line2Tokens: ['仲良く', '一生懸命', '働きました。'],
        fullJapanese: 'そんなこととは知らない若夫婦は、仲良く一生懸命働きました。',
        furiganaHtml: 'そんなこととは<ruby>知<rt>し</rt></ruby>らない<ruby>若夫婦<rt>わかふうふ</rt></ruby>は、<ruby>仲良<rt>なかよ</rt></ruby>く<ruby>一生懸命<rt>いっしょうけんめい</rt><ruby>働<rt>はたら</rt></ruby>きました。',
        translationVi: 'Chẳng hề biết chuyện đó, đôi vợ chồng trẻ sống thuận hòa và chăm chỉ làm việc.',
        puzzleTokens: ['そんなこととは', '知らない若夫婦は、', '仲良く', '一生懸命', '働きました。'],
        initialScrambledTokens: ['一生懸命', '知らない若夫婦は、', '働きました。', 'そんなこととは', '仲良く']
      },
      {
        id: 6,
        timeStart: '1:00',
        timeEnd: '1:12',
        tokens: [
          { text: 'お嫁さんは', reading: 'およめさんは' },
          { text: 'それを', reading: 'それを' },
          { text: '必ず', reading: 'かならず' },
          { text: '神棚に', reading: 'かみだなに' },
          { text: '備えます。', reading: 'そなえます' }
        ],
        line1Tokens: ['お嫁さんは', 'それを', '必ず', '神棚に', '備えます。'],
        fullJapanese: 'お嫁さんはそれを必ず神棚に備えます。',
        furiganaHtml: 'お<ruby>嫁<rt>よめ</rt></ruby>さんは それを <ruby>必<rt>かなら</rt></ruby>ず <ruby>神棚<rt>かみだな</rt></ruby>に <ruby>備<rt>そな</rt></ruby>えます。',
        translationVi: 'Người vợ nhất định đem dâng lễ vật đó lên bàn thờ thần.',
        puzzleTokens: ['お嫁さんは', 'それを', '必ず', '神棚に', '備えます。'],
        initialScrambledTokens: ['お嫁さんは', '神棚に', '必ず', '備えます。', 'それを']
      },
      {
        id: 7,
        timeStart: '1:12',
        timeEnd: '1:22',
        tokens: [
          { text: 'すると', reading: 'すると' },
          { text: '天井の隅から', reading: 'てんじょう/すみ' },
          { text: '泣き声が', reading: 'なきごえ' },
          { text: '聞こえてきました。', reading: 'きこえてきました' }
        ],
        line1Tokens: ['すると', '天井の隅から', '泣き声が', '聞こえてきました。'],
        fullJapanese: 'すると天井の隅から泣き声が聞こえてきました。',
        furiganaHtml: 'すると <ruby>天井<rt>てんじょう</rt></ruby>の<ruby>隅<rt>すみ</rt></ruby>から <ruby>泣<rt>な</rt></ruby>き<ruby>声<rt>ごえ</rt></ruby>が <ruby>聞<rt>き</rt></ruby>こえてきました。',
        translationVi: 'Thế rồi từ góc trần nhà bỗng vang lên tiếng khóc thút thít.',
        puzzleTokens: ['すると', '天井の隅から', '泣き声が', '聞こえてきました。'],
        initialScrambledTokens: ['泣き声が', 'すると', '聞こえてきました。', '天井の隅から']
      },
      {
        id: 8,
        timeStart: '1:22',
        timeEnd: '1:35',
        tokens: [
          { text: '「福の神が', reading: 'ふくのかみ' },
          { text: 'やって来たら、', reading: 'き' },
          { text: 'わしは', reading: 'わしは' },
          { text: '出て行かねばならん」', reading: 'で/い' }
        ],
        line1Tokens: ['「福の神が', 'やって来たら、', 'わしは', '出て行かねばならん」'],
        fullJapanese: '「福の神がやって来たら、わしは出て行かねばならん」',
        furiganaHtml: '「<ruby>福<rt>ふく</rt></ruby>の<ruby>神<rt>かみ</rt></ruby>が やって<ruby>来<rt>き</rt></ruby>たら、 わしは <ruby>出<rt>で</rt></ruby>て<ruby>行<rt>い</rt></ruby>かねばならん」',
        translationVi: '「Khi Thần Tài đến, ta sẽ phải rời khỏi nơi này」',
        puzzleTokens: ['「福の神が', 'やって来たら、', 'わしは', '出て行かねばならん」'],
        initialScrambledTokens: ['わしは', '「福の神が', '出て行かねばならん」', 'やって来たら、']
      }
    ]
  },
  {
    id: 'vid-momotaro',
    title: '桃太郎 (Momotaro) - Cậu bé quả đào dũng cảm diệt quỷ',
    channel: 'Nihon Mukashibanashi',
    level: 'N5',
    duration: '4:15',
    sentenceCount: 16,
    thumbnailUrl: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=800&auto=format&fit=crop&q=80',
    description: 'Truyện dân gian kinh điển của Nhật Bản, câu từ dễ hiểu với các mẫu ngữ pháp sơ cấp N5.',
    sentences: []
  },
  {
    id: 'vid-totoro',
    title: 'となりのトトロ - Trích đoạn đối thoại thường ngày gia đình Kusakabe',
    channel: 'Studio Ghibli Japan',
    level: 'N4',
    duration: '5:20',
    sentenceCount: 22,
    thumbnailUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    description: 'Giao tiếp sinh hoạt hàng ngày, giọng nói tự nhiên, rèn luyện phản xạ ngữ điệu tự nhiên.',
    sentences: []
  },
  {
    id: 'vid-nhk-tea',
    title: 'Tin tức NHK Easy News: Nét đẹp văn hóa Trà đạo Nhật Bản',
    channel: 'NHK World Japan',
    level: 'N3',
    duration: '6:45',
    sentenceCount: 25,
    thumbnailUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80',
    description: 'Bản tin tiếng Nhật giản lược với vốn từ vựng phong phú về đời sống truyền thống.',
    sentences: []
  },
  {
    id: 'vid-street-interview',
    title: 'Phỏng vấn Tokyo: Người Nhật nghĩ gì về áp lực công việc và Ikigai?',
    channel: 'Tokyo Streets Life',
    level: 'N2',
    duration: '8:10',
    sentenceCount: 30,
    thumbnailUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    description: 'Tốc độ nói thực tế 100% của người bản xứ với kính ngữ và quán ngữ trung cấp N2.',
    sentences: []
  },
  {
    id: 'vid-tedx',
    title: 'TEDxTokyo: Trí tuệ nhân tạo và tương lai xã hội siêu thông minh',
    channel: 'TEDx Talks Japan',
    level: 'N1',
    duration: '12:30',
    sentenceCount: 42,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    description: 'Thuyết trình học thuật chuyên sâu, vốn từ trừu tượng và ngữ pháp nâng cao JLPT N1.',
    sentences: []
  }
];

// ---------------------------------------------------------------------------
// MAIN SHADOWING COMPONENT
// ---------------------------------------------------------------------------
export const ShadowingPage: React.FC = () => {
  // Navigation: null => Video selection library; otherwise active video
  const [activeVideo, setActiveVideo] = useState<ShadowingVideo | null>(SAMPLE_VIDEOS[0]);
  
  // Custom YouTube URL Input
  const [youtubeInput, setYoutubeInput] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'>('ALL');

  // Modes: 'shadowing' (Bắt chước phát âm) vs 'dictation' (Nghe - Viết chính tả)
  const [mainMode, setMainMode] = useState<'shadowing' | 'dictation'>('shadowing');
  
  // Dictation sub-mode: 'puzzle' (Ghép câu) vs 'typing' (Gõ chính tả)
  const [dictationSubMode, setDictationSubMode] = useState<'puzzle' | 'typing'>('puzzle');

  // Video settings & controls
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(1); // Index 1 is sentence #2 in screenshot
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoPause, setAutoPause] = useState<boolean>(true);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [showFurigana, setShowFurigana] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isVideoHidden, setIsVideoHidden] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [bookmarkedSentenceIds, setBookmarkedSentenceIds] = useState<number[]>([2]);

  // Statistics
  const [errorCount, setErrorCount] = useState<number>(0);
  const [replayCount, setReplayCount] = useState<number>(0);

  // Dictation: Puzzle mode state
  const currentSentence = activeVideo ? activeVideo.sentences[currentSentenceIndex] || activeVideo.sentences[0] : null;
  const [puzzleSelectedTokens, setPuzzleSelectedTokens] = useState<string[]>([]);
  const [puzzlePoolTokens, setPuzzlePoolTokens] = useState<string[]>([]);
  const [puzzleChecked, setPuzzleChecked] = useState<boolean>(false);

  // Dictation: Typing mode state
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [typingChecked, setTypingChecked] = useState<boolean>(false);

  // Initialize/reset sentence interaction state
  useEffect(() => {
    if (!currentSentence) return;
    
    // For puzzle mode: initialize available tokens pool
    if (currentSentence.initialScrambledTokens) {
      setPuzzlePoolTokens([...currentSentence.initialScrambledTokens]);
    } else {
      setPuzzlePoolTokens([...currentSentence.tokens.map(t => t.text)].sort(() => Math.random() - 0.5));
    }
    setPuzzleSelectedTokens([]);
    setPuzzleChecked(false);

    // For typing mode: reset
    setTypedAnswer('');
    setRevealedHints({});
    setTypingChecked(false);
  }, [currentSentenceIndex, activeVideo]);

  // Speech synthesis for authentic audio
  const speakCurrentSentence = () => {
    if (!currentSentence) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentSentence.fullJapanese);
      utterance.lang = 'ja-JP';
      utterance.rate = playbackSpeed;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 2500);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      speakCurrentSentence();
    }
  };

  const handleReplay = () => {
    setReplayCount(prev => prev + 1);
    speakCurrentSentence();
  };

  const handlePrevSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(prev => prev - 1);
    }
  };

  const handleNextSentence = () => {
    if (activeVideo && currentSentenceIndex < activeVideo.sentences.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1);
    }
  };

  const toggleBookmark = (id: number) => {
    setBookmarkedSentenceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when typing in textarea or input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSentence();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextSentence();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReplay();
      } else if (e.key === '?' || e.key === '/') {
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentSentenceIndex]);

  // Puzzle handlers
  const handleSelectPoolToken = (token: string, index: number) => {
    if (puzzleChecked) return;
    // Move token from pool to selected
    const nextPool = [...puzzlePoolTokens];
    nextPool.splice(index, 1);
    setPuzzlePoolTokens(nextPool);
    setPuzzleSelectedTokens(prev => [...prev, token]);
  };

  const handleReturnSelectedToken = (token: string, index: number) => {
    if (puzzleChecked) return;
    // Move token from selected back to pool
    const nextSelected = [...puzzleSelectedTokens];
    nextSelected.splice(index, 1);
    setPuzzleSelectedTokens(nextSelected);
    setPuzzlePoolTokens(prev => [...prev, token]);
  };

  const handleCheckPuzzle = () => {
    if (!currentSentence) return;
    setPuzzleChecked(true);
    // Calculate errors
    let errors = 0;
    currentSentence.puzzleTokens.forEach((expected, idx) => {
      if (puzzleSelectedTokens[idx] !== expected) {
        errors++;
      }
    });
    setErrorCount(errors);
  };

  // Typing handlers
  const handleToggleHint = (tokenIndex: number) => {
    setRevealedHints(prev => ({
      ...prev,
      [tokenIndex]: !prev[tokenIndex]
    }));
  };

  const handleCheckTyping = () => {
    if (!currentSentence) return;
    setTypingChecked(true);
    const cleanTyped = typedAnswer.replace(/[\s\u3000、。]/g, '');
    const cleanCorrect = currentSentence.fullJapanese.replace(/[\s\u3000、。]/g, '');
    
    if (cleanTyped === cleanCorrect) {
      setErrorCount(0);
    } else {
      // Count mismatched characters
      let diffCount = Math.abs(cleanTyped.length - cleanCorrect.length);
      const minLen = Math.min(cleanTyped.length, cleanCorrect.length);
      for (let i = 0; i < minLen; i++) {
        if (cleanTyped[i] !== cleanCorrect[i]) diffCount++;
      }
      setErrorCount(Math.max(1, diffCount));
    }
  };

  // Handle adding custom YouTube video
  const handleAddCustomVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeInput.trim()) return;
    
    const newVideo: ShadowingVideo = {
      id: `custom-${Date.now()}`,
      title: 'Video YouTube tự nhập — Phân tích bởi AI',
      channel: 'Kênh YouTube của bạn',
      level: 'N5',
      duration: '3:45',
      sentenceCount: 5,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      description: 'AI đã tự động trích xuất âm thanh, bóc tách phụ đề và tạo câu hỏi shadowing.',
      sentences: SAMPLE_VIDEOS[0].sentences
    };

    setActiveVideo(newVideo);
    setCurrentSentenceIndex(0);
  };

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 - VIDEO SELECTION & IMPORT (matches media_1788799072147.png)
  // ---------------------------------------------------------------------------
  if (!activeVideo) {
    const filteredVideos = levelFilter === 'ALL' 
      ? SAMPLE_VIDEOS 
      : SAMPLE_VIDEOS.filter(v => v.level === levelFilter);

    return (
      <div className="min-h-full p-4 md:p-8 bg-sketch-paper text-[#292524] space-y-6 max-w-7xl mx-auto">
        {/* Header (matches media_1788799072147.png) */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#292524] bg-white flex items-center justify-center shadow-sketch shrink-0">
            <span className="text-xl font-black text-sky-600">P))</span>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#292524]">
              Shadowing & Chép chính tả
            </h1>
            <p className="text-sm md:text-base text-[#57534e] font-medium mt-0.5">
              Chọn video để luyện nghe, bắt chước phát âm hoặc viết chính tả theo cấp độ JLPT.
            </p>
          </div>
        </div>

        {/* Section: Video của tôi + YouTube Link Input Bar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base md:text-lg font-black text-[#292524]">
              Video của tôi
            </span>
            <span className="border-sketch-subtle px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-700 bg-amber-50 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              AI tự tạo phụ đề + dịch
            </span>
            <span className="border-sketch-subtle px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-700 bg-amber-50 flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-600" />
              Gói Trọn đời
            </span>
          </div>

          <p className="text-xs md:text-sm text-[#78716c]">
            Dán link YouTube tiếng Nhật bất kỳ (dưới 30 phút) — AI tự nghe, tách câu và dịch sang tiếng Việt để bạn luyện shadowing.
          </p>

          {/* YouTube Input Box (matches media_1788799072147.png) */}
          <form onSubmit={handleAddCustomVideo} className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-red-600">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <input
                type="text"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-500 text-white font-bold text-sm border-2 border-[#292524] shadow-sketch flex items-center gap-1.5 active:translate-y-0.5 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Thêm video
            </button>
          </form>
        </div>

        {/* Level Filters */}
        <div className="pt-4 flex items-center justify-between border-b border-[#292524]/20 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {(['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  levelFilter === lvl
                    ? 'border-2 border-[#292524] bg-[#292524] text-white shadow-xs'
                    : 'border-sketch-subtle bg-white text-[#57534e] hover:bg-[#f6f2e9]'
                }`}
              >
                {lvl === 'ALL' ? 'Tất cả cấp độ' : lvl}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-[#78716c] shrink-0">
            {filteredVideos.length} video có sẵn
          </span>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => {
                setActiveVideo(video);
                setCurrentSentenceIndex(1); // Default to sentence #2 as in screenshot
              }}
              className="cursor-pointer group"
            >
              <RoughCard
                fill="#ffffff"
                stroke="#292524"
                borderRadius={12}
                className="overflow-hidden hover:scale-[1.01] transition-transform p-3 flex flex-col h-full shadow-sketch"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video rounded-lg overflow-hidden border border-[#292524]/30 bg-[#292524]">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[10px] tracking-wide border border-white/40">
                    {video.level}
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white font-mono text-[10px]">
                    {video.duration}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#292524] line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-[11px] text-[#78716c] font-medium mt-1">
                      {video.channel}
                    </p>
                    <p className="text-xs text-[#57534e] mt-1.5 line-clamp-2">
                      {video.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#e7e5e4] flex items-center justify-between text-xs font-bold text-[#78716c]">
                    <span className="flex items-center gap-1 text-blue-700">
                      <Layers className="w-3.5 h-3.5" />
                      {video.sentenceCount} câu luyện tập
                    </span>
                    <span className="text-sky-600 group-hover:underline flex items-center gap-0.5">
                      Vào luyện ngay →
                    </span>
                  </div>
                </div>
              </RoughCard>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 - WORKSPACE (matches media_1788799324192.png, 558769, etc.)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-full p-3 md:p-6 bg-sketch-paper text-[#292524] space-y-4 max-w-7xl mx-auto flex flex-col">
      
      {/* 1. TOP HEADER & MODE CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[#292524]/20">
        
        {/* Left: Mode Toggle Group (matches screenshot pill switch) */}
        <div className="inline-flex rounded-xl p-1 border-2 border-[#292524] bg-white shadow-sketch">
          <button
            onClick={() => setMainMode('shadowing')}
            className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
              mainMode === 'shadowing'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            Bắt chước phát âm
          </button>
          <button
            onClick={() => setMainMode('dictation')}
            className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-black transition-all ${
              mainMode === 'dictation'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            Nghe - Viết chính tả
          </button>
        </div>

        {/* Right: Auxiliary Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="border-sketch-subtle px-3 py-1.5 rounded-xl bg-white text-xs font-bold text-[#57534e] hover:bg-[#f6f2e9] shadow-sketch flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#292524]" />
            Phím tắt
          </button>

          <button
            onClick={() => setIsVideoHidden(prev => !prev)}
            className="border-sketch-subtle px-3 py-1.5 rounded-xl bg-white text-xs font-bold text-[#57534e] hover:bg-[#f6f2e9] shadow-sketch flex items-center gap-1.5 transition-transform active:scale-95"
          >
            {isVideoHidden ? (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                Hiện video
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-blue-600" />
                Ẩn video
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. BREADCRUMB & TITLE HEADER */}
      <div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveVideo(null)}
            className="text-xs font-bold text-[#78716c] hover:text-[#292524] flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Quay lại
          </button>
          <span className="border-sketch-pill px-2 py-0.2 text-[11px] font-black text-blue-700 bg-blue-50">
            {activeVideo.level}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <h2 className="text-base md:text-lg font-black text-[#292524] tracking-tight">
            {activeVideo.title}
          </h2>
          <span className="text-xs text-[#78716c] font-medium">
            · {activeVideo.channel}
          </span>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE GRID: Left (Player & Subtitle) + Right (Transcript or Dictation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ================================================================= */}
        {/* LEFT COLUMN: Video Player + Playback Controls + Active Subtitle */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Video / Canvas Scene (matches media_1788799324192.png) */}
          {!isVideoHidden ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-[#292524] bg-[#292524] shadow-sketch">
              {/* Hand-drawn style anime scene simulation */}
              <div 
                className="w-full h-full bg-cover bg-center relative flex items-center justify-center"
                style={{
                  backgroundImage: `url('${activeVideo.thumbnailUrl}')`
                }}
              >
                {/* Visual Japanese overlay tags matching screenshot */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/20">
                  むかしばなしのおへや<br />
                  <span className="text-[9px] text-amber-300">毎月第4日曜午前11:00〜放送中！</span>
                </div>

                {/* Big Center Play / Pause Overlay Button */}
                <button
                  onClick={handlePlayPause}
                  className="w-16 h-16 rounded-full bg-[#2563eb] hover:bg-blue-700 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 border-2 border-white/60 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 ml-1 fill-current" />
                  )}
                </button>

                {/* Bottom Timeline Bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <button onClick={handlePlayPause} className="hover:text-blue-400">
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{currentSentence?.timeStart || '1:03'} / {activeVideo.duration}</span>
                  </div>

                  {/* Progress track */}
                  <div className="flex-1 mx-3 h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${((currentSentenceIndex + 1) / activeVideo.sentences.length) * 100}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">{playbackSpeed}x</span>
                    <Maximize2 className="w-3.5 h-3.5 hover:text-blue-400 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Hidden Video Audio Mode Banner */
            <div className="p-8 rounded-xl border-2 border-[#292524] bg-white text-center shadow-sketch flex flex-col items-center justify-center gap-2">
              <Volume2 className="w-10 h-10 text-blue-600 animate-pulse" />
              <p className="font-bold text-sm text-[#292524]">
                Đang ẩn video để bạn tập trung cao độ vào luyện nghe & bắt chước phát âm
              </p>
              <button
                onClick={() => setIsVideoHidden(false)}
                className="text-xs font-bold text-blue-600 hover:underline mt-1"
              >
                Nhấp để hiện lại video
              </button>
            </div>
          )}

          {/* Player Sub-controls Bar (matches screenshot underneath video) */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-1">
            
            {/* Left sentence controls */}
            <div className="flex items-center gap-1.5">
              {/* Jump Previous Sentence */}
              <button
                onClick={handlePrevSentence}
                disabled={currentSentenceIndex === 0}
                className="w-8 h-8 rounded-full border border-[#292524] bg-white hover:bg-[#f6f2e9] disabled:opacity-40 text-[#292524] flex items-center justify-center shadow-xs"
                title="Câu trước"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Replay Current Sentence */}
              <button
                onClick={handleReplay}
                className="w-8 h-8 rounded-full border border-[#292524] bg-white hover:bg-[#f6f2e9] text-[#292524] flex items-center justify-center shadow-xs"
                title="Phát lại câu hiện tại"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Play / Pause in Blue Circle */}
              <button
                onClick={handlePlayPause}
                className="w-9 h-9 rounded-full bg-[#2563eb] hover:bg-blue-700 text-white flex items-center justify-center shadow-sketch transition-transform active:scale-95"
                title="Phát / Dừng"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
              </button>

              {/* Jump Next Sentence */}
              <button
                onClick={handleNextSentence}
                disabled={currentSentenceIndex === activeVideo.sentences.length - 1}
                className="w-8 h-8 rounded-full border border-[#292524] bg-white hover:bg-[#f6f2e9] disabled:opacity-40 text-[#292524] flex items-center justify-center shadow-xs"
                title="Câu kế tiếp"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Right option toggles */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              
              {/* Tự ngắt câu toggle */}
              <button
                onClick={() => setAutoPause(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg border border-[#292524] transition-colors ${
                  autoPause ? 'bg-[#292524] text-white' : 'bg-white text-[#57534e]'
                }`}
              >
                Tự ngắt câu
              </button>

              {/* Bản dịch toggle */}
              <button
                onClick={() => setShowTranslation(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg border border-[#292524] transition-colors ${
                  showTranslation ? 'bg-blue-50 text-blue-700 border-blue-600' : 'bg-white text-[#57534e]'
                }`}
              >
                文A Bản dịch
              </button>

              {/* Furigana toggle */}
              <button
                onClick={() => setShowFurigana(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg border border-[#292524] transition-colors ${
                  showFurigana ? 'bg-blue-50 text-blue-700 border-blue-600' : 'bg-white text-[#57534e]'
                }`}
              >
                👁 Furigana
              </button>

              {/* Speed selector */}
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-2 py-1 rounded-lg border border-[#292524] bg-white text-xs font-bold text-[#292524] focus:outline-none cursor-pointer"
              >
                <option value={0.75}>0.75x</option>
                <option value={0.9}>0.9x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
            </div>
          </div>

          {/* Big Subtitle Display Box (in Shadowing Mode, matches media_1788799324192.png) */}
          {mainMode === 'shadowing' && currentSentence && (
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={12}
              className="p-4 md:p-6 shadow-sketch flex flex-col justify-center min-h-[160px] text-center"
            >
              {/* Sentence Breakdown with Furigana & Underlines */}
              <div className="space-y-3">
                {/* Line 1 tokens */}
                <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3 text-lg md:text-2xl font-bold text-[#292524]">
                  {currentSentence.line1Tokens.map((token, idx) => {
                    const tokenData = currentSentence.tokens.find(t => t.text === token);
                    return (
                      <div key={idx} className="inline-flex flex-col items-center">
                        {showFurigana && tokenData?.reading && (
                          <span className="text-[11px] md:text-xs font-normal text-[#78716c] leading-none mb-0.5 select-none">
                            {tokenData.reading}
                          </span>
                        )}
                        <span className="border-b-2 border-[#78716c] pb-0.5 px-0.5">
                          {token}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Line 2 tokens (if any, rendered in blue with caret) */}
                {currentSentence.line2Tokens && (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xl md:text-2xl font-bold text-blue-600 mt-1">
                    <span className="text-blue-500 font-mono text-base">&lt;</span>
                    {currentSentence.line2Tokens.join(' ')}
                  </div>
                )}

                {/* Vietnamese Translation (matches screenshot) */}
                {showTranslation && (
                  <p className="text-xs md:text-sm text-[#78716c] font-medium pt-2 border-t border-[#e7e5e4] mt-2 italic">
                    {currentSentence.translationVi}
                  </p>
                )}
              </div>
            </RoughCard>
          )}

        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: Mode 1 (BẢN CHÉP) vs Mode 2 (CHÉP CHÍNH TẢ) */}
        {/* ================================================================= */}
        <div className="lg:col-span-5">
          
          {/* MODE 1: BẢN CHÉP (Transcript List - matches media_1788799324192.png) */}
          {mainMode === 'shadowing' && (
            <div className="space-y-3">
              {/* Transcript Header */}
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-[#292524] tracking-wider uppercase">
                  BẢN CHÉP
                </h3>
                <div className="flex items-center gap-2 text-xs text-[#78716c]">
                  <button 
                    onClick={() => setShowFurigana(prev => !prev)}
                    className="hover:text-blue-600 flex items-center gap-1 font-bold"
                  >
                    👁 Furigana
                  </button>
                  <span>·</span>
                  <button 
                    onClick={() => setShowTranslation(prev => !prev)}
                    className="hover:text-blue-600 flex items-center gap-1 font-bold"
                  >
                    👁 Trans
                  </button>
                  <Maximize2 className="w-3.5 h-3.5 hover:text-[#292524] cursor-pointer ml-1" />
                </div>
              </div>

              {/* Scrollable Sentence Cards */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {activeVideo.sentences.map((sent, idx) => {
                  const isActive = idx === currentSentenceIndex;
                  const isBookmarked = bookmarkedSentenceIds.includes(sent.id);

                  return (
                    <div
                      key={sent.id}
                      onClick={() => setCurrentSentenceIndex(idx)}
                      className="cursor-pointer transition-all"
                    >
                      <RoughCard
                        fill={isActive ? '#ffffff' : '#faf8f5'}
                        stroke={isActive ? '#2563eb' : '#292524'}
                        strokeWidth={isActive ? 1.8 : 1.2}
                        borderRadius={10}
                        className={`p-3 text-left transition-transform hover:scale-[1.01] ${
                          isActive ? 'shadow-sketch ring-2 ring-blue-500/20' : 'opacity-90'
                        }`}
                      >
                        {/* Card Header: Index tag + Bookmark */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                            isActive ? 'bg-[#2563eb] text-white' : 'text-[#78716c] bg-[#e7e5e4]'
                          }`}>
                            #{sent.id}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(sent.id);
                            }}
                            className={`p-1 hover:text-amber-600 transition-colors ${
                              isBookmarked ? 'text-amber-500' : 'text-[#a8a29e]'
                            }`}
                            title="Đánh dấu câu"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        {/* Japanese Tokens: Chips */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5 text-xs md:text-sm font-bold text-[#292524]">
                            {sent.line1Tokens.map((tok, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-2 py-0.5 rounded-md border border-[#292524]/40 bg-white"
                              >
                                {tok}
                              </span>
                            ))}
                          </div>

                          {sent.line2Tokens && (
                            <div className="flex flex-wrap gap-1.5 text-xs md:text-sm font-bold text-[#292524]">
                              {sent.line2Tokens.map((tok, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-2 py-0.5 rounded-md border border-[#292524]/40 bg-white"
                                >
                                  {tok}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Translation below */}
                        {showTranslation && (
                          <p className="text-[11px] text-[#78716c] mt-2 italic border-t border-[#e7e5e4]/80 pt-1.5">
                            {sent.translationVi}
                          </p>
                        )}
                      </RoughCard>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE 2: CHÉP CHÍNH TẢ (Dictation - matches media_1788799558769 & 99701901) */}
          {mainMode === 'dictation' && currentSentence && (
            <div className="space-y-3">
              
              {/* Chép chính tả Header */}
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-[#292524] tracking-wider uppercase">
                  CHÉP CHÍNH TẢ
                </h3>
                
                {/* Switch toggle: Tự ngắt câu */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#57534e]">Tự ngắt câu</span>
                  <button
                    type="button"
                    onClick={() => setAutoPause(prev => !prev)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors border border-[#292524] ${
                      autoPause ? 'bg-blue-600' : 'bg-stone-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      autoPause ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Dictation Mini Playback Controls Bar */}
              <div className="flex items-center justify-between p-2 rounded-xl border border-[#292524] bg-white shadow-xs">
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevSentence} className="hover:text-blue-600">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={handleReplay} className="hover:text-blue-600">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={handlePlayPause} className="hover:text-blue-600">
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <button onClick={handleNextSentence} className="hover:text-blue-600">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-[#78716c]">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span>{playbackSpeed}x</span>
                </div>
              </div>

              {/* Sub-mode Switch: Gõ chính tả vs Ghép câu */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-[#292524] bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setDictationSubMode('typing')}
                  className={`py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    dictationSubMode === 'typing'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#57534e] hover:bg-[#f6f2e9]'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Gõ chính tả
                </button>
                <button
                  type="button"
                  onClick={() => setDictationSubMode('puzzle')}
                  className={`py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    dictationSubMode === 'puzzle'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#57534e] hover:bg-[#f6f2e9]'
                  }`}
                >
                  <Puzzle className="w-3.5 h-3.5" />
                  Ghép câu
                </button>
              </div>

              {/* ========================================================= */}
              {/* SUB-MODE A: GHÉP CÂU (Puzzle Mode - matches media_1788799558769 & 99629441) */}
              {/* ========================================================= */}
              {dictationSubMode === 'puzzle' && (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-[#78716c] uppercase tracking-wide">
                    CHẠM CÁC MẢNH ĐỂ GHÉP THÀNH CÂU BẠN NGHE ĐƯỢC:
                  </p>

                  {/* Target Slots Area (matches empty gray boxes in screenshot) */}
                  <RoughCard
                    fill="#ffffff"
                    stroke="#292524"
                    borderRadius={10}
                    className="p-3.5 min-h-[70px] flex flex-wrap gap-2 items-center shadow-xs"
                  >
                    {currentSentence.puzzleTokens.map((_, slotIdx) => {
                      const token = puzzleSelectedTokens[slotIdx];
                      const isCorrect = puzzleChecked && token === currentSentence.puzzleTokens[slotIdx];
                      const isWrong = puzzleChecked && token && token !== currentSentence.puzzleTokens[slotIdx];

                      if (token) {
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            onClick={() => handleReturnSelectedToken(token, slotIdx)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs md:text-sm border-2 transition-transform active:scale-95 ${
                              isCorrect
                                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                                : isWrong
                                ? 'border-red-500 text-red-600 bg-red-50'
                                : 'border-[#292524] text-[#292524] bg-white shadow-xs'
                            }`}
                          >
                            {token}
                          </button>
                        );
                      }

                      // Empty Slot (gray box)
                      return (
                        <div
                          key={slotIdx}
                          className="w-12 h-9 rounded-lg border-2 border-[#d6d3d1] bg-[#e7e5e4]/50 flex items-center justify-center text-xs text-[#a8a29e]"
                        />
                      );
                    })}
                  </RoughCard>

                  {/* Available Word Chips (Pool) */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {puzzlePoolTokens.map((tok, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleSelectPoolToken(tok, pIdx)}
                        className="px-3 py-1.5 rounded-lg border border-[#292524] bg-white hover:bg-[#f6f2e9] text-[#292524] font-bold text-xs md:text-sm shadow-sketch active:scale-95 transition-all"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>

                  {/* Feedback on Check */}
                  {puzzleChecked && (
                    <RoughCard
                      fill="#ffffff"
                      stroke="#292524"
                      borderRadius={8}
                      className="p-2.5 text-xs text-[#292524] shadow-xs"
                    >
                      <span className="font-bold">Đáp án đúng:</span>{' '}
                      <span className="font-semibold">{currentSentence.puzzleTokens.join(' ')}</span>
                    </RoughCard>
                  )}

                  {/* Action Button: KIỂM TRA or TIẾP THEO */}
                  {!puzzleChecked ? (
                    <button
                      type="button"
                      onClick={handleCheckPuzzle}
                      disabled={puzzleSelectedTokens.length === 0}
                      className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-[#292524] font-black text-sm border-2 border-[#292524] shadow-sketch active:translate-y-0.5 transition-all"
                    >
                      KIỂM TRA ĐÁP ÁN
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleNextSentence();
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-black text-sm border-2 border-[#292524] shadow-sketch flex items-center justify-center gap-1.5 active:translate-y-0.5 transition-all"
                    >
                      TIẾP THEO <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* SUB-MODE B: GÕ CHÍNH TẢ (Typing Mode - matches media_1788799701901.png) */}
              {/* ========================================================= */}
              {dictationSubMode === 'typing' && (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-[#78716c] uppercase tracking-wide">
                    GÕ NHỮNG GÌ BẠN NGHE ĐƯỢC:
                  </p>

                  {/* Large Textarea */}
                  <textarea
                    rows={4}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder="Gõ câu trả lời của bạn tại đây..."
                    className="w-full p-3 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sketch resize-none"
                  />

                  {/* Word Hint Chips with Eye Icon (matches media_1788799701901.png) */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {currentSentence.tokens.map((tok, hIdx) => {
                        const isRevealed = revealedHints[hIdx];
                        return (
                          <button
                            key={hIdx}
                            type="button"
                            onClick={() => handleToggleHint(hIdx)}
                            className="px-2.5 py-1 rounded-lg border border-[#292524] bg-white hover:bg-[#f6f2e9] text-xs font-mono font-bold text-[#292524] shadow-xs flex items-center gap-1"
                            title="Bấm để hiện gợi ý"
                          >
                            <Eye className="w-3 h-3 text-[#78716c]" />
                            {isRevealed ? tok.text : '.'.repeat(Math.max(3, tok.text.length * 2))}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[#78716c] italic">
                      Nhấp vào biểu tượng con mắt để hiện từ
                    </p>
                  </div>

                  {/* Feedback comparison if checked */}
                  {typingChecked && (
                    <RoughCard
                      fill="#ffffff"
                      stroke="#292524"
                      borderRadius={8}
                      className="p-2.5 text-xs text-[#292524] shadow-xs space-y-1"
                    >
                      <div>
                        <span className="font-bold">Đáp án chuẩn:</span>{' '}
                        <span className="font-semibold text-emerald-700">{currentSentence.fullJapanese}</span>
                      </div>
                      <div className="text-[#78716c] italic">
                        {currentSentence.translationVi}
                      </div>
                    </RoughCard>
                  )}

                  {/* Action Buttons: KIỂM TRA ĐÁP ÁN (Yellow) & TIẾP THEO (Blue) */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleCheckTyping}
                      className="w-full py-2.5 rounded-xl bg-amber-300 hover:bg-amber-400 text-[#292524] font-black text-sm border-2 border-[#292524] shadow-sketch active:translate-y-0.5 transition-all"
                    >
                      KIỂM TRA ĐÁP ÁN
                    </button>

                    <button
                      type="button"
                      onClick={handleNextSentence}
                      className="w-full py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-black text-sm border-2 border-[#292524] shadow-sketch flex items-center justify-center gap-1.5 active:translate-y-0.5 transition-all"
                    >
                      TIẾP THEO <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STATS AT BOTTOM (matches both dictation screenshots) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                
                {/* Lỗi sai */}
                <RoughCard
                  fill="#ffffff"
                  stroke="#292524"
                  borderRadius={10}
                  className="p-2.5 shadow-sketch"
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Lỗi sai</span>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-[#292524] mt-1">
                    {errorCount}
                  </div>
                </RoughCard>

                {/* Lượt phát lại */}
                <RoughCard
                  fill="#ffffff"
                  stroke="#292524"
                  borderRadius={10}
                  className="p-2.5 shadow-sketch"
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#57534e]">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Lượt phát lại</span>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-[#292524] mt-1">
                    {replayCount}
                  </div>
                </RoughCard>
              </div>

              {/* Notice Box: Lý do (matches media_1788799558769 & 99701901) */}
              <RoughCard
                fill="#ffffff"
                stroke="#292524"
                borderRadius={10}
                className="p-3 shadow-sketch text-xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-700 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lý do</span>
                </div>
                <p className="text-[#57534e]">
                  {errorCount > 0
                    ? `Bạn đã mắc ${errorCount} lỗi với câu này. Hãy thử bấm nút phát lại hoặc kiểm tra từng mảnh từ vựng.`
                    : 'Chưa phát hiện lỗi sai. Hãy nghe kỹ và tiếp tục hoàn thành các câu tiếp theo!'}
                </p>
              </RoughCard>

            </div>
          )}

        </div>

      </div>

      {/* 4. KEYBOARD SHORTCUTS MODAL */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={16}
              className="p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="absolute top-4 right-4 text-[#78716c] hover:text-[#292524] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Keyboard className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-black text-[#292524]">
                  Phím tắt Shadowing & Chép chính tả
                </h3>
              </div>

              <div className="space-y-2.5 text-xs md:text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f6f2e9]">
                  <span className="font-bold text-[#57534e]">Phát / Tạm dừng</span>
                  <kbd className="px-2.5 py-1 rounded border border-[#292524] bg-white font-mono font-bold shadow-xs">
                    Space
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f6f2e9]">
                  <span className="font-bold text-[#57534e]">Phát lại câu hiện tại</span>
                  <kbd className="px-2.5 py-1 rounded border border-[#292524] bg-white font-mono font-bold shadow-xs">
                    R
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f6f2e9]">
                  <span className="font-bold text-[#57534e]">Lùi về câu trước</span>
                  <kbd className="px-2.5 py-1 rounded border border-[#292524] bg-white font-mono font-bold shadow-xs">
                    ←
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f6f2e9]">
                  <span className="font-bold text-[#57534e]">Chuyển sang câu tiếp theo</span>
                  <kbd className="px-2.5 py-1 rounded border border-[#292524] bg-white font-mono font-bold shadow-xs">
                    →
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#f6f2e9]">
                  <span className="font-bold text-[#57534e]">Mở / đóng bảng phím tắt</span>
                  <kbd className="px-2.5 py-1 rounded border border-[#292524] bg-white font-mono font-bold shadow-xs">
                    ?
                  </kbd>
                </div>
              </div>

              <button
                onClick={() => setShowShortcutsModal(false)}
                className="w-full mt-5 py-2 rounded-xl bg-[#292524] text-white font-bold text-xs border border-[#292524] shadow-sketch hover:bg-black transition-colors"
              >
                Đã hiểu
              </button>
            </RoughCard>
          </div>
        </div>
      )}

    </div>
  );
};
