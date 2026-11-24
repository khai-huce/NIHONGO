import { z } from 'zod';
import { groqTranscript } from '../../integrations/groq.js';
import { Prisma, type PrismaClient, type ShadowingAiRequest } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { generateShadowingTranscript, validateShadowingClip, inspectYouTube, parseYouTubeUrl, type YouTubeMetadata } from '../../integrations/shadowing-media.js';
import { assertShadowingQuota, lockGeminiQuota } from '../../integrations/gemini-quota.js';
import { accountFields, confirmShadowingAccount, setupShadowingRouter, shadowingAccount, shadowingUser } from './shadowing.routes.js';
import { hash, makeShadowingContent, shadowingDraftSchema, uuid } from './shadowing-content.js';
import { changed, missing } from './shadowing-store.js';

const dto = (request: ShadowingAiRequest) => ({ id: request.id, status: request.status, content: request.content, error: request.error });
export function shadowingAiRoutes(db: PrismaClient, config: Config) {
  const router = setupShadowingRouter(db);
  const running = new Set<Promise<void>>();
  async function expire(id: string, userId: string) {
    await db.shadowingAiRequest.updateMany({ where: { id, userId, status: 'pending', leaseUntil: { lt: new Date() } },
      data: { status: 'failed', error: 'Lượt tạo phụ đề bị gián đoạn. Bạn có thể tạo lại bằng một lượt mới.' } });
  }
  async function generate(id: string, metadata: YouTubeMetadata, input: { level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | null; description: string; audio?: string }) {
    try {
      const sentences = await generateShadowingTranscript(config, metadata).catch(async error => {
        if (!(error instanceof HttpError) || !['AI_UNAVAILABLE', 'AI_QUOTA'].includes(error.code) || !config.GROQ_API_KEY || !input.audio) throw error;
        return validateShadowingClip({ language: 'ja', cues: await groqTranscript(config.GROQ_API_KEY, input.audio) }, 0, metadata.durationMs);
      });
      const draft = shadowingDraftSchema.parse({ url: metadata.url, level: input.level, description: input.description, sentences });
      const content = await makeShadowingContent(draft, metadata);
      await db.shadowingAiRequest.updateMany({ where: { id, status: 'pending', leaseUntil: { gt: new Date() } }, data: { status: 'ready', content: content as unknown as Prisma.InputJsonValue, error: null } });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : 'Chưa tạo được phụ đề đầy đủ. Vui lòng thử lại bằng một lượt mới.';
      await db.shadowingAiRequest.updateMany({ where: { id, status: 'pending' }, data: { status: 'failed', error: message.slice(0, 1000) } }).catch(() => undefined);
    }
  }
  router.post('/', async (req, res) => {
    const userId = shadowingAccount(req, res);
    const input = shadowingDraftSchema.pick({ url: true, level: true, description: true }).extend({ ...accountFields, id: uuid, audio: z.string().min(4).max(1398104).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional() }).strict().parse(req.body);
    const canonical = parseYouTubeUrl(input.url), requestHash = hash({ youtubeId: canonical.youtubeId, level: input.level, description: input.description, ...(input.audio ? { audioHash: hash(input.audio) } : {}) });
    // An exact retry never charges quota twice and remains readable if provider credentials later change.
    let prior = await db.shadowingAiRequest.findUnique({ where: { id: input.id } });
    if (prior) {
      if (prior.userId !== userId || prior.requestHash !== requestHash) throw changed();
      await expire(input.id, userId);
      prior = await db.shadowingAiRequest.findUniqueOrThrow({ where: { id: input.id } });
      res.status(prior.status === 'pending' ? 202 : 200).json({ userId, request: dto(prior) });
      return;
    }
    if (!config.GEMINI_API_KEY || !(config.SHADOWING_GEMINI_MODEL ?? config.GEMINI_MODEL)) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'Gemini chưa được cấu hình ở máy chủ.');
    const metadata = await inspectYouTube(config, canonical.url);
    await confirmShadowingAccount(req, res, db, userId);
    const reservation = await db.$transaction(async tx => {
      await lockGeminiQuota(tx);
      const existing = await tx.shadowingAiRequest.findUnique({ where: { id: input.id } });
      if (existing) {
        if (existing.userId !== userId || existing.requestHash !== requestHash) throw changed();
        return { row: existing, created: false };
      }
      await assertShadowingQuota(tx, config, userId);
      const row = await tx.shadowingAiRequest.create({ data: { id: input.id, userId, requestHash, leaseUntil: new Date(Date.now() + 10 * 60_000) } });
      return { row, created: true };
    });
    res.status(reservation.row.status === 'pending' ? 202 : 200).json({ userId, request: dto(reservation.row) });
    if (reservation.created) {
      const job = generate(input.id, metadata, input);
      running.add(job);
      void job.finally(() => running.delete(job));
    }
  });
  router.get('/:id', async (req, res) => {
    const user = shadowingUser(res);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để xem phụ đề vừa tạo.');
    const id = uuid.parse(req.params.id);
    await expire(id, user.id);
    const request = await db.shadowingAiRequest.findFirst({ where: { id, userId: user.id } });
    if (!request) throw missing();
    res.json({ userId: user.id, request: dto(request) });
  });
  return { router, close: async () => { await Promise.allSettled([...running]); } };
}
