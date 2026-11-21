import { createHash, randomUUID } from 'node:crypto';
import { stat, mkdir, rm, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Router, json, type Request, type ErrorRequestHandler, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type PrismaClient, type ReadingArticle, type ReadingAudio } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '../auth/admin.auth.js';
import { HttpError } from '../../common/errors.js';
import { editorialInput, makeReadingContent, readingInput, readingEditorialPatch, updateReadingEditorial, validateStoredReadingContent, type ReadingContent } from './reading-content.js';
import { contentSourceSchema } from '../content/content.schema.js';
import { defaultReadingStorage, edgeReadingTts, READING_VOICE, readingMediaSchema, type ReadingTts } from './reading-tts.js';
import { readingSupplementCatalog } from './reading-supplements.catalog.js';

type LiveUser = { id: string; role: string };
type Options = { python?: string; storageDir?: string; synthesize?: ReadingTts };
const accountInput = z.object({ expectedUserId: z.string().uuid() });
const versionInput = accountInput.extend({ version: z.number().int().nonnegative() }).strict();
const articleId = (req: Request) => z.string().uuid().parse(req.params.id);
const missing = () => new HttpError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài đọc.');
const stale = () => new HttpError(409, 'ARTICLE_CHANGED', 'Bài đọc đã thay đổi. Vui lòng tải lại trước khi tiếp tục.');
const busy = () => new HttpError(409, 'AUDIO_BUSY', 'Audio đang được tạo. Vui lòng chờ rồi thử lại.');
function account(req: Request, user: LiveUser | null) {
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để lưu bài đọc và tạo audio.');
  if (req.body?.expectedUserId !== user.id) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
  return user.id;
}
const contentHash = (content: ReadingContent) => createHash('sha256').update(JSON.stringify({ text: content.text, voice: READING_VOICE, format: 'sentence-mp3-v1' })).digest('hex');
const viewContent = (article: ReadingArticle, draft = false) =>
  (article.scope === 'library' && !draft ? article.publishedContent : article.content) as unknown as ReadingContent;
const viewVersion = (article: ReadingArticle, draft = false) => article.scope === 'library' && !draft ? article.publishedVersion! : article.version;
const sourceInput = contentSourceSchema.shape.id.nullable();

export function readingRoutes(db: PrismaClient, options: Options = {}) {
  const router = Router();
  const storageDir = resolve(options.storageDir ?? defaultReadingStorage);
  const synthesize = options.synthesize ?? edgeReadingTts(options.python);
  const inFlight = new Map<string, Promise<ReadingAudio>>();
  const storagePath = (audio: Pick<ReadingAudio, 'id' | 'claimToken'>) => {
    const directory = resolve(storageDir, z.string().uuid().parse(audio.id), z.string().uuid().parse(audio.claimToken));
    if (!directory.startsWith(storageDir + sep)) throw new Error('Invalid reading storage path');
    return directory;
  };
  const filesExist = async (audio: ReadingAudio, content?: ReadingContent) => {
    try {
      const segments = readingMediaSchema.shape.segments.parse(audio.segments);
      let total = 0;
      const sentences = content?.paragraphs.flatMap(paragraph => paragraph.sentences);
      if (sentences && sentences.length !== segments.length) return false;
      for (const [index, segment] of segments.entries()) {
        if (segment.fileName !== `${index}.mp3` || Math.abs(segment.offsetSec - total) > 0.01
          || (sentences && segment.sentenceId !== sentences[index].id)) return false;
        total += segment.durationSec;
      }
      if (Math.abs(total - audio.durationSec) > 0.01) return false;
      const files = await Promise.all(segments.map(item => ensureAudioFile(audio, item.fileName)));
      return files.every(file => file.isFile() && file.size > 0 && file.size <= 20_000_000);
    } catch { return false; }
  };
  async function ensureAudioFile(audio: ReadingAudio, filename: string) {
    const directory = storagePath(audio);
    const path = resolve(directory, filename);
    try { return await stat(path); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const file = await db.readingAudioFile.findUnique({
      where: { audioId_claimToken_filename: { audioId: audio.id, claimToken: audio.claimToken, filename } },
      select: { data: true },
    });
    if (!file) throw missing();
    await mkdir(directory, { recursive: true });
    const temporary = path + '.' + randomUUID();
    try {
      await writeFile(temporary, file.data);
      await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
    return stat(path);
  }
  const readyAudio = async (articleId: string, content: ReadingContent, client: PrismaClient | Prisma.TransactionClient = db) => {
    const candidates = await client.readingAudio.findMany({ where: { articleId, contentHash: contentHash(content), voice: READING_VOICE, status: 'ready' }, orderBy: { updatedAt: 'desc' } });
    for (const audio of candidates) if (await filesExist(audio, content)) return audio;
    return null;
  };
  const audioDto = (audio: ReadingAudio, version: number, admin = false) => ({ id: audio.id, articleId: audio.articleId, version,
    voice: audio.voice, totalSeconds: audio.durationSec,
    segments: readingMediaSchema.shape.segments.parse(audio.segments).map((item, index) => ({
      sentenceId: item.sentenceId, durationSec: item.durationSec, offsetSec: item.offsetSec,
      url: `/api/${admin ? 'admin/' : ''}reading/articles/${audio.articleId}/audio/${audio.id}/${index}.mp3`,
    })),
  });
  const dto = async (article: ReadingArticle, draft = false) => {
    const isPublic = article.scope === 'library' && !draft;
    const version = viewVersion(article, draft), content = viewContent(article, draft);
    const audio = article.archivedAt ? null : await readyAudio(article.id, content);
    const supplementCatalog = [...content.vocabList, ...content.grammarList].some(item => item.aiEvidence)
      ? await readingSupplementCatalog(db, content) : undefined;
    return { ...content, id: article.id, version, visibility: isPublic ? 'public' : 'private',
      ...(supplementCatalog ? { supplementCatalog, grammarList: content.grammarList.map((g, i) => g.aiEvidence ? { ...g, jlptLevel: supplementCatalog.grammar[i]?.level ?? '' } : g) } : {}),
      createdAt: article.createdAt.toISOString(), updatedAt: article.updatedAt.toISOString(), charCount: Array.from(content.text).length,
      sourceId: isPublic ? article.publishedSourceId : article.sourceId,
      audio: audio ? audioDto(audio, version, draft) : null,
      ...(draft ? { scope: article.scope, publishedVersion: article.publishedVersion, publishedSourceId: article.publishedSourceId,
        archived: !!article.archivedAt, hasUnpublishedChanges: article.publishedVersion === null
          || article.sourceId !== article.publishedSourceId || !isDeepStrictEqual(article.content, article.publishedContent) } : {}),
    };
  };
  const readable = async (id: string, user: LiveUser | null) => {
    const article = await db.readingArticle.findUnique({ where: { id } });
    if (!article || article.archivedAt || (article.scope === 'personal' ? article.userId !== user?.id : article.publishedVersion === null || article.publishedContent === null)) throw missing();
    return article;
  };
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.readingUser = req.session.userId ? await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true, role: true } }) : null;
    next();
  });
  router.use(json({ limit: '128kb' }));
  router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } },
  }));

  router.get('/', async (req, res) => {
    z.object({}).strict().parse(req.query);
    const user = res.locals.readingUser as LiveUser | null;
    const articles = await db.readingArticle.findMany({ where: { archivedAt: null, OR: [
      ...(user ? [{ scope: 'personal', userId: user.id }] : []),
      { scope: 'library', publishedVersion: { not: null } },
    ] }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    res.json({ userId: user?.id ?? null, articles: await Promise.all(articles.map(item => dto(item))) });
  });
  router.post('/', async (req, res) => {
    const userId = account(req, res.locals.readingUser);
    const input = readingInput.extend({ id: z.string().uuid(), expectedUserId: z.string().uuid() }).strict().parse(req.body);
    const content = makeReadingContent({ title: input.title, subtitle: input.subtitle, text: input.text });
    const saved = await db.$transaction(async tx => {
      const created = await tx.readingArticle.createMany({ data: [{ id: input.id, userId, content }], skipDuplicates: true });
      const article = await tx.readingArticle.findUniqueOrThrow({ where: { id: input.id } });
      // JSONB key order is immaterial; compare only validated creation fields on an exact retry.
      const original = article.content as unknown as ReadingContent;
      if (article.userId !== userId || article.scope !== 'personal' || article.archivedAt || article.version !== 0 || original.title !== content.title || original.subtitle !== content.subtitle || original.text !== content.text) throw stale();
      return { article, created: created.count > 0 };
    });
    res.status(saved.created ? 201 : 200).json({ userId, article: await dto(saved.article) });
  });
  router.get('/:id', async (req, res) => {
    const user = res.locals.readingUser as LiveUser | null;
    res.json({ userId: user?.id ?? null, article: await dto(await readable(articleId(req), user)) });
  });
  router.patch('/:id', async (req, res) => {
    const userId = account(req, res.locals.readingUser), id = articleId(req);
    const input = readingInput.extend(versionInput.shape).strict().parse(req.body);
    const article = await readable(id, res.locals.readingUser);
    if (article.scope !== 'personal' || article.userId !== userId) throw missing();
    const prior = viewContent(article);
    const content = input.text === prior.text ? { ...prior, title: input.title, subtitle: input.subtitle }
      : makeReadingContent({ title: input.title, subtitle: input.subtitle, text: input.text });
    const saved = await db.readingArticle.updateMany({ where: { id, userId, version: input.version, archivedAt: null }, data: { content, version: { increment: 1 } } });
    if (!saved.count) throw stale();
    res.json({ userId, article: await dto(await db.readingArticle.findUniqueOrThrow({ where: { id } })) });
  });
  router.delete('/:id', async (req, res) => {
    const userId = account(req, res.locals.readingUser), input = versionInput.parse(req.body), id = articleId(req);
    const article = await readable(id, res.locals.readingUser);
    if (article.scope !== 'personal' || article.userId !== userId) throw missing();
    if (!(await db.readingArticle.updateMany({ where: { id, userId, version: input.version, archivedAt: null }, data: { archivedAt: new Date(), version: { increment: 1 } } })).count) throw stale();
    res.status(204).end();
  });

  async function generate(article: ReadingArticle, draft = false) {
    const version = viewVersion(article, draft), content = viewContent(article, draft);
    if (content.paragraphs.reduce((total, paragraph) => total + paragraph.sentences.length, 0) > 100) {
      throw new HttpError(400, 'AUDIO_SENTENCE_LIMIT', 'Audio hỗ trợ tối đa 100 câu mỗi bài. Hãy chia văn bản thành các bài ngắn hơn.');
    }
    const hash = contentHash(content), characterCount = Array.from(content.text).length;
    const key = { articleId: article.id, articleVersion: version, voice: READING_VOICE };
    const cached = await readyAudio(article.id, content);
    if (cached) return cached;
    const prior = await db.readingAudio.findUnique({ where: { articleId_articleVersion_voice: key } });
    if (prior?.status === 'ready') await db.readingAudio.updateMany({ where: { id: prior.id, status: 'ready' }, data: { status: 'failed' } });
    const claim = await db.$transaction(async tx => {
      // One short database lock claims jobs across Express processes; no lock/transaction spans synthesis.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73022002)`;
      const current = await tx.readingAudio.findUnique({ where: { articleId_articleVersion_voice: key } });
      // Reuse immutable measured files by text/voice. Never move their generation
      // version: a different draft must leave the published article's audio alive.
      const reusable = await readyAudio(article.id, content, tx);
      if (reusable) return reusable;
      const now = new Date();
      if (current?.status === 'generating' && current.leaseUntil > now) throw busy();
      if (await tx.readingAudio.findFirst({ where: { articleId: article.id, contentHash: hash, voice: READING_VOICE,
        status: 'generating', leaseUntil: { gt: now } } })) throw busy();
      if (await tx.readingAudio.count({ where: { status: 'generating', leaseUntil: { gt: now } } }) >= 2) throw busy();
      // Charge the article owner's budget even when another admin prepares library audio.
      const used = await tx.readingAudio.aggregate({ where: { article: { userId: article.userId }, createdAt: { gte: new Date(now.getTime() - 86_400_000) } }, _sum: { characterCount: true } });
      if (!current && (used._sum.characterCount ?? 0) + characterCount > 30_000) throw new HttpError(429, 'AUDIO_LIMIT', 'Đã đạt giới hạn tạo audio 30.000 ký tự trong 24 giờ.');
      const data = { contentHash: hash, status: 'generating', claimToken: randomUUID(), leaseUntil: new Date(now.getTime() + 210_000), characterCount };
      return tx.readingAudio.upsert({ where: { articleId_articleVersion_voice: key }, create: { id: randomUUID(), ...key, ...data }, update: data });
    });
    if (claim.status === 'ready') return claim;
    const directory = storagePath(claim);
    try {
      const sentences = content.paragraphs.flatMap(paragraph => paragraph.sentences).map(sentence => ({ id: sentence.id, text: sentence.japanese }));
      await mkdir(directory, { recursive: true });
      const media = readingMediaSchema.parse(await synthesize({ directory, voice: READING_VOICE, sentences }));
      let offset = 0;
      if (media.segments.length !== sentences.length) throw new Error('TTS sentence mismatch');
      for (let index = 0; index < sentences.length; index++) {
        const segment = media.segments[index];
        if (segment.sentenceId !== sentences[index].id || segment.fileName !== `${index}.mp3` || Math.abs(segment.offsetSec - offset) > 0.01) throw new Error('TTS segment mismatch');
        const file = await stat(resolve(directory, segment.fileName));
        if (!file.isFile() || file.size === 0 || file.size > 20_000_000) throw new Error('Invalid audio file');
        offset += segment.durationSec;
      }
      if (Math.abs(offset - media.totalSeconds) > 0.01) throw new Error('TTS duration mismatch');
      const latest = await db.readingArticle.findUnique({ where: { id: article.id } });
      if (!latest || latest.archivedAt || viewVersion(latest, draft) !== version || contentHash(viewContent(latest, draft)) !== hash) throw stale();
      await db.$transaction(async tx => {
        const saved = await tx.readingAudio.updateMany({ where: { id: claim.id, claimToken: claim.claimToken, status: 'generating' }, data: { status: 'ready', segments: media.segments, durationSec: media.totalSeconds } });
        if (!saved.count) throw busy();
        await tx.readingAudioFile.deleteMany({ where: { audioId: claim.id } });
        for (const { fileName } of media.segments) {
          await tx.readingAudioFile.create({ data: { audioId: claim.id, claimToken: claim.claimToken, filename: fileName, data: await readFile(resolve(directory, fileName)) } });
        }
      }, { timeout: 60000 });
      return await db.readingAudio.findUniqueOrThrow({ where: { id: claim.id } });
    } catch (error) {
      try {
        await db.readingAudio.updateMany({ where: { id: claim.id, claimToken: claim.claimToken, status: 'generating' }, data: { status: 'failed' } });
      } catch {
        // A database outage must not prevent file cleanup. The lease permits recovery later.
        console.error('Could not mark reading audio job as failed.');
      } finally {
        // Both UUID path components and the absolute storage containment were checked above.
        await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      }
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'AUDIO_UNAVAILABLE', 'Chưa tạo được audio. Bài đọc đã được lưu; vui lòng thử lại.');
    }
  }
  const audioLimit = rateLimit({ windowMs: 3_600_000, limit: 12, keyGenerator: req => req.session.userId!, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'AUDIO_LIMIT', message: 'Đã đạt giới hạn 12 yêu cầu tạo audio mỗi giờ. Vui lòng thử lại sau.' } },
  });
  router.post('/:id/audio', (req, res, next) => { account(req, res.locals.readingUser); next(); }, audioLimit, async (req, res) => {
    const user = res.locals.readingUser as LiveUser, input = versionInput.parse(req.body);
    const article = await readable(articleId(req), user), version = article.scope === 'personal' ? article.version : article.publishedVersion;
    if (article.scope === 'library' && user.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Audio bài công khai cần được quản trị viên chuẩn bị.');
    if (input.version !== version) throw stale();
    const key = `${article.id}:${version}:${READING_VOICE}`;
    let promise = inFlight.get(key);
    if (!promise) { promise = generate(article); inFlight.set(key, promise); promise.finally(() => inFlight.delete(key)).catch(() => undefined); }
    const audio = await promise;
    // A logout/account switch while a slow request runs must not disclose the private manifest.
    await new Promise<void>((accept, reject) => req.session.reload(error => error ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc.')) : accept()));
    if (req.session.userId !== user.id) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const current = await readable(article.id, user);
    if ((current.scope === 'personal' ? current.version : current.publishedVersion) !== version) throw stale();
    res.json({ userId: user.id, audio: audioDto(audio, version!) });
  });
  const serveMedia = async (req: Request, res: Response, next: NextFunction, article: ReadingArticle, draft = false) => {
    const id = z.string().uuid().parse(req.params.audioId), filename = z.string().regex(/^\d+\.mp3$/).parse(req.params.filename);
    const audio = await db.readingAudio.findUnique({ where: { id } });
    if (!audio || audio.articleId !== article.id || audio.status !== 'ready' || audio.voice !== READING_VOICE
      || audio.contentHash !== contentHash(viewContent(article, draft))) throw missing();
    const segments = readingMediaSchema.shape.segments.parse(audio.segments);
    if (!segments.some(segment => segment.fileName === filename)) throw missing();
    await ensureAudioFile(audio, filename);
    res.type('audio/mpeg');
    res.sendFile(filename, { root: storagePath(audio), dotfiles: 'deny', cacheControl: false, acceptRanges: true }, error => {
      if (error) next('statusCode' in error && error.statusCode === 404 ? missing() : 'statusCode' in error && error.statusCode === 416 ? new HttpError(416, 'INVALID_RANGE', 'Vị trí audio không hợp lệ.') : error);
    });
  };
  router.get('/:id/audio/:audioId/:filename', async (req, res, next) => {
    await serveMedia(req, res, next, await readable(articleId(req), res.locals.readingUser));
  });

  // Private learner articles are never admin library entries.
  const admin = Router();
  admin.use(requireAdmin(db), json({ limit: '128kb' }));
  const libraryDraft = async (id: string, includeArchived = false) => {
    const article = await db.readingArticle.findUnique({ where: { id } });
    if (!article || article.scope !== 'library' || (!includeArchived && article.archivedAt)) throw missing();
    return article;
  };
  const validateSource = async (sourceId: string | null) => {
    if (sourceId && !await db.contentSource.findUnique({ where: { id: sourceId } }))
      throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại.');
  };
  const adminAccount = (req: Request) => account(req, { id: req.session.userId!, role: 'admin' });
  admin.post('/preview', async (req, res) => {
    adminAccount(req);
    const { expectedUserId: _expected, ...input } = editorialInput.extend(accountInput.shape).strict().parse(req.body);
    res.json({ content: makeReadingContent(input, true) });
  });
  admin.get('/', async (req, res) => {
    z.object({}).strict().parse(req.query);
    const articles = await db.readingArticle.findMany({ where: { scope: 'library' }, orderBy: { createdAt: 'desc' } });
    res.json({ articles: await Promise.all(articles.map(article => dto(article, true))) });
  });
  admin.get('/:id', async (req, res) => {
    res.json({ article: await dto(await libraryDraft(articleId(req), true), true) });
  });
  admin.post('/', async (req, res) => {
    const userId = adminAccount(req), input = editorialInput.extend({ ...accountInput.shape, id: z.string().uuid(), sourceId: sourceInput.default(null) }).strict().parse(req.body);
    const { id, expectedUserId: _expected, sourceId, ...body } = input;
    await validateSource(sourceId);
    const content = makeReadingContent(body, true);
    const saved = await db.$transaction(async tx => {
      const created = await tx.readingArticle.createMany({ data: [{ id, userId, scope: 'library', sourceId, content }], skipDuplicates: true });
      const article = await tx.readingArticle.findUniqueOrThrow({ where: { id } });
      if (article.scope !== 'library' || article.userId !== userId || article.version !== 0 || article.archivedAt || article.sourceId !== sourceId || !isDeepStrictEqual(article.content, content)) throw stale();
      return { article, created: created.count > 0 };
    });
    res.status(saved.created ? 201 : 200).json({ userId, article: await dto(saved.article, true) });
  });
  admin.patch('/:id', async (req, res) => {
    const userId = adminAccount(req), input = readingEditorialPatch.extend({ ...versionInput.shape, sourceId: sourceInput.optional() }).strict().parse(req.body), id = articleId(req);
    const { version, expectedUserId: _expected, sourceId, ...body } = input;
    const prior = await libraryDraft(id);
    if (prior.version !== version) throw stale();
    const nextSource = sourceId === undefined ? prior.sourceId : sourceId;
    await validateSource(nextSource);
    const content = updateReadingEditorial(prior.content as unknown as ReadingContent, body);
    const result = await db.readingArticle.updateMany({ where: { id, scope: 'library', version, archivedAt: null },
      data: { content, sourceId: nextSource, version: { increment: 1 } } });
    if (!result.count) throw stale();
    res.json({ userId, article: await dto(await db.readingArticle.findUniqueOrThrow({ where: { id } }), true) });
  });
  admin.post('/:id/audio', (req, _res, next) => { adminAccount(req); next(); }, audioLimit, async (req, res) => {
    const userId = adminAccount(req), { version } = versionInput.parse(req.body), article = await libraryDraft(articleId(req));
    if (article.version !== version) throw stale();
    const key = `${article.id}:draft:${version}:${READING_VOICE}`;
    let promise = inFlight.get(key);
    if (!promise) { promise = generate(article, true); inFlight.set(key, promise); promise.finally(() => inFlight.delete(key)).catch(() => undefined); }
    const audio = await promise;
    await new Promise<void>((accept, reject) => req.session.reload(error => error ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc.')) : accept()));
    if (req.session.userId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const live = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!live || live.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Quyền quản trị đã thay đổi.');
    const current = await libraryDraft(article.id);
    if (current.version !== version) throw stale();
    res.json({ userId, audio: audioDto(audio, version, true) });
  });
  admin.get('/:id/audio/:audioId/:filename', async (req, res, next) => {
    await serveMedia(req, res, next, await libraryDraft(articleId(req)), true);
  });
  for (const operation of ['publish', 'archive', 'restore'] as const) admin.post(`/:id/${operation}`, async (req, res) => {
    const userId = adminAccount(req), { version } = versionInput.parse(req.body), id = articleId(req);
    const saved = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM reading_articles WHERE id = ${id}::uuid FOR UPDATE`;
      const article = await tx.readingArticle.findUnique({ where: { id } });
      if (!article || article.scope !== 'library') throw missing();
      if (article.version !== version || (operation === 'restore' ? !article.archivedAt : !!article.archivedAt)) throw stale();
      let data: Prisma.ReadingArticleUncheckedUpdateManyInput;
      if (operation === 'publish') {
        const content = viewContent(article, true);
        validateStoredReadingContent(content);
        if (!article.sourceId || !await tx.contentSource.findUnique({ where: { id: article.sourceId } }))
          throw new HttpError(400, 'SOURCE_REQUIRED', 'Chọn nguồn hợp lệ trước khi xuất bản.');
        if (!await readyAudio(article.id, content, tx))
          throw new HttpError(409, 'AUDIO_REQUIRED', 'Tạo audio hoàn chỉnh cho văn bản hiện tại trước khi xuất bản.');
        data = { publishedContent: article.content as Prisma.InputJsonValue, publishedVersion: version + 1,
          publishedSourceId: article.sourceId, version: { increment: 1 } };
      } else if (operation === 'archive') data = { archivedAt: new Date(), version: { increment: 1 } };
      else data = { archivedAt: null, publishedVersion: null, version: { increment: 1 } };
      if (!(await tx.readingArticle.updateMany({ where: { id, scope: 'library', version }, data })).count) throw stale();
      return tx.readingArticle.findUniqueOrThrow({ where: { id } });
    });
    res.json({ userId, article: await dto(saved, true) });
  });
  const validationErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (!(error instanceof z.ZodError) || res.headersSent) return next(error);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })) } });
  };
  admin.use(validationErrors);
  return { public: router, admin };
}
