import React, { useState, useEffect, useRef } from 'react';
import { FlashcardStudy } from '../components/chudong/FlashcardStudy';
import { QuizStudy } from '../components/chudong/QuizStudy';
import { CramStudy } from '../components/chudong/CramStudy';
import { 
  Folder, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  Download, 
  Play, 
  Info, 
  AlertCircle, 
  Layers, 
  Target, 
  Zap,
  HelpCircle
} from 'lucide-react';
import { RoughCard, RoughButton } from '../components/RoughCard';

export interface VocabWord {
  id: string;
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
}

export interface VocabLesson {
  id: string;
  name: string;
  words: VocabWord[];
}

const DEMO_WORDS: VocabWord[] = [
  { id: 'w-0', word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' },
  { id: 'w-01', word: '先生', reading: 'せんせい', hanViet: 'TIÊN SINH', meaning: 'Giáo viên, thầy/cô' },
  { id: 'w-1', word: 'コンビニ', reading: 'コンビニ', hanViet: '', meaning: 'Cửa hàng tiện lợi' },
  { id: 'w-2', word: 'アルバイト', reading: 'アルバイト', hanViet: '', meaning: 'Việc làm thêm' },
  { id: 'w-3', word: 'ドラえもん', reading: 'ドラえもん', hanViet: '', meaning: 'Đô-rê-mon' },
  { id: 'w-4', word: 'すみません', reading: 'すみません', hanViet: '', meaning: 'Xin lỗi' },
  { id: 'w-5', word: 'おはよう', reading: 'おはよう', hanViet: '', meaning: 'Chào buổi sáng' },
  { id: 'w-6', word: 'ありがとう', reading: 'ありがとう', hanViet: '', meaning: 'Cảm ơn' },
  { id: 'w-7', word: 'さようなら', reading: 'さようなら', hanViet: '', meaning: 'Tạm biệt' },
  { id: 'w-8', word: 'いただきます', reading: 'いただきます', hanViet: '', meaning: 'Mời ăn cơm / Xin phép nhận' }
];

export const ChuDongPage: React.FC = () => {
  // Lessons state with localStorage persistence
  const [lessons, setLessons] = useState<VocabLesson[]>(() => {
    try {
      const saved = localStorage.getItem('chu_dong_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('chu_dong_selected_lesson');
      return saved || null;
    } catch {
      return null;
    }
  });

  // New lesson creation
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [newLessonName, setNewLessonName] = useState('');

  // Edit lesson name
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonName, setEditLessonName] = useState('');

  // Vocabulary JSON/text input
  const [inputContent, setInputContent] = useState('');
  const [showJsonHelp, setShowJsonHelp] = useState(false);

  // Edit single vocabulary row
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editWordForm, setEditWordForm] = useState<VocabWord>({
    id: '',
    word: '',
    reading: '',
    hanViet: '',
    meaning: ''
  });

  // Notice toast for study modes
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active study mode: 'flashcard' | 'quiz' | 'cram' | null
  const [activeStudyMode, setActiveStudyMode] = useState<'flashcard' | 'quiz' | 'cram' | null>(null);
  const [isStudyFullscreen, setIsStudyFullscreen] = useState(false);
  const studyAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('chu_dong_lessons', JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    if (selectedLessonId) {
      localStorage.setItem('chu_dong_selected_lesson', selectedLessonId);
    } else {
      localStorage.removeItem('chu_dong_selected_lesson');
    }
  }, [selectedLessonId]);

  // Current active lesson
  const currentLesson = lessons.find(l => l.id === selectedLessonId) || null;

  // Show toast notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. Create Lesson Handlers
  const handleStartCreateLesson = () => {
    setIsCreatingLesson(true);
    setNewLessonName(`Bài ${lessons.length + 1}`);
  };

  const handleConfirmCreateLesson = () => {
    if (!newLessonName.trim()) return;
    const newLesson: VocabLesson = {
      id: `lesson-${Date.now()}`,
      name: newLessonName.trim(),
      words: []
    };
    const updated = [...lessons, newLesson];
    setLessons(updated);
    setSelectedLessonId(newLesson.id);
    setIsCreatingLesson(false);
    setNewLessonName('');
  };

  const handleCancelCreateLesson = () => {
    setIsCreatingLesson(false);
    setNewLessonName('');
  };

  // 2. Delete / Rename Lesson
  const handleDeleteLesson = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = lessons.filter(l => l.id !== id);
    setLessons(updated);
    if (selectedLessonId === id) {
      setSelectedLessonId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleStartRename = (lesson: VocabLesson, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLessonId(lesson.id);
    setEditLessonName(lesson.name);
  };

  const handleConfirmRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editLessonName.trim()) return;
    setLessons(prev => prev.map(l => l.id === id ? { ...l, name: editLessonName.trim() } : l));
    setEditingLessonId(null);
  };

  // 3. Import Demo Words
  const handleUseDemo = () => {
    if (!currentLesson) return;
    const updated = lessons.map(l => {
      if (l.id === currentLesson.id) {
        return {
          ...l,
          words: [...DEMO_WORDS]
        };
      }
      return l;
    });
    setLessons(updated);
    triggerToast('Đã tải 9 từ vựng demo thành công!');
  };

  // 4. Import / AI Format Handlers
  const handleImportData = () => {
    if (!currentLesson || !inputContent.trim()) return;
    
    let parsedWords: VocabWord[] = [];
    try {
      // Try parsing JSON first
      const raw = JSON.parse(inputContent);
      if (Array.isArray(raw)) {
        parsedWords = raw.map((item, idx) => ({
          id: `w-${Date.now()}-${idx}`,
          word: item.word || item.kanji || item.term || '',
          reading: item.reading || item.kana || item.furigana || item.word || '',
          hanViet: item.hanViet || '',
          meaning: item.meaning || item.definition || ''
        }));
      }
    } catch {
      // Fallback to line-by-line parsing: word, reading, hanViet, meaning OR word - meaning
      const lines = inputContent.split('\n').map(l => l.trim()).filter(Boolean);
      parsedWords = lines.map((line, idx) => {
        const parts = line.split(/[,\t|-]/).map(p => p.trim());
        return {
          id: `w-${Date.now()}-${idx}`,
          word: parts[0] || '',
          reading: parts[1] || parts[0] || '',
          hanViet: parts[2] && parts[3] ? parts[2] : '',
          meaning: parts[3] || parts[2] || parts[1] || 'Chưa có nghĩa'
        };
      });
    }

    if (parsedWords.length > 0) {
      setLessons(prev => prev.map(l => {
        if (l.id === currentLesson.id) {
          return {
            ...l,
            words: [...l.words, ...parsedWords]
          };
        }
        return l;
      }));
      setInputContent('');
      triggerToast(`Đã thêm ${parsedWords.length} từ vựng vào bài!`);
    } else {
      triggerToast('Không thể nhận diện định dạng từ vựng. Vui lòng kiểm tra lại!');
    }
  };

  const handleAiFormat = () => {
    if (!inputContent.trim()) {
      triggerToast('Vui lòng nhập hoặc dán nội dung từ vựng trước!');
      return;
    }
    // Simulate smart AI auto-formatting to clean JSON
    const lines = inputContent.split('\n').map(l => l.trim()).filter(Boolean);
    const formatted = lines.map(line => {
      const parts = line.split(/[,\t|-]/).map(p => p.trim());
      return {
        word: parts[0] || '',
        reading: parts[1] || parts[0] || '',
        hanViet: parts[2] && parts[3] ? parts[2] : '',
        meaning: parts[3] || parts[2] || parts[1] || ''
      };
    });
    setInputContent(JSON.stringify(formatted, null, 2));
    triggerToast('AI đã tự động chuẩn hóa định dạng JSON!');
  };

  // 5. Clear All Words in Lesson
  const handleClearAllWords = () => {
    if (!currentLesson) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả từ vựng trong bài này?')) {
      setLessons(prev => prev.map(l => l.id === currentLesson.id ? { ...l, words: [] } : l));
      triggerToast('Đã xóa tất cả từ vựng trong bài!');
    }
  };

  // 6. Delete single word
  const handleDeleteWord = (wordId: string) => {
    if (!currentLesson) return;
    setLessons(prev => prev.map(l => {
      if (l.id === currentLesson.id) {
        return {
          ...l,
          words: l.words.filter(w => w.id !== wordId)
        };
      }
      return l;
    }));
  };

  // 7. Edit single word
  const handleStartEditWord = (word: VocabWord) => {
    setEditingWordId(word.id);
    setEditWordForm({ ...word });
  };

  const handleSaveEditWord = () => {
    if (!currentLesson || !editingWordId) return;
    setLessons(prev => prev.map(l => {
      if (l.id === currentLesson.id) {
        return {
          ...l,
          words: l.words.map(w => w.id === editingWordId ? { ...editWordForm } : w)
        };
      }
      return l;
    }));
    setEditingWordId(null);
  };

  const wordCount = currentLesson ? currentLesson.words.length : 0;

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#292524] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-stone-600 animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* ACTIVE STUDY MODE CONTAINER (Images 1, 2, 3, 4, 5) */}
      {activeStudyMode && currentLesson && (
        <div ref={studyAreaRef} className="w-full animate-in fade-in duration-200">
          {activeStudyMode === 'flashcard' && (
            <FlashcardStudy
              words={currentLesson.words}
              lessonName={currentLesson.name}
              onExit={() => setActiveStudyMode(null)}
              isFullscreen={isStudyFullscreen}
              onToggleFullscreen={() => setIsStudyFullscreen(prev => !prev)}
            />
          )}

          {activeStudyMode === 'quiz' && (
            <QuizStudy
              words={currentLesson.words}
              lessonName={currentLesson.name}
              onExit={() => setActiveStudyMode(null)}
              isFullscreen={isStudyFullscreen}
              onToggleFullscreen={() => setIsStudyFullscreen(prev => !prev)}
            />
          )}

          {activeStudyMode === 'cram' && (
            <CramStudy
              words={currentLesson.words}
              lessonName={currentLesson.name}
              onExit={() => setActiveStudyMode(null)}
              isFullscreen={isStudyFullscreen}
              onToggleFullscreen={() => setIsStudyFullscreen(prev => !prev)}
            />
          )}
        </div>
      )}

      {/* When NOT in study mode, display full editor (Header, Card 1, Card 2, Card 3) */}
      {!activeStudyMode && (
        <>
          {/* 1. Header: Tiêu đề & Phụ đề */}
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">
              Tạo sổ tay từ vựng
            </h1>
            <p className="text-xs md:text-sm font-bold text-[#57534e]">
              Tự nhập từ vựng và chọn chế độ học phù hợp
            </p>
          </div>

      {/* 2. CARD: DANH SÁCH BÀI (Image 1, 2, 3, 4) */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4 shadow-sketch">
        
        {/* Header of Danh Sách Bài */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm md:text-base font-black text-[#292524] font-sketch">
            Danh sách bài
          </h2>

          {!isCreatingLesson && (
            <RoughButton
              onClick={handleStartCreateLesson}
              fill="#ffffff"
              stroke="#292524"
              borderRadius={8}
              roughness={0.7}
              className="px-3 py-1.5 font-bold text-xs shadow-xs hover:bg-[#fcf9f2] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo bài mới</span>
              </div>
            </RoughButton>
          )}
        </div>

        {/* Inline Create Input (Image 2) */}
        {isCreatingLesson && (
          <div className="flex items-center gap-2 p-2 border-2 border-[#292524] rounded-xl bg-[#fdfbf7] shadow-inner animate-in fade-in duration-150">
            <input
              type="text"
              value={newLessonName}
              onChange={(e) => setNewLessonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateLesson();
                if (e.key === 'Escape') handleCancelCreateLesson();
              }}
              autoFocus
              placeholder="Nhập tên bài (VD: Bài 1)..."
              className="flex-1 bg-transparent px-3 py-1 text-sm font-bold text-[#292524] outline-none font-sketch"
            />
            <button
              onClick={handleConfirmCreateLesson}
              className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
              title="Xác nhận"
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </button>
            <button
              onClick={handleCancelCreateLesson}
              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
              title="Hủy"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Empty State when no lessons (Image 1) */}
        {!isCreatingLesson && lessons.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center space-y-2 text-[#a8a29e]">
            <Folder className="w-10 h-10 stroke-[1.5] text-stone-300" />
            <p className="text-xs font-bold text-[#78716c]">
              Chưa có bài nào. Tạo bài mới để bắt đầu.
            </p>
          </div>
        )}

        {/* Lessons List (Image 3, 4) */}
        {!isCreatingLesson && lessons.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {lessons.map((lesson) => {
              const isSelected = lesson.id === selectedLessonId;
              const isEditing = editingLessonId === lesson.id;

              if (isEditing) {
                return (
                  <div key={lesson.id} className="flex items-center gap-1 p-2 border-2 border-[#292524] rounded-xl bg-white shadow-xs">
                    <input
                      type="text"
                      value={editLessonName}
                      onChange={(e) => setEditLessonName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename(lesson.id, e as any);
                        if (e.key === 'Escape') setEditingLessonId(null);
                      }}
                      autoFocus
                      className="w-28 px-2 py-0.5 text-xs font-bold outline-none"
                    />
                    <button onClick={(e) => handleConfirmRename(lesson.id, e)} className="p-1 text-emerald-600">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingLessonId(null)} className="p-1 text-rose-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={lesson.id}
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={`min-w-[170px] p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs ${
                    isSelected 
                      ? 'border-[#292524] bg-white shadow-sketch' 
                      : 'border-[#78716c]/40 bg-[#fdfbf7] hover:bg-white hover:border-[#292524]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs md:text-sm font-black text-[#292524] font-sketch">
                      {lesson.name}
                    </div>
                    <div className="text-[11px] font-bold text-[#0094ff]">
                      {lesson.words.length} từ vựng
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-stone-400">
                    <button
                      onClick={(e) => handleStartRename(lesson, e)}
                      className="p-1 hover:text-[#292524] transition-colors cursor-pointer"
                      title="Đổi tên"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteLesson(lesson.id, e)}
                      className="p-1 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Xóa bài"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </RoughCard>

      {/* 3. CARD: NHẬP TỪ VỰNG (JSON) (Image 3, 4 - Appears when a lesson exists) */}
      {currentLesson && (
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4 shadow-sketch">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-black text-[#292524] font-sketch">
              <span>Nhập từ vựng (JSON)</span>
              <button 
                onClick={() => setShowJsonHelp(!showJsonHelp)}
                className="text-[#78716c] hover:text-[#292524] cursor-pointer"
                title="Hướng dẫn định dạng"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            <RoughButton
              onClick={handleUseDemo}
              fill="#ffffff"
              stroke="#292524"
              borderRadius={8}
              roughness={0.7}
              className="px-3 py-1 font-bold text-xs shadow-xs hover:bg-[#fcf9f2] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[#292524]">
                <Play className="w-3 h-3 fill-[#292524]" />
                <span>Dùng thử demo</span>
              </div>
            </RoughButton>
          </div>

          {/* Help box */}
          {showJsonHelp && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-950 space-y-1 animate-in fade-in duration-150">
              <p>Hỗ trợ định dạng JSON hoặc văn bản tự do:</p>
              <code className="block p-2 bg-white/80 rounded border font-mono text-[11px]">
                [&#123; "word": "コンビニ", "reading": "コンビニ", "meaning": "Cửa hàng tiện lợi" &#125;]
              </code>
            </div>
          )}

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              rows={5}
              placeholder="Dán danh sách từ vựng vào đây (text thô, JSON, hoặc bất kỳ format nào – AI sẽ tự format)..."
              className="w-full p-4 rounded-xl border-2 border-[#292524] bg-white text-xs md:text-sm font-bold text-[#292524] outline-none font-sketch placeholder:text-stone-400 focus:border-[#0094ff] transition-colors resize-y"
            />
          </div>

          {/* Actions below textarea */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleImportData}
                className="px-4 py-2 rounded-xl bg-[#0094ff] border-2 border-[#292524] text-white text-xs font-black flex items-center gap-1.5 shadow-xs hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Nhập dữ liệu vào hệ thống</span>
              </button>

              <button
                onClick={handleAiFormat}
                className="px-4 py-2 rounded-xl bg-[#f3e8ff] border-2 border-[#c084fc] text-[#7e22ce] text-xs font-black flex items-center gap-1.5 shadow-xs hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>AI Format</span>
              </button>
            </div>

            {inputContent.trim() && (
              <button
                onClick={() => setInputContent('')}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Bỏ nhập</span>
              </button>
            )}
          </div>

        </RoughCard>
      )}

      {/* 4. CARD: DANH SÁCH TỪ VỰNG (Image 3 empty, Image 4 list, Image 5 edit) */}
      {currentLesson && (
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4 shadow-sketch">
          
          {wordCount === 0 ? (
            /* Empty Word State (Image 3) */
            <div className="py-6 text-center text-xs font-bold text-[#78716c]">
              Chưa có từ vựng nào. Hãy thêm từ vựng để bắt đầu học.
            </div>
          ) : (
            /* Populated Word List (Image 4 & 5) */
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs md:text-sm font-black text-[#292524] font-sketch">
                  Danh sách từ vựng ({wordCount})
                </h3>

                <button
                  onClick={handleClearAllWords}
                  className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xoá tất cả</span>
                </button>
              </div>

              {/* Scrollable list */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {currentLesson.words.map((item) => {
                  const isEditing = editingWordId === item.id;

                  if (isEditing) {
                    /* INLINE EDIT MODE (Image 5) */
                    return (
                      <div key={item.id} className="p-3 border-sketch bg-[#fdfbf7] space-y-2 animate-in fade-in duration-100">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={editWordForm.word}
                            onChange={(e) => setEditWordForm({ ...editWordForm, word: e.target.value })}
                            placeholder="Từ vựng"
                            className="p-2 text-xs font-bold bg-white border-sketch-subtle outline-none font-kanji"
                          />
                          <input
                            type="text"
                            value={editWordForm.reading}
                            onChange={(e) => setEditWordForm({ ...editWordForm, reading: e.target.value })}
                            placeholder="Cách đọc (hiragana/katakana)"
                            className="p-2 text-xs font-bold bg-white border-sketch-subtle outline-none font-kanji"
                          />
                          <input
                            type="text"
                            value={editWordForm.hanViet}
                            onChange={(e) => setEditWordForm({ ...editWordForm, hanViet: e.target.value })}
                            placeholder="Hán Việt (tùy chọn)"
                            className="p-2 text-xs font-bold bg-white border-sketch-subtle outline-none"
                          />
                          <input
                            type="text"
                            value={editWordForm.meaning}
                            onChange={(e) => setEditWordForm({ ...editWordForm, meaning: e.target.value })}
                            placeholder="Ý nghĩa"
                            className="p-2 text-xs font-bold bg-white border-sketch-subtle outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSaveEditWord}
                            className="px-3 py-1 border-sketch-subtle bg-white text-xs font-black text-[#292524] flex items-center gap-1 hover:bg-stone-100 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Lưu</span>
                          </button>
                          <button
                            onClick={() => setEditingWordId(null)}
                            className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
                          >
                            Huỷ
                          </button>
                        </div>
                      </div>
                    );
                  }

                  /* NORMAL ROW (Image 4) */
                  return (
                    <div
                      key={item.id}
                      className="p-3 border-sketch-subtle bg-white hover:bg-stone-50/80 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="grid grid-cols-4 gap-2 flex-1 items-center text-xs md:text-sm font-bold">
                        {/* Word */}
                        <div className="font-kanji font-black text-[#292524] truncate">
                          {item.word}
                        </div>

                        {/* Reading */}
                        <div className="font-kanji text-[#57534e] truncate">
                          {item.reading}
                        </div>

                        {/* Hán Việt */}
                        <div className="text-[#0094ff] font-kanji truncate">
                          {item.hanViet || '—'}
                        </div>

                        {/* Meaning */}
                        <div className="text-[#57534e] truncate">
                          {item.meaning}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 text-stone-400 shrink-0">
                        <button
                          onClick={() => handleStartEditWord(item)}
                          className="p-1 hover:text-[#292524] transition-colors cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWord(item.id)}
                          className="p-1 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xoá từ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </RoughCard>
      )}
        </>
      )}

      {/* 5. CARD: CHỌN CHẾ ĐỘ HỌC (Images 1, 2, 3, 4) */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4 shadow-sketch">
        
        {/* Info Callout Strip (Matching media_1788715771652.png) */}
        <RoughCard fill="#ffffff" stroke="#292524" shadow={true} className="p-2.5 md:p-3 text-xs md:text-sm font-bold text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Dùng bộ gõ tiếng Việt cho chế độ học nhồi nhét</span>
        </RoughCard>

        {/* Section Heading */}
        <h2 className="text-sm md:text-base font-black text-[#292524] font-sketch">
          Chọn chế độ học
        </h2>

        {/* Warning pill if 0 words (Matching media_1788715771652.png) */}
        {wordCount === 0 && (
          <RoughCard fill="#ffffff" stroke="#292524" shadow={true} className="p-2.5 md:p-3 text-xs md:text-sm font-bold text-amber-800 flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Cần ít nhất 1 từ vựng để bắt đầu học</span>
          </RoughCard>
        )}

        {/* 3 Study Mode Cards (Matching media_1788715771652.png) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          
          {/* Card 1: Flashcard */}
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            shadow={true}
            className="p-4 md:p-5 flex flex-col justify-between space-y-4 relative"
          >
            {/* Location Pin 📍 for Flashcard (Image 1) */}
            {activeStudyMode === 'flashcard' && (
              <div className="absolute -top-3 left-3 z-20 animate-in bounce-in duration-200">
                <div className="w-6 h-6 rounded-full bg-[#2563eb] border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white shadow-inner" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs md:text-sm font-black text-[#0094ff]">
                <Layers className="w-4 h-4 text-[#0094ff]" />
                <span>Flashcard</span>
              </div>
              <p className="text-[11px] font-bold text-[#78716c] leading-relaxed">
                Lật thẻ để xem đáp án. Phù hợp để làm quen với từ vựng mới.
              </p>
            </div>

            <RoughButton
              onClick={() => {
                if (wordCount === 0) {
                  triggerToast('Cần ít nhất 1 từ vựng trong bài để bắt đầu học!');
                } else {
                  setActiveStudyMode('flashcard');
                  setTimeout(() => studyAreaRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              fill={wordCount > 0 ? '#4b89ff' : '#93c5fd'}
              stroke="#1d4ed8"
              className="w-full py-2.5 text-xs font-black text-white"
            >
              Bắt đầu Flashcard
            </RoughButton>
          </RoughCard>

          {/* Card 2: Trắc nghiệm */}
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            shadow={true}
            className="p-4 md:p-5 flex flex-col justify-between space-y-4 relative"
          >
            {/* Location Pin 📍 for Trắc nghiệm (Images 2 & 3) */}
            {activeStudyMode === 'quiz' && (
              <div className="absolute -top-3 left-3 z-20 animate-in bounce-in duration-200">
                <div className="w-6 h-6 rounded-full bg-[#16a34a] border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white shadow-inner" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs md:text-sm font-black text-[#16a34a]">
                <Target className="w-4 h-4 text-[#16a34a]" />
                <span>Trắc nghiệm</span>
              </div>
              <p className="text-[11px] font-bold text-[#78716c] leading-relaxed">
                Xem từ vựng, chọn cách đọc. Kiểm tra nhanh kiến thức.
              </p>
            </div>

            <RoughButton
              onClick={() => {
                if (wordCount === 0) {
                  triggerToast('Cần ít nhất 1 từ vựng trong bài để bắt đầu học!');
                } else {
                  setActiveStudyMode('quiz');
                  setTimeout(() => studyAreaRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              fill={wordCount > 0 ? '#22c55e' : '#86efac'}
              stroke="#15803d"
              className="w-full py-2.5 text-xs font-black text-white"
            >
              Bắt đầu Trắc nghiệm
            </RoughButton>
          </RoughCard>

          {/* Card 3: Nhồi nhét */}
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            shadow={true}
            className="p-4 md:p-5 flex flex-col justify-between space-y-4 relative"
          >
            {/* Location Pin 📍 for Nhồi nhét (Images 4 & 5) */}
            {activeStudyMode === 'cram' && (
              <div className="absolute -top-3 left-3 z-20 animate-in bounce-in duration-200">
                <div className="w-6 h-6 rounded-full bg-[#ea580c] border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white shadow-inner" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs md:text-sm font-black text-[#ea580c]">
                <Zap className="w-4 h-4 text-[#ea580c]" />
                <span>Nhồi nhét</span>
              </div>
              <p className="text-[11px] font-bold text-[#78716c] leading-relaxed">
                Gõ đáp án để ghi nhớ sâu hơn. Dành cho người muốn thử thách.
              </p>
            </div>

            <RoughButton
              onClick={() => {
                if (wordCount === 0) {
                  triggerToast('Cần ít nhất 1 từ vựng trong bài để bắt đầu học!');
                } else {
                  setActiveStudyMode('cram');
                  setTimeout(() => studyAreaRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
              }}
              fill={wordCount > 0 ? '#f97316' : '#fdba74'}
              stroke="#c2410c"
              className="w-full py-2.5 text-xs font-black text-white"
            >
              Bắt đầu Nhồi nhét
            </RoughButton>
          </RoughCard>

        </div>

      </RoughCard>

    </div>
  );
};
