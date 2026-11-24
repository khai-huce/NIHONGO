import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { assistantContextHash, createAssistantAiService, parseAssistantInput, validateAssistantReply } from './assistant-ai.js';
import { getAssistantKnowledge, normalizeAssistantRoute, resolveAssistantSources, type AssistantSource } from './assistant-knowledge.js';
import { getAssistantPersonal } from './assistant-personal.js';

export function assistantRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const ai = createAssistantAiService(db, config);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn hỏi quá nhanh. Vui lòng đợi một phút.' } } }));
  router.use(json({ limit: '96kb' }));
  const currentUser = async (id?: string) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  const validateSources = (sources: AssistantSource[]) => {
    // An internal content source must never introduce an arbitrary external link.
    if (new Set(sources.map(source => source.id)).size !== sources.length
      || sources.some(source => !source.id || !source.title || !source.content || !source.url.startsWith('/') || source.url.startsWith('//') || /[\\\u0000-\u0020]/u.test(source.url))) {
      throw new HttpError(503, 'ASSISTANT_CONTEXT_UNAVAILABLE', 'Thông tin tham chiếu của trợ lý chưa sẵn sàng. Vui lòng thử lại sau.');
    }
    return sources;
  };
  const context = async (userId: string, question: string, currentRoute?: string): Promise<AssistantSource[]> => {
    const [knowledge, personal] = await Promise.all([
      getAssistantKnowledge(db, { question, currentRoute }), getAssistantPersonal(db, userId, { question }),
    ]);
    return validateSources([...personal.sources, ...knowledge].slice(0, 16));
  };
  router.post('/chat', async (req, res) => {
    const userId = await currentUser(req.session.userId);
    if (!userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để dùng trợ lý AI.');
    const input = parseAssistantInput(req.body);
    if (input.expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const currentRoute = normalizeAssistantRoute(input.currentRoute) ?? undefined;
    const sources = await context(userId, input.message, currentRoute);
    // Private reading/video IDs are valid learner routes but not public source metadata.
    const providerRoute = currentRoute && !sources.some(source => source.url === currentRoute)
      ? currentRoute.replace(/^(\/kanji|\/ngu-phap|\/tu-vung\/giao-trinh|\/tron-doi\/(?:doc-hieu|shadowing))\/.*$/, '$1') : currentRoute;
    const { reply, cached } = await ai.evaluate({ id: input.id, userId, message: input.message, history: input.history, currentRoute: providerRoute, sources });
    await new Promise<void>((resolve, reject) => req.session.reload(error => error
      ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')) : resolve()));
    if (req.session.userId !== userId || !await currentUser(userId)) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    // Re-read visibility and owner-scoped data even for memory-cache replies.
    const publicIds = sources.filter(source => source.id.startsWith('help:') || source.id.startsWith('resource:')).map(source => source.id);
    const [freshPublic, freshPersonal] = await Promise.all([
      resolveAssistantSources(db, publicIds), getAssistantPersonal(db, userId, { question: input.message }),
    ]);
    const freshById = new Map([...freshPersonal.sources, ...freshPublic].map(source => [source.id, source]));
    const freshSources = validateSources(sources.map(source => freshById.get(source.id)).filter((source): source is AssistantSource => !!source));
    if (assistantContextHash(sources) !== assistantContextHash(freshSources)) {
      throw new HttpError(409, 'AI_CONTEXT_CHANGED', 'Thông tin học hoặc nội dung tham chiếu đã thay đổi trong lúc trợ lý trả lời. Hãy gửi lại để lấy thông tin hiện tại.');
    }
    const verified = validateAssistantReply(reply, freshSources);
    const byId = new Map(freshSources.map(source => [source.id, source]));
    res.json({ userId, id: input.id, cached, reply: { text: verified.text,
      sources: verified.sourceIds.map(id => { const { title, url } = byId.get(id)!; return { id, title, url }; }),
    } });
  });
  return { router, close: ai.close };
}
