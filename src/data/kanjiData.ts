import { KanjiItem } from '../types';

export const KANJI_DATABASE: KanjiItem[] = [
  // --- N5 KANJI ---
  {
    id: "k-1",
    kanji: "一",
    hanViet: "NHẤT",
    meaning: "Số một, đồng nhất",
    level: "N5",
    strokeCount: 1,
    radicals: ["一"],
    radicalParts: [
      { radical: "一", hanViet: "NHẤT", meaning: "Một nét ngang, số 1" }
    ],
    mnemonic: "Chỉ một nét gạch ngang đơn giản đại diện cho con số 1 khởi đầu vạn vật.",
    onyomi: ["イチ (ichi)", "イツ (itsu)"],
    kunyomi: ["ひと.つ (hito.tsu)", "ひと (hito)"],
    examples: [
      { word: "一つ", reading: "ひとつ (hitotsu)", meaning: "Một cái" },
      { word: "一日", reading: "ついたち (tsuitachi)", meaning: "Ngày mùng 1" },
      { word: "一人", reading: "ひとり (hitori)", meaning: "Một người, một mình" },
      { word: "一番", reading: "いちばん (ichiban)", meaning: "Số một, nhất" },
      { word: "一時", reading: "いちじ (ichiji)", meaning: "1 giờ" }
    ],
    frequency: 2
  },
  {
    id: "k-2",
    kanji: "二",
    hanViet: "NHỊ",
    meaning: "Số hai",
    level: "N5",
    strokeCount: 2,
    radicals: ["二"],
    radicalParts: [
      { radical: "二", hanViet: "NHỊ", meaning: "Hai nét gạch ngang" }
    ],
    mnemonic: "Hai nét gạch ngang song song biểu thị số 2.",
    onyomi: ["ニ (ni)", "ジ (ji)"],
    kunyomi: ["ふた.つ (futa.tsu)", "ふた (futa)"],
    examples: [
      { word: "二つ", reading: "ふたつ (futatsu)", meaning: "Hai cái" },
      { word: "二日", reading: "ふつか (futsuka)", meaning: "Ngày mùng 2 / hai ngày" },
      { word: "二人", reading: "ふたり (futari)", meaning: "Hai người" },
      { word: "二月", reading: "にがつ (nigatsu)", meaning: "Tháng 2" }
    ],
    frequency: 9
  },
  {
    id: "k-3",
    kanji: "三",
    hanViet: "TAM",
    meaning: "Số ba",
    level: "N5",
    strokeCount: 3,
    radicals: ["一"],
    radicalParts: [
      { radical: "一", hanViet: "NHẤT", meaning: "Nét ngang số một" }
    ],
    mnemonic: "Ba nét gạch ngang xếp chồng lên nhau tạo thành số 3.",
    onyomi: ["サン (san)"],
    kunyomi: ["み.っつ (mi.ttsu)", "み (mi)"],
    examples: [
      { word: "三つ", reading: "みっつ (mittsu)", meaning: "Ba cái" },
      { word: "三日", reading: "みっか (mikka)", meaning: "Ngày mùng 3" },
      { word: "三人", reading: "さんにん (sannin)", meaning: "Ba người" },
      { word: "三角", reading: "さんかく (sankaku)", meaning: "Tam giác" }
    ],
    frequency: 14
  },
  {
    id: "k-4",
    kanji: "四",
    hanViet: "TỨ",
    meaning: "Số bốn",
    level: "N5",
    strokeCount: 5,
    radicals: ["囗", "儿"],
    radicalParts: [
      { radical: "囗", hanViet: "VI", meaning: "Vây quanh, bao bọc" },
      { radical: "儿", hanViet: "NHÂN", meaning: "Người, đôi chân" }
    ],
    mnemonic: "Trong chiếc hộp 囗 có hai chân 儿 đang phân chia thành 4 góc.",
    onyomi: ["シ (shi)"],
    kunyomi: ["よ.っつ (yo.ttsu)", "よ (yo)", "よん (yon)"],
    examples: [
      { word: "四つ", reading: "よっつ (yottsu)", meaning: "Bốn cái" },
      { word: "四日", reading: "よっか (yokka)", meaning: "Ngày mùng 4" },
      { word: "四月", reading: "しがつ (shigatsu)", meaning: "Tháng 4" },
      { word: "四季", reading: "しき (shiki)", meaning: "Bốn mùa" }
    ],
    frequency: 45
  },
  {
    id: "k-5",
    kanji: "五",
    hanViet: "NGŨ",
    meaning: "Số năm",
    level: "N5",
    strokeCount: 4,
    radicals: ["二", "乂"],
    radicalParts: [
      { radical: "二", hanViet: "NHỊ", meaning: "Trời và Đất" },
      { radical: "乂", hanViet: "NGẢI", meaning: "Giao thoa" }
    ],
    mnemonic: "Giao thoa giữa Trời và Đất tạo nên Ngũ hành (Kim Mộc Thủy Hỏa Thổ).",
    onyomi: ["ゴ (go)"],
    kunyomi: ["いつ.つ (itsu.tsu)", "いつ (itsu)"],
    examples: [
      { word: "五つ", reading: "いつつ (itsutsu)", meaning: "Năm cái" },
      { word: "五日", reading: "いつか (itsuka)", meaning: "Ngày mùng 5" },
      { word: "五人", reading: "ごにん (gonin)", meaning: "Năm người" },
      { word: "五月", reading: "ごがつ (gogatsu)", meaning: "Tháng 5" }
    ],
    frequency: 31
  },
  {
    id: "k-6",
    kanji: "六",
    hanViet: "LỤC",
    meaning: "Số sáu",
    level: "N5",
    strokeCount: 4,
    radicals: ["亠", "八"],
    radicalParts: [
      { radical: "亠", hanViet: "ĐẦU", meaning: "Nắp che ở trên" },
      { radical: "八", hanViet: "BÁT", meaning: "Số 8 chia hai bên" }
    ],
    mnemonic: "Đội mũ 亠 trên đầu và dang 2 chân 八 hình số 6.",
    onyomi: ["ロク (roku)"],
    kunyomi: ["む.っつ (mu.ttsu)", "むい (mui)"],
    examples: [
      { word: "六つ", reading: "むっつ (muttsu)", meaning: "Sáu cái" },
      { word: "六日", reading: "むいか (muika)", meaning: "Ngày mùng 6" },
      { word: "六角形", reading: "ろっかくけい (rokkakukei)", meaning: "Hình lục giác" }
    ],
    frequency: 93
  },
  {
    id: "k-7",
    kanji: "七",
    hanViet: "THẤT",
    meaning: "Số bảy",
    level: "N5",
    strokeCount: 2,
    radicals: ["一"],
    radicalParts: [
      { radical: "一", hanViet: "NHẤT", meaning: "Nét ngang" }
    ],
    mnemonic: "Hình ảnh con số 7 đảo ngược có nét cắt chéo.",
    onyomi: ["シチ (shichi)"],
    kunyomi: ["なな.つ (nana.tsu)", "なな (nana)"],
    examples: [
      { word: "七つ", reading: "ななつ (nanatsu)", meaning: "Bảy cái" },
      { word: "七日", reading: "なのか (nanoka)", meaning: "Ngày mùng 7" },
      { word: "七月", reading: "しちがつ (shichigatsu)", meaning: "Tháng 7" }
    ],
    frequency: 115
  },
  {
    id: "k-8",
    kanji: "八",
    hanViet: "BÁT",
    meaning: "Số tám",
    level: "N5",
    strokeCount: 2,
    radicals: ["八"],
    radicalParts: [
      { radical: "八", hanViet: "BÁT", meaning: "Số 8" }
    ],
    mnemonic: "Hai nét mở rộng dần sang hai bên tượng trưng cho sự phát triển rộng mở.",
    onyomi: ["ハチ (hachi)"],
    kunyomi: ["や.っつ (ya.ttsu)", "よう (you)"],
    examples: [
      { word: "八つ", reading: "やっつ (yattsu)", meaning: "Tám cái" },
      { word: "八日", reading: "ようか (youka)", meaning: "Ngày mùng 8" },
      { word: "八百屋", reading: "やおや (yaoya)", meaning: "Cửa hàng rau quả" }
    ],
    frequency: 92
  },
  {
    id: "k-9",
    kanji: "九",
    hanViet: "CỬU",
    meaning: "Số chín",
    level: "N5",
    strokeCount: 2,
    radicals: ["九"],
    radicalParts: [
      { radical: "九", hanViet: "CỬU", meaning: "Số 9" }
    ],
    mnemonic: "Cánh tay co lại với các ngón tay đếm đến con số 9 tối cao.",
    onyomi: ["キュウ (kyuu)", "ク (ku)"],
    kunyomi: ["ここの.つ (kokono.tsu)", "ここの (kokono)"],
    examples: [
      { word: "九つ", reading: "ここのつ (kokonotsu)", meaning: "Chín cái" },
      { word: "九日", reading: "ここのか (kokonoka)", meaning: "Ngày mùng 9" },
      { word: "九州", reading: "きゅうしゅう (kyuushuu)", meaning: "Vùng Kyushu Nhật Bản" }
    ],
    frequency: 55
  },
  {
    id: "k-10",
    kanji: "十",
    hanViet: "THẬP",
    meaning: "Số mười, hoàn hảo",
    level: "N5",
    strokeCount: 2,
    radicals: ["十"],
    radicalParts: [
      { radical: "十", hanViet: "THẬP", meaning: "Chữ thập, số 10" }
    ],
    mnemonic: "Một nét ngang 一 và một nét dọc 丨 đan nhau tạo thành thập toàn thập mỹ.",
    onyomi: ["ジュウ (juu)", "ジッ (ji-)"],
    kunyomi: ["とお (too)", "と (to)"],
    examples: [
      { word: "十", reading: "とお (too)", meaning: "Mười cái" },
      { word: "十日", reading: "とおか (tooka)", meaning: "Ngày mùng 10" },
      { word: "十分", reading: "じゅうぶん (juubun)", meaning: "Đầy đủ, sung túc" }
    ],
    frequency: 8
  },
  {
    id: "k-11",
    kanji: "百",
    hanViet: "BÁCH",
    meaning: "Một trăm",
    level: "N5",
    strokeCount: 6,
    radicals: ["一", "白"],
    radicalParts: [
      { radical: "一", hanViet: "NHẤT", meaning: "Một nét gạch" },
      { radical: "白", hanViet: "BẠCH", meaning: "Màu trắng" }
    ],
    mnemonic: "Thêm một nét 一 lên trên chữ BẠCH 白 (trắng) sẽ thành chữ BÁCH 百 (100).",
    onyomi: ["ヒャク (hyaku)", "ビャク (byaku)"],
    kunyomi: ["もも (momo)"],
    examples: [
      { word: "百", reading: "ひゃく (hyaku)", meaning: "Một trăm" },
      { word: "三百", reading: "さんびゃく (sanbyaku)", meaning: "Ba trăm" },
      { word: "百科事典", reading: "ひゃっかじてん (hyakkajiten)", meaning: "Bách khoa toàn thư" }
    ],
    frequency: 150
  },
  {
    id: "k-12",
    kanji: "千",
    hanViet: "THIÊN",
    meaning: "Một nghìn",
    level: "N5",
    strokeCount: 3,
    radicals: ["十", "丿"],
    radicalParts: [
      { radical: "丿", hanViet: "PHIỆT", meaning: "Nét phẩy" },
      { radical: "十", hanViet: "THẬP", meaning: "Số 10" }
    ],
    mnemonic: "Nét phẩy đi qua số THẬP thể hiện số lượng gấp cả nghìn lần.",
    onyomi: ["セン (sen)"],
    kunyomi: ["ち (chi)"],
    examples: [
      { word: "千", reading: "せん (sen)", meaning: "Một nghìn" },
      { word: "三千", reading: "さんぜん (sanzen)", meaning: "Ba nghìn" },
      { word: "千葉", reading: "ちば (chiba)", meaning: "Tỉnh Chiba" }
    ],
    frequency: 195
  },
  {
    id: "k-13",
    kanji: "万",
    hanViet: "VẠN",
    meaning: "Mười nghìn, vạn",
    level: "N5",
    strokeCount: 3,
    radicals: ["一", "勹"],
    radicalParts: [
      { radical: "一", hanViet: "NHẤT", meaning: "Một" },
      { radical: "勹", hanViet: "BAO", meaning: "Gói bọc" }
    ],
    mnemonic: "Một 一 túi bao 勹 gom lại chứa đến 1 vạn (10.000) tiền xu.",
    onyomi: ["マン (man)", "バン (ban)"],
    kunyomi: ["よろず (yorozu)"],
    examples: [
      { word: "一万", reading: "いちまん (ichiman)", meaning: "Một vạn (10.000)" },
      { word: "万一", reading: "まんいち (manichi)", meaning: "Vạn nhất, lỡ như" },
      { word: "万歳", reading: "ばんざい (banzai)", meaning: "Vạn tuế!" }
    ],
    frequency: 375
  },
  {
    id: "k-14",
    kanji: "日",
    hanViet: "NHẬT",
    meaning: "Mặt trời, ngày, Nhật Bản",
    level: "N5",
    strokeCount: 4,
    radicals: ["日"],
    radicalParts: [
      { radical: "日", hanViet: "NHẬT", meaning: "Mặt trời, ban ngày" }
    ],
    mnemonic: "Hình ảnh mặt trời hình chữ nhật với tia sáng xuyên qua tâm.",
    onyomi: ["ニチ (nichi)", "ジツ (jitsu)"],
    kunyomi: ["ひ (hi)", "-び (-bi)", "-か (-ka)"],
    examples: [
      { word: "日本", reading: "にほん (nihon)", meaning: "Nhật Bản" },
      { word: "日曜日", reading: "にちようび (nichiyoubi)", meaning: "Chủ nhật" },
      { word: "毎日", reading: "まいにち (mainichi)", meaning: "Mỗi ngày" },
      { word: "日光", reading: "にっこう (nikkou)", meaning: "Ánh nắng mặt trời" }
    ],
    frequency: 1
  },
  {
    id: "k-15",
    kanji: "月",
    hanViet: "NGUYỆT",
    meaning: "Mặt trăng, tháng",
    level: "N5",
    strokeCount: 4,
    radicals: ["月"],
    radicalParts: [
      { radical: "月", hanViet: "NGUYỆT", meaning: "Mặt trăng" }
    ],
    mnemonic: "Hình ảnh vầng trăng khuyết treo lơ lửng trên bầu trời đêm.",
    onyomi: ["ゲツ (getsu)", "ガツ (gatsu)"],
    kunyomi: ["つき (tsuki)"],
    examples: [
      { word: "月曜日", reading: "げつようび (getsuyoubi)", meaning: "Thứ hai" },
      { word: "今月", reading: "こんげつ (kongetsu)", meaning: "Tháng này" },
      { word: "一月", reading: "いちがつ (ichigatsu)", meaning: "Tháng 1" },
      { word: "満月", reading: "まんげつ (mangetsu)", meaning: "Trăng rằm" }
    ],
    frequency: 23
  },
  {
    id: "k-16",
    kanji: "火",
    hanViet: "HỎA",
    meaning: "Lửa, hỏa",
    level: "N5",
    strokeCount: 4,
    radicals: ["火"],
    radicalParts: [
      { radical: "火", hanViet: "HỎA", meaning: "Ngọn lửa bốc cháy" }
    ],
    mnemonic: "Đốm lửa đang bùng cháy với hai tia lửa văng ra hai bên.",
    onyomi: ["カ (ka)"],
    kunyomi: ["ひ (hi)", "ほ (ho)"],
    examples: [
      { word: "火曜日", reading: "かようび (kayoubi)", meaning: "Thứ ba" },
      { word: "火山", reading: "かざん (kazan)", meaning: "Núi lửa" },
      { word: "火事", reading: "かじ (kaji)", meaning: "Hỏa hoạn" },
      { word: "花火", reading: "はなび (hanabi)", meaning: "Pháo hoa" }
    ],
    frequency: 574
  },
  {
    id: "k-17",
    kanji: "水",
    hanViet: "THỦY",
    meaning: "Nước",
    level: "N5",
    strokeCount: 4,
    radicals: ["水"],
    radicalParts: [
      { radical: "水", hanViet: "THỦY", meaning: "Dòng nước" }
    ],
    mnemonic: "Dòng nước chảy ở giữa với các giọt nước bắn tung tóe hai bên.",
    onyomi: ["スイ (sui)"],
    kunyomi: ["みず (mizu)"],
    examples: [
      { word: "水曜日", reading: "すいようび (suiyoubi)", meaning: "Thứ tư" },
      { word: "水", reading: "みず (mizu)", meaning: "Nước" },
      { word: "水泳", reading: "すいえい (suiei)", meaning: "Bơi lội" },
      { word: "水道", reading: "すいどう (suidou)", meaning: "Đường ống nước" }
    ],
    frequency: 223
  },
  {
    id: "k-18",
    kanji: "木",
    hanViet: "MỘC",
    meaning: "Cây, gỗ",
    level: "N5",
    strokeCount: 4,
    radicals: ["木"],
    radicalParts: [
      { radical: "木", hanViet: "MỘC", meaning: "Cây cối" }
    ],
    mnemonic: "Hình ảnh cái cây với thân thẳng đứng, cành lá tỏa ngang và rễ cắm sâu.",
    onyomi: ["モク (moku)", "ボク (boku)"],
    kunyomi: ["き (ki)", "こ- (ko-)"],
    examples: [
      { word: "木曜日", reading: "もくようび (mokuyoubi)", meaning: "Thứ năm" },
      { word: "木", reading: "き (ki)", meaning: "Cây cối" },
      { word: "木造", reading: "もくぞう (mokuzou)", meaning: "Làm bằng gỗ" }
    ],
    frequency: 317
  },
  {
    id: "k-19",
    kanji: "金",
    hanViet: "KIM",
    meaning: "Vàng, tiền, kim loại",
    level: "N5",
    strokeCount: 8,
    radicals: ["金"],
    radicalParts: [
      { radical: "人", hanViet: "NHÂN", meaning: "Người, mái che" },
      { radical: "王", hanViet: "VƯƠNG", meaning: "Vua, vàng ngọc" }
    ],
    mnemonic: "Dưới mái nhà 人 của Vua 王 cất giữ những quặng vàng KIM quý báu.",
    onyomi: ["キン (kin)", "コン (kon)"],
    kunyomi: ["かね (kane)", "かな- (kana-)"],
    examples: [
      { word: "金曜日", reading: "きんようび (kinyoubi)", meaning: "Thứ sáu" },
      { word: "お金", reading: "おかね (okane)", meaning: "Tiền bạc" },
      { word: "金色", reading: "きんいろ (kiniro)", meaning: "Màu vàng kim" }
    ],
    frequency: 51
  },
  {
    id: "k-20",
    kanji: "土",
    hanViet: "THỔ",
    meaning: "Đất, thổ nhưỡng",
    level: "N5",
    strokeCount: 3,
    radicals: ["土"],
    radicalParts: [
      { radical: "土", hanViet: "THỔ", meaning: "Đất" }
    ],
    mnemonic: "Mầm cây nhú lên từ mặt đất THỔ màu mỡ.",
    onyomi: ["ド (do)", "ト (to)"],
    kunyomi: ["つち (tsuchi)"],
    examples: [
      { word: "土曜日", reading: "どようび (doyoubi)", meaning: "Thứ bảy" },
      { word: "土地", reading: "とち (tochi)", meaning: "Khu đất, mảnh đất" },
      { word: "お土産", reading: "おみやげ (omiyage)", meaning: "Quà lưu niệm" }
    ],
    frequency: 308
  },
  {
    id: "k-21",
    kanji: "人",
    hanViet: "NHÂN",
    meaning: "Con người, nhân loại",
    level: "N5",
    strokeCount: 2,
    radicals: ["人"],
    radicalParts: [
      { radical: "人", hanViet: "NHÂN", meaning: "Con người" }
    ],
    mnemonic: "Hình ảnh hai chân người vững chãi nương tựa vào nhau mà đứng vững.",
    onyomi: ["ジン (jin)", "ニン (nin)"],
    kunyomi: ["ひと (hito)"],
    examples: [
      { word: "日本人", reading: "にほんじん (nihonjin)", meaning: "Người Nhật Bản" },
      { word: "ベトナム人", reading: "べとなむじん (betonamujin)", meaning: "Người Việt Nam" },
      { word: "大人", reading: "おとな (otona)", meaning: "Người lớn" },
      { word: "人気", reading: "にんき (ninki)", meaning: "Được yêu thích, nổi tiếng" }
    ],
    frequency: 5
  },
  {
    id: "k-22",
    kanji: "休",
    hanViet: "HƯU",
    meaning: "Nghỉ ngơi, ngừng",
    level: "N5",
    strokeCount: 6,
    radicals: ["亻", "木"],
    radicalParts: [
      { radical: "亻", hanViet: "NHÂN ĐỨNG", meaning: "Con người" },
      { radical: "木", hanViet: "MỘC", meaning: "Cây cối" }
    ],
    mnemonic: "Người (亻) tựa lưng vào gốc cây (木) để Nghỉ ngơi (HƯU).",
    onyomi: ["キュウ (kyuu)"],
    kunyomi: ["やす.む (yasu.mu)", "やす.まる (yasu.maru)"],
    examples: [
      { word: "休み", reading: "やすみ (yasumi)", meaning: "Ngày nghỉ, giờ nghỉ" },
      { word: "休日", reading: "きゅうじつ (kyuujitsu)", meaning: "Ngày nghỉ lễ" },
      { word: "夏休み", reading: "なつやすみ (natsuyasumi)", meaning: "Kỳ nghỉ hè" },
      { word: "休憩", reading: "きゅうけい (kyuukei)", meaning: "Nghỉ giải lao" }
    ],
    frequency: 641
  },
  {
    id: "k-23",
    kanji: "体",
    hanViet: "THỂ",
    meaning: "Cơ thể, thân thể",
    level: "N5",
    strokeCount: 7,
    radicals: ["亻", "本"],
    radicalParts: [
      { radical: "亻", hanViet: "NHÂN ĐỨNG", meaning: "Người" },
      { radical: "本", hanViet: "BẢN", meaning: "Gốc rễ, cội nguồn" }
    ],
    mnemonic: "Gốc rễ (本) của mỗi con người (亻) chính là Cơ thể (THỂ) khỏe mạnh.",
    onyomi: ["タイ (tai)", "テイ (tei)"],
    kunyomi: ["からだ (karada)"],
    examples: [
      { word: "体", reading: "からだ (karada)", meaning: "Cơ thể" },
      { word: "体重", reading: "たいじゅう (taijuu)", meaning: "Cân nặng" },
      { word: "体操", reading: "たいそう (taisou)", meaning: "Thể dục" }
    ],
    frequency: 88
  },
  {
    id: "k-24",
    kanji: "何",
    hanViet: "HÀ",
    meaning: "Cái gì, bao nhiêu",
    level: "N5",
    strokeCount: 7,
    radicals: ["亻", "可"],
    radicalParts: [
      { radical: "亻", hanViet: "NHÂN ĐỨNG", meaning: "Người" },
      { radical: "可", hanViet: "KHẢ", meaning: "Khả năng, cho phép" }
    ],
    mnemonic: "Người (亻) vác trên vai vật gì có thể (可) ăn được không?",
    onyomi: ["カ (ka)"],
    kunyomi: ["なに (nani)", "なん (nan)"],
    examples: [
      { word: "何", reading: "なに / なん (nani/nan)", meaning: "Cái gì" },
      { word: "何時", reading: "なんじ (nanji)", meaning: "Mấy giờ" },
      { word: "何人", reading: "なんにん (nannin)", meaning: "Mấy người" },
      { word: "何回", reading: "なんかい (nankai)", meaning: "Mấy lần" }
    ],
    frequency: 340
  },
  {
    id: "k-25",
    kanji: "学",
    hanViet: "HỌC",
    meaning: "Học tập, trường học",
    level: "N5",
    strokeCount: 8,
    radicals: ["⺍", "冖", "子"],
    radicalParts: [
      { radical: "⺍", hanViet: "TIỂU", meaning: "Tia sáng tri thức" },
      { radical: "冖", hanViet: "MỊCH", meaning: "Mái nhà, trường học" },
      { radical: "子", hanViet: "TỬ", meaning: "Đứa trẻ" }
    ],
    mnemonic: "Đứa trẻ (子) ngồi dưới mái trường (冖) tiếp thu những tia sáng tri thức là đang Học (HỌC).",
    onyomi: ["ガク (gaku)"],
    kunyomi: ["まな.ぶ (mana.bu)"],
    examples: [
      { word: "学校", reading: "がっこう (gakkou)", meaning: "Trường học" },
      { word: "学生", reading: "がくせい (gakusei)", meaning: "Học sinh, sinh viên" },
      { word: "大学", reading: "だいがく (daigaku)", meaning: "Đại học" },
      { word: "学ぶ", reading: "まなぶ (manabu)", meaning: "Học hỏi" }
    ],
    frequency: 68
  },
  {
    id: "k-26",
    kanji: "校",
    hanViet: "HIỆU",
    meaning: "Trường học",
    level: "N5",
    strokeCount: 10,
    radicals: ["木", "交"],
    radicalParts: [
      { radical: "木", hanViet: "MỘC", meaning: "Cây cối, gỗ" },
      { radical: "交", hanViet: "GIAO", meaning: "Giao lưu, gặp gỡ" }
    ],
    mnemonic: "Nơi có bóng cây xanh (木) cho học sinh giao lưu (交) gặp gỡ chính là Trường học (HIỆU).",
    onyomi: ["コウ (kou)"],
    kunyomi: [],
    examples: [
      { word: "高校", reading: "こうこう (koukou)", meaning: "Trường cấp 3" },
      { word: "校長", reading: "こうちょう (kouchou)", meaning: "Hiệu trưởng" },
      { word: "校舎", reading: "こうしゃ (kousha)", meaning: "Khu giảng đường" }
    ],
    frequency: 187
  },
  {
    id: "k-27",
    kanji: "先",
    hanViet: "TIÊN",
    meaning: "Trước, đi trước",
    level: "N5",
    strokeCount: 6,
    radicals: ["牛", "儿"],
    radicalParts: [
      { radical: "牛", hanViet: "NGƯU", meaning: "Con bò" },
      { radical: "儿", hanViet: "NHÂN", meaning: "Đôi chân bước" }
    ],
    mnemonic: "Người dắt con bò đi trước tiên trên đường.",
    onyomi: ["セン (sen)"],
    kunyomi: ["さき (saki)", "ま.ず (ma.zu)"],
    examples: [
      { word: "先生", reading: "せんせい (sensei)", meaning: "Thầy cô giáo" },
      { word: "先月", reading: "せんげつ (sengetsu)", meaning: "Tháng trước" },
      { word: "お先に", reading: "おさきに (osakini)", meaning: "Tôi xin phép trước" }
    ],
    frequency: 172
  },
  {
    id: "k-28",
    kanji: "生",
    hanViet: "SINH",
    meaning: "Sinh sống, sinh ra, tươi sống",
    level: "N5",
    strokeCount: 5,
    radicals: ["生"],
    radicalParts: [
      { radical: "生", hanViet: "SINH", meaning: "Mầm sống đâm chồi" }
    ],
    mnemonic: "Mầm cây vươn mình đâm chồi sinh sôi nảy nở trên mặt đất.",
    onyomi: ["セイ (sei)", "ショウ (shou)"],
    kunyomi: ["い.きる (i.kiru)", "う.まれる (u.mareru)", "なま (nama)"],
    examples: [
      { word: "生活", reading: "せいかつ (seikatsu)", meaning: "Cuộc sống sinh hoạt" },
      { word: "生まれる", reading: "うまれる (umareru)", meaning: "Được sinh ra" },
      { word: "生ビール", reading: "なまビール (namabiiru)", meaning: "Bia tươi" },
      { word: "誕生日", reading: "たんじょうび (tanjoubi)", meaning: "Sinh nhật" }
    ],
    frequency: 29
  },

  // --- N4 KANJI SAMPLES ---
  {
    id: "k-101",
    kanji: "旅",
    hanViet: "LỮ",
    meaning: "Du lịch, hành trình",
    level: "N4",
    strokeCount: 10,
    radicals: ["方", "𠂉", "氏"],
    radicalParts: [
      { radical: "方", hanViet: "PHƯƠNG", meaning: "Lá cờ, phương hướng" },
      { radical: "𠂉", hanViet: "NHÂN", meaning: "Người" }
    ],
    mnemonic: "Đoàn người (𠂉) cầm cờ (方) chỉ phương hướng cùng nhau đi du lịch (LỮ).",
    onyomi: ["リョ (ryo)"],
    kunyomi: ["たび (tabi)"],
    examples: [
      { word: "旅行", reading: "りょこう (ryokou)", meaning: "Du lịch" },
      { word: "旅", reading: "たび (tabi)", meaning: "Chuyến đi" },
      { word: "旅館", reading: "りょかん (ryokan)", meaning: "Nhà trọ truyền thống kiểu Nhật" }
    ],
    frequency: 602
  },
  {
    id: "k-102",
    kanji: "館",
    hanViet: "QUÁN",
    meaning: "Tòa nhà, hội quán, bảo tàng",
    level: "N4",
    strokeCount: 16,
    radicals: ["食", "官"],
    radicalParts: [
      { radical: "食", hanViet: "THỰC", meaning: "Ăn uống" },
      { radical: "官", hanViet: "QUAN", meaning: "Quan lại, công sở" }
    ],
    mnemonic: "Nơi quan lại (官) thường tụ tập ăn uống (食) chính là Hội quán (QUÁN).",
    onyomi: ["カン (kan)"],
    kunyomi: ["やかた (yakata)"],
    examples: [
      { word: "図書館", reading: "としょかん (toshokan)", meaning: "Thư viện" },
      { word: "映画館", reading: "えいがかん (eigakan)", meaning: "Rạp chiếu phim" },
      { word: "美術館", reading: "びじゅつかん (bijutsukan)", meaning: "Bảo tàng mỹ thuật" }
    ],
    frequency: 489
  },
  {
    id: "k-103",
    kanji: "働",
    hanViet: "ĐỘNG",
    meaning: "Làm việc, lao động",
    level: "N4",
    strokeCount: 13,
    radicals: ["亻", "動"],
    radicalParts: [
      { radical: "亻", hanViet: "NHÂN ĐỨNG", meaning: "Người" },
      { radical: "動", hanViet: "ĐỘNG", meaning: "Hoạt động, cử động" }
    ],
    mnemonic: "Người (亻) liên tục vận động (動) chân tay để làm việc kiếm sống (ĐỘNG).",
    onyomi: ["ドウ (dou)"],
    kunyomi: ["はたら.く (hatara.ku)"],
    examples: [
      { word: "働く", reading: "はたらく (hataraku)", meaning: "Làm việc" },
      { word: "労働", reading: "ろうどう (roudou)", meaning: "Lao động" },
      { word: "働き者", reading: "はたらきもの (hatarakimono)", meaning: "Người chăm chỉ làm lụng" }
    ],
    frequency: 412
  },

  // --- N3 KANJI SAMPLES ---
  {
    id: "k-201",
    kanji: "想",
    hanViet: "TƯỞNG",
    meaning: "Tư tưởng, suy nghĩ, tưởng tượng",
    level: "N3",
    strokeCount: 13,
    radicals: ["相", "心"],
    radicalParts: [
      { radical: "相", hanViet: "TƯƠNG", meaning: "Hình ảnh, hỗ tương" },
      { radical: "心", hanViet: "TÂM", meaning: "Trái tim, tâm trí" }
    ],
    mnemonic: "Khắc ghi hình ảnh (相) người thương trong trái tim (心) để nhung nhớ và tưởng tượng (TƯỞNG).",
    onyomi: ["ソウ (sou)", "ソ (so)"],
    kunyomi: ["おも.う (omo.u)"],
    examples: [
      { word: "想像", reading: "そうぞう (souzou)", meaning: "Tưởng tượng" },
      { word: "理想", reading: "りそう (risou)", meaning: "Lý tưởng" },
      { word: "感想", reading: "かんそう (kansou)", meaning: "Cảm nghĩ" }
    ],
    frequency: 156
  },
  {
    id: "k-202",
    kanji: "恋",
    hanViet: "LUYẾN",
    meaning: "Tình yêu đôi lứa, lưu luyến",
    level: "N3",
    strokeCount: 10,
    radicals: ["亦", "心"],
    radicalParts: [
      { radical: "亦", hanViet: "DIỆC", meaning: "Cũng là" },
      { radical: "心", hanViet: "TÂM", meaning: "Trái tim" }
    ],
    mnemonic: "Khi trái tim (心) bị cuốn vào những sợi dây vương vấn không dứt chính là Tình yêu (LUYẾN).",
    onyomi: ["レン (ren)"],
    kunyomi: ["こい (koi)", "こい.しい (koi.shii)"],
    examples: [
      { word: "恋愛", reading: "れんあい (renai)", meaning: "Tình yêu" },
      { word: "恋人", reading: "こいびと (koibito)", meaning: "Người yêu" },
      { word: "初恋", reading: "はつこい (hatsukoi)", meaning: "Mối tình đầu" }
    ],
    frequency: 720
  },

  // --- N2 KANJI SAMPLES ---
  {
    id: "k-301",
    kanji: "響",
    hanViet: "HƯỞNG",
    meaning: "Âm hưởng, vang dội, ảnh hưởng",
    level: "N2",
    strokeCount: 20,
    radicals: ["郷", "音"],
    radicalParts: [
      { radical: "郷", hanViet: "HƯƠNG", meaning: "Quê hương" },
      { radical: "音", hanViet: "ÂM", meaning: "Âm thanh" }
    ],
    mnemonic: "Âm thanh (音) từ chốn quê hương (郷) xưa vọng về tạo nên sức lan tỏa và ảnh hưởng (HƯỞNG) sâu sắc.",
    onyomi: ["キョウ (kyou)"],
    kunyomi: ["ひび.く (hibi.ku)"],
    examples: [
      { word: "影響", reading: "えいきょう (eikyou)", meaning: "Ảnh hưởng" },
      { word: "響く", reading: "ひびく (hibiku)", meaning: "Vang vọng" },
      { word: "反響", reading: "はんきょう (hankyou)", meaning: "Tiếng vang, phản hồi" }
    ],
    frequency: 840
  },

  // --- N1 KANJI SAMPLES ---
  {
    id: "k-401",
    kanji: "鬱",
    hanViet: "ÚC",
    meaning: "Trầm cảm, u uất, rậm rạp",
    level: "N1",
    strokeCount: 29,
    radicals: ["木", "缶", "鬯", "彡"],
    radicalParts: [
      { radical: "木", hanViet: "MỘC", meaning: "Hai cái cây rừng rậm" },
      { radical: "缶", hanViet: "PHẪU", meaning: "Bình rượu" },
      { radical: "鬯", hanViet: "SƯỞNG", meaning: "Rượu nghệ tế lễ" },
      { radical: "彡", hanViet: "SAM", meaning: "Tóc sam, bóng mờ" }
    ],
    mnemonic: "Lạc vào rừng cây rậm rạp (木) ôm bình rượu (缶) ủ kín tế lễ khiến lòng u sầu rầu rĩ (ÚC).",
    onyomi: ["ウツ (utsu)"],
    kunyomi: ["ふさ.ぐ (fusa.gu)"],
    examples: [
      { word: "憂鬱", reading: "ゆううつ (yuuutsu)", meaning: "U sầu, chán nản" },
      { word: "鬱病", reading: "うつびょう (utsubyou)", meaning: "Bệnh trầm cảm" }
    ],
    frequency: 1850
  }
];
