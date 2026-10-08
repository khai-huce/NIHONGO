import { Router, json, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { inspectYouTube } from '../../integrations/shadowing-media.js';
import { requireAdmin } from '../auth/admin.auth.js';
import { hash, makeShadowingContent, shadowingDraftSchema, uuid } from './shadowing-content.js';
import { changed, contentOf, lockVideo, missing, readable, readStudy, videoDto } from './shadowing-store.js';
import { installShadowingStudy } from './shadowing-study.routes.js';

type LiveUser = { id: string; role: string };
export const shadowingUser = (res: Response): LiveUser | null => res.locals.shadowingUser ?? null;
export function shadowingAccount(req: Request, res: Response): string {
  const user = shadowingUser(res);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để lưu video và tiến độ.');
  if (req.body?.expectedUserId !== user.id) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
  return user.id;
}
export async function confirmShadowingAccount(req: Request, res: Response, db: PrismaClient, userId: string, admin = false) {
  // Provider work can outlive logout or an admin demotion. Never write using the
  // account/role captured before that network call.
  await new Promise<void>((resolve, reject) => req.session.reload(error => error
    ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')) : resolve()));
  if (req.session.userId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.');
  if (admin && user.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Chỉ quản trị viên được sửa kho nội dung.');
  res.locals.shadowingUser = user;
}
export const accountFields = { expectedUserId: uuid };
export const versionFields = { ...accountFields, version: z.number().int().nonnegative() };
const sourceId = z.string().regex(/^[a-z0-9-]+$/).max(64).nullable().default(null);
const pathId = (req: Request) => uuid.parse(req.params.id);
export function setupShadowingRouter(db: PrismaClient) {
  const router = Router();
  router.use(json({ limit: '2mb' }));
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.shadowingUser = req.session.userId ? await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true, role: true } }) : null;
    next();
  });
  router.use(rateLimit({ windowMs: 60_000, limit: 150, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }));
  return router;
}
export function shadowingRoutes(db: PrismaClient, config: Config) {
  const publicRouter = setupShadowingRouter(db), admin = setupShadowingRouter(db);
  admin.use(requireAdmin(db));
  async function detail(id: string, res: Response, editorial = false) {
    const user = shadowingUser(res);
    const video = editorial ? await db.shadowingVideo.findFirst({ where: { id, scope: 'library' } }) : await readable(db, id, user?.id ?? null);
    if (!video) throw missing();
    return { userId: user?.id ?? null, video: videoDto(video, editorial), study: !editorial && user ? await readStudy(db, user.id, id) : null };
  }
  async function verifySource(id: string | null) {
    if (id && !await db.contentSource.findUnique({ where: { id } })) throw new HttpError(400, 'SHADOWING_SOURCE', 'Nguồn nội dung chưa tồn tại.');
  }
  for (const [router, editorial] of [[publicRouter, false], [admin, true]] as const) {
    router.get('/', async (req, res) => {
      z.object({}).strict().parse(req.query);
      const user = shadowingUser(res);
      const rows = await db.shadowingVideo.findMany({ where: editorial ? { scope: 'library' } : { archivedAt: null, OR: [
        { scope: 'library', publishedVersion: { not: null } }, ...(user ? [{ scope: 'personal', ownerId: user.id }] : []),
      ] }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
      res.json({ userId: user?.id ?? null, items: rows.map(row => { const { content: _content, sourceId: _sourceId, publishedVersion: _publishedVersion, ...summary } = videoDto(row, editorial); return summary; }) });
    });
    router.post('/prepare', async (req, res) => {
      const userId = shadowingAccount(req, res);
      const input = shadowingDraftSchema.extend(accountFields).strict().parse(req.body);
      const metadata = await inspectYouTube(config, input.url);
      const content = await makeShadowingContent(input, metadata);
      await confirmShadowingAccount(req, res, db, userId, editorial);
      res.json({ userId, content });
    });
    router.post('/', async (req, res) => {
      const userId = shadowingAccount(req, res);
      const schema = shadowingDraftSchema.extend({ ...accountFields, id: uuid, transcriptReviewed: z.boolean().optional(), ...(editorial ? { sourceId } : {}) }).strict();
      const input = schema.parse(req.body);
      if (!editorial && (input.transcriptReviewed !== true || !input.sentences.length)) throw new HttpError(400, 'SHADOWING_REVIEW_REQUIRED', 'Hãy nhập ít nhất một câu và xác nhận đã rà soát phụ đề trước khi lưu.');
      const selectedSource = 'sourceId' in input ? input.sourceId as string | null : null;
      await verifySource(selectedSource);
      const metadata = await inspectYouTube(config, input.url), content = await makeShadowingContent(input, metadata);
      await confirmShadowingAccount(req, res, db, userId, editorial);
      const initialHash = hash({ content, sourceId: selectedSource });
      const created = await db.$transaction(async tx => {
        const result = await tx.shadowingVideo.createMany({ data: [{ id: input.id, ownerId: editorial ? null : userId, scope: editorial ? 'library' : 'personal',
          content: content as unknown as Prisma.InputJsonValue, initialHash, sourceId: selectedSource }], skipDuplicates: true });
        const row = await tx.shadowingVideo.findUniqueOrThrow({ where: { id: input.id } });
        if (row.scope !== (editorial ? 'library' : 'personal') || row.ownerId !== (editorial ? null : userId) || row.version !== 0 || row.archivedAt || row.initialHash !== initialHash) throw changed();
        return result.count;
      });
      res.status(created ? 201 : 200).json(await detail(input.id, res, editorial));
    });
    router.get('/:id', async (req, res) => { res.json(await detail(pathId(req), res, editorial)); });
    router.patch('/:id', async (req, res) => {
      const userId = shadowingAccount(req, res), id = pathId(req);
      const input = shadowingDraftSchema.extend({ ...versionFields, transcriptReviewed: z.boolean().optional(), ...(editorial ? { sourceId } : {}) }).strict().parse(req.body);
      if (!editorial && (input.transcriptReviewed !== true || !input.sentences.length)) throw new HttpError(400, 'SHADOWING_REVIEW_REQUIRED', 'Hãy nhập ít nhất một câu và xác nhận đã rà soát phụ đề trước khi lưu.');
      const prior = await db.shadowingVideo.findFirst({ where: { id, scope: editorial ? 'library' : 'personal', ...(editorial ? {} : { ownerId: userId }), archivedAt: null } });
      if (!prior) throw missing();
      if (prior.version !== input.version) throw changed();
      const selectedSource = 'sourceId' in input ? input.sourceId as string | null : null;
      await verifySource(selectedSource);
      const metadata = await inspectYouTube(config, input.url), content = await makeShadowingContent(input, metadata);
      await confirmShadowingAccount(req, res, db, userId, editorial);
      if (!(await db.shadowingVideo.updateMany({ where: { id, version: input.version, archivedAt: null }, data: { content: content as unknown as Prisma.InputJsonValue, sourceId: selectedSource, version: { increment: 1 } } })).count) throw changed();
      res.json(await detail(id, res, editorial));
    });
    router.post('/:id/archive', async (req, res) => {
      const userId = shadowingAccount(req, res), id = pathId(req), input = z.object(versionFields).strict().parse(req.body);
      await confirmShadowingAccount(req, res, db, userId, editorial);
      const updated = await db.shadowingVideo.updateMany({ where: { id, version: input.version, scope: editorial ? 'library' : 'personal', ...(editorial ? {} : { ownerId: userId }), archivedAt: null }, data: { archivedAt: new Date(), version: { increment: 1 } } });
      if (!updated.count) throw changed();
      const video = await db.shadowingVideo.findUniqueOrThrow({ where: { id } });
      res.json({ userId, video: videoDto(video, true), study: null });
    });
  }
  admin.post('/:id/publish', async (req, res) => {
    const userId = shadowingAccount(req, res);
    const id = pathId(req), input = z.object({ ...versionFields, transcriptReviewed: z.literal(true) }).strict().parse(req.body);
    // Check availability once more immediately before publication; no network request runs inside the transaction.
    const prior = await db.shadowingVideo.findFirst({ where: { id, scope: 'library', archivedAt: null } });
    if (!prior) throw missing();
    if (prior.version !== input.version) throw changed();
    const content = contentOf(prior, true);
    if (!prior.sourceId || !content.sentences.length) throw new HttpError(400, 'SHADOWING_PUBLISH_REQUIRED', 'Xuất bản cần nguồn nội dung và ít nhất một câu phụ đề đã rà soát.');
    const metadata = await inspectYouTube(config, `https://www.youtube.com/watch?v=${content.youtubeId}`);
    if (metadata.durationMs !== content.durationMs) throw new HttpError(409, 'SHADOWING_METADATA_CHANGED', 'Thời lượng video đã thay đổi. Hãy chuẩn bị và rà soát lại phụ đề.');
    await confirmShadowingAccount(req, res, db, userId, true);
    await db.$transaction(async tx => {
      await lockVideo(tx, id);
      const video = await tx.shadowingVideo.findUniqueOrThrow({ where: { id } });
      if (video.version !== input.version || video.archivedAt) throw changed();
      await tx.shadowingVideo.update({ where: { id }, data: { publishedContent: video.content as Prisma.InputJsonValue, publishedSourceId: video.sourceId, publishedVersion: video.version + 1, version: { increment: 1 } } });
    });
    res.json(await detail(id, res, true));
  });
  admin.post('/:id/restore', async (req, res) => {
    const userId = shadowingAccount(req, res);
    const id = pathId(req), input = z.object(versionFields).strict().parse(req.body);
    await confirmShadowingAccount(req, res, db, userId, true);
    const result = await db.shadowingVideo.updateMany({ where: { id, scope: 'library', version: input.version, archivedAt: { not: null } },
      data: { archivedAt: null, publishedContent: Prisma.DbNull, publishedSourceId: null, publishedVersion: null, version: { increment: 1 } } });
    if (!result.count) throw changed();
    res.json(await detail(id, res, true));
  });
  installShadowingStudy(publicRouter, db);
  return { public: publicRouter, admin };
}
