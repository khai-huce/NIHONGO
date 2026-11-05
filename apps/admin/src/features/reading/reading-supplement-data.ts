import type { ReadingContent } from './reading-editor-data';

type Quiz = ReadingContent['quizList'][number];

// Keep existing IDs intact; newly authored questions use a fresh safe integer,
// rather than a display position that can be reused after removal.
export function nextReadingQuizId(items: Pick<Quiz, 'id'>[]): number {
  const used = new Set(items.map(item => item.id));
  let id: number;
  do {
    const bytes = crypto.getRandomValues(new Uint32Array(2));
    id = (bytes[0] & 0xfffff) * 0x100000000 + bytes[1] + 1;
  } while (used.has(id));
  return id;
}

export function removeReadingQuizOption(quiz: Quiz, index: number): Quiz {
  if (quiz.options.length <= 2 || index < 0 || index >= quiz.options.length) return quiz;
  return { ...quiz, options: quiz.options.filter((_, i) => i !== index),
    correctIndex: quiz.correctIndex === index ? -1 : quiz.correctIndex > index ? quiz.correctIndex - 1 : quiz.correctIndex };
}

export function moveReadingQuizOption(quiz: Quiz, index: number, delta: number): Quiz {
  const target = index + delta;
  if (index < 0 || index >= quiz.options.length || target < 0 || target >= quiz.options.length) return quiz;
  const options = [...quiz.options];
  [options[index], options[target]] = [options[target], options[index]];
  return { ...quiz, options, correctIndex: quiz.correctIndex === index ? target : quiz.correctIndex === target ? index : quiz.correctIndex };
}

/** Preview/save validate the same form; do not silently drop incomplete rows. */
export function validateReadingSupplements(content: ReadingContent): void {
  const check = (value: string, max: number, label: string, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
      throw new Error(`${label}: ${required ? 'cần nhập nội dung, ' : ''}tối đa ${max} ký tự.`);
    }
  };
  const sentences = content.paragraphs.flatMap(p => p.sentences);
  for (const sentence of sentences) {
    check(sentence.translation ?? '', 3000, `Bản dịch câu ${sentence.id}`);
    const ruby = sentence.ruby ?? [];
    if (ruby.length > 500) throw new Error(`Furigana câu ${sentence.id}: tối đa 500 đoạn.`);
    if (ruby.length && ruby.map(part => part.text).join('') !== sentence.japanese) {
      throw new Error(`Furigana câu ${sentence.id}: các đoạn phải ghép đúng nguyên văn, kể cả dấu câu và khoảng trắng.`);
    }
    for (const part of ruby) {
      // Whitespace is meaningful in the Japanese source; do not trim it.
      if (!part.text.length || part.text.length > 3000) throw new Error(`Furigana câu ${sentence.id}: mỗi đoạn cần có văn bản.`);
      if (part.reading !== undefined) check(part.reading, 300, `Cách đọc câu ${sentence.id}`, true);
    }
  }
  for (const key of ['vocabList', 'grammarList', 'quizList'] as const) {
    if (content[key].length > 100) throw new Error('Mỗi phần bổ trợ tối đa 100 mục.');
  }
  content.vocabList.forEach((item, index) => {
    const label = `Từ vựng ${index + 1}`;
    check(item.word, 200, `${label} — Từ`, true);
    check(item.reading, 200, `${label} — Cách đọc`);
    check(item.hanViet, 200, `${label} — Hán Việt`);
    check(item.meaning, 1000, `${label} — Nghĩa`);
  });
  content.grammarList.forEach((item, index) => {
    const label = `Ngữ pháp ${index + 1}`;
    check(item.pattern, 200, `${label} — Mẫu`, true);
    check(item.jlptLevel, 16, `${label} — Trình độ`);
    check(item.meaning, 1000, `${label} — Nghĩa`);
    check(item.exampleJp, 1000, `${label} — Ví dụ Nhật`);
    check(item.exampleVi, 1000, `${label} — Dịch ví dụ`);
  });
  const ids = new Set<number>();
  content.quizList.forEach((item, index) => {
    const label = `Câu hỏi ${index + 1}`;
    if (!Number.isSafeInteger(item.id) || item.id < 1 || ids.has(item.id)) throw new Error(`${label}: ID không hợp lệ hoặc bị trùng.`);
    ids.add(item.id);
    check(item.question, 1000, label, true);
    if (item.options.length < 2 || item.options.length > 6) throw new Error(`${label}: cần từ 2 đến 6 lựa chọn.`);
    item.options.forEach((option, i) => check(option, 500, `${label} — Lựa chọn ${i + 1}`, true));
    if (new Set(item.options.map(option => option.normalize('NFC').trim().replace(/\s+/gu, ' '))).size !== item.options.length) {
      throw new Error(`${label}: các lựa chọn không được trùng nhau.`);
    }
    if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length) {
      throw new Error(`${label}: hãy chọn một đáp án đúng.`);
    }
    check(item.explanation, 2000, `${label} — Giải thích`);
  });
}
