import type { Prisma } from '@prisma/client';
import { HttpError } from './errors.js';

type LessonWord = { id: string; word: string; reading: string; hanViet: string; meaning: string };

// Edits, deletion and custom stars take the same lock before touching lessons/cards.
// This also prevents two lessons from concurrently claiming the same word UUID.
export async function lockVocabChanges(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
}

export async function syncLessonReview(
  tx: Prisma.TransactionClient, userId: string, lessonId: string,
  previous: Prisma.JsonValue, words: LessonWord[],
) {
  const previousIds = new Set((previous as LessonWord[]).map(word => word.id));
  const newIds = words.filter(word => !previousIds.has(word.id)).map(word => word.id);
  if (newIds.length) {
    const occupied = await tx.$queryRaw<{ id: string }[]>`
      SELECT l.id FROM vocab_lessons l
      WHERE l.user_id = ${userId}::uuid AND l.id <> ${lessonId}::uuid
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.words) item
          WHERE ${JSON.stringify(newIds)}::jsonb ? (item->>'id'))
      LIMIT 1`;
    const retainedCard = await tx.reviewCard.findFirst({
      where: { userId, category: 'vocab', sourceId: { in: newIds.map(id => `custom:${id}`) } },
      select: { id: true },
    });
    if (occupied.length || retainedCard) {
      throw new HttpError(409, 'WORD_ID_EXISTS', 'ID từ đã được dùng ở bài hoặc thẻ ôn khác. Vui lòng tải lại và nhập từ mới.');
    }
  }

  // Only update existing snapshots. Missing/removed words never create or remove stars.
  // One SQL statement keeps a batch bounded and leaves schedules/events untouched.
  await tx.$executeRaw`
    UPDATE review_cards c SET front = item->>'word', back = item->>'meaning',
      reading = item->>'reading', version = c.version + 1
    FROM jsonb_array_elements(${JSON.stringify(words)}::jsonb) item
    WHERE c.user_id = ${userId}::uuid AND c.category = 'vocab'
      AND c.source_id = 'custom:' || (item->>'id')
      AND (c.front IS DISTINCT FROM item->>'word'
        OR c.back IS DISTINCT FROM item->>'meaning'
        OR c.reading IS DISTINCT FROM item->>'reading')`;
}

export async function setCustomReviewStar(
  tx: Prisma.TransactionClient, userId: string, sourceId: string, active: boolean,
) {
  await lockVocabChanges(tx, userId);
  const wordId = sourceId.slice('custom:'.length);
  const lessons = await tx.vocabLesson.findMany({
    where: { userId, words: { array_contains: [{ id: wordId }] } },
    select: { words: true }, take: 2,
  });
  if (lessons.length > 1) {
    throw new HttpError(409, 'WORD_ID_EXISTS', 'ID từ đang trùng giữa các bài. Chưa thể xác định nội dung thẻ ôn.');
  }
  const word = (lessons[0]?.words as LessonWord[] | undefined)?.find(item => item.id === wordId);
  const existing = await tx.reviewCard.findUnique({
    where: { userId_category_sourceId: { userId, category: 'vocab', sourceId } },
  });
  if (!existing && (!word || !active)) {
    throw new HttpError(404, 'NOT_FOUND', 'Từ không còn trong bài học. Vui lòng tải lại danh sách.');
  }
  if (existing) {
    // After source deletion, keep the last saved snapshot, even if an old tab posts old text.
    return tx.reviewCard.update({ where: { id: existing.id }, data: {
      active, version: { increment: 1 },
      ...(word ? { front: word.word, back: word.meaning, reading: word.reading } : {}),
    } });
  }
  return tx.reviewCard.create({ data: {
    userId, category: 'vocab', sourceId, active,
    front: word!.word, back: word!.meaning, reading: word!.reading,
  } });
}
