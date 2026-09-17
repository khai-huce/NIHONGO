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
  HelpCircle
} from 'lucide-react';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { useLearningSettings } from '../hooks/useLearningSettings';
import { speakJapanese } from '../utils/speech';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface SentenceItem {
  id: number;
  japanese: string;
  furiganaHtml: string;
  translation: string;
  durationSec: number;
}

export interface ParagraphItem {
  id: number;
  sentences: SentenceItem[];
}

export interface VocabItem {
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
}

export interface GrammarItem {
  pattern: string;
  jlptLevel: string;
  meaning: string;
  exampleJp: string;
  exampleVi: string;
}

export interface QuizItem {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ReadingArticle {
  id: string;
  title: string;
  subtitle: string;
  charCount: number;
  durationText: string;
  totalSeconds: number;
  isDemo: boolean;
  createdAt: string;
  paragraphs: ParagraphItem[];
  vocabList: VocabItem[];
  grammarList: GrammarItem[];
  quizList: QuizItem[];
}

// ---------------------------------------------------------------------------
// DEMO ARTICLE DATA: 単身世帯の増加 (Matching screenshots exactly)
// ---------------------------------------------------------------------------
const DEMO_ARTICLE: ReadingArticle = {
  id: 'demo-tan-shin-se-tai',
  title: '単身世帯の増加',
  subtitle: 'Hộ độc thân ngày càng tăng (bài mẫu)',
  charCount: 1261,
  durationText: '3:43',
  totalSeconds: 223,
  isDemo: true,
  createdAt: '2026-09-07',
  paragraphs: [
    {
      id: 1,
      sentences: [
        {
          id: 1,
          japanese: '最近の日本社会で最も目立つ変化の一つは、一人で暮らす人が急速に増えていることです。',
          furiganaHtml: '<ruby>最近<rt>さいきん</rt></ruby>の<ruby>日本社会<rt>にほんしゃかい</rt></ruby>で<ruby>最<rt>もっと</rt></ruby>も<ruby>目立<rt>めだ</rt></ruby>つ<ruby>変化<rt>へんか</rt></ruby>の<ruby>一<rt>ひと</rt></ruby>つは、<ruby>一人<rt>ひとり</rt></ruby>で<ruby>暮<rt>く</rt></ruby>らす<ruby>人<rt>ひと</rt></ruby>が<ruby>急速<rt>きゅうそく</rt></ruby>に<ruby>増<rt>ふ</rt></ruby>えていることです。',
          translation: 'Một trong những biến đổi nổi bật nhất trong xã hội Nhật Bản gần đây là số người sống một mình đang tăng lên nhanh chóng.',
          durationSec: 14
        },
        {
          id: 2,
          japanese: '統計によると、全世帯のうち単身世帯が占める割合はすでに三分の一を超えており、今後も増え続けると見られています。',
          furiganaHtml: '<ruby>統計<rt>とうけい</rt></ruby>によると、<ruby>全世帯<rt>ぜんせたい</rt></ruby>のうち<ruby>単身世帯<rt>たんしんせたい</rt></ruby>が<ruby>占<rt>し</rt></ruby>める<ruby>割合<rt>わりあい</rt></ruby>はすでに<ruby>三分の一<rt>さんぶんのいち</rt></ruby>を<ruby>超<rt>こ</rt></ruby>えており、<ruby>今後<rt>こんご</rt></ruby>も<ruby>増<rt>ふ</rt></ruby>え<ruby>続<rt>つづ</rt></ruby>けると<ruby>見<rt>み</rt></ruby>られています。',
          translation: 'Theo thống kê, tỷ lệ hộ gia đình đơn thân đã vượt quá một phần ba tổng số hộ gia đình và dự kiến sẽ tiếp tục tăng trong tương lai.',
          durationSec: 16
        },
        {
          id: 3,
          japanese: '一人でご飯を食べたり、一人で映画を見たり、一人で旅行に出かけたりする姿は、もう特別なことではありません。',
          furiganaHtml: '<ruby>一人<rt>ひとり</rt></ruby>でご<ruby>飯<rt>はん</rt></ruby>を<ruby>食<rt>た</rt></ruby>べたり、<ruby>一人<rt>ひとり</rt></ruby>で<ruby>映画<rt>えいが</rt></ruby>を<ruby>見<rt>み</rt></ruby>たり、<ruby>一人<rt>ひとり</rt></ruby>で<ruby>旅行<rt>りょこう</rt></ruby>に<ruby>出<rt>で</rt></ruby>かけたりする<ruby>姿<rt>すがた</rt></ruby>は、もう<ruby>特別<rt>とくべつ</rt></ruby>なことではありません。',
          translation: 'Hình ảnh một mình đi ăn cơm, một mình xem phim, hay một mình đi du lịch không còn là điều gì quá đặc biệt nữa.',
          durationSec: 15
        },
        {
          id: 4,
          japanese: '以前は一人で何かをする人を気の毒に思う視線が多かったのですが、最近の若い世代はむしろ一人だけの時間を楽しむことを自然な生活スタイルとして受け入れています。',
          furiganaHtml: '<ruby>以前<rt>いぜん</rt></ruby>は<ruby>一人<rt>ひとり</rt></ruby>で<ruby>何<rt>なに</rt></ruby>かを する<ruby>人<rt>ひと</rt></ruby>を<ruby>気<rt>き</rt></ruby>の<ruby>毒<rt>どく</rt></ruby>に<ruby>思<rt>おも</rt></ruby>う<ruby>視線<rt>しせん</rt></ruby>が<ruby>多<rt>おお</rt></ruby>かったのですが、<ruby>最近<rt>さいきん</rt></ruby>の<ruby>若<rt>わか</rt></ruby>い<ruby>世代<rt>せだい</rt></ruby>はむしろ<ruby>一人<rt>ひとり</rt></ruby>だけの<ruby>時間<rt>じかん</rt></ruby>を<ruby>楽<rt>たの</rt></ruby>しむことを<ruby>自然<rt>しぜん</rt></ruby>な<ruby>生活<rt>せいかつ</rt></ruby>スタイルとして<ruby>受<rt>う</rt></ruby>け<ruby>入<rt>い</rt></ruby>れています。',
          translation: 'Trước đây có nhiều ánh nhìn thương hại dành cho người làm việc gì đó một mình, nhưng thế hệ trẻ ngày nay lại đón nhận việc tận hưởng thời gian một mình như một phong cách sống tự nhiên.',
          durationSec: 20
        }
      ]
    },
    {
      id: 2,
      sentences: [
        {
          id: 5,
          japanese: '単身世帯が増える理由はさまざまです。',
          furiganaHtml: '<ruby>単身世帯<rt>たんしんせたい</rt></ruby>が<ruby>増<rt>ふ</rt></ruby>える<ruby>理由<rt>りゆう</rt></ruby>はさまざまです。',
          translation: 'Có nhiều nguyên nhân khác nhau dẫn đến việc các hộ gia đình đơn thân ngày càng gia tăng.',
          durationSec: 8
        },
        {
          id: 6,
          japanese: '結婚を遅らせたり、まったくしなかったりする人が多くなり、学業や仕事のために家族と離れて暮らす若者も増えました。',
          furiganaHtml: '<ruby>結婚<rt>けっこん</rt></ruby>を<ruby>遅<rt>おく</rt></ruby>らせたり、まったくしなかったりする<ruby>人<rt>ひと</rt></ruby>が<ruby>多<rt>おお</rt></ruby>くなり、<ruby>学業<rt>がくぎょう</rt></ruby>や<ruby>仕事<rt>しごと</rt></ruby>のために<ruby>家族<rt>かぞく</rt></ruby>と<ruby>離<rt>はな</rt></ruby>れて<ruby>暮<rt>く</rt></ruby>らす<ruby>若者<rt>わかもの</rt></ruby>も<ruby>増<rt>ふ</rt></ruby>えました。',
          translation: 'Ngày càng nhiều người kết hôn muộn hoặc không kết hôn, đồng thời số thanh niên sống xa gia đình vì học hành hay công việc cũng tăng lên.',
          durationSec: 16
        },
        {
          id: 7,
          japanese: '平均寿命が延びるにつれて、配偶者を先に見送り、一人残される高齢者も多くなりました。',
          furiganaHtml: '<ruby>平均寿命<rt>へいきんじゅみょう</rt></ruby>が<ruby>延<rt>の</rt></ruby>びるにつれて、<ruby>配偶者<rt>はいぐうしゃ</rt></ruby>を<ruby>先<rt>さき</rt></ruby>に<ruby>見送<rt>みおく</rt></ruby>り、<ruby>一人残<rt>ひとり残</rt></ruby>される<ruby>高齢者<rt>こうれいしゃ</rt></ruby>も<ruby>多<rt>おお</rt></ruby>くなりました。',
          translation: 'Khi tuổi thọ trung bình ngày càng kéo dài, số người cao tuổi tiễn biệt người bạn đời và ở lại một mình cũng nhiều hơn.',
          durationSec: 15
        },
        {
          id: 8,
          japanese: 'さらに、個人の自由やプライバシーを大切にする価値観の変化も大きな影響を与えました。',
          furiganaHtml: 'さらに、<ruby>個人<rt>こじん</rt></ruby>の<ruby>自由<rt>じゆう</rt></ruby>やプライバシーを<ruby>大切<rt>たいせつ</rt></ruby>にする<ruby>価値観<rt>かちかん</rt></ruby>の<ruby>変化<rt>へんか</rt></ruby>も<ruby>大<rt>おお</rt></ruby>きな<ruby>影響<rt>えいきょう</rt></ruby>を<ruby>与<rt>あた</rt></ruby>えました。',
          translation: 'Thêm vào đó, sự thay đổi trong hệ giá trị đề cao sự tự do cá nhân và quyền riêng tư cũng tạo nên ảnh hưởng to lớn.',
          durationSec: 14
        },
        {
          id: 9,
          japanese: '経済的に自立できる女性が増えたことも、重要な理由の一つに挙げられます。',
          furiganaHtml: '<ruby>経済的<rt>けいざいてき</rt></ruby>に<ruby>自立<rt>じりつ</rt></ruby>できる<ruby>女性<rt>じょせい</rt></ruby>が<ruby>増<rt>ふ</rt></ruby>えたことも、<ruby>重要<rt>じゅうよう</rt></ruby>な<ruby>理由<rt>りゆう</rt></ruby>の<ruby>一<rt>ひと</rt></ruby>つに<ruby>挙<rt>あ</rt></ruby>げられます。',
          translation: 'Việc ngày càng nhiều phụ nữ có khả năng tự chủ về kinh tế cũng được xem là một lý do quan trọng.',
          durationSec: 13
        }
      ]
    },
    {
      id: 3,
      sentences: [
        {
          id: 10,
          japanese: '「一人焼肉」や「一人カラオケ」という言葉が流行しているのも、この流れをよく示しています。',
          furiganaHtml: '「<ruby>一人焼肉<rt>ひとりやきにく</rt></ruby>」や「<ruby>一人<rt>ひとり</rt></ruby>カラオケ」という<ruby>言葉<rt>ことば</rt></ruby>が<ruby>流行<rt>りゅうこう</rt></ruby>しているのも、この<ruby>流<rt>なが</rt></ruby>れをよく<ruby>示<rt>しめ</rt></ruby>しています。',
          translation: 'Sự phổ biến của những từ như "ăn thịt nướng một mình" hay "karaoke một mình" cũng phản ánh rõ nét xu hướng này.',
          durationSec: 14
        },
        {
          id: 11,
          japanese: '一人で食事をすることはもう珍しい日常になり、飲食店も一人客のためのメニューや専用のカウンター席を充実させています。',
          furiganaHtml: '<ruby>一人<rt>ひとり</rt></ruby>で<ruby>食事<rt>しょくじ</rt></ruby>をすることはもう<ruby>珍<rt>めずら</rt></ruby>しい<ruby>日常<rt>にちじょう</rt></ruby>になり、<ruby>飲食店<rt>いんしょくてん</rt></ruby>も<ruby>一人客<rt>ひとりきゃく</rt></ruby>のためのメニューや<ruby>専用<rt>せんよう</rt></ruby>のカウンター<ruby>席<rt>せき</rt></ruby>を<ruby>充実<rt>じゅうじつ</rt></ruby>させています。',
          translation: 'Việc ăn một mình đã trở thành sinh hoạt quen thuộc hàng ngày, các quán ăn cũng bổ sung nhiều thực đơn và quầy ghế riêng cho khách đi một mình.',
          durationSec: 17
        },
        {
          id: 12,
          japanese: 'スーパーやコンビニでも、少量パックの総菜や個食向けの商品が売り場に並び、生活のあらゆる場面で「おひとりさま」を前提としたサービスが定着しつつあります。',
          furiganaHtml: 'スーパーやコンビニでも、<ruby>少量<rt>しょうりょう</rt></ruby>パックの<ruby>総菜<rt>そうざい</rt></ruby>や<ruby>個食向<rt>こしょくむ</rt></ruby>けの<ruby>商品<rt>しょうひん</rt></ruby>が<ruby>売<rt>う</rt></ruby>り<ruby>場<rt>ば</rt></ruby>に<ruby>並<rt>なら</rt></ruby>び、<ruby>生活<rt>せいかつ</rt></ruby>のあらゆる<ruby>場面<rt>ばめん</rt></ruby>で「おひとりさま」を<ruby>前提<rt>ぜんてい</rt></ruby>としたサービスが<ruby>定着<rt>ていちゃく</rt></ruby>しつつあります。',
          translation: 'Tại các siêu thị và cửa hàng tiện lợi, các hộp thức ăn nhỏ và mặt hàng dành cho một người được bày bán nhiều nơi, dịch vụ dành cho người một mình đang dần ăn sâu vào mọi khía cạnh đời sống.',
          durationSec: 20
        }
      ]
    },
    {
      id: 4,
      sentences: [
        {
          id: 13,
          japanese: '一方で、単身世帯の増加には課題も指摘されています。',
          furiganaHtml: '<ruby>一方<rt>いっぽう</rt></ruby>で、<ruby>単身世帯<rt>たんしんせたい</rt></ruby>の<ruby>増加<rt>ぞうか</rt></ruby>には<ruby>課題<rt>かだい</rt></ruby>も<ruby>指摘<rt>してき</rt></ruby>されています。',
          translation: 'Mặt khác, sự gia tăng hộ gia đình đơn thân cũng đi kèm với không ít vấn đề nan giải.',
          durationSec: 10
        },
        {
          id: 14,
          japanese: '病気のときや災害時の孤立、将来への経済的不安、そして社会的なつながりの希薄化などです。',
          furiganaHtml: '<ruby>病気<rt>びょうき</rt></ruby>のときや<ruby>災害時<rt>さいがいじ</rt></ruby>の<ruby>孤立<rt>こりつ</rt></ruby>、<ruby>将来<rt>しょうらい</rt></ruby>への<ruby>経済的不安<rt>けいざいてきふあん</rt></ruby>、そして<ruby>社会的<rt>しゃかいてき</rt></ruby>なつながりの<ruby>希薄化<rt>きはくか</rt></ruby>などです。',
          translation: 'Đó là nguy cơ cô lập lúc đau ốm hay khi xảy ra thiên tai, sự bất an về kinh tế trong tương lai, và sự suy giảm các mối liên kết xã hội.',
          durationSec: 15
        },
        {
          id: 15,
          japanese: '一人で生きる自由を享受しながらも、いざというときに助け合える緩やかなコミュニティや、地域社会の見守り体制をどう整えていくかが、これからの日本にとって大きなテーマとなっています。',
          furiganaHtml: '<ruby>一人<rt>ひとり</rt></ruby>で<ruby>生<rt>い</rt></ruby>きる<ruby>自由<rt>じゆう</rt></ruby>を<ruby>享受<rt>きょうじゅ</rt></ruby>しながらも、いざというときに<ruby>助<rt>たす</rt></ruby>け<ruby>合<rt>あ</rt></ruby>える<ruby>緩<rt>ゆる</rt></ruby>やかなコミュニティや、<ruby>地域社会<rt>ちいきしゃかい</rt></ruby>の<ruby>見守<rt>みまも</rt></ruby>り<ruby>体制<rt>たいせい</rt></ruby>をどう<ruby>整<rt>ととの</rt></ruby>えていくかが、これからの<ruby>日本<rt>にほん</rt></ruby>にとって<ruby>大<rt>おお</rt></ruby>きなテーマとなっています。',
          translation: 'Làm thế nào để vừa tận hưởng sự tự do sống một mình, vừa xây dựng được mạng lưới cộng đồng gắn kết để giúp đỡ nhau khi hoạn nạn đang là chủ đề lớn của xã hội Nhật Bản hiện nay.',
          durationSec: 26
        }
      ]
    }
  ],
  vocabList: [
    {
      word: '変化',
      reading: 'へんか',
      hanViet: 'BIẾN HÓA',
      meaning: 'sự thay đổi'
    },
    {
      word: '急速',
      reading: 'きゅうそく',
      hanViet: 'CẤP TỐC',
      meaning: 'nhanh chóng'
    },
    {
      word: '統計',
      reading: 'とうけい',
      hanViet: 'THỐNG KÊ',
      meaning: 'thống kê'
    },
    {
      word: '割合',
      reading: 'わりあい',
      hanViet: 'CÁT HỢP',
      meaning: 'tỷ lệ'
    },
    {
      word: '見られる',
      reading: 'みられる',
      hanViet: 'KIẾN',
      meaning: 'được thấy, được dự đoán'
    },
    {
      word: '特別な',
      reading: 'とくべつな',
      hanViet: 'ĐẶC BIỆT',
      meaning: 'đặc biệt'
    },
    {
      word: '単身世帯',
      reading: 'たんしんせたい',
      hanViet: 'ĐƠN THÂN THẾ ĐỚI',
      meaning: 'hộ gia đình đơn thân'
    },
    {
      word: '平均寿命',
      reading: 'へいきんじゅみょう',
      hanViet: 'BÌNH QUÂN THỌ MỆNH',
      meaning: 'tuổi thọ trung bình'
    },
    {
      word: '自立',
      reading: 'じりつ',
      hanViet: 'TỰ LẬP',
      meaning: 'tự lập, tự chủ kinh tế'
    },
    {
      word: '孤立',
      reading: 'こりつ',
      hanViet: 'CÔ LẬP',
      meaning: 'cô lập, tách biệt'
    }
  ],
  grammarList: [
    {
      pattern: '〜によって・〜による',
      jlptLevel: 'N2',
      meaning: 'Do / Bằng cách / Theo như',
      exampleJp: '統計によると、全世帯のうち単身世帯が占める割合はすでに三分の一を超えており、今後も増え続けると見られています。',
      exampleVi: 'Theo thống kê, tỷ lệ hộ gia đình đơn thân đã vượt quá một phần ba tổng số hộ gia đình và dự kiến sẽ tiếp tục tăng trong tương lai.'
    },
    {
      pattern: '〜として(は)',
      jlptLevel: 'N2',
      meaning: 'Với tư cách là / Như là',
      exampleJp: '最近の若い世代はむしろ一人だけの時間を楽しむことを自然な生活スタイルとして受け入れています。',
      exampleVi: 'Thế hệ trẻ gần đây chấp nhận việc tận hưởng khoảng thời gian một mình như một phong cách sống tự nhiên.'
    },
    {
      pattern: '〜につれて',
      jlptLevel: 'N2',
      meaning: 'Cùng với / Càng... càng...',
      exampleJp: '平均寿命が延びるにつれて、配偶者を先に見送り、一人残される高齢者も多くなりました。',
      exampleVi: 'Khi tuổi thọ trung bình ngày càng tăng, số lượng người cao tuổi tiễn biệt bạn đời và sống một mình cũng tăng lên.'
    },
    {
      pattern: '〜ながら(も)',
      jlptLevel: 'N2',
      meaning: 'Tuy... nhưng / Dù vậy',
      exampleJp: '一人で生きる自由を享受しながらも、いざというときに助け合える緩やかなコミュニティが必要です。',
      exampleVi: 'Dù đang tận hưởng sự tự do khi sống một mình, nhưng một cộng đồng gắn kết để giúp đỡ nhau khi hoạn nạn vẫn là điều cần thiết.'
    }
  ],
  quizList: [
    {
      id: 1,
      question: '筆者によると、単身世帯が増えている理由として適切でないものはどれか。',
      options: [
        '子供を持つことを諦める人が増えた。',
        '平均寿命が延びた。',
        '女性の経済的自立が進んだ。',
        '結婚を遅らせる人が増えた。'
      ],
      correctIndex: 0,
      explanation: 'Trong bài, tác giả nêu các lý do: kết hôn muộn hoặc không kết hôn, tuổi thọ tăng dẫn đến người già neo đơn, phụ nữ độc lập kinh tế, giá trị cá nhân riêng tư. Không hề nhắc đến việc "từ bỏ sinh con".'
    },
    {
      id: 2,
      question: 'この文章で筆者が最も言いたいことはどれか。',
      options: [
        '経済的な自立が一人暮らしの最大のメリットである。',
        '一人暮らしは孤独で寂しいものである。',
        '一人で暮らすことは必ずしも悪いことではない。',
        '単身世帯の増加は社会全体に大きな影響を与えている。'
      ],
      correctIndex: 3,
      explanation: 'Toàn bộ bài viết luận giải việc số lượng người sống một mình tăng lên tác động sâu rộng tới kinh doanh, tiêu dùng, dịch vụ và đặt ra bài toán hệ thống gắn kết cộng đồng cho toàn xã hội.'
    },
    {
      id: 3,
      question: 'この文章の内容と合っているものはどれか。',
      options: [
        '政府は単身世帯への支援を十分に行っている。',
        'コンビニでは一人用の席が用意され始めている。',
        '一人だけの時間を楽しむ若者が増えている。',
        '高齢者の単身世帯は今後減少すると予想されている。'
      ],
      correctIndex: 2,
      explanation: 'Khớp với câu trong bài: "最近の若い世代はむしろ一人だけの時間を楽しむことを自然な生活スタイルとして受け入れています".'
    }
  ]
};

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

export const DocHieuPage: React.FC = () => {
  // Current active article (null = creation/overview view, non-null = reading study view)
  const [currentArticle, setCurrentArticle] = useState<ReadingArticle | null>(DEMO_ARTICLE);

  // Custom user articles stored in localStorage
  const [userArticles, setUserArticles] = useState<ReadingArticle[]>(() => {
    try {
      const saved = localStorage.getItem('nhai_kanji_user_reading_articles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Textarea state for creating new article
  const [inputText, setInputText] = useState<string>('');
  const [isMethodAccordionOpen, setIsMethodAccordionOpen] = useState<boolean>(false);

  // Study view states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeSentenceId, setActiveSentenceId] = useState<number>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isLoopSentence, setIsLoopSentence] = useState<boolean>(false);
  const settings = useLearningSettings();
  const [speedOverride, setPlaybackSpeed] = useState<number | null>(null);
  const [furiganaOverride, setShowFurigana] = useState<boolean | null>(null);
  const playbackSpeed = speedOverride ?? settings.audioSpeed;
  const furiganaMode = furiganaOverride === null ? settings.showFurigana : furiganaOverride ? 'always' : 'never';
  const showFurigana = furiganaMode !== 'never';
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const loopRef = useRef(isLoopSentence);
  loopRef.current = isLoopSentence;
  const readingAreaRef = useRef<HTMLDivElement>(null);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);

  // Quiz state: { [questionId]: selectedOptionIndex }
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});

  // Audio timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save custom articles to localStorage
  useEffect(() => {
    localStorage.setItem('nhai_kanji_user_reading_articles', JSON.stringify(userArticles));
  }, [userArticles]);

  // Flattened sentences for audio playback synchronization
  const allSentences = currentArticle 
    ? currentArticle.paragraphs.flatMap(p => p.sentences) 
    : [];

  const activeSentence = allSentences.find(s => s.id === activeSentenceId) || allSentences[0];

  // Format seconds to mm:ss
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Each effect owns its speech request and loop timer. A speed change restarts
  // the current sentence; pause/navigation cancels pending callbacks as well.
  useEffect(() => {
    if (!isPlaying || !currentArticle) return;
    const sentences = currentArticle.paragraphs.flatMap(paragraph => paragraph.sentences);
    const index = Math.max(0, sentences.findIndex(sentence => sentence.id === activeSentenceId));
    const sentence = sentences[index];
    if (!sentence) {
      setIsPlaying(false);
      return;
    }
    let active = true;
    let loopTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = speakJapanese(sentence.japanese, playbackSpeed, {
      onEnd: () => {
        if (!active) return;
        if (loopRef.current) {
          loopTimer = setTimeout(() => {
            if (active) setPlaybackRevision(revision => revision + 1);
          }, 400);
        } else if (sentences[index + 1]) {
          setActiveSentenceId(sentences[index + 1].id);
        } else {
          setIsPlaying(false);
        }
      },
      onError: () => { if (active) setIsPlaying(false); },
    });
    return () => {
      active = false;
      clearTimeout(loopTimer);
      cancel();
    };
  }, [isPlaying, currentArticle, activeSentenceId, playbackSpeed, playbackRevision]);

  useEffect(() => {
    readingAreaRef.current?.querySelectorAll<HTMLElement>('ruby').forEach(ruby => {
      ruby.tabIndex = furiganaMode === 'hover' ? 0 : -1;
    });
  }, [furiganaMode, currentArticle]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (activeSentence) setIsPlaying(playing => !playing);
  };

  // Handle previous sentence
  const handlePrevSentence = () => {
    const currentIndex = allSentences.findIndex(s => s.id === activeSentenceId);
    if (currentIndex > 0) {
      const prevSentence = allSentences[currentIndex - 1];
      setActiveSentenceId(prevSentence.id);
    } else {
      if (activeSentence && isPlaying) {
        setPlaybackRevision(revision => revision + 1);
      }
    }
  };

  // Handle next sentence
  const handleNextSentence = () => {
    const currentIndex = allSentences.findIndex(s => s.id === activeSentenceId);
    if (currentIndex < allSentences.length - 1) {
      const nextSentence = allSentences[currentIndex + 1];
      setActiveSentenceId(nextSentence.id);
    } else {
      setIsPlaying(false);
    }
  };

  // Select a specific sentence directly by clicking it
  const handleSelectSentence = (sentence: SentenceItem) => {
    setActiveSentenceId(sentence.id);
    setPlaybackRevision(revision => revision + 1);
    setIsPlaying(true);
  };

  // Toggle speed
  const cyclePlaybackSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
  };

  // Timer ticker while playing to update timeline smoothly
  useEffect(() => {
    if (isPlaying && currentArticle) {
      timerRef.current = setInterval(() => {
        setCurrentTimeSec(prev => {
          if (prev >= currentArticle.totalSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, currentArticle]);

  // Use Sample Text button
  const handleUseSampleText = () => {
    const sample = `日本の四季にはそれぞれ特有の美しさがあります。春には桜が咲き誇り、多くの人々が公園で花見を楽しみます。夏は各地でお祭りや花火大会が開催され、浴衣を着た若者たちで街が賑わいます。秋になると紅葉が山々を美しく染め上げ、豊かな味覚を楽しむ季節となります。そして冬には雪景色が広がり、静かで厳かな雰囲気が漂います。このような季節の移り変わりを感じることは、日本人の心に深く根付いている伝統的な感性の一つです。`;
    setInputText(sample);
  };

  // Create new article from textarea
  const handleCreateArticle = () => {
    const text = inputText.trim();
    if (!text) {
      alert('Vui lòng dán một đoạn văn bản tiếng Nhật vào ô nhập!');
      return;
    }

    // Split text into rough sentences by Japanese full stop '。'
    const rawSentences = text
      .split('。')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const generatedSentences: SentenceItem[] = rawSentences.map((s, idx) => ({
      id: idx + 1,
      japanese: s + '。',
      furiganaHtml: s + '。',
      translation: `Câu ${idx + 1}: ${s}。`,
      durationSec: Math.max(5, Math.round(s.length * 0.4))
    }));

    const totalSecs = generatedSentences.reduce((acc, curr) => acc + curr.durationSec, 0);

    const newArticle: ReadingArticle = {
      id: `user-${Date.now()}`,
      title: rawSentences[0].slice(0, 16) + '...',
      subtitle: `Bài đọc tự tạo (${text.length} ký tự)`,
      charCount: text.length,
      durationText: formatTime(totalSecs),
      totalSeconds: totalSecs,
      isDemo: false,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      paragraphs: [
        {
          id: 1,
          sentences: generatedSentences
        }
      ],
      vocabList: [
        {
          word: '日本',
          reading: 'にほん',
          hanViet: 'NHẬT BẢN',
          meaning: 'nước Nhật Bản'
        },
        {
          word: '社会',
          reading: 'しゃかい',
          hanViet: 'XÃ HỘI',
          meaning: 'xã hội'
        },
        {
          word: '生活',
          reading: 'せいかつ',
          hanViet: 'SINH HOẠT',
          meaning: 'đời sống sinh hoạt'
        }
      ],
      grammarList: [
        {
          pattern: '〜について',
          jlptLevel: 'N3',
          meaning: 'Về vấn đề / Nói về...',
          exampleJp: text.slice(0, 60) + '...',
          exampleVi: 'Ví dụ ngữ pháp trích xuất từ bài đọc tự tạo.'
        }
      ],
      quizList: [
        {
          id: 1,
          question: 'この文章の主なテーマは何ですか。',
          options: [
            rawSentences[0] || 'Vấn đề chính của đoạn văn',
            'Một quan điểm trái ngược',
            'Không liên quan',
            'Nội dung khác'
          ],
          correctIndex: 0,
          explanation: 'Chủ đề chính được thể hiện rõ ở câu mở đầu đoạn văn.'
        }
      ]
    };

    setUserArticles(prev => [newArticle, ...prev]);
    setCurrentArticle(newArticle);
    setInputText('');
    setActiveSentenceId(1);
    setCurrentTimeSec(0);
    setIsPlaying(false);
  };

  // Delete a user article
  const handleDeleteUserArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa bài đọc này?')) {
      setUserArticles(prev => prev.filter(a => a.id !== id));
      if (currentArticle?.id === id) {
        setIsPlaying(false);
        setCurrentArticle(DEMO_ARTICLE);
      }
    }
  };

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
            Dán một đoạn văn hoặc bài báo tiếng Nhật — hệ thống tạo audio giọng bản xứ kèm bản dịch, audio đọc tới đâu chữ sáng tới đó để bạn luyện đọc theo kiểu shadowing.
          </p>
        </div>

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
                Xem trước kết quả: audio đọc chuẩn, bấm từng câu, bản dịch, câu hỏi & từ vựng — miễn phí, không tốn lượt.
              </p>

              {/* Demo Card */}
              <RoughCard
                fill="#ffffff"
                stroke="#292524"
                borderRadius={12}
                roughness={0.7}
                className="p-4 space-y-1.5 shadow-sketch cursor-pointer hover:bg-stone-50/70 transition-colors"
                onClick={() => {
                  setCurrentArticle(DEMO_ARTICLE);
                  setActiveSentenceId(1);
                  setCurrentTimeSec(0);
                  setIsPlaying(false);
                }}
              >
                <h3 className="text-sm md:text-base font-black text-[#292524] font-sketch">
                  {DEMO_ARTICLE.title}
                </h3>
                <p className="text-xs font-bold text-[#57534e]">
                  {DEMO_ARTICLE.subtitle}
                </p>
                <div className="text-[11px] font-bold text-[#78716c] pt-1">
                  {DEMO_ARTICLE.durationText} · {DEMO_ARTICLE.charCount} ký tự
                </div>
              </RoughCard>
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
                      onClick={() => {
                        setCurrentArticle(art);
                        setActiveSentenceId(1);
                        setCurrentTimeSec(0);
                        setIsPlaying(false);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-black text-[#292524] font-sketch line-clamp-1">
                          {art.title}
                        </h3>
                        <button
                          onClick={(e) => handleDeleteUserArticle(art.id, e)}
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
                        {art.durationText} · {art.charCount} ký tự · {art.createdAt}
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
                onChange={(e) => setInputText(e.target.value.slice(0, 3000))}
                placeholder="Dán một đoạn đọc ngắn, đoạn văn hoặc bài báo tiếng Nhật (tối đa 3000 ký tự) vào đây..."
                rows={12}
                className="w-full bg-transparent border-0 outline-none resize-y text-sm md:text-base text-[#292524] font-kanji placeholder:text-stone-400 focus:ring-0 leading-relaxed"
              />

              <div className="flex items-center justify-end text-xs font-bold text-stone-400 pt-2 border-t border-stone-200/60">
                <span>{inputText.length}/3000</span>
              </div>
            </RoughCard>

            {/* Bottom Actions: "Dùng văn bản mẫu" + "Tạo bài đọc" Button */}
            <div className="space-y-3 pt-1">
              <div>
                <button
                  onClick={handleUseSampleText}
                  className="text-xs font-bold text-[#78716c] hover:text-[#0094ff] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Dùng văn bản mẫu
                </button>
              </div>

              <RoughButton
                onClick={handleCreateArticle}
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
          Dán một đoạn văn hoặc bài báo tiếng Nhật — hệ thống tạo audio giọng bản xứ kèm bản dịch, audio đọc tới đâu chữ sáng tới đó để bạn luyện đọc theo kiểu shadowing.
        </p>
      </div>

      {/* 2. Sub-action bar: "Tạo bài đọc khác" + Demo badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            if (isPlaying) {
              setIsPlaying(false);
            }
            setCurrentArticle(null);
          }}
          className="px-3 py-1 rounded-lg border border-[#292524] bg-white hover:bg-stone-100 text-xs font-bold text-[#292524] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Tạo bài đọc khác</span>
        </button>

        {currentArticle.isDemo && (
          <span className="px-3 py-1 rounded-full border border-[#0094ff] bg-blue-50/70 text-xs font-black text-[#0094ff] flex items-center gap-1.5 shadow-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bài đọc mẫu (demo) · miễn phí</span>
          </span>
        )}
      </div>

      {/* 3. Audio Player Bar (Full width RoughCard) */}
      <RoughCard
        fill="#ffffff"
        stroke="#292524"
        borderRadius={14}
        roughness={0.7}
        className="p-4 md:p-5 shadow-sketch space-y-3"
      >
        {/* Timeline Slider */}
        <div className="flex items-center gap-3 text-xs font-black text-slate-600 font-mono">
          <span className="w-10 text-right">{formatTime(currentTimeSec)}</span>
          
          <div 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const targetSec = Math.round(ratio * currentArticle.totalSeconds);
              setCurrentTimeSec(targetSec);
              let acc = 0;
              for (const s of allSentences) {
                acc += s.durationSec;
                if (targetSec <= acc) {
                  setActiveSentenceId(s.id);
                  if (isPlaying) setPlaybackRevision(revision => revision + 1);
                  break;
                }
              }
            }}
            className="relative flex-1 h-2.5 border border-[#292524] rounded-full bg-stone-100 cursor-pointer overflow-hidden p-0.5"
          >
            <div 
              className="h-full bg-[#0094ff] rounded-full transition-all duration-200"
              style={{ width: `${(currentTimeSec / (currentArticle.totalSeconds || 1)) * 100}%` }}
            />
          </div>

          <span className="w-10">{currentArticle.durationText}</span>
        </div>

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          
          {/* Left Player Controls: Prev, Play/Pause, Next, Loop, Speed */}
          <div className="flex items-center gap-2">
            {/* Prev Sentence */}
            <button
              onClick={handlePrevSentence}
              className="w-8 h-8 border-sketch-subtle bg-white hover:bg-stone-100 text-[#292524] flex items-center justify-center transition-colors cursor-pointer"
              title="Câu trước"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause Button */}
            <RoughButton
              onClick={togglePlay}
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
              onClick={handleNextSentence}
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
            {currentArticle.paragraphs.map(p => (
              <div key={p.id} className="space-y-3 leading-relaxed text-[#292524] font-sans">
                {p.sentences.map(s => {
                  const isActive = s.id === activeSentenceId;

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSentence(s)}
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
                        <span
                          dangerouslySetInnerHTML={{ __html: s.furiganaHtml }}
                          className="ruby-container font-medium"
                        />
                      </div>

                      {/* Vietnamese Translation (Visible if toggle ON or on hover of active) */}
                      {(showTranslation || isActive) && (
                        <div className="text-xs md:text-sm font-bold text-slate-500 pt-1.5 animate-in fade-in duration-200">
                          {s.translation}
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
