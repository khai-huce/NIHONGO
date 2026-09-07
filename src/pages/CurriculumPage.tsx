import React, { useState } from 'react';
import { 
  Headphones, 
  Volume2, 
  Search,
  X
} from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';

interface VocabSample {
  word: string;
  reading: string;
  romaji: string;
  hanViet: string;
  meaning: string;
  exampleJp: string;
  exampleVi: string;
}

interface CurriculumItem {
  id: string;
  level: string;
  levelTitle: string;
  levelColor: string;
  type: 'tango' | 'minna' | 'mimikara' | 'tettei' | 'it';
  title: string;
  subTitle: string;
  totalWords: string;
  description: string;
  bgColor: string;
  strokeColor: string;
  textColor: string;
  bannerColor?: string;
  hasHeadphones?: boolean;
  isUpcoming?: boolean;
  sampleVocabs: VocabSample[];
}

export const CurriculumPage: React.FC = () => {
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const curriculums: CurriculumItem[] = [
    // --- N5 ---
    {
      id: 'n5-tango',
      level: 'N5',
      levelTitle: 'Trình độ sơ cấp',
      levelColor: '#0094ff',
      type: 'tango',
      title: 'N5',
      subTitle: 'Từ vựng nâng cao',
      totalWords: '1000 từ vựng',
      description: 'dành cho Kỳ thi Năng lực Nhật ngữ N5',
      bgColor: '#ffd166',
      strokeColor: '#b45309',
      textColor: '#78350f',
      sampleVocabs: [
        { word: '学生', reading: 'がくせい', romaji: 'gakusei', hanViet: 'HỌC SINH', meaning: 'Học sinh, sinh viên', exampleJp: 'わたしは学生です。', exampleVi: 'Tôi là học sinh.' },
        { word: '先生', reading: 'せんせい', romaji: 'sensei', hanViet: 'TIÊN SINH', meaning: 'Thầy cô giáo', exampleJp: '田中先生は日本語を教えます。', exampleVi: 'Thầy Tanaka dạy tiếng Nhật.' },
        { word: '日本語', reading: 'にほんご', romaji: 'nihongo', hanViet: 'NHẬT BẢN NGỮ', meaning: 'Tiếng Nhật', exampleJp: '日本語を勉強します。', exampleVi: 'Tôi học tiếng Nhật.' },
        { word: '友達', reading: 'ともだち', romaji: 'tomodachi', hanViet: 'HỮU ĐẠT', meaning: 'Bạn bè', exampleJp: '友達と遊びます。', exampleVi: 'Tôi đi chơi với bạn.' },
        { word: '家族', reading: 'かぞく', romaji: 'kazoku', hanViet: 'GIA TỘC', meaning: 'Gia đình', exampleJp: '家族は４人です。', exampleVi: 'Gia đình tôi có 4 người.' }
      ]
    },
    {
      id: 'n5-minna',
      level: 'N5',
      levelTitle: 'Trình độ sơ cấp',
      levelColor: '#0094ff',
      type: 'minna',
      title: 'N5',
      subTitle: 'Giáo trình quốc dân Sơ cấp I',
      totalWords: '1000 từ vựng',
      description: 'Tiếng Nhật sơ cấp 1',
      bgColor: '#ffffff',
      strokeColor: '#2a9d8f',
      textColor: '#1f2937',
      bannerColor: '#2a9d8f',
      sampleVocabs: [
        { word: '会社員', reading: 'かいしゃいん', romaji: 'kaishain', hanViet: 'HỘI XÃ VIÊN', meaning: 'Nhân viên công ty', exampleJp: '父は会社員です。', exampleVi: 'Bố tôi là nhân viên công ty.' },
        { word: '銀行員', reading: 'ぎんこういん', romaji: 'ginkouin', hanViet: 'NGÂN HÀNG VIÊN', meaning: 'Nhân viên ngân hàng', exampleJp: '山田さんは銀行員です。', exampleVi: 'Anh Yamada là nhân viên ngân hàng.' },
        { word: '病院', reading: 'びょういん', romaji: 'byouin', hanViet: 'BỆNH VIỆN', meaning: 'Bệnh viện', exampleJp: '病院へ行きます。', exampleVi: 'Tôi đi đến bệnh viện.' }
      ]
    },

    // --- N4 ---
    {
      id: 'n4-tango',
      level: 'N4',
      levelTitle: 'Trình độ sơ cấp',
      levelColor: '#10b981',
      type: 'tango',
      title: 'N4',
      subTitle: 'Từ vựng nâng cao',
      totalWords: '1500 từ vựng',
      description: 'dành cho Kỳ thi Năng lực Nhật ngữ N4',
      bgColor: '#c084fc',
      strokeColor: '#7e22ce',
      textColor: '#3b0764',
      sampleVocabs: [
        { word: '約束', reading: 'やくそく', romaji: 'yakusoku', hanViet: 'ƯỚC THÚC', meaning: 'Lời hứa, cuộc hẹn', exampleJp: '友達と約束があります。', exampleVi: 'Tôi có hẹn với bạn.' },
        { word: '経験', reading: 'けいけん', romaji: 'keiken', hanViet: 'KINH NGHIỆM', meaning: 'Kinh nghiệm', exampleJp: '良い経験になりました。', exampleVi: 'Đã trở thành một kinh nghiệm tốt.' },
        { word: '準備', reading: 'じゅんび', romaji: 'junbi', hanViet: 'CHUẨN BỊ', meaning: 'Chuẩn bị', exampleJp: '旅行の準備をします。', exampleVi: 'Tôi chuẩn bị cho chuyến du lịch.' }
      ]
    },
    {
      id: 'n4-minna',
      level: 'N4',
      levelTitle: 'Trình độ sơ cấp',
      levelColor: '#10b981',
      type: 'minna',
      title: 'N4',
      subTitle: 'Giáo trình quốc dân Sơ cấp II',
      totalWords: '1500 từ vựng',
      description: 'Tiếng Nhật sơ cấp 2',
      bgColor: '#7ba899',
      strokeColor: '#1e3a8a',
      textColor: '#1f2937',
      bannerColor: '#3b7a57',
      sampleVocabs: [
        { word: '連絡', reading: 'れんらく', romaji: 'renraku', hanViet: 'LIÊN LẠC', meaning: 'Liên lạc', exampleJp: '後で連絡します。', exampleVi: 'Tôi sẽ liên lạc lại sau.' },
        { word: '相談', reading: 'そうだん', romaji: 'soudan', hanViet: 'TƯƠNG ĐÀM', meaning: 'Thảo luận, trao đổi', exampleJp: '先生に相談しました。', exampleVi: 'Tôi đã trao đổi với thầy giáo.' }
      ]
    },

    // --- N3 ---
    {
      id: 'n3-tango',
      level: 'N3',
      levelTitle: 'Trình độ trung cấp',
      levelColor: '#f59e0b',
      type: 'tango',
      title: 'N3',
      subTitle: 'Từ vựng nâng cao',
      totalWords: '2000 từ vựng',
      description: 'dành cho Kỳ thi Năng lực Nhật ngữ N3',
      bgColor: '#10b981',
      strokeColor: '#065f46',
      textColor: '#022c22',
      sampleVocabs: [
        { word: '改善', reading: 'かいぜん', romaji: 'kaizen', hanViet: 'CẢI THIỆN', meaning: 'Cải tiến, cải thiện', exampleJp: '業務プロセスを改善する。', exampleVi: 'Cải tiến quy trình nghiệp vụ.' },
        { word: '効果', reading: 'こうか', romaji: 'kouka', hanViet: 'HIỆU QUẢ', meaning: 'Hiệu quả', exampleJp: '薬の効果が現れる。', exampleVi: 'Hiệu quả của thuốc bắt đầu xuất hiện.' }
      ]
    },
    {
      id: 'n3-mimikara',
      level: 'N3',
      levelTitle: 'Trình độ trung cấp',
      levelColor: '#f59e0b',
      type: 'mimikara',
      title: 'N3',
      subTitle: 'Học từ vựng bằng tai',
      totalWords: '880 từ vựng',
      description: 'Luyện từ vựng qua nghe N3',
      bgColor: '#ffffff',
      strokeColor: '#6b7280',
      textColor: '#dc2626',
      bannerColor: '#6ee7b7',
      hasHeadphones: true,
      sampleVocabs: [
        { word: '注目', reading: 'ちゅうもく', romaji: 'chuumoku', hanViet: 'CHÚ MỤC', meaning: 'Chú ý, quan tâm', exampleJp: '世界中から注目されている。', exampleVi: 'Đang được toàn thế giới chú ý.' },
        { word: '期待', reading: 'きたい', romaji: 'kitai', hanViet: 'KỲ ĐÃI', meaning: 'Kỳ vọng, mong đợi', exampleJp: '親の期待に応える。', exampleVi: 'Đáp lại sự kỳ vọng của bố mẹ.' }
      ]
    },

    // --- N2 ---
    {
      id: 'n2-tango',
      level: 'N2',
      levelTitle: 'Trình độ cao cấp',
      levelColor: '#ea580c',
      type: 'tango',
      title: 'N2',
      subTitle: 'Từ vựng nâng cao',
      totalWords: '2500 từ vựng',
      description: 'dành cho Kỳ thi Năng lực Nhật ngữ N2',
      bgColor: '#fb7185',
      strokeColor: '#9f1239',
      textColor: '#4c0519',
      sampleVocabs: [
        { word: '把握', reading: 'はあく', romaji: 'haaku', hanViet: 'BÁ ÁC', meaning: 'Nắm bắt, hiểu rõ', exampleJp: '現状を正確に把握する。', exampleVi: 'Nắm bắt chính xác tình hình hiện tại.' },
        { word: '柔軟', reading: 'じゅうなん', romaji: 'juunan', hanViet: 'NHU NHUYỄN', meaning: 'Linh hoạt, mềm dẻo', exampleJp: '柔軟な姿勢で対応する。', exampleVi: 'Ứng phó với thái độ linh hoạt.' }
      ]
    },
    {
      id: 'n2-mimikara',
      level: 'N2',
      levelTitle: 'Trình độ cao cấp',
      levelColor: '#ea580c',
      type: 'mimikara',
      title: 'N2',
      subTitle: 'Học từ vựng bằng tai',
      totalWords: '1160 từ vựng',
      description: 'Luyện từ vựng qua nghe N2',
      bgColor: '#ffffff',
      strokeColor: '#6b7280',
      textColor: '#047857',
      bannerColor: '#6ee7b7',
      hasHeadphones: true,
      sampleVocabs: [
        { word: '促進', reading: 'そくしん', romaji: 'sokushin', hanViet: 'XÚC TIẾN', meaning: 'Thúc đẩy, xúc tiến', exampleJp: '経済の活性化を促進する。', exampleVi: 'Thúc đẩy sự sôi động của nền kinh tế.' }
      ]
    },

    // --- N1 ---
    {
      id: 'n1-tango',
      level: 'N1',
      levelTitle: 'Trình độ siêu cấp',
      levelColor: '#dc2626',
      type: 'tango',
      title: 'N1',
      subTitle: 'Từ vựng nâng cao',
      totalWords: '3000 từ vựng',
      description: 'dành cho Kỳ thi Năng lực Nhật ngữ N1',
      bgColor: '#38bdf8',
      strokeColor: '#0369a1',
      textColor: '#082f49',
      sampleVocabs: [
        { word: '卓越', reading: 'たくえつ', romaji: 'takuetsu', hanViet: 'TRÁC VIỆT', meaning: 'Xuất chúng, vượt trội', exampleJp: '卓越した才能を発揮する。', exampleVi: 'Phát huy tài năng xuất chúng.' }
      ]
    },
    {
      id: 'n1-mimikara',
      level: 'N1',
      levelTitle: 'Trình độ siêu cấp',
      levelColor: '#dc2626',
      type: 'mimikara',
      title: 'N1',
      subTitle: 'Học từ vựng bằng tai',
      totalWords: '1170 từ vựng',
      description: 'Luyện từ vựng qua nghe N1',
      bgColor: '#ffffff',
      strokeColor: '#6b7280',
      textColor: '#1e3a8a',
      bannerColor: '#6ee7b7',
      hasHeadphones: true,
      sampleVocabs: [
        { word: '網羅', reading: 'もうら', romaji: 'moura', hanViet: 'VÕNG LA', meaning: 'Bao quát, bao hàm toàn diện', exampleJp: '最新の研究成果を網羅した書籍。', exampleVi: 'Cuốn sách bao hàm toàn diện thành quả nghiên cứu mới nhất.' }
      ]
    },
    {
      id: 'n1-tettei',
      level: 'N1',
      levelTitle: 'Trình độ siêu cấp',
      levelColor: '#dc2626',
      type: 'tettei',
      title: 'N1',
      subTitle: '徹底トレーニング N1 文字・語彙',
      totalWords: '4000 từ vựng',
      description: 'Luyện từ vựng N1 chuyên sâu',
      bgColor: '#ffffff',
      strokeColor: '#6b7280',
      textColor: '#0284c7',
      bannerColor: '#7dd3fc',
      isUpcoming: true,
      sampleVocabs: []
    },

    // --- SE ---
    {
      id: 'se-it',
      level: 'SE',
      levelTitle: 'Software Engineer',
      levelColor: '#292524',
      type: 'it',
      title: 'IT',
      subTitle: '技術情報の日本語',
      totalWords: '1200 thuật ngữ',
      description: 'Tiếng Nhật chuyên ngành Công nghệ thông tin',
      bgColor: '#ffffff',
      strokeColor: '#6b7280',
      textColor: '#292524',
      sampleVocabs: [
        { word: '開発', reading: 'かいはつ', romaji: 'kaihatsu', hanViet: 'KHAI PHÁT', meaning: 'Phát triển phần mềm', exampleJp: 'Webアプリケーションを開発する。', exampleVi: 'Phát triển ứng dụng Web.' },
        { word: '要件定義', reading: 'ようけんていぎ', romaji: 'youkenteigi', hanViet: 'YẾU KIỆN ĐỊNH NGHĨA', meaning: 'Định nghĩa yêu cầu (Requirement)', exampleJp: '顧客と要件定義を行う。', exampleVi: 'Thực hiện định nghĩa yêu cầu với khách hàng.' },
        { word: '設計書', reading: 'せっけいしょ', romaji: 'sekkeisho', hanViet: 'THIẾT KẾ THƯ', meaning: 'Tài liệu thiết kế', exampleJp: '詳細設計書を作成する。', exampleVi: 'Tạo tài liệu thiết kế chi tiết.' }
      ]
    }
  ];

  // Group curriculums by level
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1', 'SE'];

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-8 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Header Banner: Học Bản Chất - Không Học Vẹt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch flex flex-wrap items-center gap-2">
            <span className="bg-[#0094ff] text-white px-2.5 py-0.5 rounded-lg border border-[#292524] shadow-xs">
              Học Bản Chất
            </span>
            <span>–</span>
            <span className="relative underline decoration-amber-400 decoration-4 underline-offset-4">
              Không Học Vẹt
            </span>
          </h1>
        </div>

        <div className="text-xs md:text-sm font-bold text-[#57534e] space-y-1">
          <p>Không chỉ là nghĩa của từ mà là cách dùng đúng của từ trong câu ví dụ.</p>
          <p className="text-[#78716c]">
            Website này sẽ giúp bạn nắm được Kanji, âm Hán Việt, Accent của từ vựng và ghi nhớ lâu bằng flashcard (Spaced Repetition).
          </p>
        </div>
      </div>

      {/* Curriculum Levels Sections */}
      <div className="space-y-8">
        {levels.map((lvl) => {
          const items = curriculums.filter(c => c.level === lvl);
          if (!items.length) return null;

          const first = items[0];

          return (
            <div key={lvl} className="space-y-3">
              
              {/* Level Heading */}
              <div className="flex items-center gap-2">
                <div 
                  className="w-1.5 h-7 rounded-full" 
                  style={{ backgroundColor: first.levelColor }}
                />
                <div>
                  <div className="text-base font-black text-[#292524] leading-tight font-sketch">
                    {first.level}
                  </div>
                  <div className="text-[11px] font-bold text-[#78716c] leading-none">
                    {first.levelTitle}
                  </div>
                </div>
              </div>

              {/* Grid of Cards */}
              <div className={`grid gap-4 ${lvl === 'N1' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                {items.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCurriculum(c)}
                    className={`cursor-pointer group ${c.id === 'n1-tettei' ? 'md:col-span-2' : ''}`}
                  >
                    <RoughCard
                      fill={c.bgColor}
                      stroke={c.strokeColor || '#78716c'}
                      borderRadius={14}
                      roughness={0.7}
                      className="p-5 flex flex-col justify-between min-h-[140px] shadow-sketch transition-transform group-hover:scale-[1.015]"
                    >
                      {/* Top Row inside Card */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {c.hasHeadphones && (
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600">
                              <Headphones className="w-6 h-6 stroke-[2.2]" />
                            </div>
                          )}

                          <div>
                            <div className="text-xs font-bold text-[#57534e]">
                              {c.subTitle}
                            </div>
                            <div 
                              className="text-3xl font-black font-kanji tracking-tight"
                              style={{ color: c.textColor }}
                            >
                              {c.title}
                            </div>
                          </div>
                        </div>

                        {c.isUpcoming && (
                          <span className="bg-[#0094ff] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#292524] shadow-xs">
                            🚀 Sắp ra mắt
                          </span>
                        )}
                      </div>

                      {/* Bottom Banner inside Card */}
                      {c.bannerColor ? (
                        <div 
                          className="mt-3 py-1.5 px-3 rounded-lg flex items-center justify-between text-white font-bold text-xs"
                          style={{ backgroundColor: c.bannerColor }}
                        >
                          <span>{c.totalWords}</span>
                          <span className="text-[11px] opacity-90">{c.description}</span>
                        </div>
                      ) : (
                        <div className="mt-3 pt-2 border-t border-[#78716c]/20 flex items-center justify-between text-xs font-bold">
                          <span className="font-black" style={{ color: c.textColor }}>
                            {c.totalWords}
                          </span>
                          <span className="text-[#57534e] text-[11px]">
                            {c.description}
                          </span>
                        </div>
                      )}
                    </RoughCard>
                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* POPUP / MODAL VIEW FOR SELECTED CURRICULUM */}
      {/* ============================================================ */}
      {selectedCurriculum && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedCurriculum(null)}
        >
          <div 
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={16} roughness={0.7} className="p-6 shadow-2xl space-y-5 bg-white">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#78716c]/20 pb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black font-kanji text-white shadow-sm"
                    style={{ backgroundColor: selectedCurriculum.levelColor }}
                  >
                    {selectedCurriculum.title}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#292524] font-sketch">
                      {selectedCurriculum.subTitle} ({selectedCurriculum.totalWords})
                    </h3>
                    <p className="text-xs font-bold text-[#78716c]">
                      {selectedCurriculum.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCurriculum(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-[#57534e] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search in Curriculum */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm từ vựng, kanji, nghĩa tiếng Việt..."
                  className="w-full bg-[#fdfbf7] border border-[#78716c]/40 rounded-xl px-4 py-2 text-xs font-bold text-[#292524] focus:outline-none focus:border-[#0094ff]"
                />
                <Search className="w-4 h-4 text-[#78716c] absolute right-3 top-2.5" />
              </div>

              {/* Vocab List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {selectedCurriculum.sampleVocabs.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold text-[#78716c]">
                    Bộ giáo trình này đang được chuẩn bị và sẽ sớm ra mắt!
                  </div>
                ) : (
                  selectedCurriculum.sampleVocabs
                    .filter(v => 
                      v.word.includes(searchTerm) || 
                      v.reading.includes(searchTerm) || 
                      v.hanViet.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      v.meaning.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((item, idx) => (
                      <RoughCard 
                        key={idx} 
                        fill="#fdfbf7" 
                        stroke="#78716c" 
                        borderRadius={10} 
                        roughness={0.7} 
                        className="p-3.5 flex items-center justify-between gap-4 hover:bg-blue-50/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-kanji font-black text-[#292524]">
                              {item.word}
                            </span>
                            <span className="text-xs font-bold text-[#0094ff]">
                              {item.reading}
                            </span>
                            <span className="text-[11px] font-bold text-[#78716c] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {item.hanViet}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-[#57534e]">
                            {item.meaning}
                          </div>

                          <div className="text-[11px] text-[#78716c] italic">
                            VD: {item.exampleJp} — {item.exampleVi}
                          </div>
                        </div>

                        <button
                          onClick={() => speakJapanese(item.word)}
                          className="p-2.5 rounded-full bg-white border border-[#78716c]/40 text-[#0094ff] hover:scale-110 active:scale-95 transition-transform shrink-0 cursor-pointer shadow-2xs"
                          title="Nghe phát âm"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </RoughCard>
                    ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-[#78716c]/20 pt-3 text-xs font-bold">
                <span className="text-[#78716c]">
                  Hiển thị {selectedCurriculum.sampleVocabs.length} từ vựng tiêu biểu
                </span>
                <RoughButton
                  onClick={() => setSelectedCurriculum(null)}
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
