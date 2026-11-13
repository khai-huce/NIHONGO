import type { ReadingArticle } from '@nihongo/client/reading';
import { READING_SUPPLEMENT_MAX_APPLY_BYTES, type ReadingSupplementKind, type ReadingSupplementGroup, type ReadingSupplementLists, type ReadingSupplementResponse } from '@nihongo/shared/contracts/reading-supplements';
export type SupplementSnapshot = Pick<ReadingArticle, 'id' | 'version' | 'visibility' | 'text' | 'paragraphs' | 'vocabList' | 'grammarList' | 'quizList'>;
export function missingSupplementGroups(article: SupplementSnapshot, kind: ReadingSupplementKind): ReadingSupplementGroup[] {
  return kind === 'quiz' ? article.quizList.length ? [] : ['quiz']
    : [...(!article.vocabList.length ? ['vocab' as const] : []), ...(!article.grammarList.length ? ['grammar' as const] : [])];
}
export function supplementEligibility(article: SupplementSnapshot | null, userId: string | null, kind: ReadingSupplementKind) {
  if (!userId || !article || article.visibility !== 'private' || !/^[a-f0-9-]{36}$/i.test(article.id)) return 'Đăng nhập và mở bài cá nhân đã lưu để tạo nội dung.';
  if (!article.text.trim() || Array.from(article.text).length > 3000 || article.paragraphs.flatMap(p => p.sentences).length > 100) return 'Hỗ trợ bài tối đa 3.000 ký tự và 100 câu.';
  return missingSupplementGroups(article, kind).length ? '' : 'Nhóm đã có nội dung; chỉ bổ sung nhóm đang trống.';
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const key = (value: string) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
const validText = (value: unknown, max: number, required = true): value is string => typeof value === 'string' && value.length <= max && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value);
export function validateSupplementDraft(raw: unknown, article: SupplementSnapshot, kind: ReadingSupplementKind, allowEmpty = false, checkPayloadBytes = true): string[] {
  if (!record(raw) || !Array.isArray(raw.vocabList) || !Array.isArray(raw.grammarList) || !Array.isArray(raw.quizList)) return ['Danh sách nội dung không hợp lệ.'];
  const errors: string[] = [], groups = missingSupplementGroups(article, kind);
  const sentences = article.paragraphs.flatMap(p => p.sentences);
  const evidence = (row: Record<string, unknown>) => Array.isArray(row.evidence) && row.evidence.length >= 1 && row.evidence.length <= 3
    && row.evidence.every(e => record(e) && validText(e.sentenceId, 32) && validText(e.quote, 1000) && sentences.some(s => s.id === e.sentenceId && s.japanese.includes(e.quote as string)));
  for (const group of ['vocab', 'grammar', 'quiz'] as const) if (!groups.includes(group) && (raw[`${group}List`] as unknown[]).length) errors.push('Nội dung đã có hoặc ngoài nhóm đang tạo phải giữ nguyên.');
  if (raw.vocabList.length > 15 || raw.grammarList.length > 5 || raw.quizList.length > 5) errors.push('Tối đa 15 từ, 5 mẫu ngữ pháp và 5 câu hỏi.');
  if (!allowEmpty && ![...raw.vocabList, ...raw.grammarList, ...raw.quizList].length) errors.push('Chưa có mục nào được chọn để lưu.');
  raw.vocabList.forEach((v, i) => {
    if (!record(v) || !validText(v.word, 200) || !validText(v.reading, 200) || !/^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(v.reading) || !validText(v.hanViet, 200, false) || !validText(v.meaning, 1000) || !evidence(v)) errors.push(`Từ ${i + 1}: kiểm tra từ, cách đọc kana, nghĩa và dẫn chứng.`);
  });
  raw.grammarList.forEach((g, i) => {
    if (!record(g) || !validText(g.pattern, 200) || !validText(g.meaning, 1000) || !validText(g.exampleJp, 1000) || !validText(g.exampleVi, 1000) || !evidence(g)
      || !(g.evidence as { quote: string }[]).some(e => e.quote.includes(g.exampleJp as string))) errors.push(`Mẫu ${i + 1}: cần đủ nội dung và ví dụ trích nguyên văn trong dẫn chứng.`);
  });
  raw.quizList.forEach((q, i) => {
    if (!record(q) || !Number.isSafeInteger(q.id) || Number(q.id) <= 0 || !validText(q.question, 1000) || !validText(q.explanation, 2000)
      || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => !validText(o, 500)) || new Set(q.options.map(o => typeof o === 'string' ? key(o) : '')).size !== 4
      || !Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) > 3 || !evidence(q)) errors.push(`Câu hỏi ${i + 1}: cần 4 lựa chọn khác nhau, một đáp án đúng, giải thích và dẫn chứng.`);
  });
  if (!errors.length) {
    const rows = raw as ReadingSupplementLists;
    if (new Set(rows.vocabList.map(v => key(v.word) + '\u0000' + key(v.reading))).size !== rows.vocabList.length || new Set(rows.grammarList.map(g => key(g.pattern))).size !== rows.grammarList.length
      || new Set(rows.quizList.map(q => q.id)).size !== rows.quizList.length || new Set(rows.quizList.map(q => key(q.question))).size !== rows.quizList.length) errors.push('Danh sách có mục hoặc ID câu hỏi trùng nhau.');
    if (checkPayloadBytes && new TextEncoder().encode(JSON.stringify(supplementListsPayload(rows))).byteLength > READING_SUPPLEMENT_MAX_APPLY_BYTES - 512) errors.push('Nội dung vượt giới hạn lưu 128 KB. Hãy rút gọn trước khi áp dụng.');
  }
  return errors;
}
export function supplementListsPayload(rows: ReadingSupplementLists): ReadingSupplementLists {
  const evidence = (items: {sentenceId: string; quote: string}[]) => items.map(({sentenceId, quote}) => ({sentenceId, quote}));
  return { vocabList: rows.vocabList.map(({word, reading, hanViet, meaning, evidence: e}) => ({word, reading, hanViet, meaning, evidence: evidence(e)})),
    grammarList: rows.grammarList.map(({pattern, meaning, exampleJp, exampleVi, evidence: e}) => ({pattern, meaning, exampleJp, exampleVi, evidence: evidence(e)})),
    quizList: rows.quizList.map(({id, question, options, correctIndex, explanation, evidence: e}) => ({id, question, options: [...options], correctIndex, explanation, evidence: evidence(e)})) };
}
export function validateSupplementResponse(value: unknown, userId: string, id: string, article: SupplementSnapshot, kind: ReadingSupplementKind): ReadingSupplementResponse {
  const fail = () => { throw new Error('Bản xem trước không khớp tài khoản, bài đọc hoặc dữ liệu hợp lệ. Chưa áp dụng nội dung.'); };
  if (!record(value) || value.userId !== userId || value.id !== id || value.articleId !== article.id || value.version !== article.version || value.kind !== kind || typeof value.cached !== 'boolean'
    || !record(value.result) || !Array.isArray(value.result.groups) || JSON.stringify(value.result.groups) !== JSON.stringify(missingSupplementGroups(article, kind))
    || !Array.isArray(value.result.warnings) || value.result.warnings.length > 20 || value.result.warnings.some(w => !validText(w, 1000))
    || !record(value.catalog) || !Array.isArray(value.catalog.vocab) || !Array.isArray(value.catalog.grammar)) fail();
  const typed = value as ReadingSupplementResponse;
  if (validateSupplementDraft(typed.result, article, kind, true, false).length || typed.catalog.vocab.length !== typed.result.vocabList.length || typed.catalog.grammar.length !== typed.result.grammarList.length) fail();
  if (typed.catalog.grammar.some(m => m !== null && (!record(m) || !/^[0-9a-f-]{36}$/i.test(m.id) || m.href !== '/ngu-phap/mau/' + m.id || !validText(m.pattern, 200) || !validText(m.meaning, 1000, false) || !/^N[1-5]$/.test(m.level)))) fail();
  if (typed.catalog.vocab.some(m => m !== null && (!record(m) || !validText(m.word, 200) || !validText(m.reading, 200) || !Array.isArray(m.definitions) || m.definitions.some(d => !record(d) || !validText(d.meaning, 1000) || !validText(d.source, 500))))) fail();
  return typed;
}
