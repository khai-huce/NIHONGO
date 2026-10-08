import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import kuromoji, { type IpadicFeatures, type Tokenizer } from 'kuromoji';
import type { SentenceAnalysis, SentenceToken, SentenceTokenType } from '@nihongo/shared/contracts/sentence-analysis';

const require = createRequire(import.meta.url);
let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | undefined;

function loadTokenizer() {
  if (!tokenizerPromise) {
    const dictionaryPath = join(dirname(require.resolve('kuromoji/package.json')), 'dict');
    tokenizerPromise = new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
      kuromoji.builder({ dicPath: dictionaryPath }).build((error, tokenizer) => {
        if (error) reject(error);
        else resolve(tokenizer);
      });
    }).catch(error => { tokenizerPromise = undefined; throw error; });
  }
  return tokenizerPromise;
}

export function normalizeReading(reading: string): string {
  return reading.normalize('NFKC').trim().replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

const partsOfSpeech: Record<string, { type: SentenceTokenType; label: string; explanation: string }> = {
  名詞: { type: 'noun', label: 'Danh từ · 名詞', explanation: 'Từ điển phân loại đây là danh từ. Vai trò trong câu cần xét thêm ngữ cảnh.' },
  動詞: { type: 'verb', label: 'Động từ · 動詞', explanation: 'Từ điển phân loại đây là động từ. Dạng gốc và thông tin biến hình được ghi bên dưới.' },
  形容詞: { type: 'adj', label: 'Tính từ · 形容詞', explanation: 'Từ điển phân loại đây là tính từ. Thông tin biến hình được ghi bên dưới.' },
  副詞: { type: 'adv', label: 'Trạng từ · 副詞', explanation: 'Từ điển phân loại đây là trạng từ; nghĩa cụ thể phụ thuộc ngữ cảnh.' },
  助詞: { type: 'particle', label: 'Trợ từ · 助詞', explanation: 'Từ điển phân loại đây là trợ từ. Chức năng cụ thể phụ thuộc các từ xung quanh.' },
  助動詞: { type: 'aux', label: 'Trợ động từ · 助動詞', explanation: 'Từ điển phân loại đây là trợ động từ, kết hợp với thành phần đứng trước.' },
  記号: { type: 'punct', label: 'Dấu câu / ký hiệu · 記号', explanation: 'Dấu câu hoặc ký hiệu trong văn bản gốc.' },
  連体詞: { type: 'other', label: 'Liên thể từ · 連体詞', explanation: 'Từ điển phân loại đây là liên thể từ, thường đứng trước danh từ.' },
  接続詞: { type: 'other', label: 'Liên từ · 接続詞', explanation: 'Từ điển phân loại đây là liên từ, dùng để nối các phần của câu hoặc đoạn.' },
  感動詞: { type: 'other', label: 'Thán từ · 感動詞', explanation: 'Từ điển phân loại đây là thán từ.' },
  接頭詞: { type: 'other', label: 'Tiền tố · 接頭詞', explanation: 'Từ điển phân loại đây là tiền tố, kết hợp với từ đứng sau.' },
};

function makeToken(text: string, start: number, index: number, feature?: IpadicFeatures): SentenceToken {
  const whitespace = /^\s+$/u.test(text);
  const punctuation = /^[\p{P}\p{S}]+$/u.test(text);
  const known = feature?.word_type === 'KNOWN';
  const info = whitespace
    ? { type: 'other' as const, label: 'Khoảng trắng', explanation: 'Khoảng trắng được giữ nguyên từ câu đã nhập.' }
    : known && feature.pos in partsOfSpeech
      ? partsOfSpeech[feature.pos]
      : punctuation
        ? { type: 'punct' as const, label: 'Dấu câu / ký hiệu', explanation: 'Dấu câu hoặc ký hiệu được giữ nguyên từ câu đã nhập.' }
        : { type: 'unknown' as const, label: 'Chưa nhận diện', explanation: 'Không có mục từ tương ứng trong từ điển tách từ. Chưa xác định cách đọc và từ loại.' };
  const terms = known && !whitespace && feature
    ? [feature.pos, feature.pos_detail_1, feature.pos_detail_2, feature.pos_detail_3, feature.conjugated_type, feature.conjugated_form]
      .filter(value => value && value !== '*')
    : [];
  return {
    index, text, start, end: start + text.length,
    reading: known && !whitespace && info.type !== 'punct' && feature?.reading && feature.reading !== '*' ? normalizeReading(feature.reading) : null,
    baseForm: known && feature?.basic_form && feature.basic_form !== '*' ? feature.basic_form : text,
    type: info.type, typeLabel: info.label, hanVietList: [], definitions: [], explanation: info.explanation,
    grammaticalTerms: terms.length ? `Thuật ngữ: ${[...new Set(terms)].join(' · ')}` : '',
  };
}

export async function tokenizeSentence(sentence: string): Promise<SentenceAnalysis> {
  const tokenizer = await loadTokenizer();
  const tokens: SentenceToken[] = [];
  let cursor = 0;
  for (const feature of tokenizer.tokenize(sentence)) {
    const surface = feature.surface_form;
    if (!surface) continue;
    // Kuromoji positions use code points and reset imperfectly after punctuation.
    // Derive UTF-16 offsets from the untouched source instead, including emoji.
    const start = sentence.indexOf(surface, cursor);
    if (start < 0) throw new Error('Tokenizer returned a token outside the original sentence.');
    if (start > cursor) tokens.push(makeToken(sentence.slice(cursor, start), cursor, tokens.length));
    tokens.push(makeToken(surface, start, tokens.length, feature));
    cursor = start + surface.length;
  }
  if (cursor < sentence.length) tokens.push(makeToken(sentence.slice(cursor), cursor, tokens.length));
  return { sentence, engine: 'kuromoji-ipadic', tokens };
}
