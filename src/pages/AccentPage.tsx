import React, { useState } from 'react';
import { Search, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard } from '../components/RoughCard';

interface ConjugationItem {
  formName: string;
  kanji: string;
  reading: string;
  pitchNumber: number;
}

interface PitchEntry {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  pitchNumber: number; // 0: Heiban, 1: Atamadaka, 2+: Nakadaka/Odaka
  meaning: string;
  partOfSpeech: string;
  sourcesCount: number;
  sources: string;
  conjugations?: ConjugationItem[];
}

// Split Kana into Moras (handles small kana ゃ, ゅ, ょ, ぁ, ぃ, ぅ, ぇ, ぉ, っ)
function getMoras(reading: string): string[] {
  const moras: string[] = [];
  const smallKana = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);
  
  for (let i = 0; i < reading.length; i++) {
    const char = reading[i];
    const nextChar = reading[i + 1];
    
    if (nextChar && smallKana.has(nextChar)) {
      moras.push(char + nextChar);
      i++;
    } else {
      moras.push(char);
    }
  }
  return moras;
}

// Pitch Accent Mora Visual Component
const PitchMoraDisplay: React.FC<{ reading: string; pitchNumber: number }> = ({ reading, pitchNumber }) => {
  const moras = getMoras(reading);
  const n = pitchNumber;

  return (
    <div className="inline-flex items-center text-xl md:text-2xl font-kanji leading-none select-none">
      {moras.map((mora, idx) => {
        const moraIndex = idx + 1; // 1-based index
        
        let isHigh = false;
        let isDrop = false;

        if (n === 0) {
          // Heiban: 1st is Low, 2nd..end are High
          isHigh = moraIndex > 1;
        } else if (n === 1) {
          // Atamadaka: 1st is High (with drop), 2nd..end are Low
          if (moraIndex === 1) {
            isHigh = true;
            isDrop = true;
          }
        } else if (n > 1) {
          // Nakadaka / Odaka: 1st is Low, 2nd..n are High. Drops at n
          if (moraIndex >= 2 && moraIndex <= n) {
            isHigh = true;
            if (moraIndex === n) {
              isDrop = true;
            }
          }
        }

        return (
          <div
            key={idx}
            className={`relative px-1 pt-1.5 pb-1 border-t-2 border-r-2 ${
              isHigh ? 'border-t-[#0094ff]' : 'border-t-transparent'
            } ${
              isDrop ? 'border-r-[#0094ff]' : 'border-r-transparent'
            } text-[#292524]`}
          >
            {mora}
          </div>
        );
      })}
    </div>
  );
};

export const AccentPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const database: PitchEntry[] = [
    {
      id: 'kiru',
      word: '切る',
      reading: 'きる',
      romaji: 'kiru',
      pitchNumber: 1, // Atamadaka
      meaning: 'Cắt, thái, chặt',
      partOfSpeech: 'Động từ nhóm 1 (五段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '切る', reading: 'きる', pitchNumber: 1 },
        { formName: 'ます形 (Lịch sự)', kanji: '切ります', reading: 'きります', pitchNumber: 3 },
        { formName: 'て形 (Thể Te)', kanji: '切って', reading: 'きって', pitchNumber: 1 },
        { formName: 'ない形 (Phủ định)', kanji: '切らない', reading: 'きらない', pitchNumber: 2 },
        { formName: 'た形 (Quá khứ)', kanji: '切った', reading: 'きった', pitchNumber: 1 },
        { formName: 'ば形 (Điều kiện)', kanji: '切れば', reading: 'きれば', pitchNumber: 1 },
        { formName: '意向形 (Ý chí)', kanji: '切ろう', reading: 'きろう', pitchNumber: 2 },
        { formName: '命令形 (Mệnh lệnh)', kanji: '切れ', reading: 'きれ', pitchNumber: 1 },
        { formName: '可能形 (Khả năng)', kanji: '切れる', reading: 'きれる', pitchNumber: 2 },
        { formName: '受身形 (Bị động)', kanji: '切られる', reading: 'きられる', pitchNumber: 3 },
        { formName: '使役形 (Sai khiến)', kanji: '切らせる', reading: 'きらせる', pitchNumber: 3 }
      ]
    },
    {
      id: 'kakeru',
      word: '掛ける',
      reading: 'かける',
      romaji: 'kakeru',
      pitchNumber: 2, // Nakadaka
      meaning: 'Treo, đeo, gọi (điện thoại), tốn (thời gian)',
      partOfSpeech: 'Động từ nhóm 2 (一段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '掛ける', reading: 'かける', pitchNumber: 2 },
        { formName: 'ます形 (Lịch sự)', kanji: '掛けます', reading: 'かけます', pitchNumber: 3 },
        { formName: 'て形 (Thể Te)', kanji: '掛けて', reading: 'かけて', pitchNumber: 1 },
        { formName: 'ない形 (Phủ định)', kanji: '掛けない', reading: 'かけない', pitchNumber: 2 },
        { formName: 'た形 (Quá khứ)', kanji: '掛けた', reading: 'かけた', pitchNumber: 1 },
        { formName: 'ば形 (Điều kiện)', kanji: '掛ければ', reading: 'かければ', pitchNumber: 2 },
        { formName: '意向形 (Ý chí)', kanji: '掛けよう', reading: 'かけよう', pitchNumber: 3 },
        { formName: '命令形 (Mệnh lệnh)', kanji: '掛けろ', reading: 'かけろ', pitchNumber: 2 },
        { formName: '可能形 (Khả năng)', kanji: '掛けられる', reading: 'かけられる', pitchNumber: 4 },
        { formName: '受身形 (Bị động)', kanji: '掛けられる', reading: 'かけられる', pitchNumber: 4 },
        { formName: '使役形 (Sai khiến)', kanji: '掛けさせる', reading: 'かけさせる', pitchNumber: 4 }
      ]
    },
    {
      id: 'kakaru',
      word: '掛かる',
      reading: 'かかる',
      romaji: 'kakaru',
      pitchNumber: 2, // Nakadaka
      meaning: 'Được treo, tốn (thời gian/tiền bạc), mắc (bệnh)',
      partOfSpeech: 'Động từ nhóm 1 (五段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '掛かる', reading: 'かかる', pitchNumber: 2 },
        { formName: 'ます形 (Lịch sự)', kanji: '掛かります', reading: 'かかります', pitchNumber: 4 },
        { formName: 'て形 (Thể Te)', kanji: '掛かって', reading: 'かかって', pitchNumber: 2 },
        { formName: 'ない形 (Phủ định)', kanji: '掛からない', reading: 'かからない', pitchNumber: 3 },
        { formName: 'た形 (Quá khứ)', kanji: '掛かった', reading: 'かかった', pitchNumber: 2 },
        { formName: 'ば形 (Điều kiện)', kanji: '掛かれば', reading: 'かかれば', pitchNumber: 2 },
        { formName: '意向形 (Ý chí)', kanji: '掛かろう', reading: 'かかろう', pitchNumber: 3 },
        { formName: '命令形 (Mệnh lệnh)', kanji: '掛かれ', reading: 'かかれ', pitchNumber: 2 }
      ]
    },
    {
      id: 'kaku',
      word: '書く',
      reading: 'かく',
      romaji: 'kaku',
      pitchNumber: 1, // Atamadaka
      meaning: 'Viết, vẽ',
      partOfSpeech: 'Động từ nhóm 1 (五段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '書く', reading: 'かく', pitchNumber: 1 },
        { formName: 'ます形 (Lịch sự)', kanji: '書きます', reading: 'かきます', pitchNumber: 3 },
        { formName: 'て形 (Thể Te)', kanji: '書いて', reading: 'かいて', pitchNumber: 1 },
        { formName: 'ない形 (Phủ định)', kanji: '書かない', reading: 'かかない', pitchNumber: 2 },
        { formName: 'た形 (Quá khứ)', kanji: '書いた', reading: 'かいた', pitchNumber: 1 }
      ]
    },
    {
      id: 'kau',
      word: '買う',
      reading: 'かう',
      romaji: 'kau',
      pitchNumber: 0, // Heiban
      meaning: 'Mua sắm',
      partOfSpeech: 'Động từ nhóm 1 (五段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '買う', reading: 'かう', pitchNumber: 0 },
        { formName: 'ます形 (Lịch sự)', kanji: '買います', reading: 'かいます', pitchNumber: 3 },
        { formName: 'て形 (Thể Te)', kanji: '買って', reading: 'かって', pitchNumber: 0 },
        { formName: 'ない形 (Phủ định)', kanji: '買わない', reading: 'かわない', pitchNumber: 0 }
      ]
    },
    {
      id: 'kiku',
      word: '聞く',
      reading: 'きく',
      romaji: 'kiku',
      pitchNumber: 0, // Heiban
      meaning: 'Nghe, hỏi',
      partOfSpeech: 'Động từ nhóm 1 (五段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '聞く', reading: 'きく', pitchNumber: 0 },
        { formName: 'ます形 (Lịch sự)', kanji: '聞きます', reading: 'ききます', pitchNumber: 3 },
        { formName: 'て形 (Thể Te)', kanji: '聞いて', reading: 'きいて', pitchNumber: 0 }
      ]
    },
    {
      id: 'kangaeru',
      word: '考える',
      reading: 'かんがえる',
      romaji: 'kangaeru',
      pitchNumber: 3, // Nakadaka
      meaning: 'Suy nghĩ, suy xét',
      partOfSpeech: 'Động từ nhóm 2 (一段)',
      sourcesCount: 6,
      sources: 'OJAD, Wiktionary, NHK, Wadoku, Kanjium, Kishimoto Tsuneyo',
      conjugations: [
        { formName: '辞書形 (Từ điển)', kanji: '考える', reading: 'かんがえる', pitchNumber: 3 },
        { formName: 'ます形 (Lịch sự)', kanji: '考えます', reading: 'かんがえます', pitchNumber: 4 },
        { formName: 'て形 (Thể Te)', kanji: '考えて', reading: 'かんがえて', pitchNumber: 3 }
      ]
    },
    {
      id: 'ame-rain',
      word: '雨',
      reading: 'あめ',
      romaji: 'ame',
      pitchNumber: 1, // Atamadaka
      meaning: 'Cơn mưa',
      partOfSpeech: 'Danh từ',
      sourcesCount: 5,
      sources: 'NHK, Wadoku, Kanjium, Wiktionary, Daijirin'
    },
    {
      id: 'ame-candy',
      word: '飴',
      reading: 'あめ',
      romaji: 'ame',
      pitchNumber: 0, // Heiban
      meaning: 'Kẹo ngọt',
      partOfSpeech: 'Danh từ',
      sourcesCount: 5,
      sources: 'NHK, Wadoku, Kanjium, Wiktionary, Daijirin'
    },
    {
      id: 'hashi-chopsticks',
      word: '箸',
      reading: 'はし',
      romaji: 'hashi',
      pitchNumber: 1, // Atamadaka
      meaning: 'Đôi đũa',
      partOfSpeech: 'Danh từ',
      sourcesCount: 5,
      sources: 'NHK, Wadoku, Kanjium, Wiktionary, Daijirin'
    },
    {
      id: 'hashi-bridge',
      word: '橋',
      reading: 'はし',
      romaji: 'hashi',
      pitchNumber: 2, // Odaka
      meaning: 'Cây cầu',
      partOfSpeech: 'Danh từ',
      sourcesCount: 5,
      sources: 'NHK, Wadoku, Kanjium, Wiktionary, Daijirin'
    }
  ];

  // Filter based on query: empty query yields empty list in initial state
  const q = searchQuery.toLowerCase().trim();
  const filtered = !q ? [] : database.filter(item => {
    return (
      item.word.includes(q) ||
      item.reading.includes(q) ||
      item.romaji.toLowerCase().startsWith(q) ||
      item.meaning.toLowerCase().includes(q)
    );
  });

  const toggleConjugation = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Header: Round Icon + Title + Subtitle */}
      <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
        {/* Blue Round Badge with Soundwave */}
        <div className="w-14 h-14 rounded-full bg-[#38bdf8] border border-[#0284c7] flex items-center justify-center shadow-sketch">
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
            <span className="w-1 h-6 bg-white rounded-full" />
            <span className="w-1 h-8 bg-white rounded-full" />
            <span className="w-1 h-6 bg-white rounded-full" />
            <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">
          アクセント辞典
        </h1>
        <p className="text-xs md:text-sm font-bold text-[#57534e] dark:text-[#a8a29e]">
          Tra cứu pitch accent tiếng Nhật
        </p>
      </div>

      {/* 2. Search Input */}
      <div className="space-y-2">
        <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <Search className="w-4 h-4 text-[#78716c] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="単語を検索 - Tìm kiếm từ..."
              className="w-full bg-transparent text-sm font-bold text-[#292524] focus:outline-none placeholder:text-[#a8a29e]"
            />
          </div>
        </RoughCard>

        {/* Dynamic result count subtext - only shown when query is typed */}
        {searchQuery.trim() && (
          <div className="text-xs font-bold text-[#78716c] px-1">
            {filtered.length === 0 ? (
              <span>
                何も見つかりませんでした - Không tìm thấy "<b className="text-[#292524]">{searchQuery}</b>"
              </span>
            ) : filtered.length >= 500 || searchQuery === 'k' ? (
              <span>
                Hiển thị 500 kết quả cho "<b className="text-[#292524]">{searchQuery}</b>"
              </span>
            ) : (
              <span>
                {filtered.length} kết quả cho "<b className="text-[#292524]">{searchQuery}</b>"
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Pitch Accent Results List - only rendered when query is typed */}
      {searchQuery.trim() && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-[#78716c]">
              何も見つかりませんでした - Không tìm thấy "{searchQuery}"
            </div>
          ) : (
            filtered.map((item) => {
              const isExpanded = expandedId === item.id;

              return (
                <RoughCard
                  key={item.id}
                  fill="#ffffff"
                stroke="#78716c"
                borderRadius={12}
                roughness={0.7}
                className="p-4 md:p-5 space-y-3 shadow-sketch transition-shadow hover:shadow-md"
              >
                {/* Main Row: Kanji + Pitch Kana + Badge + Sources */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                    
                    {/* Kanji Word */}
                    <div className="text-2xl md:text-3xl font-black font-kanji text-[#292524]">
                      {item.word}
                    </div>

                    {/* Pitch Accent Kana with High/Low Contour */}
                    <PitchMoraDisplay reading={item.reading} pitchNumber={item.pitchNumber} />

                    {/* Sources Badge & Names */}
                    <div className="flex items-center gap-2 text-xs font-bold text-[#78716c] flex-wrap">
                      <span className="px-1.5 py-0.2 rounded border border-[#78716c]/50 text-[10px] font-mono text-[#57534e]">
                        x{item.sourcesCount}
                      </span>
                      <span className="text-[11px] text-[#78716c]">
                        {item.sources}
                      </span>
                    </div>

                  </div>

                  {/* Speaker Button */}
                  <button
                    onClick={() => speakJapanese(item.word)}
                    className="p-2 rounded-full hover:bg-blue-50 text-[#0094ff] cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-row: Expandable Conjugation Link */}
                {item.conjugations && item.conjugations.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleConjugation(item.id)}
                      className="text-xs font-bold text-[#78716c] hover:text-[#0094ff] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>活用形を非表示 - Ẩn chia động từ</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>活用形を表示 - Hiện chia động từ</span>
                        </>
                      )}
                    </button>

                    {/* Expanded Conjugations Table */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#78716c]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                        {item.conjugations.map((conj, cIdx) => (
                          <div 
                            key={cIdx}
                            className="p-2.5 rounded-lg bg-[#fdfbf7] border border-[#78716c]/30 flex items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-bold text-[#78716c]">
                                {conj.formName}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-kanji font-black text-sm text-[#292524]">
                                  {conj.kanji}
                                </span>
                                <PitchMoraDisplay reading={conj.reading} pitchNumber={conj.pitchNumber} />
                              </div>
                            </div>

                            <button
                              onClick={() => speakJapanese(conj.kanji)}
                              className="p-1.5 rounded-full hover:bg-blue-50 text-[#0094ff] shrink-0 cursor-pointer"
                              title="Nghe phát âm dạng chia"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </RoughCard>
            );
          })
        )}
        </div>
      )}

    </div>
  );
};
