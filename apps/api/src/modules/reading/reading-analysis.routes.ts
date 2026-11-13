import { Router, json, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { evaluateReadingAnalysis, readingAnalysisHash } from './reading-analysis.ai.js';
import { readingAnalysisInput, readingAnalysisApplyInput, readingAnalysisBase, validateReadingAnalysisApply } from './reading-analysis.schema.js';

const missing = () => new HttpError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài đọc cá nhân của tài khoản này.');
const stale = () => new HttpError(409, 'ARTICLE_CHANGED', 'Bài đọc đã thay đổi. Hãy tải lại bài trước khi phân tích hoặc lưu.');
const accountChanged = () => new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
const articleId = (req: Request) => z.string().uuid().parse(req.params.articleId).toLowerCase();

/** Mounted ahead of the normal article router; it does not widen the ordinary PATCH API. */
export function readingAnalysisRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const currentUser = async (req: Request, expectedUserId: string) => {
    const userId = req.session.userId;
    if (!userId || !await db.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để phân tích bài đọc.');
    if (userId !== expectedUserId) throw accountChanged();
    return userId;
  };
  const reloadSession = async (req: Request, userId: string) => {
    await new Promise<void>((resolve, reject) => req.session.reload(error => error
      ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')) : resolve()));
    await currentUser(req, userId);
  };
  const ownedArticle = async (id: string, userId: string) => {
    const article = await db.readingArticle.findUnique({ where: { id } });
    if (!article || article.userId !== userId || article.scope !== 'personal' || article.archivedAt) throw missing();
    return article;
  };
  const limiter = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn gửi quá nhanh. Vui lòng đợi một phút.' } } });
  const prepare = [(_req: Request, res: import('express').Response, next: import('express').NextFunction) => { res.set('Cache-Control', 'no-store'); next(); },
    limiter, json({ limit: '512kb' })];

  router.post('/:articleId/analysis', ...prepare, async (req, res) => {
    const input = readingAnalysisInput.parse(req.body), id = articleId(req);
    const userId = await currentUser(req, input.expectedUserId);
    const article = await ownedArticle(id, userId);
    if (article.version !== input.version) throw stale();
    const content = readingAnalysisBase(article.content), baseHash = readingAnalysisHash(content);
    const { result, cached } = await evaluateReadingAnalysis(db, config, { id: input.id, userId, articleId: id, version: input.version, content });
    await reloadSession(req, userId);
    const current = await ownedArticle(id, userId);
    if (current.version !== input.version || readingAnalysisHash(current.content) !== baseHash) throw stale();
    res.json({ userId, id: input.id, articleId: id, version: input.version, cached, result });
  });

  router.post('/:articleId/analysis/apply', ...prepare, async (req, res) => {
    const input = readingAnalysisApplyInput.parse(req.body), id = articleId(req);
    const userId = await currentUser(req, input.expectedUserId);
    await reloadSession(req, userId);
    const appliedHash = readingAnalysisHash(input.annotations);
    const version = await db.$transaction(async tx => {
      // Consistent row ordering serializes both same-request retries and separate previews.
      await tx.$queryRaw`SELECT id FROM reading_articles WHERE id = ${id}::uuid FOR UPDATE`;
      const article = await tx.readingArticle.findUnique({ where: { id } });
      if (!article || article.scope !== 'personal' || article.userId !== userId || article.archivedAt) throw missing();
      const request = await tx.readingAnalysisRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.userId !== userId || request.purpose !== 'annotations' || request.articleId !== id || request.baseVersion !== input.version || request.status !== 'ready') {
        throw new HttpError(409, 'ANALYSIS_NOT_READY', 'Không tìm thấy bản phân tích hợp lệ của bài này. Hãy phân tích lại.');
      }
      if (request.appliedVersion !== null) {
        if (request.appliedHash !== appliedHash) throw new HttpError(409, 'AI_REQUEST_REUSED', 'Lượt phân tích này đã lưu nội dung khác. Hãy tải lại bài.');
        if (article.version !== request.appliedVersion) throw stale();
        return request.appliedVersion;
      }
      if (article.version !== input.version || readingAnalysisHash(article.content) !== request.baseHash) throw stale();
      const original = readingAnalysisBase(article.content);
      const annotations = validateReadingAnalysisApply(input.annotations, original);
      const next = structuredClone(original);
      const nextSentences = next.paragraphs.flatMap(paragraph => paragraph.sentences);
      annotations.forEach((annotation, index) => {
        if (annotation.generatedFields.includes('translation')) nextSentences[index].translation = annotation.translation;
        if (annotation.generatedFields.includes('ruby')) nextSentences[index].ruby = annotation.ruby;
      });
      // Recheck the persisted session under the transaction immediately before the write.
      const session = await tx.session.findUnique({ where: { sid: req.sessionID } });
      if (!session || session.expire <= new Date() || !session.sess || typeof session.sess !== 'object' || Array.isArray(session.sess)
        || session.sess.userId !== userId) throw accountChanged();
      const saved = await tx.readingArticle.updateMany({ where: { id, userId, scope: 'personal', version: input.version, archivedAt: null },
        data: { content: next, version: { increment: 1 } } });
      if (!saved.count) throw stale();
      const nextVersion = input.version + 1;
      await tx.readingAnalysisRequest.update({ where: { id: request.id }, data: { appliedHash, appliedVersion: nextVersion } });
      return nextVersion;
    });
    await reloadSession(req, userId);
    res.json({ userId, articleId: id, version, requestId: input.requestId });
  });
  return router;
}
