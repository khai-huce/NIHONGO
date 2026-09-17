// Versioned kana data and pure quiz rules shared by the browser and Express.
// Keep kana-v1 IDs, table order, and null cells stable when extending the catalog.
export const KANA_CATALOG_ID = 'kana-v1';

export const KANA_COUNT = 104;

function freezeRows(rows) {
  return Object.freeze(rows.map(row => Object.freeze(row.map(kana => kana && Object.freeze(kana)))));
}

export const SEION_ROWS = freezeRows([
  [
    { id: 'あ', hira: 'あ', kata: 'ア', romaji: 'a' },
    { id: 'い', hira: 'い', kata: 'イ', romaji: 'i' },
    { id: 'う', hira: 'う', kata: 'ウ', romaji: 'u' },
    { id: 'え', hira: 'え', kata: 'エ', romaji: 'e' },
    { id: 'お', hira: 'お', kata: 'オ', romaji: 'o' },
  ],
  [
    { id: 'か', hira: 'か', kata: 'カ', romaji: 'ka' },
    { id: 'き', hira: 'き', kata: 'キ', romaji: 'ki' },
    { id: 'く', hira: 'く', kata: 'ク', romaji: 'ku' },
    { id: 'け', hira: 'け', kata: 'ケ', romaji: 'ke' },
    { id: 'こ', hira: 'こ', kata: 'コ', romaji: 'ko' },
  ],
  [
    { id: 'さ', hira: 'さ', kata: 'サ', romaji: 'sa' },
    { id: 'し', hira: 'し', kata: 'シ', romaji: 'shi' },
    { id: 'す', hira: 'す', kata: 'ス', romaji: 'su' },
    { id: 'せ', hira: 'せ', kata: 'セ', romaji: 'se' },
    { id: 'そ', hira: 'そ', kata: 'ソ', romaji: 'so' },
  ],
  [
    { id: 'た', hira: 'た', kata: 'タ', romaji: 'ta' },
    { id: 'ち', hira: 'ち', kata: 'チ', romaji: 'chi' },
    { id: 'つ', hira: 'つ', kata: 'ツ', romaji: 'tsu' },
    { id: 'て', hira: 'て', kata: 'テ', romaji: 'te' },
    { id: 'と', hira: 'と', kata: 'ト', romaji: 'to' },
  ],
  [
    { id: 'な', hira: 'な', kata: 'ナ', romaji: 'na' },
    { id: 'に', hira: 'に', kata: 'ニ', romaji: 'ni' },
    { id: 'ぬ', hira: 'ぬ', kata: 'ヌ', romaji: 'nu' },
    { id: 'ね', hira: 'ね', kata: 'ネ', romaji: 'ne' },
    { id: 'の', hira: 'の', kata: 'ノ', romaji: 'no' },
  ],
  [
    { id: 'は', hira: 'は', kata: 'ハ', romaji: 'ha' },
    { id: 'ひ', hira: 'ひ', kata: 'ヒ', romaji: 'hi' },
    { id: 'ふ', hira: 'ふ', kata: 'フ', romaji: 'fu' },
    { id: 'へ', hira: 'へ', kata: 'ヘ', romaji: 'he' },
    { id: 'ほ', hira: 'ほ', kata: 'ホ', romaji: 'ho' },
  ],
  [
    { id: 'ま', hira: 'ま', kata: 'マ', romaji: 'ma' },
    { id: 'み', hira: 'み', kata: 'ミ', romaji: 'mi' },
    { id: 'む', hira: 'む', kata: 'ム', romaji: 'mu' },
    { id: 'め', hira: 'め', kata: 'メ', romaji: 'me' },
    { id: 'も', hira: 'も', kata: 'モ', romaji: 'mo' },
  ],
  [
    { id: 'や', hira: 'や', kata: 'ヤ', romaji: 'ya' },
    null,
    { id: 'ゆ', hira: 'ゆ', kata: 'ユ', romaji: 'yu' },
    null,
    { id: 'よ', hira: 'よ', kata: 'ヨ', romaji: 'yo' },
  ],
  [
    { id: 'ら', hira: 'ら', kata: 'ラ', romaji: 'ra' },
    { id: 'り', hira: 'り', kata: 'リ', romaji: 'ri' },
    { id: 'る', hira: 'る', kata: 'ル', romaji: 'ru' },
    { id: 'れ', hira: 'れ', kata: 'レ', romaji: 're' },
    { id: 'ろ', hira: 'ろ', kata: 'ロ', romaji: 'ro' },
  ],
  [
    { id: 'わ', hira: 'わ', kata: 'ワ', romaji: 'wa' },
    null,
    null,
    null,
    { id: 'を', hira: 'を', kata: 'ヲ', romaji: 'wo' },
  ],
  [
    { id: 'ん', hira: 'ん', kata: 'ン', romaji: 'n' },
    null,
    null,
    null,
    null
  ]
]);

export const DAKUON_ROWS = freezeRows([
  [
    { id: 'が', hira: 'が', kata: 'ガ', romaji: 'ga' },
    { id: 'ぎ', hira: 'ぎ', kata: 'ギ', romaji: 'gi' },
    { id: 'ぐ', hira: 'ぐ', kata: 'グ', romaji: 'gu' },
    { id: 'げ', hira: 'げ', kata: 'ゲ', romaji: 'ge' },
    { id: 'ご', hira: 'ご', kata: 'ゴ', romaji: 'go' },
  ],
  [
    { id: 'ざ', hira: 'ざ', kata: 'ザ', romaji: 'za' },
    { id: 'じ', hira: 'じ', kata: 'ジ', romaji: 'ji' },
    { id: 'ず', hira: 'ず', kata: 'ズ', romaji: 'zu' },
    { id: 'ぜ', hira: 'ぜ', kata: 'ゼ', romaji: 'ze' },
    { id: 'ぞ', hira: 'ぞ', kata: 'ゾ', romaji: 'zo' },
  ],
  [
    { id: 'だ', hira: 'だ', kata: 'ダ', romaji: 'da' },
    { id: 'ぢ', hira: 'ぢ', kata: 'ヂ', romaji: 'ji' },
    { id: 'づ', hira: 'づ', kata: 'ヅ', romaji: 'zu' },
    { id: 'で', hira: 'で', kata: 'デ', romaji: 'de' },
    { id: 'ど', hira: 'ど', kata: 'ド', romaji: 'do' },
  ],
  [
    { id: 'ば', hira: 'ば', kata: 'バ', romaji: 'ba' },
    { id: 'び', hira: 'び', kata: 'ビ', romaji: 'bi' },
    { id: 'ぶ', hira: 'ぶ', kata: 'ブ', romaji: 'bu' },
    { id: 'べ', hira: 'べ', kata: 'ベ', romaji: 'be' },
    { id: 'ぼ', hira: 'ぼ', kata: 'ボ', romaji: 'bo' },
  ],
  [
    { id: 'ぱ', hira: 'ぱ', kata: 'パ', romaji: 'pa' },
    { id: 'ぴ', hira: 'ぴ', kata: 'ピ', romaji: 'pi' },
    { id: 'ぷ', hira: 'ぷ', kata: 'プ', romaji: 'pu' },
    { id: 'ぺ', hira: 'ぺ', kata: 'ペ', romaji: 'pe' },
    { id: 'ぽ', hira: 'ぽ', kata: 'ポ', romaji: 'po' },
  ]
]);

export const YOON_ROWS = freezeRows([
  [
    { id: 'きゃ', hira: 'きゃ', kata: 'キャ', romaji: 'kya' },
    { id: 'きゅ', hira: 'きゅ', kata: 'キュ', romaji: 'kyu' },
    { id: 'きょ', hira: 'きょ', kata: 'キョ', romaji: 'kyo' },
    { id: 'しゃ', hira: 'しゃ', kata: 'シャ', romaji: 'sha' },
    { id: 'しゅ', hira: 'しゅ', kata: 'シュ', romaji: 'shu' },
    { id: 'しょ', hira: 'しょ', kata: 'ショ', romaji: 'sho' },
    { id: 'ちゃ', hira: 'ちゃ', kata: 'チャ', romaji: 'cha' },
    { id: 'ちゅ', hira: 'ちゅ', kata: 'チュ', romaji: 'chu' },
    { id: 'ちょ', hira: 'ちょ', kata: 'チョ', romaji: 'cho' },
  ],
  [
    { id: 'にゃ', hira: 'にゃ', kata: 'ニャ', romaji: 'nya' },
    { id: 'にゅ', hira: 'にゅ', kata: 'ニュ', romaji: 'nyu' },
    { id: 'にょ', hira: 'にょ', kata: 'ニョ', romaji: 'nyo' },
    { id: 'ひゃ', hira: 'ひゃ', kata: 'ヒャ', romaji: 'hya' },
    { id: 'ひゅ', hira: 'ひゅ', kata: 'ヒュ', romaji: 'hyu' },
    { id: 'ひょ', hira: 'ひょ', kata: 'ヒョ', romaji: 'hyo' },
    { id: 'みゃ', hira: 'みゃ', kata: 'ミャ', romaji: 'mya' },
    { id: 'みゅ', hira: 'みゅ', kata: 'ミュ', romaji: 'myu' },
    { id: 'みょ', hira: 'みょ', kata: 'ミョ', romaji: 'myo' },
  ],
  [
    { id: 'りゃ', hira: 'りゃ', kata: 'リャ', romaji: 'rya' },
    { id: 'りゅ', hira: 'りゅ', kata: 'リュ', romaji: 'ryu' },
    { id: 'りょ', hira: 'りょ', kata: 'リョ', romaji: 'ryo' },
    { id: 'ぎゃ', hira: 'ぎゃ', kata: 'ギャ', romaji: 'gya' },
    { id: 'ぎゅ', hira: 'ぎゅ', kata: 'ギュ', romaji: 'gyu' },
    { id: 'ぎょ', hira: 'ぎょ', kata: 'ギョ', romaji: 'gyo' },
    { id: 'じゃ', hira: 'じゃ', kata: 'ジャ', romaji: 'ja' },
    { id: 'じゅ', hira: 'じゅ', kata: 'ジュ', romaji: 'ju' },
    { id: 'じょ', hira: 'じょ', kata: 'ジョ', romaji: 'jo' },
  ],
  [
    { id: 'びゃ', hira: 'びゃ', kata: 'ビャ', romaji: 'bya' },
    { id: 'びゅ', hira: 'びゅ', kata: 'ビュ', romaji: 'byu' },
    { id: 'びょ', hira: 'びょ', kata: 'ビョ', romaji: 'byo' },
    { id: 'ぴゃ', hira: 'ぴゃ', kata: 'ピャ', romaji: 'pya' },
    { id: 'ぴゅ', hira: 'ぴゅ', kata: 'ピュ', romaji: 'pyu' },
    { id: 'ぴょ', hira: 'ぴょ', kata: 'ピョ', romaji: 'pyo' },
    null,
    null,
    null
  ]
]);

export const KANA_LIST = Object.freeze([...SEION_ROWS, ...DAKUON_ROWS, ...YOON_ROWS].flat().filter(Boolean));
const byId = new Map(KANA_LIST.map(kana => [kana.id, kana]));
const scripts = ['hiragana', 'katakana'];

function validateMode(mode) {
  if (![...scripts, 'both'].includes(mode)) throw new Error('Chế độ quiz bảng chữ cái không hợp lệ.');
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Giá trị ngẫu nhiên phải nằm trong khoảng từ 0 đến dưới 1.');
    const other = Math.floor(value * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function makeKanaQuiz(mode, random = Math.random) {
  validateMode(mode);
  const questionScripts = mode === 'both'
    ? shuffle(Array.from({ length: KANA_COUNT }, (_, index) => scripts[index % 2]), random)
    : Array(KANA_COUNT).fill(mode);
  return shuffle(KANA_LIST, random).map((target, index) => {
    const seenRomaji = new Set([target.romaji]);
    const options = [target.id];
    for (const candidate of shuffle(KANA_LIST, random)) {
      if (seenRomaji.has(candidate.romaji)) continue;
      seenRomaji.add(candidate.romaji);
      options.push(candidate.id);
      if (options.length === 4) break;
    }
    return { kanaId: target.id, script: questionScripts[index], options: shuffle(options, random) };
  });
}

export function gradeKanaAnswers(mode, answers) {
  validateMode(mode);
  if (!Array.isArray(answers) || answers.length !== KANA_COUNT) {
    throw new Error(`Cần hoàn thành đủ ${KANA_COUNT} câu trước khi lưu kết quả.`);
  }
  const seen = new Set();
  const graded = [];
  let hiraganaCount = 0;
  let correctCount = 0;
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) throw new Error('Câu trả lời không hợp lệ.');
    const { kanaId, script, answerId } = answer;
    const target = byId.get(kanaId);
    const selected = byId.get(answerId);
    if (!target || !selected || seen.has(kanaId)) throw new Error('Mỗi chữ trong bảng phải có đúng một câu trả lời hợp lệ.');
    if (!scripts.includes(script) || (mode !== 'both' && script !== mode)) throw new Error('Bảng chữ của câu trả lời không khớp chế độ quiz.');
    seen.add(kanaId);
    if (script === 'hiragana') hiraganaCount += 1;
    // Kana with the same pronunciation (じ/ぢ, ず/づ) must never be counted as wrong.
    const correct = target.romaji === selected.romaji;
    if (correct) correctCount += 1;
    graded.push({ kanaId, script, answerId, correct });
  }
  if (mode === 'both' && hiraganaCount !== KANA_COUNT / 2) {
    throw new Error('Chế độ cả hai cần đúng 52 câu Hiragana và 52 câu Katakana.');
  }
  return { answers: graded, total: KANA_COUNT, correct: correctCount };
}
