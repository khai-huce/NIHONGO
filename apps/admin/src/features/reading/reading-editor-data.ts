import type { ReadingArticle, ReadingAudio, ReadingSentence } from '@nihongo/client/reading';

export type ReadingContent = Pick<ReadingArticle, 'title' | 'subtitle' | 'text' | 'paragraphs' | 'vocabList' | 'grammarList' | 'quizList'>;
export type AdminReading = ReadingArticle & {
  updatedAt: string; sourceId: string | null; publishedSourceId: string | null;
  publishedVersion: number | null; archived: boolean; hasUnpublishedChanges: boolean;
};
export type ReadingForm = { title: string; subtitle: string; text: string; sourceId: string; content: ReadingContent; translationsReviewed: boolean };
export const emptyReadingContent = (): ReadingContent => ({ title: '', subtitle: '', text: '', paragraphs: [], vocabList: [], grammarList: [], quizList: [] });
export function readingEditorForm(article?: AdminReading): ReadingForm {
  const content: ReadingContent = article ? structuredClone({ title: article.title, subtitle: article.subtitle, text: article.text,
    paragraphs: article.paragraphs, vocabList: article.vocabList, grammarList: article.grammarList, quizList: article.quizList }) : emptyReadingContent();
  return { title: content.title, subtitle: content.subtitle, text: content.text, sourceId: article?.sourceId ?? '', content, translationsReviewed: false };
}

/** Sentence IDs are positional: reuse annotations only when exact Japanese text has one unambiguous match. */
export function reconcileReading(oldContent: ReadingContent, segmented: ReadingContent) {
  if (oldContent.text === segmented.text) return { content: { ...structuredClone(oldContent), title: segmented.title, subtitle: segmented.subtitle }, kept: 0, removedTranslations: 0, removedRuby: 0, removedRich: 0 };
  const oldSentences = oldContent.paragraphs.flatMap(paragraph => paragraph.sentences);
  const newSentences = segmented.paragraphs.flatMap(paragraph => paragraph.sentences);
  const oldCount = new Map<string, number>(), newCount = new Map<string, number>();
  for (const sentence of oldSentences) oldCount.set(sentence.japanese, (oldCount.get(sentence.japanese) ?? 0) + 1);
  for (const sentence of newSentences) newCount.set(sentence.japanese, (newCount.get(sentence.japanese) ?? 0) + 1);
  const byText = new Map(oldSentences.map(sentence => [sentence.japanese, sentence]));
  const matched = new Set<ReadingSentence>();
  const content = structuredClone(segmented);
  content.paragraphs = content.paragraphs.map(paragraph => ({ ...paragraph, sentences: paragraph.sentences.map(sentence => {
    const previous = byText.get(sentence.japanese);
    if (!previous || oldCount.get(sentence.japanese) !== 1 || newCount.get(sentence.japanese) !== 1) return { ...sentence, translation: '' };
    matched.add(previous);
    return { ...sentence, translation: previous.translation ?? '', ...(previous.ruby ? { ruby: structuredClone(previous.ruby) } : {}) };
  }) }));
  content.vocabList = []; content.grammarList = []; content.quizList = [];
  return { content, kept: [...matched].filter(sentence => sentence.translation?.trim()).length,
    removedTranslations: oldSentences.filter(sentence => sentence.translation?.trim() && !matched.has(sentence)).length,
    removedRuby: oldSentences.filter(sentence => sentence.ruby?.length && !matched.has(sentence)).length,
    removedRich: oldContent.vocabList.length + oldContent.grammarList.length + oldContent.quizList.length };
}

export function readingEditorBody(form: ReadingForm, saved?: AdminReading | null) {
  if (!form.title.trim() || form.title.trim().length > 200) throw new Error('Tiêu đề cần từ 1 đến 200 ký tự.');
  if (form.subtitle.trim().length > 500) throw new Error('Mô tả ngắn tối đa 500 ký tự.');
  if (!form.text.trim() || Array.from(form.text).length > 3000) throw new Error('Bài đọc cần từ 1 đến 3000 ký tự.');
  if (form.content.text !== form.text || !form.content.paragraphs.length) throw new Error('Hãy tách câu và kiểm tra bản dịch trước khi lưu.');
  if (saved && saved.text !== form.text && !form.translationsReviewed) throw new Error('Cần xác nhận kiểm tra bản dịch khi đổi văn bản Nhật.');
  return { title: form.title.trim(), subtitle: form.subtitle.trim(), text: form.text, sourceId: form.sourceId || null,
    annotations: form.content.paragraphs.flatMap(paragraph => paragraph.sentences).map(sentence => ({ sentenceId: sentence.id,
      japanese: sentence.japanese, translation: sentence.translation ?? '', ...(sentence.ruby ? { ruby: sentence.ruby } : {}) })),
    vocabList: form.content.vocabList, grammarList: form.content.grammarList, quizList: form.content.quizList,
    ...(saved && saved.text !== form.text ? { translationsReviewed: true } : {}),
  };
}

export function validAdminReadingAudio(audio: ReadingAudio | null, article: Pick<AdminReading, 'id' | 'version' | 'paragraphs'>): audio is ReadingAudio {
  const sentences = article.paragraphs.flatMap(paragraph => paragraph.sentences);
  if (!audio || audio.articleId !== article.id || audio.version !== article.version || !Number.isFinite(audio.totalSeconds) || audio.totalSeconds <= 0 || audio.segments.length !== sentences.length) return false;
  let offset = 0;
  for (let index = 0; index < audio.segments.length; index++) {
    const segment = audio.segments[index];
    if (segment.sentenceId !== sentences[index].id || !Number.isFinite(segment.durationSec) || segment.durationSec <= 0 || !Number.isFinite(segment.offsetSec)
      || Math.abs(segment.offsetSec - offset) > 0.05 || segment.url !== `/api/admin/reading/articles/${encodeURIComponent(article.id)}/audio/${encodeURIComponent(audio.id)}/${index}.mp3`) return false;
    offset += segment.durationSec;
  }
  return Math.abs(offset - audio.totalSeconds) <= 0.1;
}
