import { Router, json, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { readingAnalysisBase } from './reading-analysis.schema.js';
import { readingAnalysisHash } from './reading-analysis.ai.js';
import { supplementInput, supplementApplyInput, supplementPayload, validateSupplements } from './reading-supplements.schema.js';
import { evaluateReadingSupplements } from './reading-supplements.ai.js';
import { readingSupplementCatalog } from './reading-supplements.catalog.js';

const missing = () => new HttpError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài đọc cá nhân của tài khoản này.');
const stale = () => new HttpError(409, 'ARTICLE_CHANGED', 'Bài đọc đã thay đổi. Hãy tải lại bài trước khi tạo hoặc lưu nội dung.');
const wrongAccount = () => new HttpError(409, 'ACCOUNT_CHANGED', 'Phiên hoặc tài khoản đã thay đổi. Hãy đăng nhập và tải lại bài.');
export function readingSupplementRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const session = async (req: Request, expected: string, reload = false) => {
    if (reload) await new Promise<void>((resolve, reject) => req.session.reload(error => error ? reject(wrongAccount()) : resolve()));
    if (!req.session.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để tạo nội dung cho bài đọc.');
    if (req.session.userId !== expected || !await db.user.findUnique({ where: { id: expected }, select: { id: true } })) throw wrongAccount();
    return expected;
  };
  const owned = async (id: string, userId: string) => {
    const row = await db.readingArticle.findUnique({ where: { id } });
    if (!row || row.scope !== 'personal' || row.userId !== userId || row.archivedAt) throw missing();
    return row;
  };
  const idOf = (req: Request) => z.string().uuid().parse(req.params.articleId).toLowerCase();
  const prepare = [(_req: Request, res: import('express').Response, next: import('express').NextFunction) => { res.set('Cache-Control', 'no-store'); next(); },
    rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Bạn gửi quá nhanh. Hãy đợi một phút.' } } }), json({ limit: '128kb' })];
  router.post('/:articleId/supplements', ...prepare, async (req, res) => {
    const input = supplementInput.parse(req.body), id = idOf(req), userId = await session(req, input.expectedUserId);
    const article = await owned(id, userId);
    if (article.version !== input.version) throw stale();
    const content = readingAnalysisBase(article.content), hash = readingAnalysisHash(content);
    const { result, cached } = await evaluateReadingSupplements(db, config, { ...input, userId, articleId: id, content });
    const catalog = await readingSupplementCatalog(db, result);
    await session(req, userId, true);
    const current = await owned(id, userId);
    if (current.version !== input.version || readingAnalysisHash(current.content) !== hash) throw stale();
    res.json({ userId, id: input.id, articleId: id, version: input.version, kind: input.kind, cached, result, catalog });
  });
  router.post('/:articleId/supplements/apply', ...prepare, async (req, res) => {
    const input = supplementApplyInput.parse(req.body), id = idOf(req), userId = await session(req, input.expectedUserId, true);
    const article = await owned(id, userId), payload = supplementPayload(input), hash = readingAnalysisHash(payload);
    // Tokenizer work is outside the DB transaction; the locked snapshot is compared before writing.
    const request = await db.readingAnalysisRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.userId !== userId || request.articleId !== id || request.purpose !== input.kind || request.baseVersion !== input.version || request.status !== 'ready') throw new HttpError(409, 'ANALYSIS_NOT_READY', 'Không tìm thấy bản xem trước hợp lệ cho thao tác này.');
    if (request.appliedVersion !== null) {
      if (request.appliedHash !== hash || article.version !== request.appliedVersion) throw stale();
      res.json({ userId, articleId: id, requestId: input.requestId, version: article.version, kind: input.kind }); return;
    }
    if (article.version !== input.version || readingAnalysisHash(article.content) !== request.baseHash) throw stale();
    const content = readingAnalysisBase(article.content);
    const result = await validateSupplements({ ...payload, warnings: [] }, content, input.kind);
    if (![...result.vocabList, ...result.grammarList, ...result.quizList].length) throw new HttpError(400, 'SUPPLEMENT_EMPTY', 'Chưa chọn nội dung nào để lưu.');
    // Quiz IDs must belong to the preview; editing/removing is allowed, creating arbitrary IDs is not.
    const prior = await validateSupplements(request.result, content, input.kind, true, true);
    if (result.vocabList.length > prior.vocabList.length || result.grammarList.length > prior.grammarList.length) throw new HttpError(400, 'SUPPLEMENT_INVALID', 'Chỉ sửa hoặc bỏ mục đã tạo trong bản xem trước.');
    if (result.quizList.some(q => !prior.quizList.some(old => old.id === q.id))) throw new HttpError(400, 'SUPPLEMENT_INVALID', 'ID câu hỏi không thuộc bản xem trước.');
    const catalog = await readingSupplementCatalog(db, result);
    const version = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM reading_articles WHERE id=${id}::uuid FOR UPDATE`;
      const current = await tx.readingArticle.findUnique({ where: { id } });
      const ledger = await tx.readingAnalysisRequest.findUniqueOrThrow({ where: { id: request.id } });
      if (!current || current.userId !== userId || current.scope !== 'personal' || current.archivedAt) throw missing();
      const liveSession = await tx.session.findUnique({ where: { sid: req.sessionID } });
      if (!liveSession || liveSession.expire <= new Date() || !liveSession.sess || typeof liveSession.sess !== 'object' || Array.isArray(liveSession.sess) || liveSession.sess.userId !== userId) throw wrongAccount();
      if (ledger.appliedVersion !== null) {
        if (ledger.appliedHash !== hash || current.version !== ledger.appliedVersion) throw stale();
        return ledger.appliedVersion;
      }
      if (current.version !== input.version || readingAnalysisHash(current.content) !== request.baseHash) throw stale();
      const next = structuredClone(content);
      if (result.groups.includes('vocab')) next.vocabList = result.vocabList.map(({ evidence, ...row }) => ({ ...row, aiEvidence: evidence }));
      if (result.groups.includes('grammar')) next.grammarList = result.grammarList.map(({ evidence, ...row }, index) => ({ ...row, jlptLevel: catalog.grammar[index]?.level ?? '', aiEvidence: evidence }));
      if (result.groups.includes('quiz')) next.quizList = result.quizList.map(({ evidence, ...row }) => ({ ...row, aiEvidence: evidence }));
      await tx.readingArticle.update({ where: { id }, data: { content: next, version: { increment: 1 } } });
      await tx.readingAnalysisRequest.update({ where: { id: request.id }, data: { appliedHash: hash, appliedVersion: input.version + 1 } });
      return input.version + 1;
    });
    await session(req, userId, true);
    res.json({ userId, articleId: id, requestId: input.requestId, version, kind: input.kind });
  });
  return router;
}
