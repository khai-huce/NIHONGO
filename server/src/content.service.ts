import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { kanjiContentSchema, radicalContentSchema, contentImportSchema, contentSourceSchema,
  type KanjiContentData, type ContentImport } from './content.schema.js';

export type ContentDb = PrismaClient | Prisma.TransactionClient;
const changed = () => new HttpError(409, 'CONTENT_CHANGED', 'Nội dung đã thay đổi. Vui lòng xem trước lại trước khi lưu.');
const missing = () => new HttpError(404, 'CONTENT_NOT_FOUND', 'Không tìm thấy nội dung đã xuất bản.');
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export async function getKanji(db: ContentDb, id: string, options: { allowArchived?: boolean } = {}) {
  const row = await db.kanjiContent.findFirst({ where: { id, status: options.allowArchived ? { in: ['published', 'archived'] } : 'published' } });
  return row?.published ? kanjiContentSchema.parse(row.published) : null;
}
export async function loadKanjiCatalog(db: ContentDb, options: { allowArchived?: boolean } = {}) {
  return (await db.kanjiContent.findMany({ where: { status: options.allowArchived ? { in: ['published', 'archived'] } : 'published',
    published: { not: Prisma.DbNull } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }))
    .map(row => kanjiContentSchema.parse(row.published));
}
export async function loadRoadmapDefinition(db: ContentDb, id: string) {
  return db.catalogDefinition.findUnique({ where: { id }, select: { id: true, level: true, perDay: true, kanjiIds: true, kanjiList: true } });
}
export async function loadPublicContent(db: PrismaClient) {
  return db.$transaction(async tx => {
    // Read both states in one statement so a concurrent archive/publish cannot
    // duplicate or omit a Kanji between the two lists used by existing roadmaps.
    const rows = await tx.kanjiContent.findMany({
      where: { status: { in: ['published', 'archived'] }, published: { not: Prisma.DbNull } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return {
      kanji: rows.filter(row => row.status === 'published').map(row => kanjiContentSchema.parse(row.published)),
      archivedKanji: rows.filter(row => row.status === 'archived').map(row => kanjiContentSchema.parse(row.published)),
      radicals: (await tx.radicalContent.findMany({ where: { status: 'published' }, orderBy: { number: 'asc' } }))
        .map(row => radicalContentSchema.parse(row.published)),
      sources: await tx.contentSource.findMany({ orderBy: { id: 'asc' } }),
      roadmaps: await tx.catalogDefinition.findMany({ orderBy: { id: 'asc' } }),
    };
  });
}
export const kanjiReviewSnapshot = (data: KanjiContentData) => ({ front: data.kanji, back: data.meaning, reading: data.hanViet, hint: data.mnemonic });

export async function saveKanjiDraft(tx: ContentDb, data: KanjiContentData, sourceId: string, expectedVersion: number | null) {
  data = kanjiContentSchema.parse(data);
  if (!await tx.contentSource.findUnique({ where: { id: sourceId } })) throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại.');
  const prior = await tx.kanjiContent.findUnique({ where: { id: data.id } });
  if (prior) {
    if (prior.character !== data.kanji) throw new HttpError(409, 'CONTENT_IDENTITY_CHANGED', 'Không được đổi ký tự của ID đã tồn tại.');
    if (equal(kanjiContentSchema.parse(prior.draft), data) && prior.draftSourceId === sourceId) return { row: prior, changed: false };
    if (prior.version !== expectedVersion) throw changed();
    const result = await tx.kanjiContent.updateMany({ where: { id: data.id, version: expectedVersion }, data: { draft: json(data), draftSourceId: sourceId, version: { increment: 1 } } });
    if (!result.count) throw changed();
  } else {
    if (expectedVersion !== null) throw changed();
    const duplicate = await tx.kanjiContent.findUnique({ where: { character: data.kanji } });
    if (duplicate) throw new HttpError(409, 'DUPLICATE_CHARACTER', `Chữ ${data.kanji} đã có ID ${duplicate.id}.`);
    const created = await tx.kanjiContent.createMany({ data: [{ id: data.id, character: data.kanji, level: data.level, hanViet: data.hanViet, meaning: data.meaning,
      sourceId, draftSourceId: sourceId, draft: json(data), sortOrder: 100000 }], skipDuplicates: true });
    if (!created.count) throw changed();
  }
  return { row: await tx.kanjiContent.findUniqueOrThrow({ where: { id: data.id } }), changed: true };
}
export async function saveRadicalDraft(tx: ContentDb, raw: unknown, sourceId: string, expectedVersion: number | null) {
  const data = radicalContentSchema.parse(raw);
  if (!await tx.contentSource.findUnique({ where: { id: sourceId } })) throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại.');
  const prior = await tx.radicalContent.findUnique({ where: { number: data.number } });
  if (prior) {
    if (equal(radicalContentSchema.parse(prior.draft), data) && prior.draftSourceId === sourceId) return { row: prior, changed: false };
    if (prior.version !== expectedVersion) throw changed();
    const result = await tx.radicalContent.updateMany({ where: { number: data.number, version: expectedVersion }, data: { draft: json(data), draftSourceId: sourceId, version: { increment: 1 } } });
    if (!result.count) throw changed();
  } else {
    if (expectedVersion !== null) throw changed();
    const result = await tx.radicalContent.createMany({ data: [{ number: data.number, sourceId, draftSourceId: sourceId, draft: json(data) }], skipDuplicates: true });
    if (!result.count) throw changed();
  }
  return { row: await tx.radicalContent.findUniqueOrThrow({ where: { number: data.number } }), changed: true };
}

export async function changeContentStatus(db: PrismaClient, kind: 'kanji' | 'radicals', id: string | number, version: number, status: 'published' | 'archived') {
  return db.$transaction(async tx => {
    if (kind === 'kanji') {
      await tx.$queryRaw`SELECT id FROM kanji_content WHERE id = ${String(id)} FOR UPDATE`;
      const prior = await tx.kanjiContent.findUnique({ where: { id: String(id) } });
      if (!prior) throw missing();
      if (prior.version !== version) throw changed();
      const data = kanjiContentSchema.parse(prior.draft);
      const updated = await tx.kanjiContent.updateMany({ where: { id: prior.id, version }, data: {
        status, version: { increment: 1 }, ...(status === 'published' ? { published: json(data), sourceId: prior.draftSourceId,
          level: data.level, hanViet: data.hanViet, meaning: data.meaning, dictionaryRadicalNumber: data.dictionaryRadicalNumber ?? null, publishedAt: new Date() } : {}),
      } });
      if (!updated.count) throw changed();
      if (status === 'published') await tx.reviewCard.updateMany({ where: { category: 'kanji', sourceId: prior.id },
        data: { ...kanjiReviewSnapshot(data), version: { increment: 1 } } });
      return tx.kanjiContent.findUniqueOrThrow({ where: { id: prior.id } });
    }
    const prior = await tx.radicalContent.findUnique({ where: { number: Number(id) } });
    if (!prior) throw missing();
    if (prior.version !== version) throw changed();
    const data = radicalContentSchema.parse(prior.draft);
    const updated = await tx.radicalContent.updateMany({ where: { number: prior.number, version }, data: {
      status, version: { increment: 1 }, ...(status === 'published' ? { published: json(data), sourceId: prior.draftSourceId, publishedAt: new Date() } : {}),
    } });
    if (!updated.count) throw changed();
    return tx.radicalContent.findUniqueOrThrow({ where: { number: prior.number } });
  });
}

export function parseContentImport(raw: unknown): ContentImport {
  const input = contentImportSchema.parse(raw);
  const keys = input.kind === 'kanji' ? input.entries.map(entry => entry.data.id) : input.entries.map(entry => entry.data.number);
  if (new Set<string | number>(keys).size !== keys.length) throw new HttpError(400, 'DUPLICATE_IMPORT_ID', 'Tệp nhập chứa ID lặp.');
  if (input.kind === 'kanji' && new Set(input.entries.map(entry => entry.data.kanji)).size !== input.entries.length)
    throw new HttpError(400, 'DUPLICATE_CHARACTER', 'Tệp nhập chứa ký tự lặp.');
  return input;
}
export const contentImportHash = (input: ContentImport) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
export async function previewContentImport(db: ContentDb, raw: unknown) {
  const input = parseContentImport(raw);
  const rows = [];
  for (const entry of input.entries) {
    const id = 'id' in entry.data ? entry.data.id : entry.data.number;
    const row = input.kind === 'kanji' ? await db.kanjiContent.findUnique({ where: { id: String(id) } })
      : await db.radicalContent.findUnique({ where: { number: Number(id) } });
    const same = row && equal(input.kind === 'kanji' ? kanjiContentSchema.parse(row.draft) : radicalContentSchema.parse(row.draft), entry.data) && row.draftSourceId === entry.sourceId;
    const hasSource = !!await db.contentSource.findUnique({ where: { id: entry.sourceId } });
    const duplicate = input.kind === 'kanji' ? await db.kanjiContent.findFirst({ where: { character: (entry.data as KanjiContentData).kanji, id: { not: String(id) } } }) : null;
    const identityChanged = row && 'character' in row && row.character !== (entry.data as KanjiContentData).kanji;
    rows.push({ id, version: row?.version ?? null, action: !hasSource ? 'source_missing' : duplicate || identityChanged ? 'identity_conflict'
      : same ? 'unchanged' : (row?.version ?? null) !== entry.expectedVersion ? 'version_conflict' : row ? 'update_draft' : 'create_draft' });
  }
  return { previewHash: contentImportHash(input), rows, canCommit: rows.every(row => ['unchanged', 'create_draft', 'update_draft'].includes(row.action)) };
}
export async function commitContentImport(db: PrismaClient, raw: unknown, previewHash: string) {
  const input = parseContentImport(raw);
  if (contentImportHash(input) !== previewHash) throw new HttpError(409, 'PREVIEW_CHANGED', 'Dữ liệu khác với bản đã xem trước.');
  return db.$transaction(async tx => {
    const preview = await previewContentImport(tx, input);
    if (!preview.canCommit) throw changed();
    let changedCount = 0;
    // Stable lock order prevents crossed multi-row edits from deadlocking.
    if (input.kind === 'kanji') {
      for (const entry of [...input.entries].sort((a, b) => a.data.id.localeCompare(b.data.id))) {
        if ((await saveKanjiDraft(tx, entry.data, entry.sourceId, entry.expectedVersion)).changed) changedCount++;
      }
    } else {
      for (const entry of [...input.entries].sort((a, b) => a.data.number - b.data.number)) {
        if ((await saveRadicalDraft(tx, entry.data, entry.sourceId, entry.expectedVersion)).changed) changedCount++;
      }
    }
    return { changed: changedCount, unchanged: input.entries.length - changedCount };
  }, { timeout: 30000 });
}

export const initialCatalogSchema = z.object({
  approvalDate: z.literal('2026-09-20'), sources: z.array(contentSourceSchema),
  kanji: z.array(z.object({ sourceId: z.string(), data: kanjiContentSchema }).strict()),
  radicals: z.array(z.object({ sourceId: z.string(), data: radicalContentSchema }).strict()),
  roadmaps: z.array(z.object({ id: z.string().max(32), level: z.string().max(2), perDay: z.number().int().positive(),
    kanjiIds: z.array(z.string()), kanjiList: z.array(z.string()) }).strict()),
}).strict();
export async function seedContentCatalog(db: PrismaClient, raw: unknown) {
  const input = initialCatalogSchema.parse(raw);
  const duplicateIds = new Set(input.kanji.map(item => item.data.id)).size !== input.kanji.length;
  if (duplicateIds) throw new Error('Catalog fixture has duplicate IDs.');
  return db.$transaction(async tx => {
    const sources = await tx.contentSource.createMany({ data: input.sources, skipDuplicates: true });
    const kanji = await tx.kanjiContent.createMany({ data: input.kanji.map(({ data, sourceId }, sortOrder) => ({
      id: data.id, character: data.kanji, level: data.level, hanViet: data.hanViet, meaning: data.meaning,
      dictionaryRadicalNumber: data.dictionaryRadicalNumber, sourceId, draftSourceId: sourceId, published: json(data), draft: json(data),
      status: 'published', sortOrder, publishedAt: new Date(),
    })), skipDuplicates: true });
    const radicals = await tx.radicalContent.createMany({ data: input.radicals.map(({ data, sourceId }) => ({
      number: data.number, sourceId, draftSourceId: sourceId, draft: json(data), published: json(data), status: 'published', publishedAt: new Date(),
    })), skipDuplicates: true });
    let roadmaps = 0;
    for (const definition of input.roadmaps) {
      const prior = await loadRoadmapDefinition(tx, definition.id);
      if (prior && !equal(prior, definition)) throw new Error(`Refusing to change immutable roadmap ${definition.id}.`);
      if (definition.kanjiIds.length !== definition.kanjiList.length || new Set(definition.kanjiIds).size !== definition.kanjiIds.length)
        throw new Error('Invalid roadmap definition.');
      for (const [index, id] of definition.kanjiIds.entries()) {
        if ((await getKanji(tx, id, { allowArchived: true }))?.kanji !== definition.kanjiList[index]) throw new Error('Roadmap identity mismatch.');
      }
      roadmaps += (await tx.catalogDefinition.createMany({ data: [definition], skipDuplicates: true })).count;
    }
    // Existing stars predate the content tables. Hydrate their displayed text from the
    // current published DB revision, never from an older seed over an editor's changes.
    let synchronizedCards = 0;
    const starredIds = await tx.reviewCard.findMany({ where: { category: 'kanji' }, distinct: ['sourceId'], select: { sourceId: true }, orderBy: { sourceId: 'asc' } });
    for (const { sourceId } of starredIds) {
      await tx.$queryRaw`SELECT id FROM kanji_content WHERE id = ${sourceId} FOR UPDATE`;
      const data = await getKanji(tx, sourceId, { allowArchived: true });
      if (!data) continue;
      const snapshot = kanjiReviewSnapshot(data);
      synchronizedCards += (await tx.reviewCard.updateMany({
        where: { category: 'kanji', sourceId: data.id, OR: [
          { front: { not: snapshot.front } }, { back: { not: snapshot.back } },
          { reading: { not: snapshot.reading } }, { hint: { not: snapshot.hint } },
        ] }, data: { ...snapshot, version: { increment: 1 } },
      })).count;
    }
    return { sources: sources.count, kanji: kanji.count, radicals: radicals.count, roadmaps, synchronizedCards };
  }, { timeout: 30000 });
}
