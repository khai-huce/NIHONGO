import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dataset build only: no API calls, DB writes, or changes to the application.
const dir = path.dirname(fileURLToPath(import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
const upstream = readJson('sources/n5.json');
const revision = readJson('sources/revision.json');
const translations = new Map();
for (const line of fs.readFileSync(path.join(dir, 'meanings-vi.txt'), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)) {
  const separator = line.indexOf('|');
  const index = Number(line.slice(0, separator));
  assert(separator > 0 && Number.isInteger(index) && !translations.has(index));
  translations.set(index, line.slice(separator + 1).trim());
}
assert.equal(upstream.length, 662);
assert.equal(translations.size, upstream.length);
const namespace = Buffer.from('0a7efc68448b4f229e4ca735fd97cc01', 'hex');
function id(key) {
  const bytes = crypto.createHash('sha1').update(namespace).update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const hiragana = value => value.normalize('NFKC').replace(/[ァ-ヶ]/gu, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const firstForm = value => value.trim().split(/\s*[/、]\s*|\s+/u)[0];
const corrections = {
  82: { english: ['soap'], note: 'Nghĩa economy trong nguồn sai với せっけん; sửa thành xà phòng.', url: 'https://jisho.org/search/せっけん' },
  193: { english: ['one day'], note: 'Với cách đọc いちにち chỉ giữ nghĩa một ngày; không dùng nghĩa ngày mùng một của cách đọc ついたち.', url: 'https://www.mitsumura-tosho.co.jp/webmaga/kotoba-to-manabi/kotoba/detail12' },
  353: { word: '散歩する', note: 'Thêm する vào từ để khớp cách đọc さんぽする và nghĩa động từ trong nguồn.' },
  418: { word: 'あげる', note: 'Dùng dạng kana cho nghĩa cho/tặng, tránh lẫn với nghĩa nâng lên của 上げる.', url: 'https://jisho.org/search/上げる' },
  461: { word: '掃除する', note: 'Thêm する để khớp cách đọc そうじする và nghĩa động từ trong nguồn.' },
  557: { word: 'おじいさん', note: 'Nguồn ghép sai chữ 伯父/叔父 với cách đọc おじいさん và nghĩa grandfather. Giữ cách đọc/nghĩa và sửa chữ thành おじいさん.', url: 'https://jisho.org/search/おじいさん' },
  568: { english: ['half'], note: 'Sửa half minute thành half: 半分 là một nửa, không phải nửa phút.', url: 'https://jisho.org/search/半分' },
  596: { word: '勉強する', note: 'Thêm する để khớp cách đọc べんきょうする và nghĩa động từ trong nguồn.' },
  655: { word: '練習する', note: 'Thêm する để khớp cách đọc れんしゅうする và nghĩa động từ trong nguồn.' },
};
// キロ abbreviates two different units. Use the full forms already in the source.
const fullUnitForms = { 51: 'キログラム', 52: 'キロメートル' };
const groups = [
  ['a', 'Hàng あ — A, I, U, E, O', 'あいうえお'],
  ['ka', 'Hàng か — Ka/Ga đến Ko/Go', 'かきくけこ'],
  ['sa', 'Hàng さ — Sa/Za đến So/Zo', 'さしすせそ'],
  ['ta', 'Hàng た — Ta/Da đến To/Do', 'たちつてと'],
  ['na', 'Hàng な — Na đến No', 'なにぬねの'],
  ['ha', 'Hàng は — Ha/Ba/Pa đến Ho/Bo/Po', 'はひふへほ'],
  ['ma', 'Hàng ま — Ma đến Mo', 'まみむめも'],
  ['ya', 'Hàng や — Ya, Yu, Yo', 'やゆよ'],
  ['ra', 'Hàng ら — Ra đến Ro', 'らりるれろ'],
  ['wa', 'Hàng わ — Wa', 'わをん'],
];
const grouped = new Map(groups.map(([key]) => [key, []]));
const review = [];
for (const [index, original] of upstream.entries()) {
  assert.equal(original.level, 'N5');
  const correction = corrections[index] ?? {};
  const word = correction.word ?? fullUnitForms[index] ?? firstForm(original.word);
  const reading = firstForm(original.reading || word);
  assert(/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(reading), `Invalid reading ${index}: ${reading}`);
  const vi = translations.get(index);
  assert(vi?.length, `Missing translation ${index}`);
  const base = hiragana(reading).normalize('NFD')[0];
  const group = groups.find(([, , chars]) => chars.includes(base));
  assert(group, `No group for ${word}/${reading}`);
  const wordId = id(`word|${original.word}|${original.reading}`);
  const item = {
    id: wordId, word, reading, hanViet: '', meaning: vi, romaji: '',
    partOfSpeech: [], exampleJp: '', exampleVi: '',
    ruby: /\p{Script=Han}/u.test(word) ? [{ text: word, reading }] : [],
  };
  grouped.get(group[0]).push(item);
  review.push({
    id: wordId, sourceIndex: index, originalWord: original.word,
    originalReading: original.reading, originalMeaningsEn: original.meanings,
    word, reading, meaningVi: vi, translationStatus: 'draft-needs-human-review',
    ...(correction.english ? { correctedMeaningsEn: correction.english } : {}),
    changes: [
      ...(correction.note ? [correction.note] : []),
      ...(!original.reading ? ['Nguồn không có reading riêng: dùng chính chữ kana làm cách đọc.'] : []),
      ...(fullUnitForms[index] ? ['Dùng tên đơn vị đầy đủ đã có trong nguồn để phân biệt hai nghĩa của キロ.'] : !correction.word && word !== original.word ? ['Chọn dạng viết đầu tiên cho câu hỏi; các dạng gốc giữ trong bản đối chiếu.'] : []),
      ...(original.reading && reading !== original.reading ? ['Chọn cách đọc đầu tiên để chế độ gõ có một đáp án rõ ràng; các cách đọc gốc giữ trong bản đối chiếu.'] : []),
    ],
    ...(correction.url ? { verificationUrl: correction.url } : {}),
  });
}
const collator = new Intl.Collator('ja');
const topics = groups.map(([key, title, japanese]) => {
  const entries = grouped.get(key).sort((a, b) => collator.compare(hiragana(a.reading), hiragana(b.reading)) || a.id.localeCompare(b.id));
  const lessonCount = Math.ceil(entries.length / 25);
  const lessons = Array.from({ length: lessonCount }, (_, i) => {
    const start = Math.floor(i * entries.length / lessonCount), end = Math.floor((i + 1) * entries.length / lessonCount);
    const words = entries.slice(start, end);
    return { id: id(`lesson|${key}|${i + 1}`), title: `Bài ${i + 1} — ${words[0].word} → ${words.at(-1).word}`, words };
  });
  return { id: id(`topic|${key}`), title, japanese, lessons };
});
const attribution = 'Nguồn: OpenJLPT; Jonathan Waller (Tanos); JMdict/EDICT — James William Breen và EDRDG. Chuyển đổi, chia bài và bản dịch tiếng Việt: NIHONGO (AI hỗ trợ, cần rà soát). CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/. Nguồn: https://github.com/evanclan/OpenJLPT';
const draft = {
  title: 'Từ vựng N5', subtitle: '662 mục từ · Nghĩa tiếng Việt cần rà soát',
  description: 'Danh sách N5 tham khảo của cộng đồng; không phải danh mục thi chính thức. Chia theo hàng kana, tối đa 25 từ/bài. ' + attribution,
  level: 'N5', style: 'custom', sourceId: null, topics,
};
const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'sources/n5.json'))).digest('hex');
const source = {
  id: `openjlpt-n5-${revision.commit.slice(0, 8)}-vi-v1`,
  name: 'Từ vựng N5 — OpenJLPT, bản dịch Việt nháp v1',
  url: `https://github.com/evanclan/OpenJLPT/tree/${revision.commit}`,
  license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  version: `${revision.commit} / NIHONGO vi-v1`, checksum: sourceHash,
  attribution,
  notes: '662 mục từ. Giữ bản gốc và NOTICE/giấy phép kèm file. Bản dịch Việt do AI hỗ trợ biên soạn, chưa được người dùng duyệt từng mục. Cách phân nhóm kana do NIHONGO thêm; lấy dạng viết/cách đọc đầu tiên cho bài tập, sửa 9 mục có ghi chú trong review.json. Không nhập ví dụ/audio Tatoeba; chưa có Hán Việt/từ loại. sourceId của JSON giáo trình để null để người dùng tạo/chọn nguồn trong admin. Giấy phép dữ liệu không thay giấy phép mã nguồn ứng dụng.',
};
const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
save('tu-vung-n5.json', draft);
save('source.json', source);
save('review.json', { revision, sourceHash, license: 'CC BY-SA 4.0', entries: review });
const allWords = topics.flatMap(t => t.lessons.flatMap(l => l.words));
assert.equal(new Set(allWords.map(w => w.id)).size, 662);
assert.equal(new Set(allWords.map(w => `${w.word}|${w.reading}`)).size, 662);
const report = {
  sourceCommit: revision.commit, sourceSha256: sourceHash,
  topicCount: topics.length, lessonCount: topics.reduce((sum, t) => sum + t.lessons.length, 0), wordCount: allWords.length,
  translationStatus: 'draft-needs-human-review', sourceCorrectionCount: Object.keys(corrections).length,
  topics: topics.map(t => ({ title: t.title, lessons: t.lessons.length, words: t.lessons.reduce((sum, l) => sum + l.words.length, 0) })),
  outputSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'tu-vung-n5.json'))).digest('hex'),
};
save('validation.json', report);
console.log(JSON.stringify(report, null, 2));
